# Walkthrough — Patch Fixes

## Changes Made

### 1. Fixed wrong error codes (Bugs #1, #2)

**[property.errors.ts](file:///d:/Code/Homenet/apps/api/src/common/errors/codes/property.errors.ts#L16-L20)** — Added new `PROPERTY_MISSING_AREA` error (code 1502, HTTP 400):
```diff
+  PROPERTY_MISSING_AREA: {
+    code: 1502,
+    message: 'area_id is required for property creation',
+    httpStatus: 400,
+  },
```

**[property.service.ts](file:///d:/Code/Homenet/apps/api/src/modules/property/property.service.ts)** — Three error-code fixes:
- Missing `area_id` on create → now throws `PROPERTY_MISSING_AREA` (was `PROPERTY_NOT_FOUND`)
- Area not found on create → now throws `AREA_ERRORS.AREA_NOT_FOUND` (was `PROPERTY_NOT_FOUND`)
- Area not found on update → now throws `AREA_ERRORS.AREA_NOT_FOUND` (was `PROPERTY_NOT_FOUND`)

---

### 2. Refactored duplicated status logic (Bug #3)

Renamed `computeInitialStatus(dto)` → `computeStatus(data: Record<string, unknown>)` so it accepts a plain record and works for **both** the create and update paths. The update path now calls `this.computeStatus(merged)` instead of inlining the same logic.

---

### 3. Fixed indentation in else block (Issue #4)

The `merged` variable, `for` loop, and `allComplete` check were incorrectly indented at the method-body level inside an `else` block. Fixed to consistent 8-space nesting.

---

### 4. Deleted dead DTO files (Issue #5)

Removed two files that were no longer imported anywhere:
- `src/modules/property/dto/create-property.dto.ts`
- `src/modules/property/dto/update-property.dto.ts`

---

### 5. Added `@IsUUID()` validators (Nits #12, #13)

**[upsert-property.dto.ts](file:///d:/Code/Homenet/apps/api/src/modules/property/dto/upsert-property.dto.ts)** — `property_id` and `area_id` now use `@IsUUID()` instead of `@IsString()` to reject garbage input at the validation layer.

---

### 6. Restored deprecated `PATCH :id` endpoint (Issue #8)

**[property.controller.ts](file:///d:/Code/Homenet/apps/api/src/modules/property/property.controller.ts#L75-L87)** — Re-added `PATCH /properties/:id` as a deprecated alias that delegates to `upsert()`. Existing clients won't break.

---

### 7. Fixed documentation (Bug #2 in docs, Issue #10)

**[api-testing-guide.md](file:///d:/Code/Homenet/apps/api/docs/arman-docs/api-testing-guide.md)**:
- Area-not-found error response now shows `"Area not found"` / code `1400` (was `"Property not found"` / `1500`)
- Removed duplicate list items 14–16 in the test checklist

---

## Verification

- **TypeScript check**: `npx tsc --noEmit` passes with zero new errors. The only remaining errors are pre-existing (missing Prisma `Verification` model and `@nestjs/event-emitter` package — unrelated to this patch).
- **No import breakage**: Confirmed `CreatePropertyDto` and `UpdatePropertyDto` are not referenced anywhere in `src/` before deletion.

## Files Modified

| File | Change |
|---|---|
| [property.errors.ts](file:///d:/Code/Homenet/apps/api/src/common/errors/codes/property.errors.ts) | Added `PROPERTY_MISSING_AREA` error code |
| [property.service.ts](file:///d:/Code/Homenet/apps/api/src/modules/property/property.service.ts) | Fixed error codes, refactored `computeStatus`, fixed indentation |
| [upsert-property.dto.ts](file:///d:/Code/Homenet/apps/api/src/modules/property/dto/upsert-property.dto.ts) | Added `@IsUUID()` on `property_id` and `area_id` |
| [property.controller.ts](file:///d:/Code/Homenet/apps/api/src/modules/property/property.controller.ts) | Added deprecated `PATCH :id` endpoint |
| [api-testing-guide.md](file:///d:/Code/Homenet/apps/api/docs/arman-docs/api-testing-guide.md) | Fixed area error response, removed duplicate items |
| `create-property.dto.ts` | **Deleted** (dead file) |
| `update-property.dto.ts` | **Deleted** (dead file) |
