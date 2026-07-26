import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import type {
  IAuthRepository,
  AuthIdentityWithUser,
  RefreshTokenWithUser,
  UserWithAuthIdentities,
  AuthProvider,
} from '../interfaces/auth-repository.interface.js';

@Injectable()
export class PrismaAuthRepository implements IAuthRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async findIdentityByProvider(provider: AuthProvider, email: string): Promise<{ id: string } | null> {
    const identity = await this.prisma.authIdentity.findFirst({
      where: { provider, email } as any,
      select: { id: true },
    });

    return identity;
  }

  async findIdentityWithUser(provider: AuthProvider, email: string): Promise<AuthIdentityWithUser | null> {
    const identity = await this.prisma.authIdentity.findFirst({
      where: { provider, email } as any,
      include: { user: true },
    }) as any;

    if (!identity) return null;

    return {
      id: identity.id,
      provider: identity.provider,
      email: identity.email,
      password_hash: identity.password_hash,
      user: {
        id: identity.user.id,
        full_name: identity.user.full_name,
        avatar_url: identity.user.avatar_url,
      },
    };
  }

  async createUserWithIdentity(
    userData: { full_name: string },
    identityData: { provider: AuthProvider; email: string; password_hash: string },
  ): Promise<{ id: string; full_name: string; avatar_url: string | null }> {
    const user = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newUser = await tx.user.create({
        data: {
          full_name: userData.full_name,
        },
      });

      await tx.authIdentity.create({
        data: {
          user_id: newUser.id,
          provider: identityData.provider as any,
          email: identityData.email,
          password_hash: identityData.password_hash,
        },
      });

      return newUser;
    });

    return {
      id: user.id,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    };
  }

  async findRefreshTokenWithUser(tokenHash: string): Promise<RefreshTokenWithUser | null> {
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
      },
      include: {
        user: {
          include: {
            auth_identities: {
              where: { provider: 'LOCAL' },
              take: 1,
            },
          },
        },
      },
    });

    if (!storedToken) return null;

    return {
      id: storedToken.id,
      user_id: storedToken.user_id,
      token_hash: storedToken.token_hash,
      expires_at: storedToken.expires_at,
      revoked_at: storedToken.revoked_at,
      user: {
        id: storedToken.user.id,
        full_name: storedToken.user.full_name,
        avatar_url: storedToken.user.avatar_url,
        auth_identities: storedToken.user.auth_identities.map((ai) => ({
          email: ai.email,
        })),
      },
    };
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revoked_at: new Date() },
    });
  }

  async rotateRefreshToken(
    oldTokenId: string,
    newTokenData: { user_id: string; token_hash: string; expires_at: Date },
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: oldTokenId },
        data: { revoked_at: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          user_id: newTokenData.user_id,
          token_hash: newTokenData.token_hash,
          expires_at: newTokenData.expires_at,
        },
      }),
    ]);
  }

  async revokeRefreshTokensByUserAndHash(userId: string, tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        token_hash: tokenHash,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });

    this.logger.info(`User ${userId} logged out successfully`, {
      fileName: 'prisma-auth.repository.ts',
      functionName: 'revokeRefreshTokensByUserAndHash',
      lineNumber: 140,
    });
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });

    this.logger.info(`All refresh tokens revoked for user ${userId}`, {
      fileName: 'prisma-auth.repository.ts',
      functionName: 'revokeAllRefreshTokensForUser',
      lineNumber: 160,
    });
  }

  async findUserWithAuthIdentities(userId: string): Promise<UserWithAuthIdentities | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        auth_identities: {
          where: { provider: 'LOCAL' },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      auth_identities: user.auth_identities.map((ai) => ({
        email: ai.email,
        verified_at: ai.verified_at,
      })),
    };
  }

  async updatePasswordHash(userId: string, newPasswordHash: string): Promise<void> {
    await this.prisma.authIdentity.updateMany({
      where: {
        user_id: userId,
        provider: 'LOCAL',
      },
      data: {
        password_hash: newPasswordHash,
      },
    });
  }
}
