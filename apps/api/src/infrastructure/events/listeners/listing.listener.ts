import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../config/prisma/prisma.service.js';
import { LoggerService } from '../../../common/logger/logger.service.js';
import { NOTIFICATION_SERVICE } from '../../notification/constants.js';
import type { INotificationService } from '../../notification/interfaces/notification.service.interface.js';
import {
  LISTING_EVENTS,
  ListingPriceChangedEvent,
  ListingStatusChangedEvent,
  ListingSubmittedEvent,
} from '../../../modules/property/events/listing.events.js';

/** "৳85 lakh", "৳1.8 crore" — how prices are said in Bangladesh. */
export function formatTaka(amount: number, currency: string): string {
  const trim = (n: number) => Number(n.toFixed(2)).toString();
  if (currency !== 'BDT')
    return `${currency} ${amount.toLocaleString('en-US')}`;
  if (amount >= 10_000_000) return `৳${trim(amount / 10_000_000)} crore`;
  if (amount >= 100_000) return `৳${trim(amount / 100_000)} lakh`;
  return `৳${amount.toLocaleString('en-US')}`;
}

/**
 * Turns listing lifecycle events into notifications (FR-13).
 *
 * Who hears about what:
 *  - admins:  a listing is submitted for review
 *  - owner:   their listing is approved or not approved
 *  - savers:  a listing they saved is sold, or its price drops
 *
 * Messaging (FR-12) is deliberately out of scope; nothing here is a chat.
 */
@Injectable()
export class ListingListener {
  constructor(
    @Inject(NOTIFICATION_SERVICE)
    private readonly notification: INotificationService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  @OnEvent(LISTING_EVENTS.SUBMITTED)
  async onSubmitted(event: ListingSubmittedEvent): Promise<void> {
    await this.notification.sendToAdmins({
      type: LISTING_EVENTS.SUBMITTED,
      title: 'New listing to review',
      message: `"${event.title}" was submitted and is waiting for review.`,
      link: '/admin/properties',
      metadata: { propertyId: event.propertyId, ownerId: event.ownerId },
    });
  }

  @OnEvent(LISTING_EVENTS.STATUS_CHANGED)
  async onStatusChanged(event: ListingStatusChangedEvent): Promise<void> {
    const { propertyId, ownerId, title, from, to, byAdmin } = event;
    const metadata = { propertyId, from, to };

    if (byAdmin && to === 'active' && from !== 'active') {
      await this.notification.send(ownerId, {
        type: 'listing.approved',
        title: 'Your listing is live',
        message: `"${title}" is now visible to buyers and renters.`,
        link: `/property/${propertyId}`,
        metadata,
      });
    } else if (
      byAdmin &&
      from === 'pending' &&
      (to === 'draft' || to === 'archived')
    ) {
      await this.notification.send(ownerId, {
        type: 'listing.not_approved',
        title: "Your listing wasn't approved",
        message: `"${title}" needs changes before it can go live. Review it and submit it again.`,
        link: '/my-properties',
        metadata,
      });
    }

    if (to === 'sold' && from !== 'sold') {
      await this.notification.sendToMany(
        await this.saversOf(propertyId, ownerId),
        {
          type: 'saved.sold',
          title: 'A saved property has sold',
          message: `"${title}" has been marked as sold.`,
          link: `/property/${propertyId}`,
          metadata,
        },
      );
    }
  }

  @OnEvent(LISTING_EVENTS.PRICE_CHANGED)
  async onPriceChanged(event: ListingPriceChangedEvent): Promise<void> {
    const { propertyId, ownerId, title, status, oldPrice, newPrice, currency } =
      event;
    // Only drops, and only on listings people can actually see and act on.
    if (status !== 'active' || !(newPrice < oldPrice)) return;

    await this.notification.sendToMany(
      await this.saversOf(propertyId, ownerId),
      {
        type: 'saved.price_drop',
        title: 'Price reduced',
        message: `"${title}" dropped from ${formatTaka(oldPrice, currency)} to ${formatTaka(newPrice, currency)}.`,
        link: `/property/${propertyId}`,
        metadata: { propertyId, oldPrice, newPrice, currency },
      },
    );
  }

  /** Everyone who saved the listing, except its owner. */
  private async saversOf(
    propertyId: string,
    ownerId: string,
  ): Promise<string[]> {
    try {
      const rows = await this.prisma.savedProperty.findMany({
        where: { property_id: propertyId, user_id: { not: ownerId } },
        select: { user_id: true },
      });
      return rows.map((row) => row.user_id);
    } catch (error) {
      this.logger.error(
        `Could not load savers of ${propertyId}: ${error instanceof Error ? error.message : String(error)}`,
        {
          fileName: 'listing.listener.ts',
          functionName: 'saversOf',
          lineNumber: 119,
        },
      );
      return [];
    }
  }
}
