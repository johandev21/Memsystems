import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BadRequestError } from '../../common/errors/domain-error';
import type { AgentPendingActionStatus } from '../../database/schema';
import { AgentActionsService } from './agent-actions.service';

const ACTION_STATUSES: AgentPendingActionStatus[] = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'failed',
];

function parseActionStatus(
  value: string | undefined,
): AgentPendingActionStatus {
  if (!value) {
    return 'pending';
  }
  if (!ACTION_STATUSES.includes(value as AgentPendingActionStatus)) {
    throw new BadRequestError(`Invalid pending action status: ${value}`, {
      messageKey: 'errors.agent.invalidActionStatus',
      params: { status: value },
    });
  }
  return value as AgentPendingActionStatus;
}

@ApiTags('Agent Access')
@Controller('agent-actions')
export class AgentActionsController {
  constructor(private readonly actionsService: AgentActionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List Pending Agent Actions',
    description:
      'Lists destructive agent requests waiting for approval, newest first. Actions expire 15 minutes after they are created.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Only actions with this status. Defaults to pending.',
    schema: { type: 'string', enum: ACTION_STATUSES, default: 'pending' },
  })
  @ApiOkResponse({
    description: 'Matching Pending Agent Actions and the pending count.',
  })
  list(@Query('status') status?: string) {
    return this.actionsService.list({ status: parseActionStatus(status) });
  }

  @Get('count')
  @ApiOperation({
    summary: 'Count Pending Agent Actions',
    description:
      'Returns the number of Pending Agent Actions. The header badge polls this endpoint.',
  })
  @ApiOkResponse({
    description: 'The pending action count.',
    schema: {
      type: 'object',
      properties: { pendingCount: { type: 'integer' } },
    },
  })
  async count() {
    return { pendingCount: await this.actionsService.count() };
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: 'Approve Pending Agent Action',
    description:
      'Executes the pending delete and records the outcome in the Agent Audit Log. Returns the updated action.',
  })
  @ApiParam({ name: 'id', description: 'Pending Agent Action id.' })
  @ApiOkResponse({ description: 'The updated Pending Agent Action.' })
  approve(@Param('id') id: string) {
    return this.actionsService.approve(id);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Reject Pending Agent Action',
    description:
      'Marks the pending delete as rejected without executing it. Returns the updated action.',
  })
  @ApiParam({ name: 'id', description: 'Pending Agent Action id.' })
  @ApiOkResponse({ description: 'The updated Pending Agent Action.' })
  reject(@Param('id') id: string) {
    return this.actionsService.reject(id);
  }
}
