import { sendFollowRequest } from "../controllers/follow.controller";
import { FollowService } from "../services/follow.service";
import { interactionTrackerService } from "../services/interaction-tracker.service";
import {
  InteractionSource,
  InteractionType,
} from "../models/user-interaction.model";

async function run() {
  const originalSendFollowRequest = FollowService.sendFollowRequest;
  const originalTrack = interactionTrackerService.track;

  let trackedPayload: any;
  let responsePayload: any;
  let responseStatus = 0;

  FollowService.sendFollowRequest = async (followerId: string, followingId: string) => {
    return {
      id: "follow_001",
      followerId,
      followingId,
      followStatus: "pending",
      closeFriendStatus: "none",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
  };

  interactionTrackerService.track = async (payload: any) => {
    trackedPayload = payload;
  };

  const req = {
    user: { userId: "user_001" },
    body: {
      userId: "author_001",
      postId: "post_001",
      source: InteractionSource.EXPLORE,
      deviceType: "mobile",
    },
  } as any;

  const res = {
    status(code: number) {
      responseStatus = code;
      return this;
    },
    json(payload: any) {
      responsePayload = payload;
      return this;
    },
  } as any;

  const next = (err?: unknown) => {
    if (err) throw err;
  };

  try {
    await new Promise<void>((resolve, reject) => {
      sendFollowRequest(req, res, (err?: unknown) => {
        if (err) reject(err);
      });
      setImmediate(resolve);
    });

    if (responseStatus !== 201) {
      throw new Error(`Expected status 201, got ${responseStatus}`);
    }

    if (!responsePayload?.success) {
      throw new Error("Expected follow response to be successful");
    }

    if (!trackedPayload) {
      throw new Error("Expected follow_from_post tracking payload");
    }

    if (trackedPayload.type !== InteractionType.FOLLOW_FROM_POST) {
      throw new Error(`Expected type follow_from_post, got ${trackedPayload.type}`);
    }

    if (trackedPayload.postId !== "post_001") {
      throw new Error(`Expected postId post_001, got ${trackedPayload.postId}`);
    }

    if (trackedPayload.source !== InteractionSource.EXPLORE) {
      throw new Error(`Expected source explore, got ${trackedPayload.source}`);
    }

    console.log("follow_from_post controller test passed");
  } finally {
    FollowService.sendFollowRequest = originalSendFollowRequest;
    interactionTrackerService.track = originalTrack;
  }
}

run().catch((err) => {
  console.error("follow_from_post controller test failed:", err);
  process.exit(1);
});
