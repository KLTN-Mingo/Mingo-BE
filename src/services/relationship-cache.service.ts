import { getRedisClient } from "../lib/redis";

export async function invalidateRelationshipCaches(
  ...userIds: string[]
): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!redis) return;

    const keys = [...new Set(userIds.filter(Boolean))].map(
      (userId) => `friends:${userId}`
    );
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    console.error("[RelationshipCache] Failed to invalidate friend cache:", error);
  }
}
