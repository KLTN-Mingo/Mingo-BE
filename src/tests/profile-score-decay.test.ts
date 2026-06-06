import {
  applyProfileScoreDelta,
  getEffectiveProfileScore,
} from "../utils/profile-score.util";

function assertClose(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 0.0001) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

const now = new Date("2026-06-06T00:00:00.000Z");
const tenDaysAgo = new Date("2026-05-27T00:00:00.000Z");
const oneDayAgo = new Date("2026-06-05T00:00:00.000Z");

assertClose(
  getEffectiveProfileScore({ score: 100, lastUpdatedAt: tenDaysAgo }, now),
  100 * Math.pow(0.98, 10),
  "Old topic must decay from its own timestamp"
);

assertClose(
  getEffectiveProfileScore({ score: 100, lastUpdatedAt: oneDayAgo }, now),
  98,
  "Recent topic must use its own timestamp"
);

const updated = applyProfileScoreDelta(
  { score: 100, lastUpdatedAt: tenDaysAgo },
  5,
  now
);
assertClose(
  updated.score,
  100 * Math.pow(0.98, 10) + 5,
  "New interaction must be added after decay"
);
if (updated.lastUpdatedAt.getTime() !== now.getTime()) {
  throw new Error("Updated key must receive the interaction timestamp");
}

assertClose(
  getEffectiveProfileScore(42, now),
  42,
  "Legacy numeric values must remain readable during migration"
);

console.log("profile score decay test passed");
