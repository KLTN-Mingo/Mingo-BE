"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowModel = exports.CloseFriendStatus = exports.FollowStatus = void 0;
// src/models/follow.model.ts
const mongoose_1 = require("mongoose");
// Trạng thái follow request
var FollowStatus;
(function (FollowStatus) {
    FollowStatus["PENDING"] = "pending";
    FollowStatus["ACCEPTED"] = "accepted";
    FollowStatus["REJECTED"] = "rejected";
})(FollowStatus || (exports.FollowStatus = FollowStatus = {}));
// Trạng thái close friend request
var CloseFriendStatus;
(function (CloseFriendStatus) {
    CloseFriendStatus["NONE"] = "none";
    CloseFriendStatus["PENDING"] = "pending";
    CloseFriendStatus["ACCEPTED"] = "accepted";
    CloseFriendStatus["REJECTED"] = "rejected";
})(CloseFriendStatus || (exports.CloseFriendStatus = CloseFriendStatus = {}));
const FollowSchema = new mongoose_1.Schema({
    followerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    followingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    followStatus: {
        type: String,
        enum: Object.values(FollowStatus),
        default: FollowStatus.PENDING,
        index: true,
    },
    closeFriendStatus: {
        type: String,
        enum: Object.values(CloseFriendStatus),
        default: CloseFriendStatus.NONE,
        index: true,
    },
    closeFriendRequestedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    closeFriendRequestedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
// Compound unique index to prevent duplicate follows
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Indexes for queries
FollowSchema.index({ followerId: 1, followStatus: 1, createdAt: -1 });
FollowSchema.index({ followingId: 1, followStatus: 1, createdAt: -1 });
FollowSchema.index({ followerId: 1, closeFriendStatus: 1 });
FollowSchema.index({ followingId: 1, closeFriendStatus: 1 });
exports.FollowModel = (0, mongoose_1.model)("Follow", FollowSchema);
