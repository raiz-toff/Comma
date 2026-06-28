CREATE TABLE `shift_platforms` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`platform` text NOT NULL,
	`platform_online_seconds` integer DEFAULT 0 NOT NULL,
	`gross_revenue` real DEFAULT 0 NOT NULL,
	`tips_revenue` real DEFAULT 0 NOT NULL,
	`trips_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `shifts` ADD `reconciliation_status` text DEFAULT 'reconciled' NOT NULL;