import { Injectable } from '@nestjs/common';
import { getAuth } from '@clerk/express';
import type { Request } from 'express';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
}

export interface RequestAuthenticator {
  authenticate(request: Request): Promise<AuthPrincipal | null>;
}

export const REQUEST_AUTHENTICATOR = 'REQUEST_AUTHENTICATOR';

@Injectable()
export class ClerkRequestAuthenticator implements RequestAuthenticator {
  authenticate(request: Request): Promise<AuthPrincipal | null> {
    const auth = getAuth(request);
    if (!auth || !auth.userId || !auth.sessionId) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      userId: auth.userId,
      sessionId: auth.sessionId,
    });
  }
}

@Injectable()
export class InMemoryRequestAuthenticator implements RequestAuthenticator {
  private readonly principals = new Map<string, AuthPrincipal>();

  register(tokenOrUserId: string, principal: AuthPrincipal) {
    this.principals.set(tokenOrUserId, principal);
  }

  authenticate(request: Request): Promise<AuthPrincipal | null> {
    const rawHeader = request.headers['x-test-user-id'];
    const testUserId =
      typeof rawHeader === 'string'
        ? rawHeader
        : (request as unknown as { testUserId?: string }).testUserId;
    if (testUserId) {
      const rawSessionHeader = request.headers['x-test-session-id'];
      const sessionId =
        typeof rawSessionHeader === 'string'
          ? rawSessionHeader
          : 'test-session-id';
      return Promise.resolve(
        this.principals.get(testUserId) ?? {
          userId: testUserId,
          sessionId,
        },
      );
    }
    return Promise.resolve(null);
  }
}

@Injectable()
export class AuthService {}
