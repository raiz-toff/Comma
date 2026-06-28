CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchants_name_unique` ON `merchants` (`name`);--> statement-breakpoint
CREATE TABLE `vehicle_tax_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`tax_year` integer NOT NULL,
	`country` text NOT NULL,
	`deduction_method` text NOT NULL,
	`standard_rate_primary` real,
	`standard_rate_secondary` real,
	`rate_threshold` real,
	`beginning_year_odometer` integer,
	`ending_year_odometer` integer,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `merchant` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `merchant_normalized` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `start_odometer` integer;--> statement-breakpoint
ALTER TABLE `shifts` ADD `end_odometer` integer;--> statement-breakpoint
ALTER TABLE `shifts` ADD `distance_source` text DEFAULT 'gps_only' NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `current_odometer` integer DEFAULT 0 NOT NULL;