import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { appSettings } from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import {
  decryptApiKey,
  encryptApiKey,
  isEncryptedPayload,
} from './key-encryption';

/** Singleton row id in `app_settings` holding the global gateway key. */
export const APP_SETTINGS_ID = 'global';

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  /**
   * The global Vercel AI Gateway key, decrypted. `null` when unset or
   * unreadable (corrupt payload / rotated encryption secret) — the latter
   * is logged so it surfaces in server logs instead of failing silently.
   */
  async getGatewayApiKey(): Promise<string | null> {
    const [row] = await this.db
      .select({ apiKey: appSettings.gatewayApiKey })
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID));
    const stored = row?.apiKey;
    if (!stored) return null;
    if (!isEncryptedPayload(stored)) {
      this.logger.warn(
        'Ignoring unencrypted gateway key payload in app_settings.',
      );
      return null;
    }
    try {
      return decryptApiKey(stored);
    } catch (error) {
      this.logger.warn(
        `Could not decrypt gateway key: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async setGatewayApiKey(apiKey: string | null | undefined): Promise<void> {
    if (!apiKey || !apiKey.trim()) {
      await this.removeGatewayApiKey();
      return;
    }
    const encrypted = encryptApiKey(apiKey.trim());
    await this.db
      .insert(appSettings)
      .values({ id: APP_SETTINGS_ID, gatewayApiKey: encrypted })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { gatewayApiKey: encrypted, updatedAt: new Date() },
      });
  }

  async removeGatewayApiKey(): Promise<void> {
    await this.db
      .update(appSettings)
      .set({ gatewayApiKey: null, updatedAt: new Date() })
      .where(eq(appSettings.id, APP_SETTINGS_ID));
  }

  /**
   * The global Voyage AI key (embeddings), decrypted. Same contract as the
   * gateway key: `null` when unset or unreadable, with decryption problems
   * logged rather than failing silently.
   */
  async getVoyageApiKey(): Promise<string | null> {
    const [row] = await this.db
      .select({ apiKey: appSettings.voyageApiKey })
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID));
    const stored = row?.apiKey;
    if (!stored) return null;
    if (!isEncryptedPayload(stored)) {
      this.logger.warn(
        'Ignoring unencrypted voyage key payload in app_settings.',
      );
      return null;
    }
    try {
      return decryptApiKey(stored);
    } catch (error) {
      this.logger.warn(
        `Could not decrypt voyage key: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async setVoyageApiKey(apiKey: string | null | undefined): Promise<void> {
    if (!apiKey || !apiKey.trim()) {
      await this.removeVoyageApiKey();
      return;
    }
    const encrypted = encryptApiKey(apiKey.trim());
    await this.db
      .insert(appSettings)
      .values({ id: APP_SETTINGS_ID, voyageApiKey: encrypted })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { voyageApiKey: encrypted, updatedAt: new Date() },
      });
  }

  async removeVoyageApiKey(): Promise<void> {
    await this.db
      .update(appSettings)
      .set({ voyageApiKey: null, updatedAt: new Date() })
      .where(eq(appSettings.id, APP_SETTINGS_ID));
  }
}
