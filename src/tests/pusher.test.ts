import { isPusherConfigured } from "../lib/pusher";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const original = {
    appId: process.env.PUSHER_APP_ID,
    key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY,
    legacyKey: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    legacySecret: process.env.PUSHER_APP_SECRET,
  };

  delete process.env.PUSHER_APP_ID;
  delete process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  delete process.env.PUSHER_KEY;
  delete process.env.PUSHER_SECRET;
  delete process.env.PUSHER_APP_SECRET;

  assert(isPusherConfigured() === false, "missing Pusher env should be treated as unconfigured");

  process.env.PUSHER_APP_ID = "app-id";
  process.env.PUSHER_KEY = "app-key";
  process.env.PUSHER_SECRET = "app-secret";

  assert(isPusherConfigured() === true, "PUSHER_KEY and PUSHER_SECRET should configure Pusher");

  restoreEnv("PUSHER_APP_ID", original.appId);
  restoreEnv("NEXT_PUBLIC_PUSHER_APP_KEY", original.key);
  restoreEnv("PUSHER_KEY", original.legacyKey);
  restoreEnv("PUSHER_SECRET", original.secret);
  restoreEnv("PUSHER_APP_SECRET", original.legacySecret);

  console.log("Pusher config test passed");
}

run();
