ALTER TABLE `shifts` ADD `dead_mileage` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `active_mileage` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `duration_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `paused_seconds` integer DEFAULT 0 NOT NULL;