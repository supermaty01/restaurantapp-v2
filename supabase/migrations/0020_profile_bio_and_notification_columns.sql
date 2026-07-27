-- Dos filtraciones pequeñas que la auditoría encontró. Verificar con `npm run db:test`.
--
-- Las dos son de la misma familia: una función cuidadosa por delante y una
-- política de tabla generosa por detrás. El cuidado no sirve de nada si la
-- puerta de al lado está abierta, y PostgREST expone las tablas directamente.

-- ── 1. La bio se leía saltándose la regla que la protege ─────────────────────
--
-- `user_profile()` (0007) decide con cuidado quién ve la biografía:
--
--     case when friendship_state(p.user_id) in ('friends', 'self') then p.bio end
--
-- «La bio es parte de la cara pública, pero solo cuando ya puedes ver el
-- contenido de la persona; para un desconocido la página se queda en un nombre
-- y un handle», dice el comentario. Pero la política de 0002 es:
--
--     create policy profiles_public_read on profiles
--       for select using (auth.role() = 'authenticated')
--
-- A nivel de tabla y **sin restricción de columnas**. Así que
-- `GET /rest/v1/profiles?select=bio` devolvía la biografía de cualquiera, y la
-- comprobación de la RPC era una formalidad que se esquivaba cambiando de
-- endpoint. El propio comentario de 0002 dice «solo username/display_name/avatar
-- se exponen», que nunca fue lo que hacía el código.
--
-- Postgres no sabe restringir columnas dentro de una policy, así que la tabla
-- deja de ser legible por terceros y en su lugar va una vista con las columnas
-- públicas.
--
-- **Y esta vista va con derechos de definidor, al revés que la de 0005.** Vale
-- la pena decir por qué, porque 0005 arregló precisamente lo contrario y quien
-- lea aquello primero va a pensar que esto es el mismo fallo repetido.
--
-- Lo que 0005 tenía roto era una vista que se saltaba un filtro **de filas**: el
-- feed debía enseñar solo lo de tus amigos, y con derechos de definidor enseñaba
-- lo de todo el mundo. Ahí `security_invoker` era la respuesta porque la
-- pregunta era «¿qué filas puede ver esta persona?».
--
-- Aquí no hay filtro de filas que respetar: **todos los perfiles son buscables a
-- propósito**, o no habría forma de encontrar a nadie para agregarlo. Lo que hay
-- que filtrar son las **columnas**, y eso lo hace la propia lista del `select`.
-- Con `security_invoker` la vista heredaría la política de abajo y no
-- devolvería ninguna fila ajena, que es justo lo que rompe la búsqueda.
--
-- Dicho de otra forma: la vista *es* el control de acceso, y por eso no lleva ni
-- `bio` ni ninguna columna futura que no se haya decidido publicar.
drop policy if exists profiles_public_read on profiles;

create or replace view public_profiles as
  select user_id, username, display_name, avatar_url, created_at
  from profiles;

-- La tabla en crudo solo se lee a uno mismo. Lo público de los demás sale por la
-- vista; lo privado, por ninguna parte.
create policy profiles_self_read on profiles
  for select using (user_id = (select auth.uid()));

grant select on public_profiles to authenticated;

-- `search_users` y compañía son `security definer`, así que siguen leyendo
-- `profiles` entera por dentro y eligiendo qué devuelven. Eso no cambia: son
-- justo el sitio donde la decisión debe vivir.

-- ── 2. Marcar un aviso permitía reescribirlo entero ──────────────────────────
--
-- 0016 dice, literalmente: «Solo tuyas, y solo de lectura y marcado: nadie
-- inserta avisos a mano desde el cliente». La política de lectura cumple. La de
-- escritura es un `for update` sin restricción de columnas, así que el cliente
-- podía reescribir `kind`, `actor_id`, `visit_uuid` y `pushed_at` de sus propios
-- avisos — incluido poner `pushed_at` a null para hacer que el Worker se los
-- reenviara.
--
-- El daño se lo hace uno a sí mismo, así que no es urgente. Pero una política
-- que no dice lo que su comentario promete es una que alguien va a leer y creer.
--
-- Se cierra con un trigger en vez de con una política, porque Postgres tampoco
-- sabe acotar columnas en un `update`: lo único que un cliente puede cambiar de
-- su aviso es haberlo leído.
create or replace function notifications_only_read_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El Worker entra con la clave de servidor, que no pasa por RLS ni por aquí.
  -- Esto acota al cliente, que es quien tiene el token de usuario.
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.kind is distinct from old.kind
     or new.actor_id is distinct from old.actor_id
     or new.visit_uuid is distinct from old.visit_uuid
     or new.created_at is distinct from old.created_at
     or new.pushed_at is distinct from old.pushed_at
  then
    raise exception 'de un aviso solo se puede cambiar read_at';
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_guard on notifications;
create trigger notifications_guard
  before update on notifications
  for each row execute function notifications_only_read_at();

-- ── 3. `reject_older_update` sin search_path ─────────────────────────────────
--
-- Es el único de los cuarenta y tantos que no lo llevaba. No es `security
-- definer`, así que el riesgo real es bajo, pero el linter de Supabase lo marca
-- (`function_search_path_mutable`) y un aviso permanente que se sabe que hay que
-- ignorar es como se aprende a ignorar la lista entera.
create or replace function reject_older_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.updated_at < old.updated_at then
    return null; -- skip the update, keep the newer stored row
  end if;
  return new;
end;
$$;
