PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_dishes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` integer,
	`rating` integer,
	`comments` text,
	`restaurant_id` text,
	`user_id` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_dishes`("id", "name", "price", "rating", "comments", "restaurant_id", "user_id") SELECT "id", "name", "price", "rating", "comments", "restaurant_id", "user_id" FROM `dishes`;--> statement-breakpoint
DROP TABLE `dishes`;--> statement-breakpoint
ALTER TABLE `__new_dishes` RENAME TO `dishes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_restaurants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`comments` text,
	`rating` integer,
	`user_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_restaurants`("id", "name", "location", "comments", "rating", "user_id") SELECT "id", "name", "location", "comments", "rating", "user_id" FROM `restaurants`;--> statement-breakpoint
DROP TABLE `restaurants`;--> statement-breakpoint
ALTER TABLE `__new_restaurants` RENAME TO `restaurants`;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`user_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "name", "color", "user_id") SELECT "id", "name", "color", "user_id" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id") SELECT "id" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE TABLE `__new_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visited_at` text NOT NULL,
	`comments` text,
	`restaurant_id` text,
	`user_id` text,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_visits`("id", "visited_at", "comments", "restaurant_id", "user_id") SELECT "id", "visited_at", "comments", "restaurant_id", "user_id" FROM `visits`;--> statement-breakpoint
DROP TABLE `visits`;--> statement-breakpoint
ALTER TABLE `__new_visits` RENAME TO `visits`;