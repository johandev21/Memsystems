import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BadRequestError } from '../../common/errors/domain-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AgentAuditStatus } from '../../database/schema';
import { AgentAuditService } from './agent-audit.service';
import { AgentKeysService } from './agent-keys.service';
import { AgentSettingsService } from './agent-settings.service';
import {
  CreateAgentKeyDto,
  UpdateAgentAccessDto,
} from './dto/agent-access.dto';

const AUDIT_STATUSES: AgentAuditStatus[] = [
  'success',
  'error',
  'denied',
  'pending_approval',
];

function parseNonNegativeInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : Math.max(0, parsed);
}

function parseAuditStatus(
  value: string | undefined,
): AgentAuditStatus | undefined {
  if (!value) {
    return undefined;
  }
  if (!AUDIT_STATUSES.includes(value as AgentAuditStatus)) {
    throw new BadRequestError(`Invalid audit status: ${value}`, {
      messageKey: 'errors.agent.invalidAuditStatus',
      params: { status: value },
    });
  }
  return value as AgentAuditStatus;
}

@ApiTags('Agent Access')
@Controller('settings')
export class AgentAccessController {
  constructor(
    private readonly settingsService: AgentSettingsService,
    private readonly keysService: AgentKeysService,
    private readonly auditService: AgentAuditService,
  ) {}

  @Get('agent-access')
  @ApiOperation({
    summary: 'Get Agent Access settings',
    description:
      'Returns the workspace Agent Access policies: soft-delete, permanent-delete, resource-delete, and the default Notebook access level.',
  })
  @ApiOkResponse({ description: 'Agent Access settings.' })
  getAgentAccess() {
    return this.settingsService.get();
  }

  @Patch('agent-access')
  @ApiOperation({
    summary: 'Update Agent Access settings',
    description:
      'Updates one or more Agent Access policies. Omitted fields keep their current value.',
  })
  @ApiBody({ type: UpdateAgentAccessDto })
  @ApiOkResponse({ description: 'The updated Agent Access settings.' })
  @UsePipes(new ZodValidationPipe(UpdateAgentAccessDto.schema))
  updateAgentAccess(@Body() body: UpdateAgentAccessDto) {
    return this.settingsService.update(body);
  }

  @Get('agent-keys')
  @ApiOperation({
    summary: 'List Agent Keys',
    description:
      'Lists Agent Keys for Settings. Key hashes are never returned; only the display prefix identifies a key.',
  })
  @ApiOkResponse({ description: 'Agent Keys, newest first.' })
  listAgentKeys() {
    return this.keysService.list();
  }

  @Post('agent-keys')
  @ApiOperation({
    summary: 'Create Agent Key',
    description:
      'Creates an Agent Key and returns the plaintext key exactly once. Store it before leaving Settings.',
  })
  @ApiBody({ type: CreateAgentKeyDto })
  @ApiCreatedResponse({
    description: 'The new Agent Key and its display metadata.',
  })
  @UsePipes(new ZodValidationPipe(CreateAgentKeyDto.schema))
  createAgentKey(@Body() body: CreateAgentKeyDto) {
    return this.keysService.create(body.name);
  }

  @Delete('agent-keys/:id')
  @ApiOperation({
    summary: 'Revoke Agent Key',
    description:
      'Revokes an Agent Key. Requests using the key are rejected immediately.',
  })
  @ApiParam({ name: 'id', description: 'Agent Key id.' })
  @ApiOkResponse({
    description: 'Agent Key revoked.',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async revokeAgentKey(@Param('id') id: string) {
    await this.keysService.revoke(id);
    return { success: true };
  }

  @Get('agent-audit')
  @ApiOperation({
    summary: 'List Agent Audit Logs',
    description:
      'Lists Agent Audit Logs for Settings, newest first. Payload fields such as text, content, and transcripts are redacted.',
  })
  @ApiQuery({
    name: 'keyId',
    required: false,
    description: 'Only entries recorded for this Agent Key.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Only entries with this status.',
    schema: { type: 'string', enum: AUDIT_STATUSES },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    schema: { type: 'integer', minimum: 0, default: 0 },
  })
  @ApiOkResponse({ description: 'A page of Agent Audit Logs.' })
  listAgentAudit(
    @Query('keyId') keyId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.list({
      keyId,
      status: parseAuditStatus(status),
      limit: parseNonNegativeInt(limit),
      offset: parseNonNegativeInt(offset),
    });
  }

  @Delete('agent-audit')
  @ApiOperation({
    summary: 'Clear Agent Audit Logs',
    description:
      'Deletes every Agent Audit Log. Entries older than 30 days are also pruned automatically.',
  })
  @ApiOkResponse({
    description: 'Agent Audit Logs cleared.',
    schema: {
      type: 'object',
      properties: { success: { type: 'boolean' } },
    },
  })
  async clearAgentAudit() {
    await this.auditService.clear();
    return { success: true };
  }
}
