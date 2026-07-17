import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { PropertyService } from '../../property/property.service.js';
import { VERIFICATION_SERVICE } from '../verification.constants.js';
import type { IVerificationService } from '../interfaces/verification.service.interface.js';
import { VerificationService } from './verification.service.js';

describe('VerificationService', () => {
  let service: VerificationService;
  let mockVerificationProvider: jest.Mocked<IVerificationService>;
  let mockPropertyService: jest.Mocked<PropertyService>;
  let mockLogger: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockVerificationProvider = {
      verify: jest.fn(),
    };

    mockPropertyService = {
      updateVerificationStatus: jest.fn(),
    } as unknown as jest.Mocked<PropertyService>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: VERIFICATION_SERVICE,
          useValue: mockVerificationProvider,
        },
        {
          provide: PropertyService,
          useValue: mockPropertyService,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processVerification', () => {
    it('should call the verification provider once', async () => {
      mockVerificationProvider.verify.mockResolvedValue({
        propertyId: 'prop-123',
        status: 'verified' as const,
      });

      await service.processVerification('prop-123');

      expect(mockVerificationProvider.verify).toHaveBeenCalledTimes(1);
      expect(mockVerificationProvider.verify).toHaveBeenCalledWith('prop-123');
    });

    it('should call updateVerificationStatus with the result from the provider', async () => {
      mockVerificationProvider.verify.mockResolvedValue({
        propertyId: 'prop-456',
        status: 'verified' as const,
      });

      await service.processVerification('prop-456');

      expect(mockPropertyService.updateVerificationStatus).toHaveBeenCalledWith(
        'prop-456',
        'verified',
        undefined,
      );
    });

    it('should pass notes when status is rejected', async () => {
      mockVerificationProvider.verify.mockResolvedValue({
        propertyId: 'prop-789',
        status: 'rejected' as const,
        notes: 'Document verification failed',
      });

      await service.processVerification('prop-789');

      expect(mockPropertyService.updateVerificationStatus).toHaveBeenCalledWith(
        'prop-789',
        'rejected',
        'Document verification failed',
      );
    });

    it('should log when verification starts and completes', async () => {
      mockVerificationProvider.verify.mockResolvedValue({
        propertyId: 'prop-111',
        status: 'verified' as const,
      });

      await service.processVerification('prop-111');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Verification started for property: prop-111',
        expect.objectContaining({
          fileName: 'verification.service.ts',
          functionName: 'processVerification',
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Verification verified for property: prop-111',
        expect.objectContaining({
          fileName: 'verification.service.ts',
          functionName: 'processVerification',
        }),
      );
    });

    it('should log an error and not throw when verification fails', async () => {
      const testError = new Error('Provider unavailable');
      mockVerificationProvider.verify.mockRejectedValue(testError);

      await expect(
        service.processVerification('prop-999'),
      ).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Verification failed for property: prop-999 — Provider unavailable',
        expect.objectContaining({
          fileName: 'verification.service.ts',
          functionName: 'processVerification',
        }),
      );
    });

    it('should not throw any exception', async () => {
      mockVerificationProvider.verify.mockResolvedValue({
        propertyId: 'prop-555',
        status: 'verified' as const,
      });

      await expect(
        service.processVerification('prop-555'),
      ).resolves.toBeUndefined();
    });
  });
});
