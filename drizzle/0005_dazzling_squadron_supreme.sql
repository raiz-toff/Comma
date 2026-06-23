CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`target_value` real NOT NULL,
	`unit` text NOT NULL,
	`period` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
