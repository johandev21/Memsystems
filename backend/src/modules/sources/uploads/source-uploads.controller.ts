import {
  Body,
  Controller,
  Param,
  Post,
  Put,
  Req,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SourceUploadsService } from './source-uploads.service';
import { CreateUploadTargetDto } from './dto/create-upload-target.dto';
import { FinalizeUploadDto } from './dto/finalize-upload.dto';

@ApiTags('Sources')
@Controller()
export class SourceUploadsController {
  constructor(private readonly uploadsService: SourceUploadsService) {}

  @Post('notebooks/:notebookId/source-uploads')
  @ApiOperation({
    summary: 'Create Upload Intent',
    description:
      'Creates a short-lived Upload Intent that authorizes one direct file upload for the Notebook.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiBody({ type: CreateUploadTargetDto })
  @ApiCreatedResponse({ description: 'The Upload Intent and upload target.' })
  @UsePipes(new ZodValidationPipe(CreateUploadTargetDto.schema))
  createTarget(
    @Param('notebookId') notebookId: string,
    @Body() body: CreateUploadTargetDto,
  ) {
    return this.uploadsService.createTarget(notebookId, body);
  }

  @Put('source-uploads/:token')
  @ApiOperation({
    summary: 'Upload file to Upload Intent',
    description:
      'Streams the file bytes to the upload target named by the Upload Intent token.',
  })
  @ApiParam({ name: 'token', description: 'Upload Intent token.' })
  @ApiConsumes('application/octet-stream')
  @ApiBody({
    description: 'Raw file bytes.',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiOkResponse({ description: 'Upload accepted.' })
  uploadLocal(@Param('token') token: string, @Req() request: Request) {
    return this.uploadsService.uploadLocal(token, request);
  }

  @Post('notebooks/:notebookId/source-uploads/:token/finalize')
  @ApiOperation({
    summary: 'Finalize file upload',
    description:
      'Consumes the uploaded file, creates the Source, and starts ingestion. The Upload Intent is single-use.',
  })
  @ApiParam({ name: 'notebookId', description: 'Notebook id.' })
  @ApiParam({ name: 'token', description: 'Upload Intent token.' })
  @ApiBody({ type: FinalizeUploadDto })
  @ApiCreatedResponse({ description: 'The created Source.' })
  @UsePipes(new ZodValidationPipe(FinalizeUploadDto.schema))
  finalize(
    @Param('notebookId') notebookId: string,
    @Param('token') token: string,
    @Body() body: FinalizeUploadDto,
  ) {
    return this.uploadsService.finalize(notebookId, token, body.title);
  }
}
