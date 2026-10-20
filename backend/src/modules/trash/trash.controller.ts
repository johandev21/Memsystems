import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BadRequestError } from '../../common/errors/domain-error';
import { TrashKind, TrashLedgerService } from './trash-ledger.service';

const VALID_KINDS: TrashKind[] = [
  'notebook_folder',
  'notebook',
  'source_folder',
  'source',
  'study_material_folder',
  'study_material',
];

function assertValidKind(kind: string): asserts kind is TrashKind {
  if (!VALID_KINDS.includes(kind as TrashKind)) {
    throw new BadRequestError(`Invalid trash kind: ${kind}`, {
      messageKey: 'errors.trash.invalidKind',
      params: { kind },
    });
  }
}

@ApiTags('Trash')
@Controller('trash')
export class TrashController {
  constructor(private readonly trashLedgerService: TrashLedgerService) {}

  @Get()
  @ApiOperation({
    summary: 'List Trash',
    description:
      'Lists soft-deleted Notebooks, Library Folders, Sources, Source Folders, Study Materials, and Study Material Folders, newest first.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor from a previous page.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
  })
  @ApiOkResponse({ description: 'A page of Trash entries.' })
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr
      ? Math.min(100, Math.max(1, parseInt(limitStr, 10) || 30))
      : 30;
    return this.trashLedgerService.list(cursor, limit);
  }

  @Post(':kind/:id/restore')
  @ApiOperation({
    summary: 'Restore Trash entry',
    description: 'Restores one soft-deleted item from Trash.',
  })
  @ApiParam({
    name: 'kind',
    description: 'Trash entry kind.',
    schema: { type: 'string', enum: VALID_KINDS },
  })
  @ApiParam({ name: 'id', description: 'Id of the trashed item.' })
  @ApiCreatedResponse({ description: 'The restored item.' })
  async restore(@Param('kind') kind: string, @Param('id') id: string) {
    assertValidKind(kind);
    return this.trashLedgerService.restore(kind, id);
  }

  @Delete(':kind/:id')
  @ApiOperation({
    summary: 'Permanently delete Trash entry',
    description:
      'Permanently deletes one item from Trash. This cannot be undone.',
  })
  @ApiParam({
    name: 'kind',
    description: 'Trash entry kind.',
    schema: { type: 'string', enum: VALID_KINDS },
  })
  @ApiParam({ name: 'id', description: 'Id of the trashed item.' })
  @ApiOkResponse({ description: 'The permanently deleted item.' })
  async deleteForever(@Param('kind') kind: string, @Param('id') id: string) {
    assertValidKind(kind);
    return this.trashLedgerService.deleteForever(kind, id);
  }

  @Delete()
  @ApiOperation({
    summary: 'Empty Trash',
    description:
      'Permanently deletes every item in Trash. This cannot be undone.',
  })
  @ApiOkResponse({ description: 'Trash emptied.' })
  async emptyTrash() {
    return this.trashLedgerService.emptyTrash();
  }
}
