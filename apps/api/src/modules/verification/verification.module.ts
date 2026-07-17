import { Module } from '@nestjs/common';
import { PropertyModule } from '../property/property.module.js';
import { VERIFICATION_SERVICE } from './verification.constants.js';
import { VerificationService } from './services/verification.service.js';
import { MockVerificationService } from './services/mock-verification.service.js';

@Module({
  imports: [PropertyModule],
  providers: [
    VerificationService,
    {
      provide: VERIFICATION_SERVICE,
      useClass: MockVerificationService,
    },
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
