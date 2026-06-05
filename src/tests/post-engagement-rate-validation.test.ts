import { Types } from "mongoose";
import { ModerationStatus, PostModel, PostVisibility } from "../models/post.model";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testPostValidationClampsEngagementRate() {
  const post = new PostModel({
    userId: new Types.ObjectId(),
    contentText: "hello",
    visibility: PostVisibility.PUBLIC,
    engagementRate: 1.0635,
    moderationStatus: ModerationStatus.APPROVED,
  });

  await post.validate();

  assert(post.engagementRate === 1, "Expected engagementRate above 1 to be clamped before validation");
}

testPostValidationClampsEngagementRate()
  .then(() => console.log("post engagement rate validation test passed"))
  .catch((err) => {
    console.error("post engagement rate validation test failed:", err);
    process.exit(1);
  });
