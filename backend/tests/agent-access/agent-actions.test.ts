import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../src/common/errors/domain-error';
import {
  AGENT_ACTION_TTL_MS,
  AgentActionsService,
  type AgentPendingActionEntry,
} from '../../src/modules/agent-access/agent-actions.service';
import {
  buildDeleteSummary,
  buildDeleteSuccessMessage,
  decideDelete,
  EMPTY_TRASH_DISABLED_MESSAGE,
  FOLDER_DELETE_UNAVAILABLE_MESSAGE,
  NOTEBOOK_DELETE_DISABLED_MESSAGE,
  SOURCE_DELETE_DISABLED_MESSAGE,
  STUDY_MATERIAL_PERMANENT_DELETE_DISABLED_MESSAGE,
} from '../../src/modules/agent-access/delete-policy';

const defaults = {
  softDelete: 'ask' as const,
  permanentDelete: 'never' as const,
  resourceDelete: 'never' as const,
  notebookDefault: 'on' as const,
};

function createService() {
  const notebooks = { delete: vi.fn().mockResolvedValue(undefined) };
  const sources = { delete: vi.fn().mockResolvedValue(undefined) };
  const studyMaterials = {
    delete: vi.fn().mockResolvedValue(undefined),
    permanentDelete: vi.fn().mockResolvedValue(undefined),
  };
  const trash = { emptyTrash: vi.fn().mockResolvedValue({ success: true }) };
  const audit = { recordToolCall: vi.fn().mockResolvedValue({}) };

  const service = new AgentActionsService(
    {} as never,
    notebooks as never,
    sources as never,
    studyMaterials as never,
    trash as never,
    audit as never,
  );

  return { service, notebooks, sources, studyMaterials, trash, audit };
}

function action(
  overrides: Partial<AgentPendingActionEntry> = {},
): AgentPendingActionEntry {
  return {
    id: 'action_1',
    agentKeyId: 'key_1',
    agentKeyName: 'Test key',
    toolName: 'delete_source',
    notebookId: 'nb1',
    targetType: 'source',
    targetIds: ['src1'],
    summary: 'Delete source "Reading" (src1) and move it to Trash.',
    payload: null,
    status: 'pending',
    errorMessage: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + AGENT_ACTION_TTL_MS),
    resolvedAt: null,
    ...overrides,
  };
}

describe('delete policy', () => {
  it('refuses resource deletes unless the policy asks for approval', () => {
    expect(decideDelete({ targetType: 'notebook', settings: defaults })).toEqual(
      { kind: 'refuse', message: NOTEBOOK_DELETE_DISABLED_MESSAGE },
    );
    expect(decideDelete({ targetType: 'source', settings: defaults })).toEqual({
      kind: 'refuse',
      message: SOURCE_DELETE_DISABLED_MESSAGE,
    });
    expect(
      decideDelete({
        targetType: 'notebook',
        settings: { ...defaults, resourceDelete: 'ask' },
      }),
    ).toEqual({ kind: 'approval' });
  });

  it('allows soft study material deletes only when the policy allows it', () => {
    expect(
      decideDelete({ targetType: 'study_material', settings: defaults }),
    ).toEqual({ kind: 'approval' });
    expect(
      decideDelete({
        targetType: 'study_material',
        settings: { ...defaults, softDelete: 'allow' },
      }),
    ).toEqual({ kind: 'execute' });
  });

  it('requires approval for permanent deletes even when soft deletes are allowed', () => {
    expect(
      decideDelete({
        targetType: 'study_material',
        settings: { ...defaults, softDelete: 'allow', permanentDelete: 'ask' },
        permanent: true,
      }),
    ).toEqual({ kind: 'approval' });

    expect(
      decideDelete({
        targetType: 'study_material',
        settings: { ...defaults, softDelete: 'allow' },
        permanent: true,
      }),
    ).toEqual({
      kind: 'refuse',
      message: STUDY_MATERIAL_PERMANENT_DELETE_DISABLED_MESSAGE,
    });
  });

  it('refuses empty trash and folder deletes', () => {
    expect(decideDelete({ targetType: 'trash', settings: defaults })).toEqual({
      kind: 'refuse',
      message: EMPTY_TRASH_DISABLED_MESSAGE,
    });
    expect(
      decideDelete({
        targetType: 'trash',
        settings: { ...defaults, permanentDelete: 'ask' },
      }),
    ).toEqual({ kind: 'approval' });
    expect(decideDelete({ targetType: 'folder', settings: defaults })).toEqual({
      kind: 'refuse',
      message: FOLDER_DELETE_UNAVAILABLE_MESSAGE,
    });
  });

  it('builds readable single and bulk summaries', () => {
    expect(
      buildDeleteSummary({
        targetType: 'study_material',
        targetIds: ['sm1'],
        title: 'Cell biology',
        permanent: true,
      }),
    ).toBe('Permanently delete study material "Cell biology" (sm1).');

    expect(
      buildDeleteSummary({
        targetType: 'source',
        targetIds: ['a', 'b', 'c'],
        title: 'ignored',
      }),
    ).toBe('Delete 3 sources and move them to Trash.');

    expect(
      buildDeleteSummary({
        targetType: 'study_material',
        targetIds: ['a', 'b'],
        permanent: true,
      }),
    ).toBe('Permanently delete 2 study materials.');

    expect(
      buildDeleteSuccessMessage({ targetType: 'trash', targetIds: [] }),
    ).toBe('Emptied Trash.');
  });
});

