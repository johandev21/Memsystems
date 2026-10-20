import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  appSettings,
  type AgentAccessLevel,
  type AgentConfirmPolicy,
  type AgentSoftDeletePolicy,
} from '../../database/schema';
import { DRIZZLE } from '../database/database.module';

const APP_SETTINGS_ID = 'global';

export interface AgentAccessSettings {
  softDelete: AgentSoftDeletePolicy;
  permanentDelete: AgentConfirmPolicy;
  resourceDelete: AgentConfirmPolicy;
  notebookDefault: AgentAccessLevel;
}

export type UpdateAgentAccessSettings = Partial<AgentAccessSettings>;

export const DEFAULT_AGENT_ACCESS_SETTINGS: AgentAccessSettings = {
  softDelete: 'ask',
  permanentDelete: 'never',
  resourceDelete: 'never',
  notebookDefault: 'on',
};

type AppSettingsRow = typeof appSettings.$inferSelect;

function toSettings(row: AppSettingsRow): AgentAccessSettings {
  return {
    softDelete: row.agentSoftDeletePolicy,
    permanentDelete: row.agentPermanentDeletePolicy,
    resourceDelete: row.agentResourceDeletePolicy,
    notebookDefault: row.agentNotebookAccessDefault,
  };
}

/**
 * Reads and writes the singleton `app_settings` row (`id = 'global'`).
 *
 * The Agent Access columns were added with defaults, so the row is created on
 * demand and never needs explicit backfilling.
 */
@Injectable()
export class AgentSettingsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
  ) {}

  async get(): Promise<AgentAccessSettings> {
    await this.ensureRow();
    const row = await this.findRow();
    return row ? toSettings(row) : { ...DEFAULT_AGENT_ACCESS_SETTINGS };
  }

  async update(input: UpdateAgentAccessSettings): Promise<AgentAccessSettings> {
    await this.ensureRow();

    const values: Partial<typeof appSettings.$inferInsert> = {};
    if (input.softDelete !== undefined) {
      values.agentSoftDeletePolicy = input.softDelete;
    }
    if (input.permanentDelete !== undefined) {
      values.agentPermanentDeletePolicy = input.permanentDelete;
    }
    if (input.resourceDelete !== undefined) {
      values.agentResourceDeletePolicy = input.resourceDelete;
    }
    if (input.notebookDefault !== undefined) {
      values.agentNotebookAccessDefault = input.notebookDefault;
    }

    if (Object.keys(values).length === 0) {
      return this.get();
    }

    const [row] = await this.db
      .update(appSettings)
      .set(values)
      .where(eq(appSettings.id, APP_SETTINGS_ID))
      .returning();

    return row ? toSettings(row) : this.get();
  }

  private async findRow(): Promise<AppSettingsRow | undefined> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))
      .limit(1);
    return row;
  }

  private async ensureRow(): Promise<void> {
    await this.db
      .insert(appSettings)
      .values({ id: APP_SETTINGS_ID })
      .onConflictDoNothing({ target: appSettings.id });
  }
}
