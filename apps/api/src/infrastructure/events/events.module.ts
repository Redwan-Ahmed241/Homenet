import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module.js';
import { VerificationListener } from './listeners/verification.listener.js';
import { ListingListener } from './listeners/listing.listener.js';

@Module({
  imports: [NotificationModule],
  providers: [VerificationListener, ListingListener],
})
export class EventsModule {}
