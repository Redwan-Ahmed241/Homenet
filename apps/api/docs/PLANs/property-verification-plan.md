# Property Verification System — Implementation Plan

## Overview

When a user submits a property, the API immediately transitions the property to `PENDING` status and returns the response. A background worker picks up the verification task asynchronously (via Redis/BullMQ), runs the verification provider, updates `VerificationStatus` to `VERIFIED` or `REJECTED`, and emits the correct event that triggers a notification (mocked).

---

## Design Principles

All new infrastructure (Redis, Queue, Worker, Notification) is built as **generic, reusable modules** with interface-based abstractions. They know nothing about property verification — they provide capabilities that any feature can use. This keeps things decoupled: you can swap implementations, add new queues, or change notification channels without anything breaking.

```
┌─────────────────────────────────────────────────────┐
│                  Feature Layer                        │
│  ┌──────────────────────────────────────────────┐   │
│  │         Property Verification Flow            │   │
│  │  API → Queue → Worker → Verify → Event → Notify│   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                Abstract Interfaces                    │
│  IQueueService  │  INotificationService  │ IVerificationService │
├─────────────────────────────────────────────────────┤
│           Infrastructure / Implementation Layer       │
│  BullMQ/Redis  │  Console/Mail/SMS  │ Mock/GovService │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

1. User submits property → `POST /v1/properties/:id/submit`
2. `PropertyService.submitForVerification()`:
   - Validates all required fields + docs are present
   - Transitions `PropertyStatus` to `PENDING` (unchanged from today)
   - Creates a `Verification` record with status `PENDING`
   - Enqueues a job via `IQueueService` (generic queue interface)
   - Returns response immediately (202 Accepted)
3. Worker picks up the job from the queue
4. Worker calls `IVerificationService.verify(propertyId)` — orchestration only
5. Verification provider (mock) returns `VERIFIED` or `REJECTED`
6. Worker calls `PropertyService.updateVerificationStatus()` to update the `Verification` record
7. Worker emits `PropertyVerifiedEvent` or `PropertyRejectedEvent` based on result
8. Event listener calls `INotificationService` (generic interface) — mock logs to console

---

## Phase 1: Schema

**Goal:** Add `Verification` model and `VerificationStatus` enum. No changes to existing `PropertyStatus`.

### 1.1 Prisma Changes

```prisma
enum VerificationStatus {
  pending
  verified
  rejected
}

model Verification {
  id          String             @id @default(uuid())
  property_id String
  status      VerificationStatus @default(pending)
  notes       String?
  verified_at DateTime?
  created_at  DateTime           @default(now())
  updated_at  DateTime           @updatedAt

  property Property @relation(fields: [property_id], references: [id], onDelete: Cascade)

  @@index([property_id])
  @@index([status])
}
```

Existing `PropertyStatus` remains untouched:

```prisma
enum PropertyStatus {
  draft
  pending
  active
  sold
  archived
}
```

### 1.2 Add Verification Status to Existing Property Service

Add methods to property service/repository:
- `createVerification(propertyId)` — creates a `Verification` with `PENDING`
- `updateVerificationStatus(propertyId, status, notes?)` — updates the latest `Verification` record

---

## Phase 2: Reusable Infrastructure Modules

**Goal:** Build generic, interface-driven modules that any feature can consume.

### 2.1 Redis Module (`src/infrastructure/redis/`)

Owns the Redis connection. Exports a config and a `Redis` client.

```
src/infrastructure/redis/
├── redis.module.ts
├── redis.config.ts          # reads REDIS_HOST, REDIS_PORT from env
└── redis.provider.ts        # creates & exports Redis client
```

### 2.2 Queue Module (`src/infrastructure/queue/`)

Generic job queue abstraction built on BullMQ. Features register their own queues — this module provides the factory.

```
src/infrastructure/queue/
├── queue.module.ts
├── interfaces/
│   └── queue.service.interface.ts    # IQueueService
├── services/
│   └── bullmq-queue.service.ts       # implements IQueueService
└── constants.ts                      # export const QUEUE_SERVICE = 'QUEUE_SERVICE'
```

```typescript
// IQueueService — generic, no knowledge of verification
interface IQueueService {
  add<T>(queueName: string, jobName: string, data: T, opts?: JobOptions): Promise<Job>;
  getQueue(queueName: string): Queue;
}
```

### 2.3 Notification Module (`src/infrastructure/notification/`)

Generic notification abstraction. Any feature can send notifications through it.

```
src/infrastructure/notification/
├── notification.module.ts
├── interfaces/
│   └── notification.service.interface.ts   # INotificationService
├── services/
│   └── mock-notification.service.ts        # logs to console/winston
└── constants.ts
```

```typescript
// INotificationService — generic, no knowledge of verification
interface INotificationService {
  send(userId: string, event: NotificationEvent): Promise<void>;
}

