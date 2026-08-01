import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, primaryKey, blob } from 'drizzle-orm/sqlite-core';

/**
 * Sync columns (see docs/02-modelo-de-datos.md).
 *
 * Identity strategy: the integer PK stays the local key; `uuid` is the global
 * sync identity that travels to Supabase. The SQL defaults below are a safety
 * net so a raw insert (or a backfill) never leaves a NULL — the repositories
 * still generate the uuid in TS so the value is known at insert time for the
 * change log.
 *
 * `uuidDefault` builds a canonical v4 uuid in pure SQLite (ADD COLUMN can't use
 * expression defaults, but CREATE TABLE — which the migration rebuild uses —
 * can).
 */
const uuidDefault = sql`(
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
)`;

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const syncColumns = () => ({
  uuid: text('uuid').notNull().unique().default(uuidDefault),
  createdAt: text('created_at').notNull().default(nowIso),
  updatedAt: text('updated_at').notNull().default(nowIso),
  /**
   * De qué cuenta de Supabase es esta fila, o `null` si de ninguna todavía.
   *
   * No es `userId`: ese apunta a la tabla `users` local, vestigial de la auth
   * vieja, y no dice nada de la cuenta de la nube. **Null es un estado normal y
   * no un hueco** — es lo que tiene un diario sin cuenta, que es el modo en que
   * la app funciona entera (docs/00).
   *
   * No viaja en el sync: el servidor ya sabe de quién es cada fila por RLS, y
   * mandarlo sería dejar que un cliente opinara sobre eso. Aquí solo sirve para
   * saber qué enseñar en este teléfono. Ver la migración 0012.
   */
  accountUuid: text('account_uuid'),
});

// 'default' es un valor guardado, no un hueco: significa "lo que digan mis
// ajustes generales, ahora y más adelante". Ver features/privacy/visibility.ts.
const visibilityColumn = () =>
  text('visibility', { enum: ['default', 'private', 'friends', 'public'] })
    .notNull()
    .default('default');

// Tabla de usuarios
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
});

// Tabla de restaurantes
export const restaurants = sqliteTable('restaurants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  comments: text('comments'),
  rating: integer('rating'),
  userId: integer('user_id').references(() => users.id),
  visibility: visibilityColumn(),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns(),
});

// Tabla de visitas
export const visits = sqliteTable('visits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Nullable, like the mirror: imported v1 diaries contain visits with no
  // recorded date, and a pull of one of those failed the local insert with
  // "NOT NULL constraint failed". The app copes — the month timeline groups
  // them under "Sin fecha".
  visitedAt: text('visited_at'),
  comments: text('comments'),
  restaurantId: integer('restaurant_id').references(() => restaurants.id),
  userId: integer('user_id').references(() => users.id),
  visibility: visibilityColumn(),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns(),
});

// Tabla de platos
export const dishes = sqliteTable('dishes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  // `real` y no `integer`: un plato cuesta 3,50. Lo declaraba entero mientras
  // la app escribia decimales, y SQLite no lo impide -- el fallo aparecia mucho
  // despues, al empujar contra Postgres, que si aplica tipos. El espejo usa
  // `numeric(12,2)`. Ver la migracion 0011.
  price: real('price'),
  /**
   * En qué moneda está `price`.
   *
   * Por plato y no por diario: un diario que se lleva de viaje mezcla platos de
   * Bogotá y de Madrid en la misma lista, y con una sola moneda la mitad de los
   * números dicen otra cosa de la que costaron. El ajuste general sigue
   * existiendo, pero como **punto de partida** de lo nuevo (ver
   * `useDefaultCurrency`), no como respuesta para todo.
   *
   * Nulo exactamente cuando `price` lo es: un precio sin moneda es un número sin
   * unidad, y una moneda sin precio no dice nada. Lo sujeta `dish-schema.ts` al
   * escribir y `dish-price.node.test.ts` al vigilarlo. Ver la migración 0013.
   */
  currency: text('currency'),
  rating: integer('rating'),
  comments: text('comments'),
  restaurantId: integer('restaurant_id').references(() => restaurants.id),
  userId: integer('user_id').references(() => users.id),
  visibility: visibilityColumn(),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns(),
});

// Tabla de etiquetas
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  userId: integer('user_id').references(() => users.id),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns(),
});

// Tabla de personas (con quién se comparte una visita). Una persona no tiene
// por qué ser usuaria de la app; si lo es, se vincula con linkedUserId.
export const people = sqliteTable('people', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  // La cuenta a la que apunta esta persona, si apunta a alguna. Es el uuid de
  // auth, no un id local: quien te acompaña en una comida vive en el movil de
  // otra persona, y su fila local aqui es solo una etiqueta con un puntero.
  // Sin cuenta vinculada, "Irene" es una persona perfectamente valida.
  linkedAccountUuid: text('linked_account_uuid'),
  // El @handle en el momento de etiquetar, para poder pintar la etiqueta sin
  // pedirle el perfil al servidor (y sin conexion).
  username: text('username'),
  linkedUserId: integer('linked_user_id').references(() => users.id),
  userId: integer('user_id').references(() => users.id),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns(),
});

