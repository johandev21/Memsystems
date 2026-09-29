-- Grounding Mode persistence contract (#98). Notebooks store their default
-- mode (strict | moderate | free); existing notebooks backfill to strict.
-- Chat turns, generation requests, and retrieval traces record the mode they
-- answered with, so later tickets can vary answering behavior per mode.
DO $$ BEGIN
  CREATE TYPE "public"."grounding_mode" AS ENUM('strict', 'moderate', 'free');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN IF NOT EXISTS "grounding_mode" "grounding_mode" DEFAULT 'strict' NOT NULL;--> statement-breakpoint
ALTER TABLE "notebook_chat_messages" ADD COLUMN IF NOT EXISTS "grounding_mode" "grounding_mode" DEFAULT 'strict' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN IF NOT EXISTS "grounding_mode" "grounding_mode" DEFAULT 'strict' NOT NULL;--> statement-breakpoint
ALTER TABLE "retrieval_traces" ADD COLUMN IF NOT EXISTS "grounding_mode" "grounding_mode" DEFAULT 'strict' NOT NULL;
