export const PROFILE_SCORE_DAILY_RETENTION = 0.98;
export const PROFILE_SCORE_PRUNE_THRESHOLD = 0.01;

export interface ProfileScoreEntry {
  score: number;
  lastUpdatedAt: Date;
}

export type ProfileScoreValue = ProfileScoreEntry | number | null | undefined;

function toValidDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getEffectiveProfileScore(
  value: ProfileScoreValue,
  now: Date = new Date()
): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value || !Number.isFinite(value.score)) return 0;

  const updatedAt = toValidDate(value.lastUpdatedAt);
  if (!updatedAt) return value.score;

  const elapsedMs = Math.max(0, now.getTime() - updatedAt.getTime());
  const elapsedDays = elapsedMs / 86_400_000;
  return value.score * Math.pow(PROFILE_SCORE_DAILY_RETENTION, elapsedDays);
}

export function applyProfileScoreDelta(
  current: ProfileScoreValue,
  delta: number,
  now: Date = new Date()
): ProfileScoreEntry {
  return {
    score: getEffectiveProfileScore(current, now) + delta,
    lastUpdatedAt: now,
  };
}

export function updateProfileScoreMap(
  scores: Map<string, ProfileScoreEntry>,
  keys: Iterable<string>,
  delta: number,
  now: Date = new Date()
): void {
  for (const key of new Set(keys)) {
    if (!key) continue;
    scores.set(key, applyProfileScoreDelta(scores.get(key), delta, now));
  }
}

export function getTopProfileScoreKeys(
  scores:
    | Map<string, ProfileScoreValue>
    | Record<string, ProfileScoreValue>
    | null
    | undefined,
  limit: number,
  now: Date = new Date()
): string[] {
  if (!scores || limit <= 0) return [];
  const entries =
    scores instanceof Map ? Array.from(scores.entries()) : Object.entries(scores);
  return entries
    .map(([key, value]) => [key, getEffectiveProfileScore(value, now)] as const)
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export function shouldPruneProfileScore(value: ProfileScoreValue, now: Date): boolean {
  return Math.abs(getEffectiveProfileScore(value, now)) < PROFILE_SCORE_PRUNE_THRESHOLD;
}
