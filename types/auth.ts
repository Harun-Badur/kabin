export interface AuthUser {
  id: string;
  email: string | null;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface SignUpParams {
  email: string;
  password: string;
}

export interface SignUpResult {
  needsEmailConfirmation: boolean;
}

export type AuthStatus = 'idle' | 'loading' | 'error' | 'success';
