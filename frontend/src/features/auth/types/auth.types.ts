import type { Session, User } from "better-auth";

export interface AuthContext {
  session: Session | null;
  user: User | null;
  isPending: boolean;
}

export type { Session, User };
