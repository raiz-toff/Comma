ALTER TABLE `expenses` ADD `vehicle_id` text REFERENCES vehicles(id);--> statement-breakpoint
ALTER TABLE `expenses` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `receipt_uri` text;