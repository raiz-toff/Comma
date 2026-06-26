CREATE TABLE `platforms` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`color` text NOT NULL,
	`text_color` text NOT NULL,
	`country` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`hourly_rate` text DEFAULT '20' NOT NULL,
	`mileage_rate` text DEFAULT '0.62' NOT NULL,
	`sort_priority` integer DEFAULT 1 NOT NULL
);
