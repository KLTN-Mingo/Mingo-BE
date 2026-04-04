"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockedUsers = exports.unblockUser = exports.blockUser = void 0;
const mongoose_1 = require("mongoose");
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../errors");
const response_1 = require("../utils/response");
const block_model_1 = require("../models/block.model");
const user_model_1 = require("../models/user.model");
const user_dto_1 = require("../dtos/user.dto");
/**
 * @route   POST /api/follow/blocks
 * @body    { userId: string, reason?: string }
 */
exports.blockUser = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const me = req.user?.userId;
    const { userId: targetId, reason } = req.body;
    if (!targetId || !mongoose_1.Types.ObjectId.isValid(targetId)) {
        throw new errors_1.ValidationError("userId không hợp lệ");
    }
    if (targetId === me) {
        throw new errors_1.ValidationError("Không thể chặn chính mình");
    }
    const target = await user_model_1.UserModel.findById(targetId);
    if (!target)
        throw new errors_1.NotFoundError("Không tìm thấy người dùng");
    try {
        await block_model_1.BlockModel.create({
            blockerId: new mongoose_1.Types.ObjectId(me),
            blockedId: new mongoose_1.Types.ObjectId(targetId),
            reason: reason?.slice(0, 500),
        });
    }
    catch (e) {
        if (e?.code === 11000) {
            throw new errors_1.ConflictError("Đã chặn người dùng này trước đó");
        }
        throw e;
    }
    (0, response_1.sendSuccess)(res, { blockedId: targetId }, "Đã chặn người dùng");
});
/**
 * @route   DELETE /api/follow/blocks/:userId
 */
exports.unblockUser = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const me = req.user?.userId;
    const { userId: targetId } = req.params;
    if (!mongoose_1.Types.ObjectId.isValid(targetId)) {
        throw new errors_1.ValidationError("userId không hợp lệ");
    }
    await block_model_1.BlockModel.deleteOne({
        blockerId: new mongoose_1.Types.ObjectId(me),
        blockedId: new mongoose_1.Types.ObjectId(targetId),
    });
    (0, response_1.sendSuccess)(res, null, "Đã bỏ chặn");
});
/**
 * @route   GET /api/follow/blocks?page&limit
 */
exports.getBlockedUsers = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const me = req.user?.userId;
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const filter = { blockerId: new mongoose_1.Types.ObjectId(me) };
    const [total, rows] = await Promise.all([
        block_model_1.BlockModel.countDocuments(filter),
        block_model_1.BlockModel.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("blockedId", "name avatar phoneNumber verified")
            .lean(),
    ]);
    const blockedUsers = rows.map((r) => ({
        blockedAt: r.createdAt,
        reason: r.reason,
        user: r.blockedId ? (0, user_dto_1.toUserMinimal)(r.blockedId) : undefined,
        userId: r.blockedId?._id?.toString(),
    }));
    (0, response_1.sendPaginated)(res, blockedUsers, { page, limit, total });
});
