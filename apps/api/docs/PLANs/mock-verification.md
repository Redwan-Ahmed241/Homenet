# Property Verification System — Implementation Plan

## Overview

When a user submits a property, the API immediately transitions the property to `PENDING` status and returns a `202 Accepted` response. A lightweight `BackgroundTaskService` handles the verification asynchronously within the same process (prototype). The design is structured so that migrating to BullMQ/Redis in production requires **no changes to the API layer or business logic** — only `BackgroundTaskService`'s implementation changes.

> ⚠️ **PROTOTYPE ONLY — DO NOT IMPLEMENT BullMQ, Redis, Queue, or Worker modules.**  
> All references to BullMQ/Redis/Worker below are for **future production context only**.  
> The prototype uses `setTimeout` in `BackgroundTaskService` — no queue infrastructure.

---

## Design Principles

1. **API Contract Stability** — `PropertyService.submitForVerification()` and the controller remain unchanged when migrating to BullMQ. *(🚫 BullMQ not implemented in prototype — future only)*
2. **Abstraction Over Infrastructure** — `BackgroundTaskService` hides all execution details (setTimeout vs. BullMQ vs. SQS). *(🚫 Prototype uses setTimeout only)*
3. **Separation of Concerns** — `VerificationService.processVerification()` owns the orchestration (load, verify, update, emit). It can be called directly or from a worker.
4. **Replaceable Verification Provider** — `IVerificationService` allows swapping the mock for a real government API with a module-level provider change.
5. **Generic Notification Interface** — `INotificationService` remains available for future email/SMS without touching verification code.

```
                    ┌──────────────────────────────────────────┐
                    │          Prototype Architecture           │
                    │                                          │
                    │  API → PropertyService                    │
                    │         → BackgroundTaskService           │
                    │              → VerificationService        │
                    │                   .processVerification()  │
                    │              (setTimeout async)           │
                    │                                          │
                    │         EventEmitter → Listener           │
                    │                        → Notification    │
                    └──────────────────────────────────────────┘

                    ┌──────────────────────────────────────────┐
                    │        Future Production Architecture     │
                    │                                          │
                    │  API → PropertyService                    │
                    │         → BackgroundTaskService           │
                    │              → BullMQ → Worker            │
                    │                         → VerifService    │
                    │                            .processVerif()│
                    │         EventEmitter → Listener           │
                    │                        → Notification    │
                    └──────────────────────────────────────────┘
```

**Key insight:** The API → PropertyService → BackgroundTaskService contract is identical in both diagrams. Only `BackgroundTaskService`'s internal wiring changes.

---

## Data Flow

1. User submits property → `POST /v1/properties/:id/submit`
2. `PropertyService.submitForVerification()`:
   - Validates all required fields + docs are present
   - Transitions `PropertyStatus` to `PENDING`
   - Creates a `Verification` record with status `PENDING`
   - Calls `backgroundTaskService.enqueueVerification(propertyId)`
   - Returns response immediately (`202 Accepted`)
3. `BackgroundTaskService` (prototype) schedules `VerificationService.processVerification(propertyId)` via `setTimeout()` or equivalent async mechanism
4. `VerificationService.processVerification()`:
   - Loads property and documents
   - Calls `IVerificationService.verify(propertyId)` — the mock provider
   - Updates verification status via `PropertyService.updateVerificationStatus()`
   - Emits `PropertyVerifiedEvent` or `PropertyRejectedEvent`
5. Event listener calls `INotificationService` (mock logs to console)

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

## Phase 2: BackgoundTaskService (Prototype)

**Goal:** A lightweight abstraction that hides how background tasks are executed. Prototype uses in-process async scheduling; production will swap to BullMQ without changing callers.

```
src/infrastructure/background-task/
├── background-task.module.ts
├── background-task.constants.ts              # export const BACKGROUND_TASK_SERVICE
├── interfaces/
│   └── background-task.service.interface.ts  # IBackgroundTaskService
└── services/
    ├── prototype-background-task.service.ts   # setTimeout-based implementation
    └── prototype-background-task.service.spec.ts
```

