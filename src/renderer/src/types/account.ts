export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** Set from the Google account picture on Google sign-in; absent for email/password accounts. */
  avatar?: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}
