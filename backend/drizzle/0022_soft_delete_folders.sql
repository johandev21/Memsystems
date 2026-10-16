ALTER TABLE "notebook_folders" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notebook_folders_deleted_at_idx" ON "notebook_folders" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notebooks_deleted_at_idx" ON "notebooks" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "source_folders" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_folders_deleted_at_idx" ON "source_folders" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sources_deleted_at_idx" ON "sources" USING btree ("deleted_at");
