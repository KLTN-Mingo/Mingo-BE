import { FollowStatus } from "../models/follow.model";
import { ValidationError } from "../errors";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface CloseFriendRequestIdentity {
  id: string;
  requesterId: string;
  participantIds: string[];
  requestedAt: Date;
}

export function parseRelationshipBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} phải là boolean`);
  }
  return value;
}

export function normalizeRelationshipPagination(
  pageValue: unknown,
  limitValue: unknown
): { page: number; limit: number } {
  const parsedPage = Number(pageValue ?? DEFAULT_PAGE);
  const parsedLimit = Number(limitValue ?? DEFAULT_LIMIT);
  const page = Number.isFinite(parsedPage)
    ? Math.max(DEFAULT_PAGE, Math.trunc(parsedPage))
    : DEFAULT_PAGE;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsedLimit)))
    : DEFAULT_LIMIT;

  return { page, limit };
}

export function isAcceptedRelationship(
  follow?: { followStatus?: FollowStatus } | null
): boolean {
  return follow?.followStatus === FollowStatus.ACCEPTED;
}

export function deduplicateCloseFriendRequests<
  T extends CloseFriendRequestIdentity
>(requests: T[]): T[] {
  const seen = new Set<string>();

  return requests.filter((request) => {
    const participants = [...request.participantIds].sort().join(":");
    const key = `${participants}:${request.requesterId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function assertFollowStatus(value: unknown): FollowStatus | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    !Object.values(FollowStatus).includes(value as FollowStatus)
  ) {
    throw new ValidationError("status follow không hợp lệ");
  }
  return value as FollowStatus;
}
