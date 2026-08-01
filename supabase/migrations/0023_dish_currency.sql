-- La moneda de un plato, en el espejo.
--
-- El razonamiento entero esta en la migracion local `0013_dish_currency.sql`;
-- aqui solo la parte que tiene que existir para que el dato viaje: la columna,
-- el reparto de lo que ya hay, y la unica funcion que devuelve precios a otro
-- dispositivo (`visit_detail`), que sin esto entregaba un numero sin unidad y
-- quien lo recibia lo pintaba con **su** moneda.
--
-- El reparto es el mismo y por el mismo motivo: la app solo se ha usado en
-- Colombia y en Europa, asi que el propio numero distingue los dos casos. Por
-- debajo de mil, euros; de mil en adelante, pesos. Es una heuristica, esta
-- escrito que lo es, y no parte ningun caso real -- no hay platos de mil euros
-- ni de novecientos pesos.
--
-- **Se ejecuta a los dos lados y sobre las mismas filas**, asi que la fila local
-- y su espejo salen con la misma moneda y la reconciliacion por fecha no tiene
-- nada que decidir. Si solo se hiciera aqui, el primer push de cada dispositivo
-- machacaria el reparto con un null.
--
-- Sin restriccion `check` que exija los dos a la vez, a proposito: la
-- reconciliacion escribe fila a fila desde clientes que pueden ir por delante o
-- por detras de esta migracion, y una fila rechazada por el espejo no es un
-- aviso -- es un push que falla entero y un diario que deja de subir. La regla
-- «precio y moneda van juntos» se aplica donde se escribe (`dish-schema.ts`).

alter table dishes add column if not exists currency text;

update dishes
  set currency = case when price < 1000 then 'EUR' else 'COP' end
  where price is not null and currency is null;

-- `visit_detail` es el unico sitio donde un precio sale hacia otra persona: la
-- pantalla de una visita compartida. El resto de funciones sociales
-- (`feed_page`, `user_entries_page`) no devuelven precios.
--
-- Se reescribe entera y no se parchea porque Postgres no sabe editar el cuerpo
-- de una funcion. Es identica a la de 0014 salvo por la clave `currency`.
create or replace function visit_detail(target uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when can_read_visit(target) then (
    select json_build_object(
      'uuid', v.uuid,
      'visited_at', v.visited_at,
      'comments', v.comments,
      'visibility', effective_visibility(v.visibility, v.user_id, 'visit'),
      'created_at', v.created_at,
      'author', json_build_object(
        'user_id', p.user_id, 'username', p.username,
        'display_name', p.display_name, 'avatar_url', p.avatar_url
      ),
      'restaurant', (
        select json_build_object(
          'uuid', r.uuid, 'name', r.name,
          'latitude', r.latitude, 'longitude', r.longitude,
          'rating', case when is_shared(r.visibility, r.user_id, 'restaurant') then r.rating end,
          'comments', case when is_shared(r.visibility, r.user_id, 'restaurant') then r.comments end
        )
        from restaurants r
        where r.uuid = v.restaurant_uuid and r.deleted = false
      ),
      'dishes', coalesce((
        select json_agg(json_build_object(
          'uuid', d.uuid, 'name', d.name, 'price', d.price, 'currency', d.currency,
          'rating', d.rating,
          'comments', d.comments,
          'image_key', (
            select i.remote_key from images i
            where i.dish_uuid = d.uuid and i.deleted = false and i.remote_key is not null
            order by i.created_at limit 1
          )
        ) order by d.name)
        from dish_visit dv
        join dishes d on d.uuid = dv.dish_uuid and d.deleted = false
        where dv.visit_uuid = v.uuid
      ), '[]'::json),
      'images', coalesce((
        select json_agg(i.remote_key order by i.created_at)
        from images i
        where i.visit_uuid = v.uuid and i.deleted = false and i.remote_key is not null
      ), '[]'::json),
      'people', coalesce((
        select json_agg(json_build_object(
          'name', pe.name, 'account_uuid', pe.linked_user_id, 'username', pe.username
        ) order by pe.name)
        from visit_participant vp
        join people pe on pe.uuid = vp.person_uuid and pe.deleted = false
        where vp.visit_uuid = v.uuid
      ), '[]'::json)
    )
    from visits v
    join profiles p on p.user_id = v.user_id
    where v.uuid = target
  ) end;
$$;
