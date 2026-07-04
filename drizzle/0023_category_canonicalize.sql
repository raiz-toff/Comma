-- Category canonicalization (2026-07-04 web↔mobile category unification).
-- The web app historically used its own slugs for two concepts; the canonical vocabulary
-- (src/registry/expenseCategories.ts) wins. Rows that arrived via sync before both apps
-- shared one vocabulary may carry the legacy web slugs — remap them in place.
-- sync_updated_at is deliberately NOT bumped: the web app runs the same remap on its own
-- rows (logical migration 6), so both sides converge without any sync traffic, and no
-- LWW timestamps move.
UPDATE `expenses` SET `category` = 'wash' WHERE `category` = 'car_wash';--> statement-breakpoint
UPDATE `expenses` SET `category` = 'licensing' WHERE `category` = 'registration';
