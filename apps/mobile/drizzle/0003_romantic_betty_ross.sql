PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_dish_tag` (
	`dish_id` integer,
	`tag_id` integer,
	PRIMARY KEY(`dish_id`, `tag_id`),
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_dish_tag`("dish_id", "tag_id") SELECT "dish_id", "tag_id" FROM `dish_tag`;--> statement-breakpoint
DROP TABLE `dish_tag`;--> statement-breakpoint
ALTER TABLE `__new_dish_tag` RENAME TO `dish_tag`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_dish_visit` (
	`visit_id` integer,
	`dish_id` integer,
	PRIMARY KEY(`visit_id`, `dish_id`),
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_dish_visit`("visit_id", "dish_id") SELECT "visit_id", "dish_id" FROM `dish_visit`;--> statement-breakpoint
DROP TABLE `dish_visit`;--> statement-breakpoint
ALTER TABLE `__new_dish_visit` RENAME TO `dish_visit`;--> statement-breakpoint
CREATE TABLE `__new_dishes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` integer,
	`rating` integer,
	`comments` text,
	`restaurant_id` integer,
	`user_id` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_dishes`("id", "name", "price", "rating", "comments", "restaurant_id", "user_id") SELECT "id", "name", "price", "rating", "comments", "restaurant_id", "user_id" FROM `dishes`;--> statement-breakpoint
DROP TABLE `dishes`;--> statement-breakpoint
ALTER TABLE `__new_dishes` RENAME TO `dishes`;--> statement-breakpoint
CREATE TABLE `__new_restaurant_tag` (
	`restaurant_id` integer,
	`tag_id` integer,
	PRIMARY KEY(`restaurant_id`, `tag_id`),
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_restaurant_tag`("restaurant_id", "tag_id") SELECT "restaurant_id", "tag_id" FROM `restaurant_tag`;--> statement-breakpoint
DROP TABLE `restaurant_tag`;--> statement-breakpoint
ALTER TABLE `__new_restaurant_tag` RENAME TO `restaurant_tag`;--> statement-breakpoint
CREATE TABLE `__new_restaurants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`comments` text,
	`rating` integer,
	`user_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_restaurants`("id", "name", "latitude", "longitude", "comments", "rating", "user_id") SELECT "id", "name", "latitude", "longitude", "comments", "rating", "user_id" FROM `restaurants`;--> statement-breakpoint
DROP TABLE `restaurants`;--> statement-breakpoint
ALTER TABLE `__new_restaurants` RENAME TO `restaurants`;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`user_id` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "name", "color", "user_id") SELECT "id", "name", "color", "user_id" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE TABLE `__new_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visited_at` text NOT NULL,
	`comments` text,
	`restaurant_id` integer,
	`user_id` integer,
	FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_visits`("id", "visited_at", "comments", "restaurant_id", "user_id") SELECT "id", "visited_at", "comments", "restaurant_id", "user_id" FROM `visits`;--> statement-breakpoint
DROP TABLE `visits`;--> statement-breakpoint
ALTER TABLE `__new_visits` RENAME TO `visits`;