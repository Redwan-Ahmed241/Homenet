import type { VerificationStatus } from '@prisma/client';

export interface VerificationResult {
  propertyId: string;
  status: VerificationStatus;
  notes?: string;
}
