-- El precio de un plato admite decimales, y ahora la columna lo dice.
--
-- `schema.ts` declaraba `price: integer('price')` mientras la app escribia 3.5.
-- SQLite no lo impide -- los tipos son afinidades, no restricciones -- asi que
-- un plato de 3,50 se guardaba tal cual y nadie se enteraba de nada. El error
-- aparecia mucho mas tarde y en otro sitio: tumbo un push contra Postgres, que
-- si aplica tipos, y de ahi salio la 0008 del espejo.
--
-- El lado servidor se arreglo entonces (`numeric(12,2)`) y el local se quedo
-- mintiendo. Esto lo pone de acuerdo.
--
-- **No hay conversion de valores.** Con afinidad INTEGER, SQLite solo convierte
-- un REAL a entero si la conversion no pierde nada, asi que los 3.5 que hay en
-- disco ya estan guardados como REAL. Lo que cambia es lo que la tabla declara,
-- que es lo que leera quien venga detras.
--
-- Se reconstruye la tabla porque SQLite no sabe cambiar el tipo de una columna.
-- El `coalesce` de cada columna con default no es decoracion: las filas de un
-- movil real vienen de importar una copia de la v1, que sustituye el fichero
-- entero, y ahi las columnas que anadieron migraciones posteriores sencillamente
-- no estan. Copiarlas en crudo reventaria la migracion y dejaria la app sin
-- arrancar -- la leccion de la 0008.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_dishes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` real,
	`rating` integer,
	`comments` text,
	`restaurant_id` integer,
	`user_id` integer,
	`visibility` text DEFAULT 'default' NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`uuid` text DEFAULT (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_dishes`("id", "name", "price", "rating", "comments", "restaurant_id", "user_id", "visibility", "deleted", "uuid", "created_at", "updated_at") SELECT "id", "name", "price", "rating", "comments", "restaurant_id", "user_id", coalesce("visibility", 'default'), coalesce("deleted", 0), coalesce("uuid", lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))), coalesce("created_at", strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), coalesce("updated_at", strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) FROM `dishes`;--> statement-breakpoint
DROP TABLE `dishes`;--> statement-breakpoint
ALTER TABLE `__new_dishes` RENAME TO `dishes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `dishes_uuid_unique` ON `dishes` (`uuid`);
