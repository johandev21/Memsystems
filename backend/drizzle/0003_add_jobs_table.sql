DO $$ BEGIN
  CREATE TYPE "job_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"group_key" varchar(255),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"last_error" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"backoff_base_ms" integer DEFAULT 5000 NOT NULL,
	"next_attempt_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_status_next_attempt_at_idx" ON "jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_group_key_idx" ON "jobs" USING btree ("group_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_type_idx" ON "jobs" USING btree ("type");
