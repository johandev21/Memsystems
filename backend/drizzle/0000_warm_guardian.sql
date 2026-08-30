CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('streaming', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_added_via" AS ENUM('manual', 'ai_search');--> statement-breakpoint
CREATE TYPE "public"."source_index_job_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('text', 'url', 'file');--> statement-breakpoint
CREATE TYPE "public"."study_material_kind" AS ENUM('quiz', 'simple_flashcard', 'roadmap', 'mind_map');--> statement-breakpoint
CREATE TYPE "public"."web_search_job_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "generation_requests" (
	"id" varchar PRIMARY KEY NOT NULL,
	"notebook_id" varchar NOT NULL,
	"kind" "study_material_kind" NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_folder_id" varchar,
	"status" "generation_status" DEFAULT 'streaming' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "jobs" (
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
);
--> statement-breakpoint
CREATE TABLE "notebook_chat_messages" (
	"id" varchar PRIMARY KEY NOT NULL,
	"notebook_id" varchar NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"reasoning" text,
	"cited_source_ids" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notebooks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(500) DEFAULT '' NOT NULL,
	"icon" varchar(50) DEFAULT 'notebook' NOT NULL,
	"banner" varchar(2000),
	"banner_focal_point" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_chunks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"source_id" varchar NOT NULL,
	"notebook_id" varchar NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_index_jobs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"source_id" varchar NOT NULL,
	"notebook_id" varchar NOT NULL,
	"status" "source_index_job_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"content_hash" varchar(64),
	"processing_version" integer,
	"embedding_model" varchar(200),
	"embedding_dimensions" integer,
	"chunks_count" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"next_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" varchar PRIMARY KEY NOT NULL,
	"notebook_id" varchar NOT NULL,
	"kind" "source_kind" NOT NULL,
	"added_via" "source_added_via" DEFAULT 'manual' NOT NULL,
	"metadata" jsonb,
	"title" varchar(500) NOT NULL,
	"raw_text" text NOT NULL,
	"url" text,
	"s3_key" varchar(1000),
	"content_type" varchar(200),
	"file_size" integer,
	"sha256" varchar(64),
	"content_hash" varchar(64),
	"canonical_url" text,
	"fetched_url" text,
	"http_status" integer,
	"fetched_at" timestamp,
	"etag" varchar(200),
	"last_modified" varchar(100),
	"extraction_method" varchar(20),
	"extractor_version" varchar(20),
	"normalization_version" integer,
	"robots_decision" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_material_folders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"notebook_id" varchar NOT NULL,
	"parent_id" varchar,
	"name" varchar(200) NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_materials" (
	"id" varchar PRIMARY KEY NOT NULL,
	"notebook_id" varchar NOT NULL,
	"kind" "study_material_kind" NOT NULL,
	"title" varchar(200) DEFAULT 'Untitled' NOT NULL,
	"folder_id" varchar,
	"content" jsonb NOT NULL,
	"options" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"openai_api_key" text,
	"deepseek_api_key" text,
	"anthropic_api_key" text,
	"gemini_api_key" text,
	"kimi_api_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_search_jobs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"notebook_id" varchar NOT NULL,
	"user_id" text NOT NULL,
	"query" varchar(500) NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"status" "web_search_job_status" DEFAULT 'pending' NOT NULL,
	"summary" text,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_requests" ADD CONSTRAINT "generation_requests_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD CONSTRAINT "generation_requests_target_folder_id_study_material_folders_id_fk" FOREIGN KEY ("target_folder_id") REFERENCES "public"."study_material_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_chat_messages" ADD CONSTRAINT "notebook_chat_messages_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD CONSTRAINT "source_chunks_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_index_jobs" ADD CONSTRAINT "source_index_jobs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_index_jobs" ADD CONSTRAINT "source_index_jobs_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_material_folders" ADD CONSTRAINT "study_material_folders_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_material_folders" ADD CONSTRAINT "study_material_folders_parent_id_study_material_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."study_material_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_folder_id_study_material_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."study_material_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_search_jobs" ADD CONSTRAINT "web_search_jobs_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_requests_notebook_id_idx" ON "generation_requests" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "generation_requests_target_folder_id_idx" ON "generation_requests" USING btree ("target_folder_id");--> statement-breakpoint
CREATE INDEX "jobs_status_next_attempt_at_idx" ON "jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "jobs_group_key_idx" ON "jobs" USING btree ("group_key");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notebook_chat_messages_notebook_id_idx" ON "notebook_chat_messages" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "notebook_chat_messages_created_at_idx" ON "notebook_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notebooks_user_id_idx" ON "notebooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "source_chunks_source_id_chunk_index_idx" ON "source_chunks" USING btree ("source_id","chunk_index");--> statement-breakpoint
CREATE INDEX "source_chunks_notebook_id_idx" ON "source_chunks" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "source_chunks_embedding_idx" ON "source_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "source_index_jobs_source_id_idx" ON "source_index_jobs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_index_jobs_status_idx" ON "source_index_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "source_index_jobs_notebook_id_idx" ON "source_index_jobs" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "sources_notebook_id_idx" ON "sources" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "sources_kind_idx" ON "sources" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "sources_content_hash_idx" ON "sources" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "study_material_folders_notebook_id_idx" ON "study_material_folders" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "study_material_folders_parent_id_idx" ON "study_material_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "study_material_folders_deleted_at_idx" ON "study_material_folders" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "study_materials_notebook_id_idx" ON "study_materials" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "study_materials_kind_idx" ON "study_materials" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "study_materials_title_idx" ON "study_materials" USING btree ("title");--> statement-breakpoint
CREATE INDEX "study_materials_folder_id_idx" ON "study_materials" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "study_materials_deleted_at_idx" ON "study_materials" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "web_search_jobs_notebook_id_idx" ON "web_search_jobs" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX "web_search_jobs_user_id_idx" ON "web_search_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "web_search_jobs_status_idx" ON "web_search_jobs" USING btree ("status");