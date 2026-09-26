/**
 * Listing lifecycle events. PropertyService emits them; listeners in
 * src/infrastructure/events/listeners turn them into notifications (FR-13).
 * New kinds of notification should be added as new listeners, not as calls
 * inside PropertyService.
 */
export const LISTING_EVENTS = {
  SUBMITTED: 'listing.submitted',
  STATUS_CHANGED: 'listing.status_changed',
  PRICE_CHANGED: 'listing.price_changed',
} as const;

export type ListingStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'sold'
  | 'archived';

/** An owner submitted a listing for review. */
export class ListingSubmittedEvent {
  constructor(
    public readonly propertyId: string,
    public readonly ownerId: string,
    public readonly title: string,
  ) {}
}

/** A listing's status changed — approval, rejection, or being marked sold. */
export class ListingStatusChangedEvent {
  constructor(
    public readonly propertyId: string,
    public readonly ownerId: string,
    public readonly title: string,
    public readonly from: ListingStatus,
    public readonly to: ListingStatus,
    /** True when an admin made the change, i.e. moderation. */
    public readonly byAdmin: boolean,
  ) {}
}

/** A listing's asking price changed. */
export class ListingPriceChangedEvent {
  constructor(
    public readonly propertyId: string,
    public readonly ownerId: string,
    public readonly title: string,
    public readonly status: ListingStatus,
    public readonly oldPrice: number,
    public readonly newPrice: number,
    public readonly currency: string,
  ) {}
}
