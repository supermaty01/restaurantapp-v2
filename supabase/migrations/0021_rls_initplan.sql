-- `auth.uid()` deja de evaluarse una vez por fila. Verificar con `npm run db:test`.
--
-- Postgres trata `auth.uid()` dentro de una política como algo que puede dar un
-- valor distinto en cada fila, así que **la llama por cada fila que examina**.
-- En una tabla de diez entradas da igual; en el diario de alguien que lleva años
-- apuntando comidas, cada consulta paga miles de llamadas a una función que iba
-- a devolver exactamente lo mismo todas las veces.
--
-- Envolverla en un subselect —`(select auth.uid())`— la convierte en un
-- InitPlan: se evalúa una vez, al principio, y el resultado se reutiliza. Es la
-- optimización que Supabase documenta como `auth_rls_initplan`, y de las 27
-- políticas del proyecto no la tenía ninguna.
--
-- No cambia lo que cada política permite: `(select f())` y `f()` devuelven lo
-- mismo. Lo que cambia es cuántas veces se pregunta. Los 154 asserts de
-- `npm run db:test` son la prueba de que el comportamiento es idéntico — se
-- escribieron antes que esto y siguen pasando después.
--
-- ── Por qué generada y no escrita a mano ─────────────────────────────────────
--
-- Veintisiete políticas repartidas por nueve migraciones. Copiarlas a mano es
-- veintisiete oportunidades de cambiar una condición sin querer mientras se
-- reescribe, y una política de seguridad mal transcrita no falla: deja pasar.
--
-- Reconstruirlas desde `pg_policies` usa como fuente lo que la base **tiene**,
-- no lo que uno cree recordar que tiene. La sustitución es textual y acotada, y
-- lo que queda intacto (tabla, comando, roles, forma de la condición) no pasa
-- por ninguna mano.
do $$
declare
  policy record;
  new_qual text;
  new_check text;
  statement text;
  touched int := 0;
begin
  for policy in
    select
      schemaname,
      tablename,
      policyname,
      cmd,
      -- `roles` llega como name[]; `{public}` es lo normal aquí.
      array_to_string(roles, ', ') as role_list,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
      -- Las que ya están envueltas se dejan en paz. Postgres las muestra como
      -- `( SELECT auth.uid() AS uid)`, así que basta con mirar si hay un select.
      and coalesce(qual, '') not like '%SELECT auth.uid()%'
      and coalesce(with_check, '') not like '%SELECT auth.uid()%'
  loop
    new_qual := replace(policy.qual, 'auth.uid()', '(select auth.uid())');
    new_check := replace(policy.with_check, 'auth.uid()', '(select auth.uid())');

    execute format('drop policy %I on %I.%I', policy.policyname, policy.schemaname, policy.tablename);

    statement := format(
      'create policy %I on %I.%I for %s to %s',
      policy.policyname, policy.schemaname, policy.tablename, policy.cmd, policy.role_list
    );

    -- Un INSERT no lleva USING y un SELECT/DELETE no lleva WITH CHECK; añadir
    -- el que no toca es un error de sintaxis, no una política más estricta.
    if new_qual is not null then
      statement := statement || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      statement := statement || format(' with check (%s)', new_check);
    end if;

    execute statement;
    touched := touched + 1;
  end loop;

  raise notice 'initplan: % politicas reescritas', touched;
end;
$$;

-- ── Índices que dejaron de usarse en 0017 ───────────────────────────────────
--
-- 0001 los creó con el comentario «las consultas de pull filtran por
-- updated_at». 0017 cambió el pull a `sync_seq` —porque `updated_at` lo pone el
-- móvil que escribió, y con dos dispositivos y los relojes desfasados había
-- filas que no se bajaban nunca— y creó `(user_id, sync_seq)`.
--
-- Los seis originales llevan desde entonces sin que nadie los consulte, y un
-- índice que nadie lee sigue cobrando: cada insert y cada update lo mantienen al
-- día. En la tabla que más escribe el sync eso es peaje puro.
drop index if exists restaurants_user_updated_idx;
drop index if exists dishes_user_updated_idx;
drop index if exists visits_user_updated_idx;
drop index if exists tags_user_updated_idx;
drop index if exists people_user_updated_idx;
drop index if exists images_user_updated_idx;
