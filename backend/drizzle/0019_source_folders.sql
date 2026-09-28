CREATE TABLE IF NOT EXISTS "source_folders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"notebook_id" varchar NOT NULL,
	"parent_id" varchar,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_folders" ADD CONSTRAINT "source_folders_notebook_id_notebooks_id_fk" FOREIGN KEY ("notebook_id") REFERENCES "public"."notebooks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_folders" ADD CONSTRAINT "source_folders_parent_id_source_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."source_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_folders_notebook_id_idx" ON "source_folders" USING btree ("notebook_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_folders_parent_id_idx" ON "source_folders" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "folder_id" varchar;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sources" ADD CONSTRAINT "sources_folder_id_source_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."source_folders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sources_folder_id_idx" ON "sources" USING btree ("folder_id");
