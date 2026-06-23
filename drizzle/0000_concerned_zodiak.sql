CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`date` integer NOT NULL,
	`is_deductible` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text,
	`platform` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`gross_revenue` real DEFAULT 0 NOT NULL,
	`tips_revenue` real DEFAULT 0 NOT NULL,
	`tracked_mileage` real DEFAULT 0 NOT NULL,
	`notes` text,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
