import mongoose from "mongoose";
import { Types } from "mongoose";
import { FollowService } from "../services/follow.service";
import { FollowModel, FollowStatus, CloseFriendStatus } from "../models/follow.model";
import { UserModel } from "../models/user.model";
import { NotificationService } from "../services/notification.service";
import * as relationshipCacheService from "../services/relationship-cache.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run(): Promise<void> {
  const requestId = new Types.ObjectId("6a24392a6514bae0db745364");
  const followerId = new Types.ObjectId("699ff5987a63ffb8f30ffae4");
  const followingId = new Types.ObjectId("699ff5917a63ffb8f30ffadf");

  const originalStartSession = mongoose.startSession;
  const originalFindById = FollowModel.findById;
  const originalFindOneAndUpdate = FollowModel.findOneAndUpdate;
  const originalUpdateOne = UserModel.updateOne;
  const originalInvalidate = relationshipCacheService.invalidateRelationshipCaches;
  const originalNotifyAccepted = NotificationService.notifyFollowAccepted;

  const updateCalls: Array<{
    filter: unknown;
    update: unknown;
    options: Record<string, unknown>;
  }> = [];

  try {
    (mongoose.startSession as any) = async () => ({
      withTransaction: async (work: () => Promise<void>) => {
        await work();
      },
      endSession: async () => undefined,
    });

    (FollowModel.findById as any) = (id: string) => ({
      session: async () => {
        assert(id === requestId.toString(), "findById must use the request id");
        return {
          _id: requestId,
          followerId,
          followingId,
          followStatus: FollowStatus.PENDING,
          closeFriendStatus: CloseFriendStatus.NONE,
        };
      },
    });

    (FollowModel.findOneAndUpdate as any) = async (
      filter: unknown,
      update: unknown,
      options: unknown
    ) => {
      assert(
        JSON.stringify(filter) ===
          JSON.stringify({
            _id: requestId,
            followingId,
            followStatus: FollowStatus.PENDING,
          }),
        "findOneAndUpdate must target the pending request for the receiver"
      );
      assert(
        JSON.stringify(update) ===
          JSON.stringify({
            $set: {
              followStatus: FollowStatus.ACCEPTED,
            },
          }),
        "findOneAndUpdate must accept the pending request"
      );
      assert((options as any)?.new === true, "findOneAndUpdate must request the updated document");

      return {
        _id: requestId,
        followerId,
        followingId,
        followStatus: FollowStatus.ACCEPTED,
        closeFriendStatus: CloseFriendStatus.NONE,
        createdAt: new Date("2026-06-06T15:13:46.279Z"),
        updatedAt: new Date("2026-06-06T15:24:09.183Z"),
      };
    };

    (UserModel.updateOne as any) = async (
      filter: unknown,
      update: unknown,
      options: Record<string, unknown>
    ) => {
      updateCalls.push({ filter, update, options });
      return { acknowledged: true };
    };

    (relationshipCacheService.invalidateRelationshipCaches as any) = async () => undefined;
    (NotificationService.notifyFollowAccepted as any) = async () => undefined;

    const result = await FollowService.respondFollowRequest(
      followingId.toString(),
      requestId.toString(),
      true
    );

    assert(result.followStatus === FollowStatus.ACCEPTED, "request must be accepted");
    assert(updateCalls.length === 2, "accepting a request must update both user counters");
    assert(
      updateCalls.every((call) => call.options?.updatePipeline === true),
      "counter updates must enable updatePipeline for aggregation updates"
    );
    assert(
      updateCalls.every(
        (call) =>
          Array.isArray(call.update) &&
          (call.options?.session as { withTransaction?: unknown } | undefined)
      ),
      "counter updates must keep using pipeline updates inside the session"
    );

    console.log("follow respond updatePipeline test passed");
  } finally {
    (mongoose.startSession as any) = originalStartSession;
    (FollowModel.findById as any) = originalFindById;
    (FollowModel.findOneAndUpdate as any) = originalFindOneAndUpdate;
    (UserModel.updateOne as any) = originalUpdateOne;
    (relationshipCacheService.invalidateRelationshipCaches as any) = originalInvalidate;
    (NotificationService.notifyFollowAccepted as any) = originalNotifyAccepted;
  }
}

run().catch((error) => {
  console.error("follow respond updatePipeline test failed:", error);
  process.exit(1);
});
