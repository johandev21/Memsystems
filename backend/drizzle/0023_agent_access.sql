-- Agent Access contract (spec #118). Agent Keys authenticate MCP requests;
-- Agent Audit Logs record every tool call; Agent Pending Actions hold deletes
-- that need approval. All statements are idempotent so the migration can be
-- re-applied safely.
DO $$ BEGIN
  CREATE TYPE "public"."agent_access_level" AS ENUM('on', 'read_only', 'off');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."agent_soft_delete_policy" AS ENUM('ask', 'allow');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."agent_confirm_policy" AS ENUM('never', 'ask');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_keys" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "agent_keys_key_hash_unique" UNIQUE("key_hash")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_keys_revoked_at_idx" ON "agent_keys" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_keys_last_used_at_idx" ON "agent_keys" USING btree ("last_used_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_audit_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_key_id" varchar,
	"tool_name" varchar(100) NOT NULL,
	"args" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"duration_ms" integer,
	"notebook_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_audit_logs_agent_key_id_agent_keys_id_fk" FOREIGN KEY ("agent_key_id") REFERENCES "agent_keys"("id") ON DELETE SET NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_audit_logs_created_at_idx" ON "agent_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_audit_logs_agent_key_id_idx" ON "agent_audit_logs" USING btree ("agent_key_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_pending_actions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agent_key_id" varchar,
	"tool_name" varchar(100) NOT NULL,
	"notebook_id" varchar,
	"target_type" varchar(40) NOT NULL,
	"target_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "agent_pending_actions_agent_key_id_agent_keys_id_fk" FOREIGN KEY ("agent_key_id") REFERENCES "agent_keys"("id") ON DELETE SET NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_pending_actions_status_idx" ON "agent_pending_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_pending_actions_expires_at_idx" ON "agent_pending_actions" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "agent_soft_delete_policy" "agent_soft_delete_policy" DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "agent_permanent_delete_policy" "agent_confirm_policy" DEFAULT 'never' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "agent_resource_delete_policy" "agent_confirm_policy" DEFAULT 'never' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "agent_notebook_access_default" "agent_access_level" DEFAULT 'on' NOT NULL;--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN IF NOT EXISTS "agent_access" "agent_access_level";