### 2.1 Interface

```typescript
export interface IBackgroundTaskService {
  enqueueVerification(propertyId: string): Promise<void>;
}
```

The interface is intentionally narrow. It only exposes what `PropertyService` needs. Additional job types can be added later as new methods.

### 2.2 Prototype Implementation

```typescript
@Injectable()
export class PrototypeBackgroundTaskService implements IBackgroundTaskService {
  private readonly logger = new Logger(PrototypeBackgroundTaskService.name);
  private readonly delayMs: number;

  constructor(
    private readonly verificationService: VerificationService,
    @Inject(BACKGROUND_TASK_CONFIG) config: BackgroundTaskConfig,
  ) {
    this.delayMs = config.verificationDelayMs ?? 3000;
  }

  async enqueueVerification(propertyId: string): Promise<void> {
    // Schedule async verification without blocking the response
    setTimeout(() => {
      this.verificationService.processVerification(propertyId).catch((err) => {
        this.logger.error(`Verification failed for property ${propertyId}`, err);
      });
    }, this.delayMs);
  }
}
```

#### Configuration

```typescript
export interface BackgroundTaskConfig {
  verificationDelayMs: number; // simulated async delay (default: 3000)
}
```

Read from environment via a config provider (e.g., `BACKGROUND_VERIFICATION_DELAY_MS`).

### 2.3 Prototype Behavior

- `enqueueVerification()` returns immediately — `setTimeout` is non-blocking
- After the configured delay, `VerificationService.processVerification()` executes
- Errors are logged but do not surface to the API caller (already returned 202)
- The prototype runs entirely in-process: no Redis, no BullMQ, no worker processes

---

## Phase 3: Verification Service — Orchestration

**Goal:** A feature-level service that owns the verification orchestration workflow. This is what `BackgroundTaskService` calls directly (prototype) or a BullMQ worker calls (production). *(🚫 BullMQ worker NOT implemented in prototype — future only)*

```
src/modules/verification/
├── verification.module.ts
├── verification.constants.ts              # VERIFICATION_SERVICE token
├── interfaces/
│   └── verification.service.interface.ts  # IVerificationService (provider contract)
├── services/
│   ├── verification.service.ts             # processVerification() orchestration
│   ├── verification.service.spec.ts
│   ├── mock-verification.service.ts        # implements IVerificationService
│   └── mock-verification.service.spec.ts
└── dto/
    └── verification-result.dto.ts
```

### 3.1 Two Services, One Module

| Service | Role |
|---|---|
| `VerificationService` | **Orchestration.** `processVerification()` loads data, calls `IVerificationService.verify()`, updates status, emits events. |
| `MockVerificationService` | **Provider.** Implements `IVerificationService`. Contains the deterministic mock rules. Can be swapped for `GovVerificationService` later. |

### 3.2 IVerificationService (Provider Contract)

```typescript
export interface VerificationResult {
  propertyId: string;
  status: VerificationStatus;
  notes?: string;
}

export interface IVerificationService {
  verify(propertyId: string): Promise<VerificationResult>;
}
```

This is the same interface from the original plan. Only the **caller** changes: previously the worker processor called it; now `VerificationService.processVerification()` calls it. *(🚫 Worker processor NOT implemented in prototype — future only)*

### 3.3 VerificationService.processVerification()

