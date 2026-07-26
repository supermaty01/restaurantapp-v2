-- Vaciar el diario de UNA cuenta en el espejo de Postgres.
--
-- Esto no se deshace. No hay papelera, y el borrado suave del sync no aplica
-- aquí: son DELETE de verdad.
--
-- ── Antes de ejecutarlo ──────────────────────────────────────────────────────
-- Haz una copia desde la app (Ajustes > copia de seguridad) y sácala del
-- teléfono. El espejo no es tu copia de seguridad: es una réplica de lo que
-- tiene el móvil, y en cuanto vacíes uno de los dos el otro deja de tener con
-- qué reconstruirlo.
--
-- ── Cómo usarlo ─────────────────────────────────────────────────────────────
-- Pega tu uuid en los DOS sitios marcados «TU UUID AQUÍ». Lo encuentras en
-- Supabase > Authentication > Users.
--
-- 1. Ejecuta el bloque de RECUENTO y mira los números.
-- 2. Solo si cuadran, ejecuta el bloque de BORRADO.
--
-- Escrito para el **SQL Editor de Supabase**, que no es psql: no admite `\set`
-- ni `:variables`. Por eso el uuid va literal y el borrado va dentro de un
-- bloque `do`, que es donde Postgres sí deja declarar una variable.
--
-- En el editor corres como `postgres`, que se salta RLS. El filtro por cuenta
-- de cada sentencia es lo único que impide tocar filas de otra persona.


-- ═══ 1. RECUENTO (no borra nada) ════════════════════════════════════════════
with me as (select '00000000-0000-0000-0000-000000000000'::uuid as id)  -- ← TU UUID AQUÍ
select 'restaurantes' as tabla, count(*) from restaurants, me where user_id = me.id
union all select 'platos',        count(*) from dishes, me            where user_id = me.id
union all select 'visitas',       count(*) from visits, me            where user_id = me.id
union all select 'etiquetas',     count(*) from tags, me              where user_id = me.id
union all select 'personas',      count(*) from people, me            where user_id = me.id
union all select 'imagenes',      count(*) from images, me            where user_id = me.id
union all select 'participantes', count(*) from visit_participant, me where user_id = me.id
union all select 'enlaces',       count(*) from share_links, me       where owner_id = me.id
order by 1;


-- ═══ 2. BORRADO ═════════════════════════════════════════════════════════════
-- Un bloque `do` es implícitamente una transacción: si algo falla a mitad, no
-- queda un diario a medio borrar.
do $$
declare
  cuenta uuid := '00000000-0000-0000-0000-000000000000';  -- ← TU UUID AQUÍ
  restantes int;
begin
  -- El guard comprueba que la cuenta EXISTE, no que sea distinta del hueco.
  --
  -- La primera versión comparaba contra el uuid de ejemplo, y eso se rompe
  -- solo: lo natural es hacer buscar-y-reemplazar del hueco, lo que cambia
  -- también el literal de la comparación y deja el guard siempre verdadero --
  -- el script se negaba a hacer nada incluso bien rellenado. Así, además, un
  -- uuid mal copiado se detiene aquí en vez de borrar cero filas en silencio y
  -- dar la impresión de que ya estaba vacío.
  if not exists (select 1 from auth.users where id = cuenta) then
    raise exception 'No existe ninguna cuenta con el uuid %. Revísalo en Authentication > Users.', cuenta;
  end if;

  -- Las uniones primero. Aunque las claves foráneas van con `on delete
  -- cascade`, borrarlas explícitamente deja claro qué se está tocando y no
  -- depende de que el cascade esté donde uno cree que está.
  delete from restaurant_tag    where user_id = cuenta;
  delete from dish_tag          where user_id = cuenta;
  delete from dish_visit        where user_id = cuenta;
  delete from visit_participant where user_id = cuenta;

  -- Las etiquetas que OTROS te pusieron y rechazaste. Son tuyas, no de ellos.
  delete from tag_rejections    where user_id = cuenta;

  -- Los datos. Visitas antes que restaurantes: las visitas apuntan al sitio.
  delete from images            where user_id = cuenta;
  delete from visits            where user_id = cuenta;
  delete from dishes            where user_id = cuenta;
  delete from restaurants       where user_id = cuenta;
  delete from tags              where user_id = cuenta;
  delete from people            where user_id = cuenta;

  delete from share_links       where owner_id = cuenta;
  delete from ai_usage          where user_id = cuenta;

  -- ── Lo que se conserva a propósito ────────────────────────────────────────
  -- profiles             tu nombre de usuario. Borrarlo puede dejartelo cogido
  --                      por otra persona, y la app lo recrea vacio al entrar.
  -- friendships          vaciar el diario no es dejar de conocer a nadie, y
  --                      rehacerlas requiere que la otra persona acepte.
  -- visibility_defaults  tus ajustes de privacidad.
  --
  -- Si de verdad quieres empezar de cero tambien en eso, descomenta:
  -- delete from visibility_defaults where user_id = cuenta;
  -- delete from friendships where cuenta in (user_a, user_b);
  -- delete from profiles    where user_id = cuenta;

  select count(*) into restantes from restaurants where user_id = cuenta;
  raise notice 'Listo. Restaurantes que quedan: %', restantes;
end;
$$;

-- Vuelve a ejecutar el bloque de RECUENTO para confirmar que quedó en cero.
--
-- ── Verificado ──────────────────────────────────────────────────────────────
-- Ejecutado contra una base con las migraciones 0001-0014 y dos cuentas con
-- datos: vacía la cuenta indicada, deja intacta la otra, conserva el perfil, y
-- se niega a hacer nada si el uuid no corresponde a ninguna cuenta.
