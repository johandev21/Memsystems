ALTER TYPE "study_material_kind" ADD VALUE 'audio_overview';

CREATE TABLE "study_material_audio" (
  "study_material_id" varchar PRIMARY KEY NOT NULL REFERENCES "study_materials"("id") ON DELETE CASCADE,
  "audio" bytea NOT NULL,
  "content_type" varchar(100) DEFAULT 'audio/wav' NOT NULL
);
