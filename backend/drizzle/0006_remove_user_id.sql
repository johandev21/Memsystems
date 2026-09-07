DROP INDEX IF EXISTS "public"."notebooks_user_id_idx";--> statement-breakpoint
ALTER TABLE "notebooks" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."web_search_jobs_user_id_idx";--> statement-breakpoint
ALTER TABLE "web_search_jobs" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "public"."source_upload_intents_user_id_idx";--> statement-breakpoint
ALTER TABLE "source_upload_intents" DROP COLUMN IF EXISTS "user_id";
