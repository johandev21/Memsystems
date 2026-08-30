import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId =
      request.userId ?? request.principal?.userId ?? request.user?.id;
    if (data === 'id' || data === 'userId' || !data) {
      return userId;
    }
    return (
      (request.principal as Record<string, unknown> | undefined)?.[data] ??
      userId
    );
  },
);

export const CurrentSession = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId =
      request.sessionId ?? request.principal?.sessionId ?? request.session?.id;
    if (data === 'id' || data === 'sessionId' || !data) {
      return sessionId;
    }
    return (
      (request.principal as Record<string, unknown> | undefined)?.[data] ??
      sessionId
    );
  },
);
