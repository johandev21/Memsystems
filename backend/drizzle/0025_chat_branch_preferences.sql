ALTER TABLE "notebook_chat_messages"
  ADD COLUMN "preferred_child_id" varchar,
  ADD COLUMN "preferred_child_initialized" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

WITH RECURSIVE selected_path AS (
  SELECT
    n."id" AS "notebook_id",
    message."id" AS "message_id",
    message."parent_id"
  FROM "notebooks" AS n
  JOIN "notebook_chat_messages" AS message
    ON message."id" = n."selected_chat_message_id"

  UNION ALL

  SELECT
    selected_path."notebook_id",
    parent."id" AS "message_id",
    parent."parent_id"
  FROM selected_path
  JOIN "notebook_chat_messages" AS parent
    ON parent."id" = selected_path."parent_id"
), ranked_children AS (
  SELECT
    parent."id" AS "parent_id",
    child."id" AS "child_id",
    row_number() OVER (
      PARTITION BY parent."id"
      ORDER BY
        (selected_path."message_id" IS NOT NULL) DESC,
        child."created_at" ASC,
        child."id" ASC
    ) AS "rank"
  FROM "notebook_chat_messages" AS parent
  JOIN "notebook_chat_messages" AS child
    ON child."parent_id" = parent."id"
  LEFT JOIN selected_path
    ON selected_path."notebook_id" = parent."notebook_id"
    AND selected_path."message_id" = child."id"
)
UPDATE "notebook_chat_messages" AS parent
SET "preferred_child_id" = ranked_children."child_id"
FROM ranked_children
WHERE ranked_children."parent_id" = parent."id"
  AND ranked_children."rank" = 1;
--> statement-breakpoint

UPDATE "notebook_chat_messages"
SET "preferred_child_initialized" = true;
