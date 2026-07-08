import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { ICacheService } from '../../common/cache/cache.service.interface.js';
import { CACHE_TTL } from '../../common/cache/cache.service.interface.js';
import { validatePassword } from '../../common/utils/password.util.js';
import { RegisterDto } from './dto/register.dto.js';
import { AppException } from '../../common/errors/app.exception.js';
import { AUTH_ERRORS } from '../../common/errors/error-codes.js';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoggerService } from '../../common/logger/logger.service.js';
import type { IAuthRepository } from './interfaces/auth-repository.interface.js';

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
    @Inject('IAuthRepository') private readonly authRepo: IAuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    @Inject('ICacheService') private readonly cacheService: ICacheService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const validation = validatePassword(dto.password);
    if (!validation.isValid) {
      throw new AppException(AUTH_ERRORS.PASSWORD_TOO_WEAK, validation.errors.join('; '));
    }

    const existingIdentity = await this.authRepo.findIdentityByProvider('LOCAL', dto.email.toLowerCase());
    if (existingIdentity) {
      throw new AppException(AUTH_ERRORS.EMAIL_ALREADY_EXISTS);
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const user = await this.authRepo.createUserWithIdentity(
      { full_name: dto.full_name, avatar_url: dto.avatar_url },
      { provider: 'LOCAL', email: dto.email.toLowerCase(), password_hash: passwordHash },
    );

    const tokens = await this.generateTokenPair(user.id, dto.email.toLowerCase());

    await this.storeRefreshToken(user.id, tokens.refresh_token);

    this.logger.info(`New user registered: ${dto.email}`, {
      fileName: 'auth.service.ts',
      functionName: 'register',
      lineNumber: 71,
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

  async validateLocalUser(email: string, password: string) {
    const identity = await this.authRepo.findIdentityWithUser('LOCAL', email.toLowerCase());

    if (!identity || !identity.password_hash) {
      this.logger.warn(`Failed login attempt for email: ${email}`, {
        fileName: 'auth.service.ts',
        functionName: 'validateLocalUser',
        lineNumber: 92,
      });
      throw new AppException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, identity.password_hash);

    if (!isPasswordValid) {
      this.logger.warn(`Failed login attempt (bad password) for email: ${email}`, {
        fileName: 'auth.service.ts',
        functionName: 'validateLocalUser',
        lineNumber: 100,
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

  async login(user: { id: string; email: string; full_name: string; avatar_url: string | null }): Promise<AuthResponse> {
    const tokens = await this.generateTokenPair(user.id, user.email);

    await this.storeRefreshToken(user.id, tokens.refresh_token);

    this.logger.info('User logged in successfully', {
      fileName: 'auth.service.ts',
      functionName: 'login',
      lineNumber: 124,
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

  async refreshTokens(oldRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(oldRefreshToken);

    const storedToken = await this.authRepo.findRefreshTokenWithUser(tokenHash);

    if (!storedToken) {
      throw new AppException(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }

    if (storedToken.expires_at < new Date()) {
      await this.authRepo.revokeRefreshToken(storedToken.id);
      throw new AppException(AUTH_ERRORS.REFRESH_TOKEN_EXPIRED);
    }

    const email = storedToken.user.auth_identities[0]?.email;

    if (!email) {
      throw new AppException(AUTH_ERRORS.USER_IDENTITY_NOT_FOUND);
    }

    const newTokens = await this.generateTokenPair(storedToken.user_id, email);

    await this.authRepo.rotateRefreshToken(storedToken.id, {
      user_id: storedToken.user_id,
      token_hash: this.hashToken(newTokens.refresh_token),
      expires_at: this.getRefreshTokenExpiry(),
    });

    return newTokens;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.authRepo.revokeRefreshTokensByUserAndHash(userId, tokenHash);
  }

  async getProfile(userId: string) {
    return this.cacheService.getOrSet(`auth:profile:${userId}`, async () => {
      const user = await this.authRepo.findUserWithAuthIdentities(userId);

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
    }, CACHE_TTL.DETAIL);
  }

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
    await this.authRepo.createRefreshToken(
      userId,
      this.hashToken(rawToken),
      this.getRefreshTokenExpiry(),
    );
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);
    return expiry;
  }
}
