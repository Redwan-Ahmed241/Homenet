# Property Submission Workflow

## Endpoint 1: `POST /v1/properties/draft`

Save or update a draft. No validation beyond ownership. The user can call this any number of times.

```
                ┌─────────────────────────────────────┐
                │     POST /v1/properties/draft       │
                │  Body: any fields the user wants    │
                └────────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Does body have an `id`? │
                    └───────┬────────┬────────┘
                            │        │
                       No   │        │  Yes
                            │        │
                    ┌───────▼──┐  ┌───▼───────────┐
                    │  Create  │  │  Update        │
                    │  draft   │  │  existing      │
                    │  return  │  │  draft         │
                    │  new id  │  │  return id     │
                    └──────────┘  └───────────────┘
```

---

## Endpoint 2: `POST /v1/properties/submit`

Save fields, validate everything, and if all required fields are present — transition to `pending` and enqueue verification.

```
                ┌─────────────────────────────────────┐
                │   POST /v1/properties/submit        │
                │  Body: any fields + optional `id`   │
                └────────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Does body have an `id`? │
                    └───────┬────────┬────────┘
                            │        │
                       No   │        │  Yes
                            │        │
                    ┌───────▼──┐  ┌───▼───────────┐
                    │  Create  │  │  Load existing │
                    │  draft   │  │  draft by id   │
                    └───────┬──┘  └───┬───────────┘
                            │        │
                            └────┬────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Merge body fields into │
                    │  the draft (always save) │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  All required fields     │
                    │  present?                │
                    └───────┬────────┬────────┘
                            │        │
                       Yes  │        │  No
                            │        │
                    ┌───────▼────┐ ┌─▼──────────────┐
                    │  Set to    │ │  Return error   │
                    │  pending   │ │  Draft stays    │
                    │  Create    │ │  (but fields    │
                    │  Verifica- │ │  were saved)    │
                    │  tion      │ └────────────────┘
                    │  Enqueue   │
                    │  back-     │
                    │  ground    │
                    │  task      │
                    └────────────┘
```

---

## Summary

| Call | Fields saved? | Validates? | Status outcome |
|------|:-----------:|:---------:|:-------------:|
| `/draft` (no id) | Yes | No | `draft` |
| `/draft` (with id) | Yes | No | `draft` (unchanged) |
| `/submit` (no id) | Yes | Yes | Creates draft first, then `pending` if valid, `draft` if not |
| `/submit` (with id) | Yes | Yes | `pending` if valid, `draft` if not |
