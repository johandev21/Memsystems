-- Persists one retrieval trace per Chat turn and per Study Material
-- Generation, so a poor answer can be diagnosed as an ingestion, retrieval,
-- or generation failure (RAG-03). The correlation ids are intentionally not
-- foreign keys: a trace stays useful when a turn failed before its message or
-- generation request row was written.
CREATE TYPE "public"."retrieval_trace_kind" AS ENUM('chat', 'generation');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retrieval_traces" (
	"id" varchar PRIMARY KEY NOT NULL,
	"notebook_id" varchar NOT NULL,
	"kind" "retrieval_trace_kind" NOT NULL,
	"chat_message_id" varchar,
	"generation_request_id" varchar,
	"query" text NOT NULL,
	"trace" jsonb NOT NULL,
	"latency_ms" integer NOT NULL,
	"embedding_input_tokens" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "retrieval_traces" ADD CONSTRAINT "retrieval_traces_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_traces_notebook_id_created_at_idx" ON "retrieval_traces" USING btree ("notebook_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_traces_chat_message_id_idx" ON "retrieval_traces" USING btree ("chat_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_traces_generation_request_id_idx" ON "retrieval_traces" USING btree ("generation_request_id");
