UPDATE "notebook_chat_messages" AS selected_message
SET "preferred_child_id" = NULL,
    "preferred_child_initialized" = true
FROM "notebooks" AS notebook
WHERE notebook."selected_chat_message_id" = selected_message."id";