interface NotificationEvent {
  type: string;      // e.g. 'property.verified', 'property.rejected'
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}
```

### 2.4 Worker Module (`src/infrastructure/worker/`)

Registers BullMQ workers. Uses `@nestjs/bullmq`'s `WorkerModule` under the hood. Generic — any processor can be registered.

```
src/infrastructure/worker/
├── worker.module.ts
└── worker.constants.ts
```

---

## Phase 3: Verification Service Interface & Mock

**Goal:** Feature-level module that implements the verification contract. The only place verification rules live.

```
src/modules/verification/
├── verification.module.ts
├── verification.constants.ts              # VERIFICATION_SERVICE token
├── interfaces/
│   └── verification.service.interface.ts
├── services/
│   ├── mock-verification.service.ts
│   └── mock-verification.service.spec.ts
└── dto/
    └── verification-result.dto.ts
```

### 3.1 Interface

```typescript
export enum VerificationStatus {
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export interface VerificationResult {
  propertyId: string;
  status: VerificationStatus;
  notes?: string;
}

export interface IVerificationService {
  verify(propertyId: string): Promise<VerificationResult>;
}
```

### 3.2 Mock Rules (Deterministic)

Based on the **last digit of the property UUID**:

| Last digit (hex) | Result |
|---|---|
| 0-7 | `VERIFIED` |
| 8 | `MANUAL_REVIEW` (treated as re-queue for now) |
| 9 | `REJECTED` |

Same property ID → same result every time. Demos are repeatable.

```typescript
// pseudo-logic
const lastChar = propertyId[propertyId.length - 1];
if (lastChar >= '0' && lastChar <= '7') return { status: 'verified' };
if (lastChar === '9') return { status: 'rejected', notes: 'Document verification failed' };
// '8' could be used later for manual review flow
```

Add a simulated delay of 2–5 seconds to mimic real async processing.

---

## Phase 4: Property Verification Processor

**Goal:** The worker processor — orchestration only, no business logic.

```
src/modules/worker/
└── processors/
    └── property-verification.processor.ts
```

```typescript
@Processor('property-verification')
class PropertyVerificationProcessor {
  constructor(
    @Inject(VERIFICATION_SERVICE) private verificationService: IVerificationService,
    private propertyService: PropertyService,
    private eventEmitter: EventEmitter2,
  ) {}

  @Process()
  async handle(job: Job<{ propertyId: string }>) {
    const { propertyId } = job.data;

    // Step 1: Verify — all logic lives in the verification provider
    const result = await this.verificationService.verify(propertyId);

    // Step 2: Update status
    await this.propertyService.updateVerificationStatus(
      propertyId,
      result.status,
      result.notes,
    );

    // Step 3: Emit the correct event
    if (result.status === 'verified') {
      this.eventEmitter.emit(
        'property.verified',
        new PropertyVerifiedEvent(propertyId, verifiedAt),
      );
    } else {
      this.eventEmitter.emit(
        'property.rejected',
        new PropertyRejectedEvent(propertyId, result.notes ?? 'No details provided'),
      );
    }
  }
}
```

---

## Phase 5: Events & Mock Notifications

**Goal:** Emit typed events; listener routes to generic notification service.

### 5.1 Events

```
src/modules/events/
├── events.module.ts
├── events/
│   ├── property-verified.event.ts
│   └── property-rejected.event.ts
└── listeners/
    └── verification.listener.ts
```

```typescript
class PropertyVerifiedEvent {
  constructor(public propertyId: string, public verifiedAt: Date) {}
}

class PropertyRejectedEvent {
  constructor(public propertyId: string, public notes: string) {}
}
```

### 5.2 Listener

```typescript
@Injectable()
class VerificationListener {
  constructor(
    @Inject(NOTIFICATION_SERVICE) private notification: INotificationService,
  ) {}

