CREATE TABLE IF NOT EXISTS "notebook_folders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"parent_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notebook_folders" ADD CONSTRAINT "notebook_folders_parent_id_notebook_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notebook_folders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notebook_folders_parent_id_idx" ON "notebook_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notebook_folders_name_idx" ON "notebook_folders" USING btree ("name");--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN IF NOT EXISTS "folder_id" varchar;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_folder_id_notebook_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."notebook_folders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notebooks_folder_id_idx" ON "notebooks" USING btree ("folder_id");
