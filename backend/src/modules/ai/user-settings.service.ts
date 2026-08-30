import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import { userSettings } from '../../database/schema';
import { DRIZZLE } from '../database/database.module';
import type { ProviderId } from './providers/model-catalog';

const apiKeyColumns = {
  openai: userSettings.openaiApiKey,
  deepseek: userSettings.deepseekApiKey,
  anthropic: userSettings.anthropicApiKey,
  google: userSettings.geminiApiKey,
  kimi: userSettings.kimiApiKey,
} as const;

const apiKeyFields = {
  openai: 'openaiApiKey',
  deepseek: 'deepseekApiKey',
  anthropic: 'anthropicApiKey',
  google: 'geminiApiKey',
  kimi: 'kimiApiKey',
} as const;

@Injectable()
export class UserSettingsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async getUserOpenaiApiKey(userId: string): Promise<string | null> {
    return this.getUserApiKey(userId, 'openai');
  }

  async getUserApiKey(
    userId: string,
    providerId: ProviderId,
  ): Promise<string | null> {
    const column = apiKeyColumns[providerId];
    const [row] = await this.db
      .select({ apiKey: column })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    return (
      row?.apiKey ||
      process.env[
        `${providerId === 'google' ? 'GEMINI' : providerId.toUpperCase()}_API_KEY`
      ] ||
      (providerId === 'openai' ? process.env.PROVIDER_OPENAI_API_KEY : null) ||
      null
    );
  }

  async setUserOpenaiApiKey(
    userId: string,
    apiKey: string | null | undefined,
  ): Promise<void> {
    return this.setUserApiKey(userId, 'openai', apiKey);
  }

  async setUserApiKey(
    userId: string,
    providerId: ProviderId,
    apiKey: string | null | undefined,
  ): Promise<void> {
    if (!apiKey || !apiKey.trim()) {
      await this.removeUserApiKey(userId, providerId);
      return;
    }
    const trimmed = apiKey.trim();
    await this.db
      .insert(userSettings)
      .values({ userId, [apiKeyFields[providerId]]: trimmed })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { [apiKeyFields[providerId]]: trimmed, updatedAt: new Date() },
      });
  }

  async removeUserOpenaiApiKey(userId: string): Promise<void> {
    return this.removeUserApiKey(userId, 'openai');
  }

  async removeUserApiKey(
    userId: string,
    providerId: ProviderId,
  ): Promise<void> {
    await this.db
      .update(userSettings)
      .set({ [apiKeyFields[providerId]]: null, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId));
  }
}
