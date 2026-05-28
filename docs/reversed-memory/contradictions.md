# ClientMemory contradictions — roadmap

This document describes how Bianca handles conflicting observations today and options for future work.

## Current behavior

Facts are deduplicated by **`normalizedKey`**, computed as:

```
category + ":" + normalizeFactText(fact)
```

`normalizeFactText` lowercases, collapses whitespace, and strips most punctuation. There is **no semantic contradiction detection**.

### Example: tea preference

If a resident says on different calls:

- "I like tea in the morning"
- "I do not like tea anymore"

These produce **different normalized keys** and are stored as **two separate facts**. Both may eventually become `active` if each is reinforced independently. Both can appear in the same prompt.

There is no automatic:

- `contradictionCount` increment
- `conflicted` status
- suppression of the older observation

The schema includes `contradictionCount` and `conflicted` for forward compatibility, but **no production code sets them yet**.

## Why this is acceptable for now

The reversed-memory patch prioritizes:

1. Provisional-first storage
2. Reinforcement before prompt use
3. Decay and unsafe-text filtering

Contradiction handling requires reliable semantic or structured comparison (negation, antonyms, entity linking). Getting this wrong would silently delete valid nuance ("used to like tea" vs "does not like tea now").

## Known limitations

| Scenario | Current result |
|----------|----------------|
| Same fact, paraphrased identically after normalization | Merged / reinforced |
| Same fact, different category | Two rows |
| Explicit contradiction | Two rows coexist |
| Corrected preference ("call me Rose not Margaret") | New row; old may remain until decay |
| Prompt injection disguised as preference | Blocked on write; filtered on read if legacy |

## Future design options

### Option A — Structured key/value facts

Store `{ key: "beverage.tea", value: "likes" | "dislikes" }` with explicit supersession:

- New observation with same key replaces or conflicts with prior value
- `supersededBy` pointer to winning fact

### Option B — Lightweight negation pairs

Maintain a small ruleset:

- Detect "does not" / "no longer" / "never" prefixes
- Compare normalized stem to existing keys in same category
- Mark older fact `conflicted`, increment `contradictionCount` on both

### Option C — LLM contradiction pass (async)

After extraction, run a second model call:

- Input: new facts + top-N active facts for client
- Output: merge, conflict, or ignore
- Higher cost; needs strong audit logging

### Option D — Human review queue

Surface new `provisional` facts that fuzzy-match an active fact in caregiver UI before activation.

## Recommended next step

Implement **Option B** for high-impact categories (`preference`, `health`, `relationship`) before Option C. Keep mood/concern as time-bounded observations where contradictions are often valid temporal change.

## Related files

- `packages/backend/src/utils/clientMemory.scoring.js` — `buildNormalizedKey`, `normalizeFactText`
- `packages/backend/src/services/clientMemory.service.js` — `mergeExtractedFacts`, `getClientFacts`
- `packages/backend/src/models/clientMemory.model.js` — `contradictionCount`, `status: conflicted`
