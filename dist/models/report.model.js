"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportModel = exports.ReportStatus = exports.ReportReason = exports.ReportTargetType = void 0;
// src/models/report.model.ts
const mongoose_1 = require("mongoose");
var ReportTargetType;
(function (ReportTargetType) {
    ReportTargetType["POST"] = "post";
    ReportTargetType["COMMENT"] = "comment";
    ReportTargetType["USER"] = "user";
})(ReportTargetType || (exports.ReportTargetType = ReportTargetType = {}));
var ReportReason;
(function (ReportReason) {
    ReportReason["SPAM"] = "spam";
    ReportReason["HARASSMENT"] = "harassment";
    ReportReason["HATE_SPEECH"] = "hate_speech";
    ReportReason["INAPPROPRIATE"] = "inappropriate";
    ReportReason["SCAM"] = "scam";
    ReportReason["COPYRIGHT"] = "copyright";
    ReportReason["VIOLENCE"] = "violence";
    ReportReason["MISINFORMATION"] = "misinformation";
    ReportReason["OTHER"] = "other";
})(ReportReason || (exports.ReportReason = ReportReason = {}));
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["PENDING"] = "pending";
    ReportStatus["REVIEWING"] = "reviewing";
    ReportStatus["RESOLVED"] = "resolved";
    ReportStatus["DISMISSED"] = "dismissed";
    ReportStatus["REVIEWED"] = "reviewed";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
const ReportSchema = new mongoose_1.Schema({
    reporterId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    targetType: {
        type: String,
        enum: Object.values(ReportTargetType),
        required: true,
        index: true,
    },
    targetId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    reason: {
        type: String,
        enum: Object.values(ReportReason),
        maxlength: 120,
        trim: true,
    },
    description: {
        type: String,
        maxlength: 2000,
        default: "",
    },
    status: {
        type: String,
        enum: Object.values(ReportStatus),
        default: ReportStatus.PENDING,
        index: true,
    },
    resolutionNote: {
        type: String,
        maxlength: 1000,
    },
    reviewedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    reviewedAt: {
        type: Date,
    },
    actionTaken: {
        type: String,
        maxlength: 64,
        trim: true,
    },
    moderationSnapshot: {
        type: mongoose_1.Schema.Types.Mixed,
        default: undefined,
    },
}, { timestamps: true });
ReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 });
ReportSchema.index({ status: 1, createdAt: -1 });
exports.ReportModel = (0, mongoose_1.model)("Report", ReportSchema);