```typescript
@Injectable()
export class VerificationService {
  constructor(
    @Inject(VERIFICATION_SERVICE) private verificationProvider: IVerificationService,
    private propertyService: PropertyService,
    private eventEmitter: EventEmitter2,
  ) {}

  async processVerification(propertyId: string): Promise<void> {
    const property = await this.propertyService.repository.findById(propertyId);
    if (!property) {
      this.logger.warn(`Property ${propertyId} not found for verification`);
      return;
    }

    // Step 1: Verify — all business logic lives in the provider
    const result = await this.verificationProvider.verify(propertyId);

    // Step 2: Update status
    await this.propertyService.updateVerificationStatus(
      propertyId,
      result.status,
      result.notes,
    );

    // Step 3: Emit the correct event
    const verifiedAt = new Date();
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

### 3.4 Mock Rules (Deterministic)

Based on the **last digit of the property UUID**:

| Last digit (hex) | Result |
|---|---|
| 0-7 | `VERIFIED` |
| 8 | `MANUAL_REVIEW` (treated as re-queue for now) |
| 9 | `REJECTED` |

Same property ID → same result every time. Demos are repeatable.

```typescript
const lastChar = propertyId[propertyId.length - 1];
if (lastChar >= '0' && lastChar <= '7') return { status: 'verified' };
if (lastChar === '9') return { status: 'rejected', notes: 'Document verification failed' };
```

Add a simulated delay of 2–5 seconds within the mock provider to mimic real async processing.

---

## Phase 4: Events & Mock Notifications

**Goal:** Emit typed events; listener routes to generic notification service.

### 4.1 Events

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

### 4.2 Listener

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

### 4.3 Notification Module (Generic)

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
interface INotificationService {
  send(userId: string, event: NotificationEvent): Promise<void>;
}

interface NotificationEvent {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}
```

---

## Phase 5: API Endpoint — Submit Property

**Goal:** Enhance existing `POST /v1/properties/:id/submit` with strict validation and background task enqueue.

### 5.1 Required Fields Validation

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

### 5.2 Flow in `PropertyService.submitForVerification()`

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

  // Enqueue via BackgroundTaskService — no knowledge of BullMQ or setTimeout
  await this.backgroundTaskService.enqueueVerification(propertyId);

  // Return immediately
  return { id: propertyId, status: 'pending' };
}
```

### 5.3 Response

```typescript
@HttpCode(202)
@Post(':id/submit')
async submit(@Param('id') id: string, @CurrentUser() user: UserPayload) {
  return this.propertyService.submitForVerification(user.sub, id);
}
```

---

## Phase 6: Property Changes

**Goal:** Minimal additions to the property module.

### 6.1 New Repository Methods

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

### 6.2 Cache Invalidation

`updateVerificationStatus` should invalidate:
- Property detail cache
- Property list cache (since status filter may be affected)

---

## Future Migration: Prototype → BullMQ Production

> 🚫 **DO NOT IMPLEMENT THIS SECTION — FUTURE PRODUCTION ONLY**  
> The following describes the eventual BullMQ/Redis/Worker architecture.  
> For the prototype, stop after completing Phase 6. Do not build Redis, Queue, or Worker modules.

**Goal:** When the prototype needs to scale, `BackgroundTaskService` is the **only** module that changes.

### What Changes

| Module | Prototype | Production |
|---|---|---|
| `BackgroundTaskService` | `setTimeout` → calls `VerificationService.processVerification()` directly | Enqueues BullMQ job via `IQueueService` |
| New: Queue Module | Not present | BullMQ + Redis |
| New: Worker Module | Not present | BullMQ Worker that calls `VerificationService.processVerification()` |
| New: Redis Module | Not present | Redis connection config |
| `PropertyService` | Calls `backgroundTaskService.enqueueVerification()` | Same call — **no change** |
| `VerificationService` | Called directly by prototype BTS | Called by worker — **no change** |
| Controller | `202 Accepted` + polling | Same — **no change** |
| Events / Notifications | Same | Same — **no change** |

### Step-by-Step Migration

1. **Add infrastructure modules** (Redis, Queue, Worker) — these are new, additive modules. Nothing is removed.
2. **Implement `BullmqBackgroundTaskService`** that implements the same `IBackgroundTaskService` interface but calls `this.queueService.add('property-verification', 'verify', { propertyId })` instead of `setTimeout`.
3. **Create a BullMQ worker processor** that calls `VerificationService.processVerification(propertyId)` — the same method the prototype BTS called directly.
4. **Swap the provider** in `BackgroundTaskModule` from `PrototypeBackgroundTaskService` to `BullmqBackgroundTaskService`.
5. **Remove `PrototypeBackgroundTaskService`** (or keep as fallback for local dev).

### Future Architecture Diagram

```
┌──────────┐     ┌──────────────────┐     ┌──────────────────────┐     ┌──────────┐
│  Client  │────▶│  PropertyService  │────▶│ BackgroundTaskService │────▶│  BullMQ  │
└──────────┘     └──────────────────┘     └──────────────────────┘     └────┬─────┘
      202 Accepted                                                          │
      + polling                                                             │
                                                                   ┌────────▼────────┐
                                                                   │  Worker (Processor) │
                                                                   │  .processVerification│
                                                                   └────────┬────────┘
                                                                            │
                                                                    ┌───────▼───────┐
                                                                    │ VerificationSvc│
                                                                    │ .processVerif()│
                                                                    └───────┬───────┘
                                                                            │
                                                      ┌─────────────────────┼──────────────┐
                                                      │                     │              │
                                               ┌──────▼──────┐    ┌────────▼───────┐     │
                                               │ PropertySvc │    │ EventEmitter   │     │
                                               │ .updateVerif│    │ .emit()        │     │
                                               └─────────────┘    └────────┬───────┘     │
                                                                           │             │
                                                                    ┌──────▼──────┐     │
                                                                    │ Verification │     │
                                                                    │  Listener    │     │
                                                                    └──────┬───────┘     │
                                                                           │             │
                                                                    ┌──────▼──────┐     │
                                                                    │ Notification │     │
                                                                    └─────────────┘     │
                                                                                       │
                                                               All marked "No change"  │
                                                               during migration        │
