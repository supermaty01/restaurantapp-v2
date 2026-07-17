ALTER TABLE `restaurants` ADD `latitude` text;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `longitude` text;--> statement-breakpoint
ALTER TABLE `restaurants` DROP COLUMN `location`;