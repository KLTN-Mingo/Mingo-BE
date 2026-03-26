import { Schema, model, Document, Types } from "mongoose";

export type FeedTab = "friends" | "explore";

export interface IFeedImpression extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  requestId: string;
  tab: FeedTab;
  source: string;
  position: number;
  score?: number;
  scoreContent?: number;
  scorePopularity?: number;
  scoreSocial?: number;
  createdAt: Date;
}

const FeedImpressionSchema = new Schema<IFeedImpression>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      required: true,
      index: true,
    },
    tab: {
      type: String,
      enum: ["friends", "explore"],
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
      index: true,
    },
    position: {
      type: Number,
      required: true,
      min: 1,
    },
    score: { type: Number },
    scoreContent: { type: Number },
    scorePopularity: { type: Number },
    scoreSocial: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FeedImpressionSchema.index({ userId: 1, createdAt: -1 });
FeedImpressionSchema.index({ tab: 1, createdAt: -1 });
FeedImpressionSchema.index({ postId: 1, createdAt: -1 });
FeedImpressionSchema.index(
  { userId: 1, postId: 1, requestId: 1 },
  { unique: true }
);

// Keep analytics data for 90 days to limit collection growth.
FeedImpressionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export const FeedImpressionModel = model<IFeedImpression>(
  "FeedImpression",
  FeedImpressionSchema
);
