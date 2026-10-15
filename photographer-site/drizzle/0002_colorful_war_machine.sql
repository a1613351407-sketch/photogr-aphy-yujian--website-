CREATE TABLE `feishu_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`survey_id` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`source_key` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`file_key` text,
	`message_id` text,
	`error` text,
	`target` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`first_attempt_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`survey_id`) REFERENCES `surveys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_feishu_deliveries_survey_id` ON `feishu_deliveries` (`survey_id`);