```

### Production Infrastructure Modules (Added During Migration)

```
src/infrastructure/
├── redis/                    # NEW in production upgrade
│   ├── redis.module.ts
│   ├── redis.config.ts
│   └── redis.provider.ts
├── queue/                    # NEW in production upgrade
│   ├── queue.module.ts
│   ├── constants.ts
│   ├── interfaces/
│   │   └── queue.service.interface.ts
│   └── services/
│       └── bullmq-queue.service.ts
└── worker/                   # NEW in production upgrade
    ├── worker.module.ts
    └── worker.constants.ts
```

### What Stays the Same

- `PropertyService.submitForVerification()` — still calls `backgroundTaskService.enqueueVerification(propertyId)`
- `VerificationService.processVerification()` — still loaded, verified, updated, emitted
- `IVerificationService` — still the provider contract
- `INotificationService` — still the notification contract
- Events, listeners, DTOs — unchanged
- Controller — still returns `202 Accepted`
- Frontend polling — unchanged

---

## Module Registration in AppModule

```typescript
@Module({
  imports: [
    // Prototype infrastructure (lightweight)
    BackgroundTaskModule,   // setTimeout-based in prototype
    NotificationModule,     // console mock
    EventEmitterModule.forRoot(),

    // Feature modules
    VerificationModule,
    PropertyModule,
    // ... existing modules
  ],

  // 🚫 PRODUCTION UPGRADE ONLY — Do not implement now.
  // Future: add RedisModule, QueueModule, WorkerModule here.
  // No existing imports need to be removed or changed.
})
```

---

## File Tree (New/Modified Only)

```
prisma/schema.prisma                              # MODIFY: add Verification model + VerificationStatus enum

