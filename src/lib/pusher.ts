import PusherServer from "pusher";

console.log("PUSHER ENV:", {
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
  secretExists: !!process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_APP_CLUSTER,
});

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: "ap1",
  useTLS: true,
});
