import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma/prisma.service.js';
import { validatePassword } from '../../common/utils/password.util.js';
import { RegisterDto } from './dto/register.dto.js';
import { AppException } from '../../common/errors/app.exception.js';
import { AUTH_ERRORS } from '../../common/errors/error-codes.js';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoggerService } from '../../common/logger/logger.service.js';

interface JwtPayload {
  sub: string;
  email: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface AuthResponse extends TokenPair {
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  // ── Register ─────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // 1. Validate password strength
    const validation = validatePassword(dto.password);
    if (!validation.isValid) {
      throw new AppException(AUTH_ERRORS.PASSWORD_TOO_WEAK, validation.errors.join('; '));
    }

    // 2. Check if email is already registered under LOCAL provider
    const existingIdentity = await this.prisma.authIdentity.findFirst({
      where: {
        provider: 'LOCAL',
        email: dto.email.toLowerCase(),
      },
    });

    if (existingIdentity) {
      throw new AppException(AUTH_ERRORS.EMAIL_ALREADY_EXISTS);
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    // 4. Create User + AuthIdentity in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          full_name: dto.full_name,
          avatar_url: dto.avatar_url ?? null,
        },
      });

      await tx.authIdentity.create({
        data: {
          user_id: newUser.id,
          provider: 'LOCAL',
          email: dto.email.toLowerCase(),
          password_hash: passwordHash,
        },
      });

      return newUser;
    });

    // 5. Generate tokens
    const tokens = await this.generateTokenPair(user.id, dto.email.toLowerCase());

    // 6. Store refresh token hash
    await this.storeRefreshToken(user.id, tokens.refresh_token);

    this.logger.info(`New user registered: ${dto.email}`, {
      fileName: 'auth.service.ts',
      functionName: 'register',
      lineNumber: 102,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: dto.email.toLowerCase(),
        avatar_url: user.avatar_url,
      },
    };
  }

  // ── Validate Local User (called by LocalStrategy) ───────

  async validateLocalUser(email: string, password: string) {
    const identity = await this.prisma.authIdentity.findFirst({
      where: {
        provider: 'LOCAL',
        email: email.toLowerCase(),
      },
      include: { user: true },
    });

    if (!identity || !identity.password_hash) {
      this.logger.warn(`Failed login attempt for email: ${email}`, {
        fileName: 'auth.service.ts',
        functionName: 'validateLocalUser',
        lineNumber: 122,
      });
      throw new AppException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, identity.password_hash);

    if (!isPasswordValid) {
      this.logger.warn(`Failed login attempt (bad password) for email: ${email}`, {
        fileName: 'auth.service.ts',
        functionName: 'validateLocalUser',
        lineNumber: 130,
      });
      throw new AppException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    return {
      id: identity.user.id,
      full_name: identity.user.full_name,
      email: identity.email!,
      avatar_url: identity.user.avatar_url,
    };
  }

  // ── Login (called after LocalStrategy validates) ────────

  async login(user: { id: string; email: string; full_name: string; avatar_url: string | null }): Promise<AuthResponse> {
    const tokens = await this.generateTokenPair(user.id, user.email);

    await this.storeRefreshToken(user.id, tokens.refresh_token);

    this.logger.info('User logged in successfully', {
      fileName: 'auth.service.ts',
      functionName: 'login',
      lineNumber: 145, // Approximation, as strict line tracking is requested
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
    };
  }

  // ── Refresh Tokens (rotation) ───────────────────────────

  async refreshTokens(oldRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(oldRefreshToken);

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

    if (!storedToken) {
      throw new AppException(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }

    if (storedToken.expires_at < new Date()) {
      // Revoke expired token
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked_at: new Date() },
      });
      throw new AppException(AUTH_ERRORS.REFRESH_TOKEN_EXPIRED);
    }

    const email = storedToken.user.auth_identities[0]?.email;

    if (!email) {
      throw new AppException(AUTH_ERRORS.USER_IDENTITY_NOT_FOUND);
    }

    // Rotate: revoke old, issue new
    const newTokens = await this.generateTokenPair(storedToken.user_id, email);

    await this.prisma.$transaction([
      // Revoke old token
      this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked_at: new Date() },
      }),
      // Store new refresh token
      this.prisma.refreshToken.create({
        data: {
          user_id: storedToken.user_id,
          token_hash: this.hashToken(newTokens.refresh_token),
          expires_at: this.getRefreshTokenExpiry(),
        },
      }),
    ]);

    return newTokens;
  }

  // ── Logout ──────────────────────────────────────────────

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        token_hash: tokenHash,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });

    this.logger.info(`User ${userId} logged out successfully`, {
      fileName: 'auth.service.ts',
      functionName: 'logout',
      lineNumber: 242,
    });
  }

  // ── Get Current User Profile ────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        auth_identities: {
          where: { provider: 'LOCAL' },
        },
      },
    });

    if (!user) {
      throw new AppException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    const localIdentity = user.auth_identities[0];

    return {
      id: user.id,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      email: localIdentity?.email ?? null,
      email_verified: localIdentity?.verified_at !== null,
      created_at: user.created_at,
    };
  }

  // ── Private Helpers ─────────────────────────────────────

  private async generateTokenPair(userId: string, email: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = crypto.randomUUID();

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async storeRefreshToken(userId: string, rawToken: string): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: this.hashToken(rawToken),
        expires_at: this.getRefreshTokenExpiry(),
      },
    });
  }

  /**
   * Hash refresh tokens with SHA-256 for DB storage.
   * Using SHA-256 instead of bcrypt here because:
   * - Refresh tokens are high-entropy random UUIDs (not user-chosen passwords)
   * - We need fast lookups by hash (bcrypt is intentionally slow)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);
    return expiry;
  }
}
