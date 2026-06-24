CREATE TABLE `location_points` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`shift_id` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`altitude` real,
	`accuracy` real,
	`speed` real,
	`timestamp` integer NOT NULL,
	`source` text DEFAULT 'gps' NOT NULL,
	`is_filtered` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action
);
