CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slot` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memories_user_slot` ON `memories` (`user_id`,`slot`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`memory_id` text NOT NULL,
	`user_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photos_memory` ON `photos` (`memory_id`);--> statement-breakpoint
CREATE INDEX `photos_user` ON `photos` (`user_id`);