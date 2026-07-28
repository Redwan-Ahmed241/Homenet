import type { VerificationResult } from '../dto/verification-result.dto.js';

export interface IVerificationService {
  verify(propertyId: string): Promise<VerificationResult>;
}
