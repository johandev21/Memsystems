import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { clerkMiddleware } from '@clerk/express';
import { AuthGuard } from './auth.guard';
import {
  AuthService,
  ClerkRequestAuthenticator,
  REQUEST_AUTHENTICATOR,
} from './auth.service';

@Global()
@Module({
  providers: [
    AuthService,
    AuthGuard,
    {
      provide: REQUEST_AUTHENTICATOR,
      useClass: ClerkRequestAuthenticator,
    },
  ],
  exports: [AuthService, AuthGuard, REQUEST_AUTHENTICATOR],
})
export class AuthModule implements NestModule {
  constructor(private readonly configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    const clientUrl =
      this.configService.get<string>('CLIENT_URL') || 'http://localhost:3000';
    const authorizedParties = [
      clientUrl,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean);

    const publishableKey = this.configService.get<string>(
      'CLERK_PUBLISHABLE_KEY',
    );
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');

    consumer
      .apply(
        clerkMiddleware({
          publishableKey,
          secretKey,
          authorizedParties,
        }),
      )
      .forRoutes('*');
  }
}
