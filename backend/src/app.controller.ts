import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'API root',
    description:
      'Returns the greeting served by the Memsystems API. Useful as a liveness check.',
  })
  @ApiOkResponse({ description: 'API greeting.', schema: { type: 'string' } })
  getHello(): string {
    return this.appService.getHello();
  }
}
