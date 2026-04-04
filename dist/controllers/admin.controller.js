"use strict";
// src/controllers/admin.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = exports.handleReport = exports.getReports = void 0;
const mongoose_1 = require("mongoose");
const date_fns_1 = require("date-fns");
const async_handler_1 = require("../utils/async-handler");
const response_1 = require("../utils/response");
const errors_1 = require("../errors");
const report_model_1 = require("../models/report.model");
const post_model_1 = require("../models/post.model");
const comment_model_1 = require("../models/comment.model");
const user_model_1 = require("../models/user.model");
const REPORT_ACTIONS = [
    "approved_content",
    "removed_content",
    "warned_user",
    "blocked_user",
];
function isReportAdminAction(v) {
    return REPORT_ACTIONS.includes(v);
}
function parseAdminReportStatus(raw) {
    if (!raw)
        return undefined;
    if (raw === "pending")
        return report_model_1.ReportStatus.PENDING;
    if (raw === "reviewed")
        return report_model_1.ReportStatus.REVIEWED;
    if (raw === "dismissed")
        return report_model_1.ReportStatus.DISMISSED;
    return undefined;
}
function parseEntityTypeFilter(raw) {
    if (!raw)
        return undefined;
    if (raw === "post")
        return report_model_1.ReportTargetType.POST;
    if (raw === "comment")
        return report_model_1.ReportTargetType.COMMENT;
    return undefined;
}
function mapReporter(reporter) {
    if (!reporter || !reporter._id)
        return null;
    return {
        _id: String(reporter._id),
        username: reporter.name ?? reporter.phoneNumber ?? "",
        avatarUrl: reporter.avatar ?? "",
    };
}
async function loadEntitiesForReports(reports) {
    const postIds = reports
        .filter((r) => r.targetType === report_model_1.ReportTargetType.POST)
        .map((r) => r.targetId.toString());
    const commentIds = reports
        .filter((r) => r.targetType === report_model_1.ReportTargetType.COMMENT)
        .map((r) => r.targetId.toString());
    const map = new Map();
    if (postIds.length) {
        const posts = await post_model_1.PostModel.find({ _id: { $in: postIds } })
            .select("contentText aiToxicScore aiHateSpeechScore aiSpamScore aiOverallRisk")
            .lean();
        for (const p of posts) {
            map.set(p._id.toString(), {
                contentText: p.contentText,
                aiToxicScore: p.aiToxicScore,
                aiHateSpeechScore: p.aiHateSpeechScore,
                aiSpamScore: p.aiSpamScore,
                aiOverallRisk: p.aiOverallRisk,
            });
        }
    }
    if (commentIds.length) {
        const comments = await comment_model_1.CommentModel.find({ _id: { $in: commentIds } })
            .select("contentText")
            .lean();
        for (const c of comments) {
            map.set(c._id.toString(), { contentText: c.contentText });
        }
    }
    return map;
}
async function applyReportSideEffect(report, action) {
    if (report.targetType === report_model_1.ReportTargetType.USER) {
        if (action === "blocked_user") {
            await user_model_1.UserModel.findByIdAndUpdate(report.targetId, { isBlocked: true });
        }
        return;
    }
    if (action === "warned_user") {
        return;
    }
    if (action === "blocked_user") {
        if (report.targetType === report_model_1.ReportTargetType.POST) {
            const p = await post_model_1.PostModel.findById(report.targetId).select("userId").lean();
            if (p?.userId) {
                await user_model_1.UserModel.findByIdAndUpdate(p.userId, { isBlocked: true });
            }
        }
        else {
            const c = await comment_model_1.CommentModel.findById(report.targetId)
                .select("userId")
                .lean();
            if (c?.userId) {
                await user_model_1.UserModel.findByIdAndUpdate(c.userId, { isBlocked: true });
            }
        }
        return;
    }
    if (report.targetType === report_model_1.ReportTargetType.POST) {
        if (action === "removed_content") {
            await post_model_1.PostModel.findByIdAndUpdate(report.targetId, {
                isHidden: true,
                moderationStatus: post_model_1.ModerationStatus.REJECTED,
            });
        }
        else if (action === "approved_content") {
            await post_model_1.PostModel.findByIdAndUpdate(report.targetId, {
                isHidden: false,
                moderationStatus: post_model_1.ModerationStatus.APPROVED,
            });
        }
        return;
    }
    if (report.targetType === report_model_1.ReportTargetType.COMMENT) {
        if (action === "removed_content") {
            await comment_model_1.CommentModel.findByIdAndUpdate(report.targetId, {
                isHidden: true,
                moderationStatus: comment_model_1.CommentModerationStatus.REJECTED,
            });
        }
        else if (action === "approved_content") {
            await comment_model_1.CommentModel.findByIdAndUpdate(report.targetId, {
                isHidden: false,
                moderationStatus: comment_model_1.CommentModerationStatus.APPROVED,
            });
        }
    }
}
/**
 * @route   GET /api/admin/reports
 */
