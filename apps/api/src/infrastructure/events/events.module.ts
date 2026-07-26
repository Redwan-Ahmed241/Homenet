import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module.js';
import { VerificationListener } from './listeners/verification.listener.js';

@Module({
  imports: [NotificationModule],
  providers: [VerificationListener],
})
export class EventsModule {}