export const images = sqliteTable('images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull(), // Ruta del archivo en el dispositivo
  description: text('description'), // Descripción opcional
  remoteKey: text('remote_key'), // Clave en R2 (null si aún no subida)
  uploadedAt: text('uploaded_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),

  // Relación opcional: solo una de estas columnas tendrá valor
  restaurantId: integer('restaurant_id').references(() => restaurants.id),
  visitId: integer('visit_id').references(() => visits.id),
  dishId: integer('dish_id').references(() => dishes.id),
  ...syncColumns(),
});

export const imagesRelations = relations(images, ({ one }) => ({
  restaurant: one(restaurants, { fields: [images.restaurantId], references: [restaurants.id] }),
  visit: one(visits, { fields: [images.visitId], references: [visits.id] }),
  dish: one(dishes, { fields: [images.dishId], references: [dishes.id] }),
}));

// Relaciones de etiquetas con restaurantes (Many-to-Many)
export const restaurantTags = sqliteTable(
  'restaurant_tag',
  {
    restaurantId: integer('restaurant_id').references(() => restaurants.id),
    tagId: integer('tag_id').references(() => tags.id),
  },
  (table) => [primaryKey({ columns: [table.restaurantId, table.tagId] })],
);

// Relaciones de etiquetas con platos (Many-to-Many)
export const dishTags = sqliteTable(
  'dish_tag',
  {
    dishId: integer('dish_id').references(() => dishes.id),
    tagId: integer('tag_id').references(() => tags.id),
  },
  (table) => [primaryKey({ columns: [table.dishId, table.tagId] })],
);

// Relación de visitas con platos (Many-to-Many)
export const dishVisits = sqliteTable(
  'dish_visit',
  {
    visitId: integer('visit_id').references(() => visits.id),
    dishId: integer('dish_id').references(() => dishes.id),
  },
  (table) => [primaryKey({ columns: [table.visitId, table.dishId] })],
);

// Personas etiquetadas en una visita. tagStatus modela el flujo social:
// 'local' (persona sin cuenta) | 'pending' | 'accepted' | 'rejected'.
export const visitParticipants = sqliteTable(
  'visit_participant',
  {
    visitId: integer('visit_id')
      .notNull()
      .references(() => visits.id),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id),
    tagStatus: text('tag_status', {
      enum: ['local', 'pending', 'accepted', 'rejected'],
    })
      .notNull()
      .default('local'),
  },
  (table) => [primaryKey({ columns: [table.visitId, table.personId] })],
);

// Cola de salida del sync: una fila por cambio local pendiente de enviar.
// row_uuid se guarda desnormalizado para que un borrado siga sabiendo la
// identidad global. Ver docs/03-sync.md.
export const changeLog = sqliteTable('change_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  rowId: integer('row_id').notNull(),
  rowUuid: text('row_uuid').notNull(),
  operation: text('operation', { enum: ['insert', 'update', 'delete'] }).notNull(),
  changedAt: text('changed_at').notNull().default(nowIso),
  synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
});

// Definición de relaciones con Drizzle
export const usersRelations = relations(users, ({ many }) => ({
  restaurants: many(restaurants),
  visits: many(visits),
  dishes: many(dishes),
  tags: many(tags),
}));

export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  user: one(users, { fields: [restaurants.userId], references: [users.id] }),
  visits: many(visits),
  dishes: many(dishes),
  tags: many(restaurantTags),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
  user: one(users, { fields: [visits.userId], references: [users.id] }),
  restaurant: one(restaurants, { fields: [visits.restaurantId], references: [restaurants.id] }),
  dishes: many(dishVisits),
  participants: many(visitParticipants),
}));

export const dishesRelations = relations(dishes, ({ one, many }) => ({
  user: one(users, { fields: [dishes.userId], references: [users.id] }),
  restaurant: one(restaurants, { fields: [dishes.restaurantId], references: [restaurants.id] }),
  tags: many(dishTags),
  visits: many(dishVisits),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
  restaurantTags: many(restaurantTags),
  dishTags: many(dishTags),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  user: one(users, { fields: [people.userId], references: [users.id] }),
  linkedUser: one(users, { fields: [people.linkedUserId], references: [users.id] }),
  visits: many(visitParticipants),
}));

export const visitParticipantsRelations = relations(visitParticipants, ({ one }) => ({
  visit: one(visits, { fields: [visitParticipants.visitId], references: [visits.id] }),
  person: one(people, { fields: [visitParticipants.personId], references: [people.id] }),
}));

// Tabla de configuración
export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value'),
  blobValue: blob('blob_value'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
