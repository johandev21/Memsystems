import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
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

@Controller('trash')
export class TrashController {
  constructor(private readonly trashLedgerService: TrashLedgerService) {}

  @Get()
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
  async restore(@Param('kind') kind: string, @Param('id') id: string) {
    assertValidKind(kind);
    return this.trashLedgerService.restore(kind, id);
  }

  @Delete(':kind/:id')
  async deleteForever(@Param('kind') kind: string, @Param('id') id: string) {
    assertValidKind(kind);
    return this.trashLedgerService.deleteForever(kind, id);
  }

  @Delete()
  async emptyTrash() {
    return this.trashLedgerService.emptyTrash();
  }
}
