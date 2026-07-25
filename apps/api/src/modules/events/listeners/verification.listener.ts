import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { NOTIFICATION_SERVICE } from '../../../infrastructure/notification/constants.js';
import type { INotificationService } from '../../../infrastructure/notification/interfaces/notification.service.interface.js';
import { PropertyVerifiedEvent } from '../events/property-verified.event.js';
import { PropertyRejectedEvent } from '../events/property-rejected.event.js';

@Injectable()
export class VerificationListener {
  constructor(
    @Inject(NOTIFICATION_SERVICE)
    private readonly notification: INotificationService,
    private readonly logger: LoggerService,
  ) {}

  @OnEvent('property.verified')
  async onVerified(event: PropertyVerifiedEvent): Promise<void> {
    const fileName = 'verification.listener.ts';
    const functionName = 'onVerified';

    this.logger.info(
      `Property verified event received for: ${event.propertyId}`,
      { fileName, functionName, lineNumber: 22 },
    );

    await this.notification.send(event.userId, {
      type: 'property.verified',
      title: 'Property Verified',
      message: `Your property has been verified successfully.`,
      metadata: {
        propertyId: event.propertyId,
        verifiedAt: event.verifiedAt,
      },
    });
  }

  @OnEvent('property.rejected')
  async onRejected(event: PropertyRejectedEvent): Promise<void> {
    const fileName = 'verification.listener.ts';
    const functionName = 'onRejected';

    this.logger.info(
      `Property rejected event received for: ${event.propertyId}`,
      { fileName, functionName, lineNumber: 41 },
    );

    await this.notification.send(event.userId, {
      type: 'property.rejected',
      title: 'Property Verification Failed',
      message: `Your property verification was rejected. Reason: ${event.notes}`,
      metadata: {
        propertyId: event.propertyId,
        notes: event.notes,
      },
    });
  }
}
