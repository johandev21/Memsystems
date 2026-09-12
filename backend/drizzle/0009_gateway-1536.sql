-- REVERT migration (0008 switched embeddings to self-hosted e5-small/384,
-- which is being removed): drop all 384-dim embeddings before widening the
-- column back to gateway text-embedding-3-small 1536 dims. Destructive by
-- design (dev data disposable). No-op on fresh DBs (empty table).
DELETE FROM "source_chunks";--> statement-breakpoint
DROP INDEX "public"."source_chunks_embedding_idx";--> statement-breakpoint
ALTER TABLE "source_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1536);--> statement-breakpoint
CREATE INDEX "source_chunks_embedding_idx" ON "source_chunks" USING hnsw ("embedding" vector_cosine_ops);
