PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visited_at` text,
	`comments` text,
	`restaurant_id` integer,
	`user_id` integer,
	`visibility` text DEFAULT 'private' NOT NULL,
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
--> Rebuilding the table re-imposes NOT NULL on every column that has it, and
--> the rows on a real device came from importing a v1 backup, which replaces
--> the SQLite file wholesale: columns added by later migrations are simply
--> absent there. Copying them raw would fail the migration and leave the app
--> unable to start, which is far worse than the sync error this fixes.
INSERT INTO `__new_visits`("id", "visited_at", "comments", "restaurant_id", "user_id", "visibility", "deleted", "uuid", "created_at", "updated_at") SELECT "id", "visited_at", "comments", "restaurant_id", "user_id", coalesce("visibility", 'private'), coalesce("deleted", 0), coalesce("uuid", lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))), coalesce("created_at", strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), coalesce("updated_at", strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) FROM `visits`;--> statement-breakpoint
DROP TABLE `visits`;--> statement-breakpoint
ALTER TABLE `__new_visits` RENAME TO `visits`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `visits_uuid_unique` ON `visits` (`uuid`);