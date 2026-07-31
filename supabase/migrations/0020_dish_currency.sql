-- La moneda vive en el plato. Verificar con `npm run db:test`.
--
-- El espejo guardaba `price` como un numero sin unidad y la app lo pintaba
-- siempre en pesos colombianos, que era la unica moneda escrita en el codigo. Un
-- diario de comidas viaja: el mismo cuaderno tiene un menu del dia en Madrid y
-- un corrientazo en Bogota, y con una moneda global la mitad de los precios
-- estaban mal etiquetados -- tanto en el diario propio como en toda visita
-- compartida, donde el numero llega a otra persona sin nada que lo explique.
--
-- El ajuste general no desaparece: pasa a ser lo que se propone al escribir un
-- precio nuevo, y se **copia** en la fila al guardar. A diferencia del `default`
-- de visibilidad, que se resuelve al leer para que cambiar el ajuste mueva lo ya
-- escrito, aqui cambiar de pais no puede reescribir lo que pagaste el mes
-- pasado. Por eso vive solo en el movil (`app_settings`) y no aqui: el servidor
-- nunca necesita resolverlo, porque cada fila ya trae la suya.

alter table dishes add column if not exists currency text;

-- Lo que ya hay. La app solo se ha usado en Colombia y en Europa, y las dos
-- escalas no se solapan: un plato de menos de 1000 no existe en pesos -- el cafe
-- mas barato pasa de 2000 -- y uno de mas de 1000 no existe en euros. Asi que el
-- propio numero dice de donde viene, y esa es toda la informacion que hay.
--
-- Es una suposicion, y se deja escrita: lo que quede mal etiquetado se corrige a
-- mano, plato a plato, que es como se corrige un dato que solo su autor conoce.
update dishes
set currency = case when price < 1000 then 'EUR' else 'COP' end
where price is not null and currency is null;

-- Precio y moneda van juntos o no van. Una moneda sin precio es una etiqueta
-- sobre nada, y un precio sin moneda es un numero que no significa nada.
update dishes set currency = null where price is null;

-- **Sin `check` que lo exija**, aunque la regla sea esa.
--
-- Un movil con la version anterior instalada sigue enviando `price` sin
-- `currency`, y una comprobacion aqui rechazaria esa fila -- y con ella el lote
-- entero, porque el push va por lotes. El sync de esa persona se quedaria
-- parado hasta que actualizara la app, que es un precio desproporcionado por
-- una regla que el cliente ya cumple. La regla vive en
-- `features/dishes/currency.ts` (`pairPriceAndCurrency`), que es quien escribe.
comment on column dishes.currency is
  'ISO 4217, escrita junto al precio por el cliente. Nula en filas anteriores a 0020 sin precio.';

-- ── El detalle compartido la lleva ───────────────────────────────────────────
-- Sin esto, quien recibe una visita ve "12" y su app decide en que moneda es.
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
          'rating', d.rating, 'comments', d.comments,
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
