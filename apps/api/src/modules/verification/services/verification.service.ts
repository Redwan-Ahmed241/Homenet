import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { PropertyService } from '../../property/property.service.js';
import { VERIFICATION_SERVICE } from '../verification.constants.js';
import type { IVerificationService } from '../interfaces/verification.service.interface.js';
import { PropertyVerifiedEvent } from '../events/property-verified.event.js';
import { PropertyRejectedEvent } from '../events/property-rejected.event.js';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(VERIFICATION_SERVICE)
    private readonly verificationProvider: IVerificationService,
    private readonly propertyService: PropertyService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async processVerification(propertyId: string): Promise<void> {
    const fileName = 'verification.service.ts';
    const functionName = 'processVerification';

    this.logger.info(`Verification started for property: ${propertyId}`, {
      fileName,
      functionName,
      lineNumber: 23,
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
          lineNumber: 40,
        },
      );

      // Step 3: Emit the correct event with the property owner's userId
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { user_id: true },
      });

      if (!property) {
        this.logger.error(`Property not found after verification: ${propertyId}`, {
          fileName,
          functionName,
          lineNumber: 51,
        });
        return;
      }

      const verifiedAt = new Date();
      if (result.status === 'verified') {
        this.eventEmitter.emit(
          'property.verified',
          new PropertyVerifiedEvent(propertyId, property.user_id, verifiedAt),
        );
      } else {
        this.eventEmitter.emit(
          'property.rejected',
          new PropertyRejectedEvent(propertyId, property.user_id, result.notes ?? 'No details provided'),
        );
      }
    } catch (error) {
      this.logger.error(
        `Verification failed for property: ${propertyId} — ${(error as Error).message}`,
        {
          fileName,
          functionName,
          lineNumber: 61,
        },
      );
    }
  }
}