describe('AgentActionsService', () => {
  it('executes notebook and source deletes for every target id', async () => {
    const { service, notebooks, sources } = createService();

    await service.executeDelete({
      targetType: 'notebook',
      targetIds: ['nb1', 'nb2'],
    });
    expect(notebooks.delete).toHaveBeenCalledTimes(2);
    expect(notebooks.delete).toHaveBeenNthCalledWith(1, 'nb1');
    expect(notebooks.delete).toHaveBeenNthCalledWith(2, 'nb2');

    await service.executeDelete({
      targetType: 'source',
      targetIds: ['src1'],
    });
    expect(sources.delete).toHaveBeenCalledWith('src1');
  });

  it('chooses soft or permanent study material deletes from the payload', async () => {
    const { service, studyMaterials } = createService();

    await service.executeDelete({
      targetType: 'study_material',
      targetIds: ['sm1'],
      payload: null,
    });
    expect(studyMaterials.delete).toHaveBeenCalledWith('sm1');

    await service.executeDelete({
      targetType: 'study_material',
      targetIds: ['sm2'],
      payload: { permanent: true },
    });
    expect(studyMaterials.permanentDelete).toHaveBeenCalledWith('sm2');
  });

  it('empties trash and rejects folder deletes', async () => {
    const { service, trash } = createService();

    await service.executeDelete({ targetType: 'trash', targetIds: [] });
    expect(trash.emptyTrash).toHaveBeenCalledTimes(1);

    await expect(
      service.executeDelete({ targetType: 'folder', targetIds: ['f1'] }),
    ).rejects.toThrow(FOLDER_DELETE_UNAVAILABLE_MESSAGE);
  });

  it('throws for expired actions and leaves resolved actions unchanged', async () => {
    const { service } = createService();
    const expired = action({ status: 'expired', resolvedAt: new Date() });
    vi.spyOn(service, 'get').mockResolvedValue(expired);

    await expect(service.approve('action_1')).rejects.toBeInstanceOf(
      BadRequestError,
    );
    await expect(service.reject('action_1')).rejects.toBeInstanceOf(
      BadRequestError,
    );

    const approved = action({ status: 'approved', resolvedAt: new Date() });
    vi.spyOn(service, 'get').mockResolvedValue(approved);
    await expect(service.approve('action_1')).resolves.toBe(approved);
    await expect(service.reject('action_1')).resolves.toBe(approved);
  });

  it('marks a pending action expired when its deadline has passed', async () => {
    const { service } = createService();
    vi.spyOn(service, 'get').mockResolvedValue(
      action({ expiresAt: new Date(Date.now() - 1_000) }),
    );
    const updateStatus = vi
      .spyOn(
        service as unknown as {
          updateStatus: (
            id: string,
            status: string,
            errorMessage?: string | null,
          ) => Promise<void>;
        },
        'updateStatus',
      )
      .mockResolvedValue(undefined);

    await expect(service.approve('action_1')).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(updateStatus).toHaveBeenCalledWith('action_1', 'expired');
  });

  it('marks an action approved and audits a successful execution', async () => {
    const { service, audit } = createService();
    const pending = action();
    vi.spyOn(service, 'get').mockResolvedValue(pending);
    vi.spyOn(service, 'executeDelete').mockResolvedValue(undefined);
    const updateStatus = vi
      .spyOn(
        service as unknown as {
          updateStatus: (
            id: string,
            status: string,
            errorMessage?: string | null,
          ) => Promise<void>;
        },
        'updateStatus',
      )
      .mockResolvedValue(undefined);

    await expect(service.approve('action_1')).resolves.toBe(pending);

    expect(updateStatus).toHaveBeenCalledWith('action_1', 'approved');
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'delete_source',
        status: 'success',
        errorMessage: null,
        notebookId: 'nb1',
      }),
    );
  });

  it('marks an action failed and audits the error without rethrowing', async () => {
    const { service, audit } = createService();
    const pending = action();
    vi.spyOn(service, 'get').mockResolvedValue(pending);
    vi.spyOn(service, 'executeDelete').mockRejectedValue(new Error('boom'));
    const updateStatus = vi
      .spyOn(
        service as unknown as {
          updateStatus: (
            id: string,
            status: string,
            errorMessage?: string | null,
          ) => Promise<void>;
        },
        'updateStatus',
      )
      .mockResolvedValue(undefined);

    await expect(service.approve('action_1')).resolves.toBe(pending);

    expect(updateStatus).toHaveBeenCalledWith('action_1', 'failed', 'boom');
    expect(audit.recordToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'delete_source',
        status: 'error',
        errorMessage: 'boom',
      }),
    );
  });

  it('throws a not-found error for unknown actions', async () => {
    const { service } = createService();
    vi.spyOn(service, 'get').mockResolvedValue(null);

    await expect(service.approve('missing')).rejects.toThrow(
      'Pending action not found',
    );
  });
});
