import { PostVisibility } from "../models/post.model";
import { FollowStatus } from "../models/follow.model";

type IdLike = { toString(): string } | string;

export interface RelationshipVisibilityContext {
  visibility?: PostVisibility | string;
  authorId?: IdLike | null;
  viewerId?: IdLike | null;
  friendIds: Set<string>;
  closeFriendIds: Set<string>;
  blockedUserIds: Set<string>;
}

export interface CloseFriendRowLike {
  followerId?: IdLike | null;
  followingId?: IdLike | null;
}

function idToString(id: IdLike | null | undefined): string | undefined {
  return id?.toString();
}

export function canViewPostWithRelationship(
  context: RelationshipVisibilityContext
): boolean {
  const authorId = idToString(context.authorId);
  const viewerId = idToString(context.viewerId);
  if (!authorId) return false;
  if (viewerId && authorId === viewerId) return true;
  if (context.blockedUserIds.has(authorId)) return false;

  switch (context.visibility) {
    case PostVisibility.PUBLIC:
      return true;
    case PostVisibility.FRIENDS:
      return context.friendIds.has(authorId);
    case PostVisibility.BESTFRIENDS:
      return context.closeFriendIds.has(authorId);
    case PostVisibility.PRIVATE:
    default:
      return false;
  }
}

export function collectMutualCloseFriendIds(
  userId: string,
  rows: CloseFriendRowLike[]
): Set<string> {
  const byOtherUser = new Map<string, Set<string>>();

  rows.forEach((row) => {
    const followerId = idToString(row.followerId);
    const followingId = idToString(row.followingId);
    if (!followerId || !followingId) return;

    const otherUserId =
      followerId === userId
        ? followingId
        : followingId === userId
          ? followerId
          : undefined;
    if (!otherUserId) return;

    const directions = byOtherUser.get(otherUserId) ?? new Set<string>();
    directions.add(`${followerId}->${followingId}`);
    byOtherUser.set(otherUserId, directions);
  });

  const mutualIds = new Set<string>();
  byOtherUser.forEach((directions, otherUserId) => {
    if (
      directions.has(`${userId}->${otherUserId}`) &&
      directions.has(`${otherUserId}->${userId}`)
    ) {
      mutualIds.add(otherUserId);
    }
  });
  return mutualIds;
}

export function canReadRelationshipStatusFilter(params: {
  currentUserId: string;
  targetUserId: string;
  status?: FollowStatus | string;
}): boolean {
  if (!params.status || params.status === FollowStatus.ACCEPTED) return true;
  return params.currentUserId === params.targetUserId;
}
