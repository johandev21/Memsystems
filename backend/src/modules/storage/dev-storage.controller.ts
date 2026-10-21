import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain-error';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@Controller('dev-storage')
export class DevStorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get(':key')
  @ApiOperation({
    summary: 'Download local storage object',
    description:
      'Serves a local storage object signed by the dev storage adapter. Used for local development and tests only.',
  })
  @ApiParam({ name: 'key', description: 'Storage key of the object.' })
  @ApiQuery({ name: 'expires', description: 'Signed link expiry timestamp.' })
  @ApiQuery({ name: 'sig', description: 'Signed link signature.' })
  @ApiQuery({
    name: 'filename',
    required: false,
    description:
      'When set, the response is served as a download with this filename.',
  })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'The stored object bytes.',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async getDevStorageFile(
    @Param('key') key: string,
    @Query('expires') expires: string,
    @Query('sig') sig: string,
    @Query('filename') filename: string,
    @Res() res: Response,
  ) {
    const decodedKey = decodeURIComponent(key);
    const verification = this.storageService.verifyLocalToken(
      decodedKey,
      expires,
      sig,
    );

    if (!verification.ok) {
      if (verification.reason === 'expired') {
        throw new ForbiddenError('Link expired', {
          messageKey: 'errors.storage.dev.linkExpired',
        });
      }
      throw new ForbiddenError('Invalid signature', {
        messageKey: 'errors.storage.dev.invalidSignature',
      });
    }

    try {
      const buffer = await this.storageService.getObjectBuffer(decodedKey);
      const contentType = this.storageService.contentTypeForKey(decodedKey);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      if (filename) {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename.replace(/"/g, '')}"`,
        );
      }

      res.send(buffer);
    } catch {
      throw new NotFoundError('File not found', {
        messageKey: 'errors.storage.dev.fileNotFound',
      });
    }
  }
}
