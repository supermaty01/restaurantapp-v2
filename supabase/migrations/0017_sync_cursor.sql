-- El pull deja de depender del reloj de los moviles. Verificar con `npm run db:test`.
--
-- El bug: `updated_at` en las tablas espejo lo pone el cliente (0001 lo declara
-- `not null` y sin default a proposito, porque es lo que compara el
-- last-write-wins). El motor paginaba el pull con ese mismo valor: guardaba
-- `max(updated_at)` de lo recibido como cursor y luego pedia `updated_at >
-- cursor`.
--
-- Con un solo dispositivo eso funciona por casualidad. Con dos deja de hacerlo:
-- si el movil B tiene el reloj cinco minutos atrasado, escribe filas con un
-- `updated_at` anterior al cursor que el movil A ya guardo, y **A no las baja
-- nunca**. Sin error, sin reintento, sin nada que lo delate. Para algo que se
-- vende como copia de seguridad, perder filas en silencio es el peor fallo
-- posible.
--
-- Y no hace falta que los relojes esten mal a proposito: basta el desfase normal
-- entre dos telefonos, o un cambio de zona horaria, o que uno estuviera sin red
-- y sincronice tarde.
--
-- La separacion que faltaba es entre dos preguntas distintas:
--
--   * "cual de estas dos versiones es la buena" -> `updated_at`, el reloj de
--     quien escribio. Sigue igual, y sigue siendo lo que compara el trigger
--     `reject_older_update`.
--   * "que ha cambiado desde la ultima vez que mire" -> tiene que contestarlo
--     el servidor, que es el unico reloj que ven todos los dispositivos.
--
-- Una secuencia y no un timestamp: `now()` dentro de una transaccion devuelve el
-- instante en que empezo, asi que dos transacciones solapadas pueden grabar el
-- mismo valor y una puede hacerse visible despues de que otro dispositivo haya
-- guardado ese valor como cursor -- la fila se salta igual. `nextval` es
-- monotona y unica por fila tocada, y no tiene nada que ver con ningun reloj.

create sequence if not exists sync_seq;

-- Compartida por todas las tablas, no una por tabla. El cursor sigue siendo por
-- tabla, asi que una secuencia comun solo deja huecos en cada una, que es
-- exactamente lo que un cursor `>` espera encontrar.
create or replace function stamp_sync_seq()
returns trigger
language plpgsql
as $$
begin
  new.sync_seq := nextval('sync_seq');
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'restaurants', 'tags', 'dishes', 'visits', 'people', 'images',
    'restaurant_tag', 'dish_tag', 'dish_visit', 'visit_participant'
  ] loop
    -- Las filas que ya existen reciben un valor de la secuencia por el default,
    -- asi que un dispositivo con cursor nulo (una restauracion) las ve todas.
    execute format(
      'alter table %I add column if not exists sync_seq bigint not null default nextval(''sync_seq'')',
      t
    );

    -- El default solo cubre el insert. Sin el trigger, editar una fila no
    -- cambiaria su sync_seq y el otro dispositivo no se enteraria de la edicion.
    execute format('drop trigger if exists %I on %I', t || '_sync_seq', t);
    execute format(
      'create trigger %I before insert or update on %I '
      'for each row execute function stamp_sync_seq()',
      t || '_sync_seq', t
    );

    -- El indice es lo que hace barato el `where sync_seq > cursor order by
    -- sync_seq`, que es la consulta que corre en cada pasada de cada dispositivo.
    execute format(
      'create index if not exists %I on %I (user_id, sync_seq)',
      t || '_sync_seq_idx', t
    );
  end loop;
end;
$$;

-- ── Conteos para comparar con el movil ───────────────────────────────────────
-- Lo que hace falta para poder decir "faltan N por bajar": sin esto la app no
-- tiene forma de saber si su copia esta completa, solo de esperar que si.
create or replace function sync_counts()
returns table (table_name text, rows bigint, max_seq bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t text;
begin
  foreach t in array array[
    'restaurants', 'tags', 'dishes', 'visits', 'people', 'images'
  ] loop
    return query execute format(
      'select %L::text, count(*)::bigint, coalesce(max(sync_seq), 0)::bigint '
      'from %I where user_id = auth.uid() and deleted = false',
      t, t
    );
  end loop;
end;
$$;

do $$
begin
  execute 'revoke execute on function sync_counts() from public';
  execute 'grant execute on function sync_counts() to authenticated';
end;
$$;
