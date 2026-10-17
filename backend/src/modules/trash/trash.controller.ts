import { Controller, Get, Query } from '@nestjs/common';
import { TrashLedgerService } from './trash-ledger.service';

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
}
