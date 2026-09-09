-- DESTRUCTIVE migration (approved, dev DB disposable): drop all stale 1536-dim
-- embeddings before narrowing the column. No-op on fresh DBs (empty table).
DELETE FROM "source_chunks";--> statement-breakpoint
DROP INDEX "public"."source_chunks_embedding_idx";--> statement-breakpoint
ALTER TABLE "source_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(384);--> statement-breakpoint
CREATE INDEX "source_chunks_embedding_idx" ON "source_chunks" USING hnsw ("embedding" vector_cosine_ops);
