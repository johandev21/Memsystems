-- Adds the global Voyage AI key column (embeddings provider). Stored
-- AES-256-GCM encrypted by UserSettingsService, like gateway_api_key.
ALTER TABLE "app_settings" ADD COLUMN "voyage_api_key" text;
