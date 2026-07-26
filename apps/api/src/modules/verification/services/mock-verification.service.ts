import { Injectable } from '@nestjs/common';
import type { VerificationStatus } from '@prisma/client';
import type { IVerificationService } from '../interfaces/verification.service.interface.js';
import type { VerificationResult } from '../dto/verification-result.dto.js';

@Injectable()
export class MockVerificationService implements IVerificationService {
  async verify(propertyId: string): Promise<VerificationResult> {
    // Simulate external verification provider delay (2–5 seconds)
    const delay = 2000 + Math.random() * 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const lastChar = propertyId[propertyId.length - 1];

    // Deterministic result based on last hex digit of property UUID
    if (lastChar >= '0' && lastChar <= '7') {
      return { propertyId, status: 'verified' as VerificationStatus };
    }

    if (lastChar === '8') {
      return {
        propertyId,
        status: 'rejected' as VerificationStatus,
        notes: 'Manual review required',
      };
    }

    // lastChar === '9' or any other
    return {
      propertyId,
      status: 'rejected' as VerificationStatus,
      notes: 'Document verification failed',
    };
  }
}