src/
├── app.module.ts                                  # MODIFY: register new modules
│
├── infrastructure/
│   ├── background-task/                           # NEW — prototype async execution
│   │   ├── background-task.module.ts
│   │   ├── background-task.constants.ts
│   │   ├── interfaces/
│   │   │   └── background-task.service.interface.ts
│   │   └── services/
│   │       ├── prototype-background-task.service.ts
│   │       └── prototype-background-task.service.spec.ts
│   │
│   └── notification/                              # NEW — generic notification
│       ├── notification.module.ts
│       ├── constants.ts
│       ├── interfaces/
│       │   └── notification.service.interface.ts
│       └── services/
│           └── mock-notification.service.ts
│
├── modules/
│   ├── property/
│   │   ├── property.service.ts                    # MODIFY: submitForVerification, updateVerificationStatus
│   │   ├── property.controller.ts                 # MODIFY: submit endpoint
│   │   ├── interfaces/
│   │   │   └── property-repository.interface.ts    # MODIFY: add verification methods
│   │   └── repositories/
│   │       └── prisma-property.repository.ts       # MODIFY: verification CRUD
│   │
│   ├── verification/                              # NEW — verification orchestration + mock provider
│   │   ├── verification.module.ts
│   │   ├── verification.constants.ts
│   │   ├── interfaces/
│   │   │   └── verification-service.interface.ts
│   │   ├── dto/
│   │   │   └── verification-result.dto.ts
│   │   └── services/
│   │       ├── verification.service.ts             # processVerification() orchestration
│   │       ├── verification.service.spec.ts
│   │       ├── mock-verification.service.ts        # deterministic mock provider
│   │       └── mock-verification.service.spec.ts
│   │
│   └── events/
│       ├── events.module.ts                       # NEW
│       ├── events/
│       │   ├── property-verified.event.ts
│       │   └── property-rejected.event.ts
│       └── listeners/
│           └── verification.listener.ts
```

### Production Upgrade Adds (No Existing Files Removed)

> 🚫 **DO NOT IMPLEMENT — For future production migration only.**

```
src/infrastructure/
├── redis/                    # ADD in production
│   ├── redis.module.ts
│   ├── redis.config.ts
│   └── redis.provider.ts
├── queue/                    # ADD in production
│   ├── queue.module.ts
│   ├── constants.ts
│   ├── interfaces/
│   │   └── queue.service.interface.ts
│   └── services/
│       └── bullmq-queue.service.ts
└── worker/                   # ADD in production
    ├── worker.module.ts
    └── worker.constants.ts
```

---

## Implementation Order Summary

> ⚠️ **Prototype phases only (1–6). Do not implement BullMQ, Redis, Queue, or Worker modules.**

| Phase | Tasks | Depends On |
|---|---|---|
| **1** | Prisma schema: `Verification` model, `VerificationStatus` enum | Nothing |
| **2** | `BackgroundTaskService` (interface + prototype setTimeout impl) | Nothing |
| **3** | Verification module: `VerificationService.processVerification()` + `IVerificationService` mock provider | Phase 1 |
| **4** | Events: classes, listener, mock notification wiring | Phase 3 |
| **5** | API: enhance submit endpoint, strict validation, enqueue via `BackgroundTaskService` | Phase 1, 2, 3 |
| **6** | Property repo/service: verification CRUD methods | Phase 1 |

Phases 1, 2 can run in parallel. Phase 3 depends on Phase 1.

---

## Testing Strategy

| Component | Test |
|---|---|
| `MockVerificationService` | Unit: verify returns deterministic result based on property ID |
| `VerificationService.processVerification()` | Unit: calls verify → updateVerificationStatus → correct event |
| `PrototypeBackgroundTaskService` | Unit: calls `processVerification` after configured delay |
| `PropertyService.submitForVerification` | Unit: validation fires, `backgroundTaskService.enqueueVerification` called, status changes to PENDING |
| `VerificationListener` | Unit: verified event → notification sent; rejected event → notification sent |
| `MockNotificationService` | Unit: send logs correctly |
| E2E | POST submit → 202 → poll Verification until status is verified/rejected |

---

## Edge Cases & Considerations

- **Duplicate submission:** If `PropertyStatus` already `PENDING` → return error
- **Already verified:** If `VerificationStatus` already `VERIFIED` → return success without re-enqueuing
- **Property not found during verification:** Log warning, discard gracefully
- **Background task failure:** Error is logged but does not crash the process (caught in `setTimeout` callback)
- **Future Gov Service:** Swapping `MockVerificationService` for `GovVerificationService` is a module-level provider change only — `VerificationService.processVerification()` stays the same
- **Future BullMQ migration:** Only `BackgroundTaskService` implementation changes — `PropertyService`, `VerificationService`, controller, and events stay identical *(🚫 Not implemented in prototype)*
- **Future notification channels:** Adding email/SMS is a new implementation of `INotificationService` — event listener code stays the same
- **Future feature using same queue:** After BullMQ migration, any feature can inject `IQueueService` — no coupling to property verification *(🚫 Queue module not implemented in prototype)*
