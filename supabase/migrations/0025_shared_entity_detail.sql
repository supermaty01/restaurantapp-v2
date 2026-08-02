-- Abrir un plato o un sitio de otra persona. Verificar con `npm run db:test`.
--
-- ## Que faltaba
--
-- Del feed solo se podia abrir una cosa: una visita. Un plato o un restaurante
-- que alguien hubiera compartido sueltos pintaban su tarjeta y ahi se acababa —
-- `FeedCard` ni siquiera los envolvia en un pulsable, para no ofrecer un toque
-- que no lleva a ningun sitio. Y dentro de una visita compartida, los platos y
-- el restaurante eran texto: se veia el nombre y la nota, y no habia forma de
-- ver la foto entera, el precio ni los comentarios largos.
--
-- Aqui estan las dos funciones que faltaban, con la misma forma que
-- `visit_detail` (0011): devuelven **json**, porque lo que se pide es un arbol,
-- y **null** cuando no se puede leer, sin distinguir «no existe» de «no es para
-- ti» — un diario que contesta esa diferencia le cuenta a un desconocido que
-- algo existe.
--
-- ## Quien puede leerlos
--
-- No se inventa ninguna regla: es la de `can_read_visit` aplicada a las otras
-- dos clases.
--
--   tuyo · publico · compartido y sois amigos · compartido y puedes leer una
--   visita en la que aparece
--
-- La cuarta es la unica que merece explicacion, y es la simetria de 0011: si te
-- etiquetaron en una cena, puedes leer esa visita aunque no seas amigo de quien
-- la escribio, y el detalle te enseña ya el nombre, la nota y el comentario de
-- cada plato. Negarte entonces el plato entero seria esconderte la foto de algo
-- que te estan enseñando a medias.
--
-- Lo que **no** hace, y es la mitad importante: `is_shared` sigue mandando en
-- las cuatro ramas salvo en «tuyo». Un plato privado dentro de una visita
-- publica viaja en el detalle de esa visita —porque una comida sin decir que se
-- comio no comparte nada— pero **no se puede abrir por su cuenta**. La decision
-- de quien comparte fue sobre esa comida, no sobre el plato.
--
-- Y `restaurant_detail` devuelve el sitio, no su historial: ni las visitas que
-- hubo alli ni los platos que se comieron. Poder ver un sitio no es poder leer
-- el diario de nadie (0011).

-- ── Quien puede leer un plato ───────────────────────────────────────────────
create or replace function can_read_dish(d uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from dishes di
    where di.uuid = d
      and di.deleted = false
      and (
        di.user_id = auth.uid()
        or effective_visibility(di.visibility, di.user_id, 'dish') = 'public'
        or (
          is_shared(di.visibility, di.user_id, 'dish')
          and (
            are_friends(auth.uid(), di.user_id)
            or exists (
              select 1 from dish_visit dv
              where dv.dish_uuid = di.uuid and can_read_visit(dv.visit_uuid)
            )
          )
        )
      )
  );
$$;

-- ── Quien puede leer un sitio ───────────────────────────────────────────────
create or replace function can_read_restaurant(r uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from restaurants re
    where re.uuid = r
      and re.deleted = false
      and (
        re.user_id = auth.uid()
        or effective_visibility(re.visibility, re.user_id, 'restaurant') = 'public'
        or (
          is_shared(re.visibility, re.user_id, 'restaurant')
          and (
            are_friends(auth.uid(), re.user_id)
            or exists (
              select 1 from visits vi
              where vi.restaurant_uuid = re.uuid and can_read_visit(vi.uuid)
            )
          )
        )
      )
  );
$$;

-- ── Un plato entero ─────────────────────────────────────────────────────────
--
-- `can_open` del restaurante viaja resuelto por el servidor. La alternativa era
-- que la pantalla llamara a `restaurant_detail` para ver si contesta y decidir
-- si pinta un enlace: una peticion de red por tarjeta para averiguar si se
-- puede pulsar, y un enlace que aparece tarde.
create or replace function dish_detail(target uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when can_read_dish(target) then (
    select json_build_object(
      'uuid', d.uuid,
      'name', d.name,
      'price', d.price,
      'currency', d.currency,
      'rating', d.rating,
      'comments', d.comments,
      'created_at', d.created_at,
      'author', json_build_object(
        'user_id', p.user_id, 'username', p.username,
        'display_name', p.display_name, 'avatar_url', p.avatar_url
      ),
      'restaurant', (
        select json_build_object(
          'uuid', r.uuid,
          'name', r.name,
          'can_open', can_read_restaurant(r.uuid)
        )
        from restaurants r
        where r.uuid = d.restaurant_uuid and r.deleted = false
      ),
      'images', coalesce((
        select json_agg(i.remote_key order by i.created_at)
        from images i
        where i.dish_uuid = d.uuid and i.deleted = false and i.remote_key is not null
      ), '[]'::json)
    )
    from dishes d
    join profiles p on p.user_id = d.user_id
    where d.uuid = target
  ) end;
$$;

-- ── Un sitio entero ─────────────────────────────────────────────────────────
create or replace function restaurant_detail(target uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when can_read_restaurant(target) then (
    select json_build_object(
      'uuid', r.uuid,
      'name', r.name,
      'latitude', r.latitude,
      'longitude', r.longitude,
      'rating', r.rating,
      'comments', r.comments,
      'created_at', r.created_at,
      'author', json_build_object(
        'user_id', p.user_id, 'username', p.username,
        'display_name', p.display_name, 'avatar_url', p.avatar_url
      ),
      'images', coalesce((
        select json_agg(i.remote_key order by i.created_at)
        from images i
        where i.restaurant_uuid = r.uuid and i.deleted = false and i.remote_key is not null
      ), '[]'::json)
    )
    from restaurants r
    join profiles p on p.user_id = r.user_id
    where r.uuid = target
  ) end;
$$;

-- ── El detalle de una visita dice que se puede abrir ────────────────────────
--
-- Identica a la de 0023 salvo por las dos claves `can_open`. Se reescribe entera
-- porque Postgres no sabe editar el cuerpo de una funcion.
--
-- El flag es necesario y no un adorno: dentro de una visita compartida se ven
-- platos que su dueño **no** ha compartido sueltos (0011), asi que pintarlos
-- todos como pulsables ofreceria un toque que el servidor va a rechazar. Un
-- enlace que no lleva a ningun sitio es indistinguible de una averia.
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
          'comments', case when is_shared(r.visibility, r.user_id, 'restaurant') then r.comments end,
          'can_open', can_read_restaurant(r.uuid)
        )
        from restaurants r
        where r.uuid = v.restaurant_uuid and r.deleted = false
      ),
      'dishes', coalesce((
        select json_agg(json_build_object(
          'uuid', d.uuid, 'name', d.name, 'price', d.price, 'currency', d.currency,
          'rating', d.rating,
          'comments', d.comments,
          'can_open', can_read_dish(d.uuid),
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

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'can_read_dish(uuid)',
    'can_read_restaurant(uuid)',
    'dish_detail(uuid)',
    'restaurant_detail(uuid)'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
