export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string };

export interface AuthContext {
  status: 'loading' | 'signed-out' | 'signed-in';
  userId?: string;
}
