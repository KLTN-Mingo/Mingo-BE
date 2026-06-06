# Personalized Feed Per-Key Decay Design

## Goal

Make the Personalized Feed implementation match the report by providing:

- exploration from content outside the user's current top interests;
- independent time decay for each topic, hashtag, and author affinity;
- one HotScore formula shared by cron and scoring fallback;
- clear separation between interaction signal multipliers and time decay.

The existing feed API and response DTOs remain unchanged.

## User Profile Schema

Replace each numeric profile map value with an embedded value:

```ts
export interface IProfileScoreEntry {
  score: number;
  lastUpdatedAt: Date;
}

topicScores: Map<string, IProfileScoreEntry>;
hashtagScores: Map<string, IProfileScoreEntry>;
authorScores: Map<string, IProfileScoreEntry>;
```

`lastCalculatedAt` is removed from the decay logic and from the schema index.
MongoDB document-level `updatedAt` remains available for operational metadata
but must not affect interest decay.

## Per-Key Time Decay

Use a daily retention constant:

```ts
PROFILE_SCORE_DAILY_RETENTION = 0.98;
```

The effective score at time `now` is:

```text
effectiveScore =
  storedScore * PROFILE_SCORE_DAILY_RETENTION ^ elapsedDays
```

Elapsed time may be fractional. Invalid or future timestamps use zero elapsed
days. Scores whose absolute value falls below a small pruning threshold may be
removed during a write to prevent unbounded profile growth.

### Interaction Update

When an interaction arrives:

1. Load the post topics, post author, and hashtags.
2. Load or create the user's profile.
3. For only the related keys, calculate the effective score from that key's
   own `lastUpdatedAt`.
4. Add the new interaction delta.
5. Store `{ score: newScore, lastUpdatedAt: now }`.
6. Increment `interactionCount`.

Unrelated keys are not read, decayed, or timestamped during this update.

The update uses optimistic concurrency: load the profile version, update with
an `_id` and `__v` condition, and retry a bounded number of times if another
interaction changed the profile concurrently. This prevents one interaction
from overwriting another interaction's map changes.

## Read-Time Scoring

Scoring never mutates the profile. It resolves each required profile entry to
its effective score at the scoring timestamp.

Content personalization remains:

```text
personalizationScore =
  sum(effective topic scores for post topics)
  + effective author score * 1.2
```

The result remains clamped to `[0, 100]`. Existing cold-start weights and API
output remain unchanged.

Legacy numeric entries are accepted temporarily by the read helper and treated
as already-decayed values. The migration removes this compatibility need from
stored data, but the fallback prevents deployment-order failures.

## Exploration And Diversity

Exploration applies only to the personalized Explore feed.

1. Rank all eligible candidates using the normal scoring formula.
2. Reserve `EXPLORATION_RATE = 0.15` of the output positions.
3. Determine the user's top interest topics using effective per-key scores.
4. Build an exploration pool from posts whose topics do not intersect those
   top interests.
5. Select exploration posts from that pool, preferring candidates with a
   reasonable popularity score and then randomizing ties/order.
6. Fill the remaining positions with the highest-ranked exploitation posts.
7. Interleave exploration posts through the result instead of appending all of
   them at the end.

If no profile or no outside-interest candidates exist, fall back to the
existing safe behavior: keep the ranked head and randomize candidates from the
lower-ranked tail. No duplicate post may appear.

Constants define the exploration rate, top-interest count, and fallback
behavior; there are no inline `0.85` or `0.15` magic numbers.

## HotScore

`calculateHotScore(post, now?)` is the only public HotScore calculation.

It calculates raw popularity from engagement and age, then applies:

```ts
HOT_SCORE_MULTIPLIER = 2;
```

Both the cron job and `ScoringService` fallback call this function. A stored
positive `post.hotScore` is consumed directly, so stored and fallback values
share the same scale.

## Naming

Rename `INTERACTION_DECAY` to `INTERACTION_SIGNAL_MULTIPLIERS`. These values
describe interaction strength modifiers such as `view = 0.6`; they are not
time decay.

The actual time-decay constants and helpers live with profile scoring logic and
use names containing `PROFILE_SCORE` or `TIME_DECAY`.

## Migration

A database migration is required because existing maps contain numbers.

For each `UserProfile`:

- convert numeric values to `{ score: oldValue, lastUpdatedAt: timestamp }`;
- use the profile's existing `updatedAt`, falling back to the migration time;
- preserve already-migrated object values;
- remove `lastCalculatedAt`.

The migration must be idempotent and support a dry-run mode. It is exposed as a
dedicated npm script and is not run automatically during application startup.

## Tests

Add executable TypeScript tests covering:

- two entries updated on different dates decay independently;
- updating one topic does not refresh another topic's timestamp;
- scoring reads effective per-key topic and author scores;
- interaction signal multipliers are not used as time decay;
- exploration reserves outside-interest posts when available;
- exploration has no duplicates and falls back safely without a profile;
- cron and fallback HotScore return the same value for the same post and time;
- migration converts numeric entries and leaves migrated entries unchanged.

Run all new tests, existing feed/culture tests, and `npm run build`.

## Report Alignment

After implementation, the report can accurately state:

- 15 percent of Explore feed positions are reserved for candidates outside the
  user's strongest current topic interests when such candidates are available;
- each profile topic, hashtag, and author affinity decays independently from
  its own last update time;
- the 90-day interaction TTL controls raw interaction retention, while per-key
  time decay controls long-term UserProfile relevance;
- cron and fallback popularity use the same HotScore formula and scale.