  @OnEvent('property.verified')
  async onVerified(event: PropertyVerifiedEvent) {
    await this.notification.send(userId, {
      type: 'property.verified',
      title: 'Property Verified',
      message: `Property ${event.propertyId} has been verified.`,
      metadata: { propertyId: event.propertyId, verifiedAt: event.verifiedAt },
    });
  }

  @OnEvent('property.rejected')
  async onRejected(event: PropertyRejectedEvent) {
    await this.notification.send(userId, {
      type: 'property.rejected',
      title: 'Property Verification Failed',
      message: `Property ${event.propertyId} was rejected. Reason: ${event.notes}`,
      metadata: { propertyId: event.propertyId, notes: event.notes },
    });
  }
}
```

---

## Phase 6: API Endpoint — Submit Property

**Goal:** Enhance existing `POST /v1/properties/:id/submit` with strict validation and job enqueue.

### 6.1 Required Fields Validation

| Field | Required |
|---|---|
| `title` | Yes |
| `description` | Yes |
| `type` | Yes |
| `listing_type` | Yes |
| `price` | Yes |
| `area_id` | Yes |
| `area_size` | Yes |
| `area_unit` | Yes |
| `address` | Yes |
| `location_lat` / `location_lng` | Yes |
| At least 1 media item | Yes |
| All amenity fields | Yes |

Missing any → throw existing `PROPERTY_CANNOT_SUBMIT` (1521) with a list of what's missing.

### 6.2 Flow in `PropertyService.submitForVerification()`

```typescript
async submitForVerification(userId: string, propertyId: string) {
  const property = await this.repository.findById(propertyId);

  // Guard: ownership
  if (property.user_id !== userId) throw new ForbiddenException();

  // Guard: must be draft
  if (property.status !== 'draft') throw new BadRequestException(PROPERTY_CANNOT_SUBMIT);

  // Validate required fields + docs
  const missing = this.validateRequiredFields(property);
  if (missing.length > 0) throw new PROPERTY_CANNOT_SUBMIT(missing);

  // Transition
  await this.repository.updateStatus(propertyId, 'pending');

  // Create verification record
  await this.repository.createVerification(propertyId);

  // Enqueue via generic queue service
  await this.queueService.add('property-verification', 'verify', { propertyId });

  // Return immediately
  return { id: propertyId, status: 'pending' };
}
```

### 6.3 Response

```typescript
@HttpCode(202)
@Post(':id/submit')
async submit(@Param('id') id: string, @CurrentUser() user: UserPayload) {
  return this.propertyService.submitForVerification(user.sub, id);
}
```

---

## Phase 7: Property Changes

**Goal:** Minimal additions to the property module.

### 7.1 New Repository Methods

In `IPropertyRepository` + `PrismaPropertyRepository`:

```typescript
updateStatus(propertyId: string, status: PropertyStatus): Promise<void>;
createVerification(propertyId: string): Promise<Verification>;
findVerification(propertyId: string): Promise<Verification | null>;
updateVerificationStatus(
  propertyId: string,
  status: VerificationStatus,
  notes?: string,
): Promise<void>;
```

### 7.2 Cache Invalidation

`updateVerificationStatus` should invalidate:
- Property detail cache
- Property list cache (since status filter may be affected)

---

## Module Registration in AppModule

```typescript
@Module({
  imports: [
    // Infrastructure (generic, reusable)
    RedisModule,
    QueueModule,
    WorkerModule,
    NotificationModule,
    EventEmitterModule.forRoot(),

    // Feature modules
    VerificationModule,
    PropertyModule,
    // ... existing modules
  ],
})
```

---

## File Tree (New/Modified Only)

```
prisma/schema.prisma                          # MODIFY: add Verification model + VerificationStatus enum

src/
├── app.module.ts                              # MODIFY: register new modules
│
├── infrastructure/                            # NEW — generic reusable modules
│   ├── redis/
│   │   ├── redis.module.ts
│   │   ├── redis.config.ts
│   │   └── redis.provider.ts
│   ├── queue/
│   │   ├── queue.module.ts
│   │   ├── constants.ts
│   │   ├── interfaces/
│   │   │   └── queue.service.interface.ts
│   │   └── services/
│   │       └── bullmq-queue.service.ts
│   ├── notification/
│   │   ├── notification.module.ts
│   │   ├── constants.ts
│   │   ├── interfaces/
│   │   │   └── notification.service.interface.ts
│   │   └── services/
│   │       └── mock-notification.service.ts
│   └── worker/
│       ├── worker.module.ts
│       └── worker.constants.ts
│
├── modules/
│   ├── property/
│   │   ├── property.service.ts                # MODIFY: submitForVerification, updateVerificationStatus
│   │   ├── property.controller.ts             # MODIFY: submit endpoint (if needed)
│   │   ├── interfaces/
│   │   │   └── property-repository.interface.ts  # MODIFY: add verification methods
│   │   └── repositories/
│   │       └── prisma-property.repository.ts     # MODIFY: verification CRUD
│   │
│   ├── verification/
│   │   ├── verification.module.ts             # NEW
│   │   ├── verification.constants.ts
│   │   ├── interfaces/
│   │   │   └── verification-service.interface.ts
│   │   ├── dto/
│   │   │   └── verification-result.dto.ts
│   │   └── services/
│   │       ├── mock-verification.service.ts
│   │       └── mock-verification.service.spec.ts
│   │
│   └── events/
│       ├── events.module.ts                   # NEW
│       ├── events/
│       │   ├── property-verified.event.ts
│       │   └── property-rejected.event.ts
│       └── listeners/
│           └── verification.listener.ts
│
└── modules/worker/                            # NEW — feature-level worker
    └── processors/
        └── property-verification.processor.ts
```

---

## Implementation Order Summary

| Phase | Tasks | Depends On |
|---|---|---|
| **1** | Prisma schema: `Verification` model, `VerificationStatus` enum | Nothing |
| **2** | Infrastructure: Redis, Queue, Notification, Worker modules | Nothing |
| **3** | Verification module: interface + mock service | Nothing |
| **4** | Property Verification Processor | Phase 1, 2, 3 |
| **5** | Events: classes, listener, mock notification wiring | Phase 2 (notification), Phase 4 |
| **6** | API: enhance submit endpoint, strict validation, enqueue | Phase 1, 2, 4 |
| **7** | Property repo/service: verification CRUD methods | Phase 1 |

Phases 1, 2, and 3 can run in parallel.

---

## Testing Strategy

| Component | Test |
|---|---|
| `MockVerificationService` | Unit: verify returns deterministic result based on property ID |
| `PropertyVerificationProcessor` | Unit: calls verify → updateVerificationStatus → correct event |
| `PropertyService.submitForVerification` | Unit: validation fires, queue.add called, status changes to PENDING |
| `VerificationListener` | Unit: verified event → notification sent; rejected event → notification sent |
| `BullmqQueueService` | Unit/Int: add/getQueue work correctly |
| `MockNotificationService` | Unit: send logs correctly |
| E2E | POST submit → 202 → poll Verification until status is verified/rejected |

---

## Edge Cases & Considerations

- **Duplicate submission:** If `PropertyStatus` already `PENDING` → return error
- **Already verified:** If `VerificationStatus` already `VERIFIED` → return success without re-enqueuing
- **Property not found in worker:** Log warning, discard job gracefully
- **Redis down:** Wrap enqueue in try/catch, log warning, property update still succeeds
- **Worker crash mid-job:** BullMQ retries (3 attempts, exponential backoff), then DLQ
- **Future Gov Service:** Swapping `MockVerificationService` for `GovVerificationService` is a module-level provider change only — nothing else breaks
- **Future notification channels:** Adding email/SMS is a new implementation of `INotificationService` — event listener code stays the same
- **Future feature using same infra:** Any feature can inject `IQueueService` or `INotificationService` — no coupling to property verification
