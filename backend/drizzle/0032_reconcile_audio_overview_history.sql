-- Main and the audio branch independently applied migrations 28 and 29.
-- Databases already past the audio timestamps must receive its additive schema too.
ALTER TYPE "study_material_kind" ADD VALUE IF NOT EXISTS 'audio_overview';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_material_audio" (
  "study_material_id" varchar PRIMARY KEY NOT NULL REFERENCES "study_materials"("id") ON DELETE CASCADE,
  "audio" bytea NOT NULL,
  "content_type" varchar(100) DEFAULT 'audio/wav' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_requests"
ADD COLUMN IF NOT EXISTS "generation_options" jsonb;
