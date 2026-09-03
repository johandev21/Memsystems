import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { userSettings } from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import {
  decryptApiKey,
  encryptApiKey,
  isEncryptedPayload,
} from './key-encryption';

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  /**
   * The user's Vercel AI Gateway key, decrypted. `null` when unset or
   * unreadable (corrupt payload / rotated encryption secret) — the latter
   * is logged so it surfaces in server logs instead of failing silently.
   */
  async getGatewayApiKey(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ apiKey: userSettings.gatewayApiKey })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    const stored = row?.apiKey;
    if (!stored) return null;
    if (!isEncryptedPayload(stored)) {
      this.logger.warn(
        `Ignoring unencrypted gateway key payload for user ${userId}.`,
      );
      return null;
    }
    try {
      return decryptApiKey(stored);
    } catch (error) {
      this.logger.warn(
        `Could not decrypt gateway key for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async setGatewayApiKey(
    userId: string,
    apiKey: string | null | undefined,
  ): Promise<void> {
    if (!apiKey || !apiKey.trim()) {
      await this.removeGatewayApiKey(userId);
      return;
    }
    const encrypted = encryptApiKey(apiKey.trim());
    await this.db
      .insert(userSettings)
      .values({ userId, gatewayApiKey: encrypted })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { gatewayApiKey: encrypted, updatedAt: new Date() },
      });
  }

  async removeGatewayApiKey(userId: string): Promise<void> {
    await this.db
      .update(userSettings)
      .set({ gatewayApiKey: null, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  }
}
