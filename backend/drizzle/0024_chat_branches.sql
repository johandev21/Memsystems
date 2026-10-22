ALTER TABLE "notebook_chat_messages"
  ADD COLUMN "parent_id" varchar;

ALTER TABLE "notebook_chat_messages"
  ADD CONSTRAINT "notebook_chat_messages_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "notebook_chat_messages"("id") ON DELETE CASCADE;

CREATE INDEX "notebook_chat_messages_parent_id_idx"
  ON "notebook_chat_messages" ("parent_id");

ALTER TABLE "notebooks"
  ADD COLUMN "selected_chat_message_id" varchar;

ALTER TABLE "notebooks"
  ADD CONSTRAINT "notebooks_selected_chat_message_id_fkey"
  FOREIGN KEY ("selected_chat_message_id") REFERENCES "notebook_chat_messages"("id") ON DELETE SET NULL;

-- Rebuild the old chronological transcript as a tree without changing any
-- message data. Repeated assistant rows are siblings for the preceding user;
-- the following user continues from the last historical assistant row.
DO $$
DECLARE
  message_row record;
  current_notebook_id varchar;
  previous_message_id varchar;
  previous_user_id varchar;
  previous_role text;
  branch_parent_id varchar;
BEGIN
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
END $$;

UPDATE "notebooks" AS n
SET "selected_chat_message_id" = latest."id"
FROM (
  SELECT DISTINCT ON ("notebook_id") "notebook_id", "id"
  FROM "notebook_chat_messages"
  ORDER BY "notebook_id", "created_at" DESC, "id" DESC
) AS latest
WHERE n."id" = latest."notebook_id";
