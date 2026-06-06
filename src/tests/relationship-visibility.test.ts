import {
  canViewPostWithRelationship,
  collectMutualCloseFriendIds,
  canReadRelationshipStatusFilter,
} from "../utils/relationship-visibility.util";
import { PostVisibility } from "../models/post.model";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const viewerId = "viewer";
  const authorId = "author";

  assert(
    canViewPostWithRelationship({
      visibility: PostVisibility.PUBLIC,
      authorId,
      viewerId,
      friendIds: new Set(),
      closeFriendIds: new Set(),
      blockedUserIds: new Set(),
    }),
    "public post must be visible when users are not blocked"
  );

  assert(
    !canViewPostWithRelationship({
      visibility: PostVisibility.FRIENDS,
      authorId,
      viewerId,
      friendIds: new Set(),
      closeFriendIds: new Set(),
      blockedUserIds: new Set(),
    }),
    "friends post must be hidden from non-friends"
  );

  assert(
    !canViewPostWithRelationship({
      visibility: PostVisibility.BESTFRIENDS,
      authorId,
      viewerId,
      friendIds: new Set([authorId]),
      closeFriendIds: new Set(),
      blockedUserIds: new Set(),
    }),
    "bestfriends post must be hidden from regular friends"
  );

  assert(
    !canViewPostWithRelationship({
      visibility: PostVisibility.PUBLIC,
      authorId,
      viewerId,
      friendIds: new Set([authorId]),
      closeFriendIds: new Set([authorId]),
      blockedUserIds: new Set([authorId]),
    }),
    "blocked users must not be visible even for public posts"
  );

  assert(
    collectMutualCloseFriendIds(viewerId, [
      { followerId: viewerId, followingId: authorId },
    ]).size === 0,
    "one-sided close-friend state must not grant bestfriends access"
  );

  assert(
    collectMutualCloseFriendIds(viewerId, [
      { followerId: viewerId, followingId: authorId },
      { followerId: authorId, followingId: viewerId },
    ]).has(authorId),
    "mutual close-friend state must grant bestfriends access"
  );

  assert(
    !canReadRelationshipStatusFilter({
      currentUserId: viewerId,
      targetUserId: authorId,
      status: "pending",
    }),
    "pending/rejected relationship filters must not be readable for other users"
  );

  assert(
    canReadRelationshipStatusFilter({
      currentUserId: viewerId,
      targetUserId: authorId,
      status: "accepted",
    }),
    "accepted relationship filters may be readable for other users"
  );
}

run()
  .then(() => console.log("relationship visibility tests passed"))
  .catch((error) => {
    console.error("relationship visibility tests failed:", error);
    process.exit(1);
  });
