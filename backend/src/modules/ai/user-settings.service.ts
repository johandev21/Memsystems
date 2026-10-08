import { Injectable } from '@nestjs/common';

/** Singleton row id in `app_settings` holding global configuration. */
export const APP_SETTINGS_ID = 'global';

@Injectable()
export class UserSettingsService {}
