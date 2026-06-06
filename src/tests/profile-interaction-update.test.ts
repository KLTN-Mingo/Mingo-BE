import { updateProfileScoreMap } from "../utils/profile-score.util";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date("2026-06-06T00:00:00.000Z");
const oldTimestamp = new Date("2026-05-07T00:00:00.000Z");
const untouchedTimestamp = new Date("2026-06-01T00:00:00.000Z");
const scores = new Map([
  ["technology", { score: 100, lastUpdatedAt: oldTimestamp }],
  ["cooking", { score: 50, lastUpdatedAt: untouchedTimestamp }],
]);

updateProfileScoreMap(scores, ["technology"], 4, now);

const technology = scores.get("technology");
const cooking = scores.get("cooking");

assert(technology, "Updated topic must exist");
assert(cooking, "Unrelated topic must remain");
assert(
  technology.lastUpdatedAt.getTime() === now.getTime(),
  "Related topic timestamp must be refreshed"
);
assert(
  technology.score < 104,
  "Related topic must decay before the new delta is added"
);
assert(
  cooking.score === 50 &&
    cooking.lastUpdatedAt.getTime() === untouchedTimestamp.getTime(),
  "Unrelated topic must not decay or receive a new timestamp"
);

console.log("profile interaction update test passed");
