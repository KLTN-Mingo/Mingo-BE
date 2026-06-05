import { buildPostShareMessageText } from "../utils/share-message.util";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const text = buildPostShareMessageText({
    postId: "681c11111111111111111111",
    shareId: "681d11111111111111111111",
    message: "  Bai nay hay ne  ",
    createdAt: new Date("2026-05-09T08:05:00.000Z"),
  });

  const payload = JSON.parse(text);

  assert(payload.type === "post_share", "type should identify a shared post");
  assert(payload.postId === "681c11111111111111111111", "postId should be preserved");
  assert(payload.shareId === "681d11111111111111111111", "shareId should be preserved");
  assert(payload.message === "Bai nay hay ne", "message should be trimmed");
  assert(
    payload.createdAt === "2026-05-09T08:05:00.000Z",
    "createdAt should be serialized as ISO"
  );

  console.log("Share message payload test passed");
}

run();
