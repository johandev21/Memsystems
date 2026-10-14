DELETE FROM "study_materials" WHERE "kind"::text IN ('study_guide', 'practice_problems', 'case_study');--> statement-breakpoint
DELETE FROM "generation_requests" WHERE "kind"::text IN ('study_guide', 'practice_problems', 'case_study');--> statement-breakpoint
ALTER TYPE "public"."study_material_kind" RENAME TO "study_material_kind_old";--> statement-breakpoint
CREATE TYPE "public"."study_material_kind" AS ENUM('quiz', 'simple_flashcard', 'roadmap', 'mind_map', 'slides');--> statement-breakpoint
ALTER TABLE "study_materials" ALTER COLUMN "kind" TYPE "public"."study_material_kind" USING "kind"::text::"public"."study_material_kind";--> statement-breakpoint
ALTER TABLE "generation_requests" ALTER COLUMN "kind" TYPE "public"."study_material_kind" USING "kind"::text::"public"."study_material_kind";--> statement-breakpoint
DROP TYPE "public"."study_material_kind_old";
