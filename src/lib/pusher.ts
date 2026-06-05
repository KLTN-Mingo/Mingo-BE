// // src/lib/pusher.ts
// import Pusher from "pusher";

// export const pusherServer = new Pusher({
//   appId: process.env.PUSHER_APP_ID!,
//   key: process.env.PUSHER_APP_KEY!,
//   secret: process.env.PUSHER_APP_SECRET!,
//   cluster: process.env.PUSHER_APP_CLUSTER ?? "ap1",
//   useTLS: true,
// });

import PusherServer from "pusher";

function getPusherConfig() {
  return {
    appId: process.env.PUSHER_APP_ID,
    key:
      process.env.NEXT_PUBLIC_PUSHER_APP_KEY ??
      process.env.PUSHER_KEY ??
      process.env.PUSHER_APP_KEY,
    secret: process.env.PUSHER_SECRET ?? process.env.PUSHER_APP_SECRET,
    cluster: process.env.PUSHER_CLUSTER ?? process.env.PUSHER_APP_CLUSTER ?? "ap1",
  };
}

export function isPusherConfigured(): boolean {
  const config = getPusherConfig();
  return Boolean(config.appId && config.key && config.secret);
}

const pusherConfig = getPusherConfig();

export const pusherServer = new PusherServer({
  appId: pusherConfig.appId ?? "",
  key: pusherConfig.key ?? "",
  secret: pusherConfig.secret ?? "",
  cluster: pusherConfig.cluster,
  useTLS: true,
});

export async function triggerPusherEvent(
  channel: string,
  event: string,
  payload: unknown
): Promise<boolean> {
  if (!isPusherConfigured()) {
    console.warn("[Pusher] Missing config, skipped event:", { channel, event });
    return false;
  }

  try {
    await pusherServer.trigger(channel, event, payload);
    return true;
  } catch (err) {
    console.error("Pusher error:", err);
    return false;
  }
}
