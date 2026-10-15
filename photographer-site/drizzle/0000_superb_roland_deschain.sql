CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`payload` text NOT NULL,
	`photos` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_surveys_created_at` ON `surveys` (`created_at`);