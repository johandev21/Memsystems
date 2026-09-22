ALTER TYPE "public"."source_processing_status" ADD VALUE IF NOT EXISTS 'degraded';--> statement-breakpoint
ALTER TABLE "source_versions" ADD COLUMN IF NOT EXISTS "quality" jsonb;
