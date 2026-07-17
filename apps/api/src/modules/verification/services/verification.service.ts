import { Injectable, Inject } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { PropertyService } from '../../property/property.service.js';
import { VERIFICATION_SERVICE } from '../verification.constants.js';
import type { IVerificationService } from '../interfaces/verification.service.interface.js';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(VERIFICATION_SERVICE)
    private readonly verificationProvider: IVerificationService,
    private readonly propertyService: PropertyService,
    private readonly logger: LoggerService,
  ) {}

  async processVerification(propertyId: string): Promise<void> {
    const fileName = 'verification.service.ts';
    const functionName = 'processVerification';

    this.logger.info(`Verification started for property: ${propertyId}`, {
      fileName,
      functionName,
      lineNumber: 20,
    });

    try {
      // Step 1: Call verification provider — all business logic lives there
      const result = await this.verificationProvider.verify(propertyId);

      // Step 2: Update verification status via PropertyService
      await this.propertyService.updateVerificationStatus(
        propertyId,
        result.status,
        result.notes,
      );

      this.logger.info(
        `Verification ${result.status} for property: ${propertyId}`,
        {
          fileName,
          functionName,
          lineNumber: 37,
        },
      );

      // TODO Phase 4: emit PropertyVerifiedEvent or PropertyRejectedEvent
    } catch (error) {
      this.logger.error(
        `Verification failed for property: ${propertyId} — ${(error as Error).message}`,
        {
          fileName,
          functionName,
          lineNumber: 48,
        },
      );
    }
  }
}
