-- REVERT migration (0009 switched embeddings to gateway text-embedding-3-small
-- at 1536 dims): the embeddings provider is now Voyage AI voyage-4, which
-- outputs 1024-dim vectors. Old embeddings are invalid in the new embedding
-- space, so drop all of them before shrinking the column. Destructive by
-- design (dev data disposable; sources re-index via the jobs system). No-op
-- on fresh DBs (empty table).
DELETE FROM "source_chunks";--> statement-breakpoint
DROP INDEX "public"."source_chunks_embedding_idx";--> statement-breakpoint
ALTER TABLE "source_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1024);--> statement-breakpoint
CREATE INDEX "source_chunks_embedding_idx" ON "source_chunks" USING hnsw ("embedding" vector_cosine_ops);