exports.getReports = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const skip = (page - 1) * limit;
    const filter = {};
    const st = parseAdminReportStatus(q.status);
    if (st) {
        filter.status = st;
    }
    const et = parseEntityTypeFilter(q.entityType);
    if (et) {
        filter.targetType = et;
    }
    const [rows, total] = await Promise.all([
        report_model_1.ReportModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
            path: "reporterId",
            select: "_id name phoneNumber avatar",
        })
            .lean(),
        report_model_1.ReportModel.countDocuments(filter),
    ]);
    const entityMap = await loadEntitiesForReports(rows);
    const reports = rows.map((r) => {
        const rep = r.reporterId;
        const key = r.targetId.toString();
        const entity = entityMap.get(key);
        return {
            id: r._id.toString(),
            reporterId: mapReporter(rep),
            targetType: r.targetType,
            targetId: key,
            reason: r.reason,
            description: r.description,
            status: r.status,
            resolutionNote: r.resolutionNote,
            reviewedBy: r.reviewedBy?.toString(),
            reviewedAt: r.reviewedAt,
            actionTaken: r.actionTaken,
            moderationSnapshot: r.moderationSnapshot,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            entity: entity
                ? {
                    contentText: entity.contentText,
                    aiScores: entity.aiToxicScore !== undefined ||
                        entity.aiHateSpeechScore !== undefined ||
                        entity.aiSpamScore !== undefined ||
                        entity.aiOverallRisk !== undefined
                        ? {
                            toxic: entity.aiToxicScore,
                            hateSpeech: entity.aiHateSpeechScore,
                            spam: entity.aiSpamScore,
                            overallRisk: entity.aiOverallRisk,
                        }
                        : undefined,
                }
                : null,
        };
    });
    const totalPages = Math.ceil(total / limit) || 1;
    (0, response_1.sendSuccess)(res, {
        reports,
        total,
        page,
        totalPages,
    });
});
/**
 * @route   PATCH /api/admin/reports/:reportId
 */
exports.handleReport = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const adminId = req.user?.userId;
    if (!adminId) {
        throw new errors_1.ForbiddenError("Cần đăng nhập");
    }
    const reportId = String(req.params.reportId);
    const body = req.body;
    if (!body.action || !isReportAdminAction(body.action)) {
        throw new errors_1.ValidationError(`action không hợp lệ. Cho phép: ${REPORT_ACTIONS.join(", ")}`, "INVALID_REPORT_ACTION");
    }
    const report = await report_model_1.ReportModel.findById(reportId).lean();
    if (!report) {
        throw new errors_1.NotFoundError("Không tìm thấy báo cáo");
    }
    await applyReportSideEffect({
        targetType: report.targetType,
        targetId: report.targetId,
    }, body.action);
    const updated = await report_model_1.ReportModel.findByIdAndUpdate(reportId, {
        status: report_model_1.ReportStatus.REVIEWED,
        reviewedBy: new mongoose_1.Types.ObjectId(adminId),
        reviewedAt: new Date(),
        actionTaken: body.action,
    }, { new: true })
        .populate({
        path: "reporterId",
        select: "_id name phoneNumber avatar",
    })
        .lean();
    if (!updated) {
        throw new errors_1.NotFoundError("Không tìm thấy báo cáo");
    }
    (0, response_1.sendSuccess)(res, updated);
});
/**
 * @route   GET /api/admin/stats
 */
exports.getDashboardStats = (0, async_handler_1.asyncHandler)(async (_req, res) => {
    const startOfToday = (0, date_fns_1.startOfDay)(new Date());
    const [totalUsers, newUsersToday, pendingReports, flaggedPosts, rejectedToday, violationAgg,] = await Promise.all([
        user_model_1.UserModel.countDocuments({ isActive: true }),
        user_model_1.UserModel.countDocuments({ createdAt: { $gte: startOfToday } }),
        report_model_1.ReportModel.countDocuments({ status: report_model_1.ReportStatus.PENDING }),
        post_model_1.PostModel.countDocuments({
            moderationStatus: post_model_1.ModerationStatus.PENDING,
            isHidden: true,
        }),
        post_model_1.PostModel.countDocuments({
            moderationStatus: post_model_1.ModerationStatus.REJECTED,
            updatedAt: { $gte: startOfToday },
        }),
        report_model_1.ReportModel.aggregate([
            { $group: { _id: "$reason", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]),
    ]);
    const violationBreakdown = violationAgg.map((row) => ({
        reason: row._id ?? "unknown",
        count: row.count,
    }));
    (0, response_1.sendSuccess)(res, {
        totalUsers,
        newUsersToday,
        pendingReports,
        flaggedPosts,
        rejectedToday,
        violationBreakdown,
    });
});
