# Notification User ID — The Missing Piece

## The Issue

The verification listener hardcodes `'system'` as the notification recipient:

**File:** `src/modules/events/listeners/verification.listener.ts:27`
```typescript
await this.notification.send('system', { ... });
```

The notification is emitted but never reaches a real user. The property owner doesn't know their property was verified or rejected.

## Root Cause

The events `PropertyVerifiedEvent` and `PropertyRejectedEvent` only carry `propertyId` — they don't carry the owner's `userId`. The listener only sees the `propertyId` and has no way to know who the property belongs to.

```
VerificationService                      VerificationListener
  ──────────────────►  emit('property.verified')
                        { propertyId, verifiedAt }
                                          │
                                          │ can't resolve userId
                                          ▼
                                    notification.send('system', ...)
```

## The Fix: Add `userId` to Event Payload

The cleanest solution: include the property owner's ID in the event so the listener has everything it needs.

### Step 1: Add `userId` to events

```typescript
// property-verified.event.ts
export class PropertyVerifiedEvent {
  constructor(
    public readonly propertyId: string,
    public readonly userId: string,
    public readonly verifiedAt: Date,
  ) {}
}

// property-rejected.event.ts
export class PropertyRejectedEvent {
  constructor(
    public readonly propertyId: string,
    public readonly userId: string,
    public readonly notes: string,
  ) {}
}
```

### Step 2: Pass `userId` when emitting

`VerificationService.processVerification()` already loads the property via `this.verificationProvider.verify(propertyId)` but **doesn't** load `Property` itself in the current implementation. We need to add a lookup or pass userId differently.

The cleanest approach: require the `userId` in `processVerification()`:

```typescript
// verification.service.ts
async processVerification(propertyId: string, userId: string): Promise<void> {
  const result = await this.verificationProvider.verify(propertyId);
  await this.propertyService.updateVerificationStatus(propertyId, result.status, result.notes);

  if (result.status === 'verified') {
    this.eventEmitter.emit(
      'property.verified',
      new PropertyVerifiedEvent(propertyId, userId, new Date()),
    );
  } else {
    this.eventEmitter.emit(
      'property.rejected',
      new PropertyRejectedEvent(propertyId, userId, result.notes ?? 'No details provided'),
    );
  }
}
```

### Step 3: Update the caller

In `PrototypeBackgroundTaskService`, we need to either:
- Pass `userId` through `enqueueVerification(propertyId, userId)` — changes the interface
- Or load the property inside `processVerification()` to get `user_id`

The cleanest is option 1:

```typescript
// IBackgroundTaskService
export interface IBackgroundTaskService {
  enqueueVerification(propertyId: string, userId: string): Promise<void>;
}
```

### Step 4: Update the listener

```typescript
// verification.listener.ts
@OnEvent('property.verified')
async onVerified(event: PropertyVerifiedEvent) {
  await this.notification.send(event.userId, {
    type: 'property.verified',
    title: 'Property Verified',
    message: `Property ${event.propertyId} has been verified successfully.`,
    metadata: { propertyId: event.propertyId, verifiedAt: event.verifiedAt },
  });
}

@OnEvent('property.rejected')
async onRejected(event: PropertyRejectedEvent) {
  await this.notification.send(event.userId, {
    type: 'property.rejected',
    title: 'Property Verification Failed',
    message: `Property ${event.propertyId} was rejected. Reason: ${event.notes}`,
    metadata: { propertyId: event.propertyId, notes: event.notes },
  });
}
```

### Step 5: Pass `userId` from the submit endpoint

```typescript
// property.service.ts
async submitForVerification(id: string, userId: string) {
  // ... validation ...
  await this.backgroundTaskService.enqueueVerification(id, userId);
  // ...
}
```

## Result

```
VerificationService                      VerificationListener
  ──────────────────►  emit('property.verified')
                        { propertyId, userId, verifiedAt }
                                          │
                                          │ userId is known
                                          ▼
                                    notification.send(actualUserId, ...)
```

No more `'system'` placeholder. The notification reaches the actual property owner.
