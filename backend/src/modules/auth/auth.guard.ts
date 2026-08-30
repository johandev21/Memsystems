import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from '../../common/errors/domain-error';
import {
  type AuthPrincipal,
  type RequestAuthenticator,
  REQUEST_AUTHENTICATOR,
} from './auth.service';

export type AuthenticatedRequest = Request & {
  principal?: AuthPrincipal;
  userId?: string;
  sessionId?: string;
  user?: { id: string };
  session?: { id: string };
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(REQUEST_AUTHENTICATOR)
    private readonly authenticator: RequestAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = await this.authenticator.authenticate(req);
    if (!principal) {
      throw new UnauthorizedError('Unauthorized');
    }

    req.principal = principal;
    req.userId = principal.userId;
    req.sessionId = principal.sessionId;
    req.user = { id: principal.userId };
    req.session = { id: principal.sessionId };
    return true;
  }
}
