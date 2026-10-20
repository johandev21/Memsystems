import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, count, desc, eq, lt, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as appSchema from '../../database/schema';
import {
  agentKeys,
  agentPendingActions,
  type AgentActionTargetType,
  type AgentPendingActionStatus,
} from '../../database/schema';
import {
  BadRequestError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { NotebooksService } from '../notebooks/notebooks.service';
import { SourcesService } from '../sources/sources.service';
import { StudyMaterialService } from '../study-materials/study-material.service';
import { TrashLedgerService } from '../trash/trash-ledger.service';
import { DRIZZLE } from '../database/database.module';
import { AgentAuditService } from './agent-audit.service';
import { FOLDER_DELETE_UNAVAILABLE_MESSAGE } from './delete-policy';

/** A Pending Agent Action expires 15 minutes after it is created. */
export const AGENT_ACTION_TTL_MS = 15 * 60 * 1000;

/** Resolved actions are kept for a week so the UI can show recent outcomes. */
export const AGENT_ACTION_RETENTION_DAYS = 7;

export interface AgentPendingActionEntry {
  id: string;
  agentKeyId: string | null;
  agentKeyName: string | null;
  toolName: string;
  notebookId: string | null;
  targetType: AgentActionTargetType;
  targetIds: string[];
  summary: string;
  payload: Record<string, unknown> | null;
  status: AgentPendingActionStatus;
  errorMessage: string | null;
  createdAt: Date;
  expiresAt: Date;
  resolvedAt: Date | null;
}

export interface CreateAgentPendingActionInput {
  agentKeyId?: string | null;
  toolName: string;
  notebookId?: string | null;
  targetType: AgentActionTargetType;
  targetIds: string[];
  summary: string;
  payload?: Record<string, unknown> | null;
  /** Defaults to {@link AGENT_ACTION_TTL_MS}. */
  ttlMs?: number;
}

export interface ExecuteAgentDeleteInput {
  targetType: AgentActionTargetType;
  targetIds: string[];
  payload?: Record<string, unknown> | null;
}

export interface ListAgentPendingActionsInput {
  status?: AgentPendingActionStatus;
}

export interface AgentPendingActionsPage {
  actions: AgentPendingActionEntry[];
  pendingCount: number;
}

type ActionRow = typeof agentPendingActions.$inferSelect;

const actionSelection = {
  id: agentPendingActions.id,
  agentKeyId: agentPendingActions.agentKeyId,
  agentKeyName: agentKeys.name,
  toolName: agentPendingActions.toolName,
  notebookId: agentPendingActions.notebookId,
  targetType: agentPendingActions.targetType,
  targetIds: agentPendingActions.targetIds,
  summary: agentPendingActions.summary,
  payload: agentPendingActions.payload,
  status: agentPendingActions.status,
  errorMessage: agentPendingActions.errorMessage,
  createdAt: agentPendingActions.createdAt,
  expiresAt: agentPendingActions.expiresAt,
  resolvedAt: agentPendingActions.resolvedAt,
};

function toEntry(
  row: ActionRow,
  agentKeyName: string | null = null,
): AgentPendingActionEntry {
  return {
    id: row.id,
    agentKeyId: row.agentKeyId,
    agentKeyName,
    toolName: row.toolName,
    notebookId: row.notebookId,
    targetType: row.targetType,
    targetIds: row.targetIds,
    summary: row.summary,
    payload: row.payload,
    status: row.status,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    resolvedAt: row.resolvedAt,
  };
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Owns Pending Agent Actions: the approval queue for destructive MCP requests,
 * the execution path shared by approvals and direct policy-allowed deletes, and
 * the audit row written when an approval executes.
 */
@Injectable()
export class AgentActionsService {
  private readonly logger = new Logger(AgentActionsService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof appSchema>,
    private readonly notebooksService: NotebooksService,
    private readonly sourcesService: SourcesService,
    private readonly studyMaterialsService: StudyMaterialService,
    private readonly trashLedgerService: TrashLedgerService,
    private readonly auditService: AgentAuditService,
  ) {}

  async create(
    input: CreateAgentPendingActionInput,
  ): Promise<AgentPendingActionEntry> {
    const expiresAt = new Date(
      Date.now() + (input.ttlMs ?? AGENT_ACTION_TTL_MS),
    );

    const [row] = await this.db
      .insert(agentPendingActions)
      .values({
        agentKeyId: input.agentKeyId ?? null,
        toolName: input.toolName.slice(0, 100),
        notebookId: input.notebookId ?? null,
        targetType: input.targetType,
        targetIds: input.targetIds,
        summary: input.summary,
        payload: input.payload ?? null,
        status: 'pending',
        expiresAt,
      })
      .returning();

    return toEntry(row);
  }

  async get(id: string): Promise<AgentPendingActionEntry | null> {
    // Keep polling (`get_action_status`) from reporting a stale `pending`
    // status after the 15-minute window has passed.
    await this.expireStale();

    const [row] = await this.db
      .select(actionSelection)
      .from(agentPendingActions)
      .leftJoin(agentKeys, eq(agentKeys.id, agentPendingActions.agentKeyId))
      .where(eq(agentPendingActions.id, id))
      .limit(1);

    return row ?? null;
  }

  async list(
    input: ListAgentPendingActionsInput = {},
  ): Promise<AgentPendingActionsPage> {
    await this.expireStale();

    const where = input.status
      ? eq(agentPendingActions.status, input.status)
      : undefined;

    const [actions, totals] = await Promise.all([
      this.db
        .select(actionSelection)
        .from(agentPendingActions)
        .leftJoin(agentKeys, eq(agentKeys.id, agentPendingActions.agentKeyId))
        .where(where)
        .orderBy(desc(agentPendingActions.createdAt)),
      this.db
        .select({ total: count() })
        .from(agentPendingActions)
        .where(eq(agentPendingActions.status, 'pending')),
    ]);

    return {
      actions,
      pendingCount: Number(totals[0]?.total ?? 0),
    };
  }

  async count(): Promise<number> {
    await this.expireStale();
    const [row] = await this.db
      .select({ total: count() })
      .from(agentPendingActions)
      .where(eq(agentPendingActions.status, 'pending'));
    return Number(row?.total ?? 0);
  }

  /**
   * Executes one approved action. Target failures are recorded on the action
   * and in the audit log instead of being rethrown, so Settings can show the
   * outcome without losing the row.
   */
  async approve(id: string): Promise<AgentPendingActionEntry> {
    const action = await this.get(id);
    if (!action) {
      throw new NotFoundError('Pending action');
    }

    await this.assertResolvable(action);

    if (action.status !== 'pending') {
      return action;
    }

    const startedAt = Date.now();

    try {
      await this.executeDelete({
        targetType: action.targetType,
        targetIds: action.targetIds,
        payload: action.payload,
      });
      await this.updateStatus(id, 'approved');
      await this.recordApprovalAudit(
        action,
        'success',
        null,
        Date.now() - startedAt,
      );
    } catch (error) {
      const message = errorMessageOf(error);
      await this.updateStatus(id, 'failed', message);
      await this.recordApprovalAudit(
        action,
        'error',
        message,
        Date.now() - startedAt,
      );
    }

    return (await this.get(id)) ?? action;
  }

  async reject(id: string): Promise<AgentPendingActionEntry> {
    const action = await this.get(id);
    if (!action) {
      throw new NotFoundError('Pending action');
    }

    await this.assertResolvable(action);

    if (action.status !== 'pending') {
      return action;
    }

    await this.updateStatus(id, 'rejected');
    return (await this.get(id)) ?? action;
  }

  /**
   * Runs the delete behind an action or a policy-allowed request. Shared by the
   * approval endpoint and the MCP tools so both paths behave identically.
   */
  async executeDelete(input: ExecuteAgentDeleteInput): Promise<void> {
    const { targetType, targetIds, payload } = input;

    switch (targetType) {
      case 'notebook':
        for (const id of targetIds) {
          await this.notebooksService.delete(id);
        }
        return;

      case 'source':
        for (const id of targetIds) {
          await this.sourcesService.delete(id);
        }
        return;

      case 'study_material':
        for (const id of targetIds) {
          if (payload?.permanent === true) {
            await this.studyMaterialsService.permanentDelete(id);
          } else {
            await this.studyMaterialsService.delete(id);
          }
        }
        return;

      case 'trash':
        await this.trashLedgerService.emptyTrash();
        return;

      case 'folder':
        throw new BadRequestError(FOLDER_DELETE_UNAVAILABLE_MESSAGE);
    }
  }

  /**
   * Marks expired pending actions as `expired`. Called by the polling endpoints
   * so counts stay accurate between cleanup runs.
   */
  async expireStale(): Promise<number> {
    const expired = await this.db
      .update(agentPendingActions)
      .set({ status: 'expired', resolvedAt: new Date() })
      .where(
        and(
          eq(agentPendingActions.status, 'pending'),
          lt(agentPendingActions.expiresAt, new Date()),
        ),
      )
      .returning({ id: agentPendingActions.id });
    return expired.length;
  }

  async pruneResolved(
    days: number = AGENT_ACTION_RETENTION_DAYS,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleted = await this.db
      .delete(agentPendingActions)
      .where(
        and(
          ne(agentPendingActions.status, 'pending'),
          lt(agentPendingActions.resolvedAt, cutoff),
        ),
      )
      .returning({ id: agentPendingActions.id });
    return deleted.length;
  }

  @Cron('*/10 * * * *')
  async cleanup(): Promise<void> {
    try {
      await this.expireStale();
      await this.pruneResolved();
    } catch (error) {
      this.logger.warn(
        `Pending action cleanup failed: ${errorMessageOf(error)}`,
      );
    }
  }

  private async assertResolvable(
    action: AgentPendingActionEntry,
  ): Promise<void> {
    if (action.status === 'expired') {
      throw new BadRequestError(
        'This pending action has expired. Ask the agent to request the deletion again.',
        { messageKey: 'errors.agent.actionExpired' },
      );
    }

    if (
      action.status === 'pending' &&
      action.expiresAt.getTime() <= Date.now()
    ) {
      await this.updateStatus(action.id, 'expired');
      throw new BadRequestError(
        'This pending action has expired. Ask the agent to request the deletion again.',
        { messageKey: 'errors.agent.actionExpired' },
      );
    }
  }

  private async updateStatus(
    id: string,
    status: AgentPendingActionStatus,
    errorMessage?: string | null,
  ): Promise<void> {
    await this.db
      .update(agentPendingActions)
      .set({
        status,
        errorMessage: errorMessage ?? null,
        resolvedAt: status === 'pending' ? null : new Date(),
      })
      .where(eq(agentPendingActions.id, id));
  }

  private async recordApprovalAudit(
    action: AgentPendingActionEntry,
    status: 'success' | 'error',
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void> {
    try {
      await this.auditService.recordToolCall({
        agentKeyId: action.agentKeyId,
        toolName: action.toolName,
        args: {
          actionId: action.id,
          targetType: action.targetType,
          targetIds: action.targetIds,
          ...(action.payload ?? {}),
        },
        status,
        errorMessage,
        durationMs,
        notebookId: action.notebookId,
      });
    } catch (error) {
      // Auditing is best-effort and must not hide the execution outcome.
      this.logger.warn(
        `Could not record approval audit row for ${action.toolName}: ${errorMessageOf(
          error,
        )}`,
      );
    }
  }
}
