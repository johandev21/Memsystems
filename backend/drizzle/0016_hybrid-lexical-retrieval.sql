-- Hybrid lexical retrieval: chunks gain the searchable text the lexical leg
-- indexes and a generated tsvector with a GIN index over it. Existing chunks
-- are backfilled from their stored content (today's searchable text), so no
-- reindex is required. The `simple` configuration is deliberate: no stemming
-- and no stop words, so identifiers and mixed-language terms stay intact.
ALTER TABLE "source_chunks" ADD COLUMN IF NOT EXISTS "searchable_text" text;--> statement-breakpoint
UPDATE "source_chunks" SET "searchable_text" = "content" WHERE "searchable_text" IS NULL;--> statement-breakpoint
ALTER TABLE "source_chunks" ALTER COLUMN "searchable_text" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "source_chunks" ADD COLUMN IF NOT EXISTS "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "source_chunks"."searchable_text")) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_chunks_search_vector_idx" ON "source_chunks" USING gin ("search_vector");
