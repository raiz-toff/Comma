-- First-sync backfill (2026-07-03 interop audit follow-up).
-- Rows created before the sync columns existed sit at sync_updated_at = 0, and push only
-- collects rows STRICTLY ABOVE the cursor (which starts at 0) — so historical data never
-- reached other devices. Stamp them to 1: still older than any real edit (epoch-ms), so it
-- can never win an LWW merge, but now included in the next push. Also rewind the push
-- cursor so devices that already pushed re-send their full history once (peers skip
-- duplicates by LWW).
UPDATE `vehicles` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `platforms` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `merchants` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `goals` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `tax_history` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `shifts` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `maintenance_logs` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `expenses` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `shift_platforms` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `vehicle_tax_profiles` SET `sync_updated_at` = 1 WHERE `sync_updated_at` = 0;--> statement-breakpoint
UPDATE `settings` SET `value` = '0' WHERE `key` = 'sync_last_pushed_at';
