CREATE TABLE `profile` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`sync_updated_at` integer DEFAULT 0 NOT NULL,
	`sync_deleted_at` integer
);
