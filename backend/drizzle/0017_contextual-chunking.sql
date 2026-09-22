-- Structure-aware chunking and contextual embeddings. Source chunks gain the
-- section heading path, the source kind, and the document/section context
-- header that is prepended to the searchable text. Existing chunks keep their
-- current representation until the reindex-all job rebuilds them (the chunking
-- and indexing versions were bumped), so the source kind is backfilled and the
-- remaining columns take a safe default.
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "indexing_representation" varchar(200);--> statement-breakpoint
ALTER TABLE "source_chunks" ADD COLUMN IF NOT EXISTS "heading_path" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD COLUMN IF NOT EXISTS "source_kind" "source_kind";--> statement-breakpoint
UPDATE "source_chunks"
SET "source_kind" = "sources"."kind"
FROM "sources"
WHERE "source_chunks"."source_id" = "sources"."id";--> statement-breakpoint
ALTER TABLE "source_chunks" ALTER COLUMN "source_kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD COLUMN IF NOT EXISTS "context_header" text DEFAULT '' NOT NULL;
