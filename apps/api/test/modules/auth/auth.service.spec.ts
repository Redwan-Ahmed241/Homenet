import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { PrismaService } from '../../../src/config/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../src/common/logger/logger.service.js';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

jest.mock('../../../src/common/utils/password.util.js', () => ({
  validatePassword: jest.fn(),
}));

import { validatePassword } from '../../../src/common/utils/password.util.js';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    authIdentity: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (arg: any): Promise<any> => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg(mockPrismaService);
    }),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLoggerService = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw BadRequestException if password validation fails', async () => {
      (validatePassword as jest.Mock).mockReturnValue({ isValid: false, errors: ['Too short'] });

      await expect(
        authService.register({
          full_name: 'Test',
          email: 'test@test.com',
          password: 'pass',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if email already registered', async () => {
      (validatePassword as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      mockPrismaService.authIdentity.findFirst.mockResolvedValue({ id: 'existing_id' });

      await expect(
        authService.register({
          full_name: 'Test',
          email: 'test@test.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully register a user and return tokens', async () => {
      (validatePassword as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      mockPrismaService.authIdentity.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      
      const mockUser = { id: 'user_id', full_name: 'Test', avatar_url: null };
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue('access_token_123');

      const result = await authService.register({
        full_name: 'Test',
        email: 'test@test.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token', 'access_token_123');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user).toEqual({
        id: 'user_id',
        full_name: 'Test',
        email: 'test@test.com',
        avatar_url: null,
      });
      expect(mockPrismaService.authIdentity.create).toHaveBeenCalled();
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('validateLocalUser', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.authIdentity.findFirst.mockResolvedValue(null);

      await expect(authService.validateLocalUser('test@test.com', 'password123')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockPrismaService.authIdentity.findFirst.mockResolvedValue({
        password_hash: 'hash',
        user: { id: 'user_id', full_name: 'Test' },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.validateLocalUser('test@test.com', 'password123')).rejects.toThrow(UnauthorizedException);
    });

    it('should return user info if validation succeeds', async () => {
      mockPrismaService.authIdentity.findFirst.mockResolvedValue({
        email: 'test@test.com',
        password_hash: 'hash',
        user: { id: 'user_id', full_name: 'Test', avatar_url: null },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateLocalUser('test@test.com', 'password123');
      expect(result).toEqual({
        id: 'user_id',
        full_name: 'Test',
        email: 'test@test.com',
        avatar_url: null,
      });
    });
  });

  describe('login', () => {
    it('should generate tokens and return auth response', async () => {
      mockJwtService.signAsync.mockResolvedValue('access_token_123');
      
      const result = await authService.login({
        id: 'user_id',
        email: 'test@test.com',
        full_name: 'Test',
        avatar_url: null,
      });

      expect(result).toHaveProperty('access_token', 'access_token_123');
      expect(result).toHaveProperty('refresh_token');
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException if token not found', async () => {
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(null);
      await expect(authService.refreshTokens('old_token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      mockPrismaService.refreshToken.findFirst.mockResolvedValue({ id: 'token_id', expires_at: pastDate });
      
      await expect(authService.refreshTokens('old_token')).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalled();
    });

    it('should rotate tokens and return new pair', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      mockPrismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'token_id',
        user_id: 'user_id',
        expires_at: futureDate,
        user: {
          auth_identities: [{ email: 'test@test.com' }],
        },
      });
      mockJwtService.signAsync.mockResolvedValue('new_access_token');

      const result = await authService.refreshTokens('old_token');

      expect(result).toHaveProperty('access_token', 'new_access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalled(); // revokes old
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled(); // creates new
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      await authService.logout('user_id', 'some_token');
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalled();
    });
  });
});
