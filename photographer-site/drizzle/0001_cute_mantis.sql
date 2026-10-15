CREATE TABLE `email_deliveries` (
	`survey_id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`provider_id` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`first_attempt_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`survey_id`) REFERENCES `surveys`(`id`) ON UPDATE no action ON DELETE no action
);
