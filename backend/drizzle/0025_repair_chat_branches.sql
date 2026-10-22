-- Repair databases where 0023 was recorded before its schema changes arrived.
-- Only rebuild chronological links when parent_id did not exist at entry.
-- Once the column exists, NULL parent_id values may be intentional root
-- messages, so this migration must preserve all existing edges verbatim.
DO $$
DECLARE
  parent_column_missing boolean;
  selected_column_missing boolean;
  message_row record;
  current_notebook_id varchar;
  previous_message_id varchar;
  previous_user_id varchar;
  previous_role text;
  branch_parent_id varchar;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'notebook_chat_messages'
      AND column_name = 'parent_id'
  ) INTO parent_column_missing;
  SELECT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'notebooks'
      AND column_name = 'selected_chat_message_id'
  ) INTO selected_column_missing;

  ALTER TABLE "notebook_chat_messages"
    ADD COLUMN IF NOT EXISTS "parent_id" varchar;
  ALTER TABLE "notebooks"
    ADD COLUMN IF NOT EXISTS "selected_chat_message_id" varchar;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notebook_chat_messages_parent_id_fkey') THEN
    ALTER TABLE "notebook_chat_messages" ADD CONSTRAINT "notebook_chat_messages_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "notebook_chat_messages"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notebooks_selected_chat_message_id_fkey') THEN
    ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_selected_chat_message_id_fkey"
      FOREIGN KEY ("selected_chat_message_id") REFERENCES "notebook_chat_messages"("id") ON DELETE SET NULL;
  END IF;

  IF parent_column_missing THEN
    FOR message_row IN
      SELECT "id", "notebook_id", "role"
      FROM "notebook_chat_messages"
      ORDER BY "notebook_id", "created_at", "id"
    LOOP
      IF current_notebook_id IS DISTINCT FROM message_row."notebook_id" THEN
        current_notebook_id := message_row."notebook_id";
        previous_message_id := NULL;
        previous_user_id := NULL;
        previous_role := NULL;
      END IF;

      IF message_row."role" = 'user' THEN
        branch_parent_id := previous_message_id;
        previous_user_id := message_row."id";
      ELSE
        branch_parent_id := CASE
          WHEN previous_role = 'assistant' THEN previous_user_id
          ELSE previous_message_id
        END;
      END IF;

      UPDATE "notebook_chat_messages"
      SET "parent_id" = branch_parent_id
      WHERE "id" = message_row."id";

      previous_message_id := message_row."id";
      previous_role := message_row."role";
    END LOOP;
  END IF;

  -- Infer a selected endpoint only for a wholly legacy schema. If parent_id
  -- already existed, preserve a missing/null pointer rather than guess from
  -- chronology across a potentially branched tree.
  IF parent_column_missing AND selected_column_missing THEN
    UPDATE "notebooks" AS n
    SET "selected_chat_message_id" = latest."id"
    FROM (
      SELECT DISTINCT ON ("notebook_id") "notebook_id", "id"
      FROM "notebook_chat_messages"
      ORDER BY "notebook_id", "created_at" DESC, "id" DESC
    ) AS latest
    WHERE n."id" = latest."notebook_id";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "notebook_chat_messages_parent_id_idx"
  ON "notebook_chat_messages" ("parent_id");
