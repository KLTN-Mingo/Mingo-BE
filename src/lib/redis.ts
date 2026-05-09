import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<void> | null = null;

function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL;
}

export function isRedisEnabled(): boolean {
  return !!getRedisUrl();
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on("error", (err) => {
      console.error("[Redis] Client error:", err);
    });
  }

  if (!redisClient.isOpen) {
    if (!redisConnectPromise) {
      redisConnectPromise = redisClient
        .connect()
        .catch((err) => {
          console.error("[Redis] Connect error:", err);
          redisClient = null;
        })
        .finally(() => {
          redisConnectPromise = null;
        }) as Promise<void>;
    }

    await redisConnectPromise;
  }

  return redisClient;
}
