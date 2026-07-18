-- Sync columns (docs/02). NOTE: SQLite forbids non-constant expression
-- defaults in ADD COLUMN, so uuid/timestamp columns are added nullable and
-- backfilled with UPDATE (which does allow expressions, evaluated per row).
-- The drizzle schema keeps them notNull+default; every insert path provides the
-- values, so no NULL is ever written. Verified by the migration test harness.

CREATE TABLE `change_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`row_id` integer NOT NULL,
	`row_uuid` text NOT NULL,
	`operation` text NOT NULL,
	`changed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`synced` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`linked_user_id` integer,
	`user_id` integer,
	`deleted` integer DEFAULT false NOT NULL,
	`uuid` text DEFAULT (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`linked_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_uuid_unique` ON `people` (`uuid`);--> statement-breakpoint
CREATE TABLE `visit_participant` (
	`visit_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`tag_status` text DEFAULT 'local' NOT NULL,
	PRIMARY KEY(`visit_id`, `person_id`),
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- dishes -------------------------------------------------------------------
ALTER TABLE `dishes` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `dishes` ADD `uuid` text;--> statement-breakpoint
ALTER TABLE `dishes` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `dishes` ADD `updated_at` text;--> statement-breakpoint
UPDATE `dishes` SET `uuid` = (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
) WHERE `uuid` IS NULL;--> statement-breakpoint
UPDATE `dishes` SET `created_at` = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE `created_at` IS NULL;--> statement-breakpoint
UPDATE `dishes` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `dishes_uuid_unique` ON `dishes` (`uuid`);--> statement-breakpoint

-- images -------------------------------------------------------------------
ALTER TABLE `images` ADD `remote_key` text;--> statement-breakpoint
ALTER TABLE `images` ADD `uuid` text;--> statement-breakpoint
ALTER TABLE `images` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `images` ADD `updated_at` text;--> statement-breakpoint
UPDATE `images` SET `uuid` = (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
) WHERE `uuid` IS NULL;--> statement-breakpoint
UPDATE `images` SET `created_at` = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE `created_at` IS NULL;--> statement-breakpoint
UPDATE `images` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `images_uuid_unique` ON `images` (`uuid`);--> statement-breakpoint

-- restaurants --------------------------------------------------------------
ALTER TABLE `restaurants` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `uuid` text;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `updated_at` text;--> statement-breakpoint
UPDATE `restaurants` SET `uuid` = (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
) WHERE `uuid` IS NULL;--> statement-breakpoint
UPDATE `restaurants` SET `created_at` = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE `created_at` IS NULL;--> statement-breakpoint
UPDATE `restaurants` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `restaurants_uuid_unique` ON `restaurants` (`uuid`);--> statement-breakpoint

-- tags ---------------------------------------------------------------------
ALTER TABLE `tags` ADD `uuid` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `updated_at` text;--> statement-breakpoint
UPDATE `tags` SET `uuid` = (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
) WHERE `uuid` IS NULL;--> statement-breakpoint
UPDATE `tags` SET `created_at` = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE `created_at` IS NULL;--> statement-breakpoint
UPDATE `tags` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_uuid_unique` ON `tags` (`uuid`);--> statement-breakpoint

-- visits -------------------------------------------------------------------
ALTER TABLE `visits` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `visits` ADD `uuid` text;--> statement-breakpoint
ALTER TABLE `visits` ADD `created_at` text;--> statement-breakpoint
ALTER TABLE `visits` ADD `updated_at` text;--> statement-breakpoint
UPDATE `visits` SET `uuid` = (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
) WHERE `uuid` IS NULL;--> statement-breakpoint
UPDATE `visits` SET `created_at` = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE `created_at` IS NULL;--> statement-breakpoint
UPDATE `visits` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `visits_uuid_unique` ON `visits` (`uuid`);
