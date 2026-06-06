import {
  deduplicateCloseFriendRequests,
  isAcceptedRelationship,
  normalizeRelationshipPagination,
  parseRelationshipBoolean,
} from "../utils/relationship.util";
import { FollowStatus } from "../models/follow.model";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function run(): void {
  assert(parseRelationshipBoolean(true, "accept") === true, "true must remain true");
  assert(parseRelationshipBoolean(false, "accept") === false, "false must remain false");
  assertThrows(
    () => parseRelationshipBoolean("false", "accept"),
    "string booleans must be rejected"
  );

  const pagination = normalizeRelationshipPagination("-4", "500");
  assert(pagination.page === 1, "page must be clamped to one");
  assert(pagination.limit === 50, "limit must be capped at fifty");

  assert(
    isAcceptedRelationship({ followStatus: FollowStatus.ACCEPTED }),
    "accepted follow must be active"
  );
  assert(
    !isAcceptedRelationship({ followStatus: FollowStatus.PENDING }),
    "pending follow must not be active"
  );
  assert(
    !isAcceptedRelationship({ followStatus: FollowStatus.REJECTED }),
    "rejected follow must not be active"
  );

  const requests = deduplicateCloseFriendRequests([
    {
      id: "forward",
      requesterId: "user-a",
      participantIds: ["user-a", "user-b"],
      requestedAt: new Date("2026-06-01T00:00:00.000Z"),
    },
    {
      id: "reverse",
      requesterId: "user-a",
      participantIds: ["user-b", "user-a"],
      requestedAt: new Date("2026-06-01T00:00:00.000Z"),
    },
  ]);

  assert(requests.length === 1, "one logical close-friend request must be returned");
  assert(requests[0].id === "forward", "the first stable request id must be retained");

  console.log("relationship invariant tests passed");
}

try {
  run();
} catch (error) {
  console.error("relationship invariant tests failed:", error);
  process.exit(1);
}
