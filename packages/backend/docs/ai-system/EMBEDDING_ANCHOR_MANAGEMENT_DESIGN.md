# DB-backed embedding anchor management (design only)

Anchors today live in `embeddingAnchor.service.js` as static phrase lists per bucket. This document describes a MongoDB-backed model aligned with **EmergencyPhrase** patterns (`isActive`, audit fields, compound indexes) so anchors can change without deploy.

---

## 1. Mongoose schema

**Collection:** `embeddinganchors` (model name `EmbeddingAnchor`).

| Field | Type | Notes |
|-------|------|--------|
| `text` | String, required, trim | Anchor phrase embedded for similarity (like `EmergencyPhrase.phrase`). |
| `bucket` | String, required, enum | Logical group: e.g. `transferMethods`, `scamIndicators`, `urgencyLanguage`, `relationshipMoney`, `physicalAbuse`, `emotionalAbuse`, `neglect`, plus any future buckets the service defines. |
| `domain` | String, enum | `financial` \| `abuse` — mirrors how the service splits financial vs abuse anchors (optional if bucket implies domain). |
| `language` | String, default `en` | Same enum idea as EmergencyPhrase for future localization. |
| `isActive` | Boolean, default `true` | Soft-disable without delete. |
| `weight` | Number, default `1` | Optional per-anchor strength when blending similarities (future). |
| `sortOrder` | Number, default `0` | Stable ordering in admin UI / tie-break. |
| `description` | String, max 500 | Admin-only context (like EmergencyPhrase). |
| `tags` | [String] | Optional grouping. |
| `createdBy` | ObjectId → Caregiver | Required on create (EmergencyPhrase pattern). |
| `lastModifiedBy` | ObjectId → Caregiver | Required on update. |
| `embeddingModel` | String | e.g. `text-embedding-3-small` — document which model this row was built for (helps migrations). |
| `embedding` | [Number] or Binary | **Optional** precomputed vector to skip embed API on read (advanced); if omitted, service embeds `text` at load time. |
| `timestamps` | — | `createdAt`, `updatedAt`. |

**Indexes**

- `{ bucket: 1, isActive: 1 }` — primary load path for a bucket.
- `{ domain: 1, isActive: 1 }` — bulk reload by domain.
- `{ bucket: 1, language: 1, isActive: 1 }` — localized buckets.
- `{ updatedAt: -1 }` — admin lists / incremental sync.
- Unique partial index optional: `{ bucket: 1, text: 1, language: 1 }` with `unique: true`, `partialFilterExpression: { isActive: true }` to avoid duplicate active anchors (tune if soft-deletes need re-add).

---

## 2. How `EmbeddingAnchorService` would load from DB (not hardcode)

1. **Startup / first use:** On `ensureInitialized()` (or explicit `initialize()`), the service:
   - Reads all documents with `isActive: true` (or loads by `domain` in two queries).
   - Groups by `bucket`.
   - For each bucket, either uses stored `embedding` or batches `text` through the OpenAI embed API (same dimensions as today).
   - Builds the in-memory maps currently produced from static arrays (`_financialEmbeddings`, norms, temporal union, etc.).

2. **Fallback:** If DB returns zero rows for a bucket, optionally merge **code defaults** for that bucket so a bad migration does not blank detection (feature-flagged).

3. **No hardcode at startup:** Static lists in code become **seed/migration** only; runtime source of truth is DB.

---

## 3. Cache invalidation

- **In-process:** Keep a monotonic `cacheGeneration` (or `lastLoadedAt`). After successful load, store it. Admin writes bump a **global anchor version** in DB (singleton `EmbeddingAnchorConfig` doc with `version: Number`) **or** rely on `post('save')` / `findOneAndUpdate` hooks that call `embeddingAnchorService.invalidateAndReload()`.

- **Reload strategy:**
  - **Eager:** On any create/update/delete of `EmbeddingAnchor`, reload **affected bucket only** (re-fetch that bucket’s actives, re-embed changed texts) to limit API cost.
  - **Full:** Simpler v1 — invalidate flag + full reload on next `ensureInitialized()` or immediate full reload in admin request path.

- **Multi-instance:** Use Redis pub/sub channel `embedding-anchors:invalidate` with payload `{ bucket?, version }`. All API nodes subscribe and run bucket-scoped or full reload. Same pattern as other cache busts in the app.

- **Race safety:** During reload, either serve previous snapshot until new embeddings are ready (double-buffer) or short-circuit detection for one tick (avoid mixed old/new).

---

## 4. Admin API (route signatures only)

Assume auth + superadmin (or role `manage_embedding_anchors`).

```
GET    /v1/admin/embedding-anchors
GET    /v1/admin/embedding-anchors/:anchorId
POST   /v1/admin/embedding-anchors
PATCH  /v1/admin/embedding-anchors/:anchorId
DELETE /v1/admin/embedding-anchors/:anchorId
POST   /v1/admin/embedding-anchors/reload          # force all nodes to refresh (optional body: { bucket })
GET    /v1/admin/embedding-anchors/meta/buckets    # list bucket keys + counts (read-only)
```

No implementation in this doc.
