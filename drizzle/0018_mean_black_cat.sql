CREATE TABLE `sync_overwrite_log` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`superseded_row` text NOT NULL,
	`winner_row` text NOT NULL,
	`merged_at` integer NOT NULL
);
