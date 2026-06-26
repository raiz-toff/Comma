CREATE TABLE `tax_history` (
	`id` text PRIMARY KEY NOT NULL,
	`old_region` text,
	`old_rate` real,
	`new_region` text NOT NULL,
	`new_rate` real NOT NULL,
	`changed_at` integer NOT NULL
);
