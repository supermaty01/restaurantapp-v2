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
-- 1. Pon tu uuid abajo. Lo encuentras en Supabase > Authentication > Users.
-- 2. Ejecuta primero el bloque de RECUENTO y mira los números.
-- 3. Solo si cuadran, ejecuta el bloque de BORRADO.
--
-- Ejecútalo en el SQL Editor de Supabase. Ahí corres como `postgres`, que se
-- salta RLS: el `where user_id = :cuenta` de cada sentencia es lo único que
-- impide tocar filas de otra persona. No lo quites.

\set cuenta '00000000-0000-0000-0000-000000000000'  -- ← TU UUID AQUÍ

-- ── RECUENTO (no borra nada) ────────────────────────────────────────────────
select 'restaurantes' as tabla, count(*) from restaurants where user_id = :'cuenta'
union all select 'platos',        count(*) from dishes            where user_id = :'cuenta'
union all select 'visitas',       count(*) from visits            where user_id = :'cuenta'
union all select 'etiquetas',     count(*) from tags              where user_id = :'cuenta'
union all select 'personas',      count(*) from people            where user_id = :'cuenta'
union all select 'imágenes',      count(*) from images            where user_id = :'cuenta'
union all select 'participantes', count(*) from visit_participant where user_id = :'cuenta'
union all select 'enlaces compartidos', count(*) from share_links where owner_id = :'cuenta'
order by 1;

-- ── BORRADO ─────────────────────────────────────────────────────────────────
-- En transacción: si algo falla a mitad, no queda un diario a medio borrar.
begin;

-- Las uniones primero. Aunque las claves foráneas van con `on delete cascade`,
-- borrarlas explícitamente deja claro qué se está tocando y no depende de que
-- el cascade esté donde uno cree.
delete from restaurant_tag    where user_id = :'cuenta';
delete from dish_tag          where user_id = :'cuenta';
delete from dish_visit        where user_id = :'cuenta';
delete from visit_participant where user_id = :'cuenta';

-- Las etiquetas que OTROS te pusieron y rechazaste. Son tuyas, no de ellos.
delete from tag_rejections    where user_id = :'cuenta';

-- Los datos. Visitas antes que restaurantes: las visitas apuntan al sitio.
delete from images            where user_id = :'cuenta';
delete from visits            where user_id = :'cuenta';
delete from dishes            where user_id = :'cuenta';
delete from restaurants       where user_id = :'cuenta';
delete from tags              where user_id = :'cuenta';
delete from people            where user_id = :'cuenta';

delete from share_links       where owner_id = :'cuenta';
delete from ai_usage          where user_id = :'cuenta';

-- ── Lo que se conserva a propósito ──────────────────────────────────────────
-- `profiles`      tu nombre de usuario. Borrarlo puede dejártelo cogido por
--                 otra persona, y la app lo recrea vacío al entrar.
-- `friendships`   tus amistades. Vaciar el diario no es dejar de conocer a
--                 nadie, y rehacerlas requiere que la otra persona acepte.
-- `visibility_defaults`  tus ajustes de privacidad.
--
-- Si de verdad quieres empezar de cero también en eso, descomenta:
-- delete from visibility_defaults where user_id = :'cuenta';
-- delete from friendships where :'cuenta' in (user_a::text, user_b::text);
-- delete from profiles    where user_id = :'cuenta';

commit;

-- Comprueba que quedó en cero volviendo a ejecutar el bloque de RECUENTO.
