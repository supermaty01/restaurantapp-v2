-- De quien es cada fila, para poder tener dos cuentas en el mismo movil.
--
-- Hasta ahora no habia forma de saberlo. `user_id` existe pero apunta a la
-- tabla `users` local, vestigial de la auth vieja que docs/12 marca para
-- eliminar: **ninguna columna guardaba el uuid de la cuenta de Supabase**. Todo
-- lo local se veia siempre, viniera de donde viniera, e iniciar sesion con la
-- cuenta B en un movil con datos de A los habria encolado como de B.
--
-- Nullable a proposito, y no es un descuido: **null significa "de nadie
-- todavia"**, que es el estado normal de un diario sin cuenta — el modo en que
-- la app funciona entera (docs/00). Poner un default o un NOT NULL obligaria a
-- inventarse una cuenta para quien no tiene ninguna.
--
-- `ALTER TABLE ADD COLUMN` y no reconstruir la tabla: SQLite lo admite para una
-- columna nullable sin default, es instantaneo y no toca ninguna fila. La 0011
-- si reconstruyo `dishes`, pero eso era para cambiar el **tipo** de una columna,
-- que es lo unico que obliga a reconstruir.
--
-- Esta migracion no cambia lo que se ve. Las lecturas todavia no filtran; solo
-- deja el dato para que puedan hacerlo.
ALTER TABLE `restaurants` ADD COLUMN `account_uuid` text;--> statement-breakpoint
ALTER TABLE `dishes` ADD COLUMN `account_uuid` text;--> statement-breakpoint
ALTER TABLE `visits` ADD COLUMN `account_uuid` text;--> statement-breakpoint
ALTER TABLE `tags` ADD COLUMN `account_uuid` text;--> statement-breakpoint
ALTER TABLE `people` ADD COLUMN `account_uuid` text;--> statement-breakpoint
ALTER TABLE `images` ADD COLUMN `account_uuid` text;
