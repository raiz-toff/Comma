ALTER TABLE `expenses` ADD `is_recurring` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `recurring_interval` text;