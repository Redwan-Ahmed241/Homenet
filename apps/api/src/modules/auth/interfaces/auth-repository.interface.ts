export interface AuthIdentityWithUser {
  id: string;
  provider: string;
  email: string | null;
  password_hash: string | null;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface RefreshTokenWithUser {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    auth_identities: { email: string | null }[];
  };
}

export interface UserWithAuthIdentities {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: Date;
  auth_identities: {
    email: string | null;
    verified_at: Date | null;
  }[];
}

export type AuthProvider = 'LOCAL' | 'GOOGLE';

export interface IAuthRepository {
  findIdentityByProvider(provider: AuthProvider, email: string): Promise<{ id: string } | null>;

  findIdentityWithUser(provider: AuthProvider, email: string): Promise<AuthIdentityWithUser | null>;

  createUserWithIdentity(
    userData: { full_name: string },
    identityData: { provider: AuthProvider; email: string; password_hash: string },
  ): Promise<{ id: string; full_name: string; avatar_url: string | null }>;

  findRefreshTokenWithUser(tokenHash: string): Promise<RefreshTokenWithUser | null>;

  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;

  revokeRefreshToken(tokenId: string): Promise<void>;

  rotateRefreshToken(
    oldTokenId: string,
    newTokenData: { user_id: string; token_hash: string; expires_at: Date },
  ): Promise<void>;

  revokeRefreshTokensByUserAndHash(userId: string, tokenHash: string): Promise<void>;

  revokeAllRefreshTokensForUser(userId: string): Promise<void>;

  findUserWithAuthIdentities(userId: string): Promise<UserWithAuthIdentities | null>;

  updatePasswordHash(userId: string, newPasswordHash: string): Promise<void>;
}
