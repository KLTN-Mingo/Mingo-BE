"use strict";
// src/controllers/report.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyReports = exports.createReport = void 0;
const mongoose_1 = require("mongoose");
const async_handler_1 = require("../utils/async-handler");
const response_1 = require("../utils/response");
const errors_1 = require("../errors");
const report_model_1 = require("../models/report.model");
const post_model_1 = require("../models/post.model");
const comment_model_1 = require("../models/comment.model");
const moderation_service_1 = require("../services/moderation/moderation.service");
// ─── Helper ───────────────────────────────────────────────────────────────────
function getUserId(req) {
    const userId = req.user?.userId;
    if (!userId) {
        throw new errors_1.ForbiddenError("Cần đăng nhập");
    }
    return userId;
}
function isReportEntityType(v) {
    return v === "post" || v === "comment";
}
function isReportReason(v) {
    return Object.values(report_model_1.ReportReason).includes(v);
}
function toTargetType(entityType) {
    return entityType === "post"
        ? report_model_1.ReportTargetType.POST
        : report_model_1.ReportTargetType.COMMENT;
}
// ─── Controllers ─────────────────────────────────────────────────────────────
/**
 * @route   POST /api/reports
 * @body    { entityType, entityId, reason, description? }
 * @access  Private
 */
exports.createReport = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const body = req.body;
    const { entityType: rawType, entityId, reason: rawReason, description } = body;
    if (!rawType || !isReportEntityType(rawType)) {
        throw new errors_1.ValidationError("entityType phải là 'post' hoặc 'comment'", "INVALID_ENTITY_TYPE");
    }
    if (!entityId || !mongoose_1.Types.ObjectId.isValid(String(entityId))) {
        throw new errors_1.ValidationError("entityId không hợp lệ", "INVALID_ENTITY_ID");
    }
    if (!rawReason || !isReportReason(rawReason)) {
        throw new errors_1.ValidationError(`reason không hợp lệ. Cho phép: ${Object.values(report_model_1.ReportReason).join(", ")}`, "INVALID_REPORT_REASON");
    }
    const reason = rawReason;
    const targetType = toTargetType(rawType);
    const oid = new mongoose_1.Types.ObjectId(String(entityId));
    let ownerUserId;
    let contentText = "";
    if (rawType === "post") {
        const post = await post_model_1.PostModel.findById(oid)
            .select("userId contentText")
            .lean();
        if (!post) {
            throw new errors_1.NotFoundError("Không tìm thấy bài viết");
        }
        ownerUserId = post.userId.toString();
        contentText = post.contentText ?? "";
    }
    else {
        const comment = await comment_model_1.CommentModel.findById(oid)
            .select("userId contentText")
            .lean();
        if (!comment) {
            throw new errors_1.NotFoundError("Không tìm thấy bình luận");
        }
        ownerUserId = comment.userId.toString();
        contentText = comment.contentText ?? "";
    }
    if (ownerUserId === userId) {
        throw new errors_1.ValidationError("Không thể báo cáo nội dung của chính bạn", "SELF_REPORT");
    }
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicate = await report_model_1.ReportModel.findOne({
        reporterId: userId,
        targetType,
        targetId: oid,
        createdAt: { $gte: since24h },
    }).lean();
    if (duplicate) {
        throw new errors_1.ValidationError("Bạn đã báo cáo nội dung này rồi");
    }
    const report = await report_model_1.ReportModel.create({
        reporterId: userId,
        targetType,
        targetId: oid,
        reason,
        description: description ? String(description).slice(0, 2000) : "",
        status: report_model_1.ReportStatus.PENDING,
    });
    const reportCount = await report_model_1.ReportModel.countDocuments({
        targetType,
        targetId: oid,
    });
    if (contentText.trim()) {
        void moderation_service_1.ModerationService.moderateAndUpdate(rawType, oid.toString(), contentText, { reportCount }).catch((err) => console.error("[Moderation] Report-trigger error:", err));
    }
    (0, response_1.sendCreated)(res, { id: report._id.toString(), status: report.status }, "Báo cáo đã được ghi nhận");
});
/**
 * @route   GET /api/reports/my
 * @query   page (default 1), limit (default 10)
 * @access  Private
 */
exports.getMyReports = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const q = req.query;
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? "10", 10) || 10));
    const skip = (page - 1) * limit;
    const filter = { reporterId: userId };
    const [rows, total] = await Promise.all([
        report_model_1.ReportModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        report_model_1.ReportModel.countDocuments(filter),
    ]);
    const items = rows.map((r) => ({
        id: r._id.toString(),
        targetType: r.targetType,
        targetId: r.targetId.toString(),
        reason: r.reason,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
    }));
    const totalPages = Math.ceil(total / limit);
    (0, response_1.sendSuccess)(res, {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
        },
    });
});
