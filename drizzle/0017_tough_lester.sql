ALTER TABLE `expenses` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `goals` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `goals` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `maintenance_logs` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `maintenance_logs` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `merchants` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `merchants` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `platforms` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `platforms` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `shift_platforms` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shift_platforms` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `shifts` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `tax_history` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tax_history` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `vehicle_tax_profiles` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicle_tax_profiles` ADD `sync_deleted_at` integer;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `sync_updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vehicles` ADD `sync_deleted_at` integer;