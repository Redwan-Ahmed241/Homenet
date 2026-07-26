import { Test, TestingModule } from '@nestjs/testing';
import { MockVerificationService } from './mock-verification.service.js';

describe('MockVerificationService', () => {
  let service: MockVerificationService;

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MockVerificationService],
    }).compile();

    service = module.get<MockVerificationService>(MockVerificationService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('deterministic results based on last hex digit', () => {
    it('should return verified for IDs ending in 0–7', async () => {
      const promise = service.verify('550e8400-e29b-41d4-a716-446655440000');
      jest.advanceTimersByTime(5000);
      const result = await promise;

      expect(result.status).toBe('verified');
      expect(result.propertyId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return verified for IDs ending in 7', async () => {
      const promise = service.verify('550e8400-e29b-41d4-a716-446655440007');
      jest.advanceTimersByTime(5000);
      const result = await promise;

      expect(result.status).toBe('verified');
    });

    it('should return rejected with manual review note for IDs ending in 8', async () => {
      const promise = service.verify('550e8400-e29b-41d4-a716-446655440008');
      jest.advanceTimersByTime(5000);
      const result = await promise;

      expect(result.status).toBe('rejected');
      expect(result.notes).toBe('Manual review required');
    });

    it('should return rejected with document verification note for IDs ending in 9', async () => {
      const promise = service.verify('550e8400-e29b-41d4-a716-446655440009');
      jest.advanceTimersByTime(5000);
      const result = await promise;

      expect(result.status).toBe('rejected');
      expect(result.notes).toBe('Document verification failed');
    });

    it('should return the correct VerificationResult shape', async () => {
      const promise = service.verify('550e8400-e29b-41d4-a716-446655440001');
      jest.advanceTimersByTime(5000);
      const result = await promise;

      expect(result).toHaveProperty('propertyId');
      expect(result).toHaveProperty('status');
      // notes is optional — may be undefined for verified results
    });
  });
});
