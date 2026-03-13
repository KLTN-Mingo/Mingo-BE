"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = exports.deleteUser = exports.updateProfile = exports.getUserById = exports.getCurrentUser = void 0;
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../errors");
const validators_1 = require("../utils/validators");
const user_model_1 = require("../models/user.model");
const response_1 = require("../utils/response");
const user_dto_1 = require("../dtos/user.dto");
/**
 * @route   GET /api/users/me
 * @desc    Lấy thông tin user hiện tại
 * @access  Private
 */
exports.getCurrentUser = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const user = await user_model_1.UserModel.findById(userId);
    if (!user) {
        throw new errors_1.NotFoundError("Không tìm thấy thông tin người dùng");
    }
    (0, response_1.sendSuccess)(res, (0, user_dto_1.toUserProfile)(user));
});
/**
 * @route   GET /api/users/:id
 * @desc    Lấy public profile của user theo ID
 * @access  Private
 */
exports.getUserById = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    (0, validators_1.validateObjectId)(id, "User ID");
    const user = await user_model_1.UserModel.findById(id);
    if (!user) {
        throw new errors_1.NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }
    // Trả public profile - ẩn thông tin nhạy cảm
    (0, response_1.sendSuccess)(res, (0, user_dto_1.toPublicUser)(user));
});
/**
 * @route   PUT /api/users/me
 * @desc    Cập nhật thông tin user
 * @access  Private
 */
exports.updateProfile = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { name, bio, avatar, backgroundUrl, dateOfBirth, gender } = req.body;
    // Validate
    if (name !== undefined) {
        (0, validators_1.validateLength)(name, 2, 100, "Tên");
    }
    if (bio !== undefined && bio.length > 500) {
        throw new errors_1.ValidationError("Bio không được vượt quá 500 ký tự");
    }
    if (gender !== undefined && !Object.values(user_model_1.Gender).includes(gender)) {
        throw new errors_1.ValidationError(`Giới tính không hợp lệ. Các giá trị hợp lệ: ${Object.values(user_model_1.Gender).join(", ")}`, "INVALID_GENDER");
    }
    let parsedDob;
    if (dateOfBirth !== undefined) {
        parsedDob = new Date(dateOfBirth);
        if (isNaN(parsedDob.getTime())) {
            throw new errors_1.ValidationError("Ngày sinh không hợp lệ", "INVALID_DATE");
        }
        if (parsedDob > new Date()) {
            throw new errors_1.ValidationError("Ngày sinh không được ở tương lai", "INVALID_DATE");
        }
    }
    const user = await user_model_1.UserModel.findById(userId);
    if (!user) {
        throw new errors_1.NotFoundError("Không tìm thấy người dùng");
    }
    // Chỉ update các field được gửi lên (undefined = không thay đổi)
    if (name !== undefined)
        user.name = name;
    if (bio !== undefined)
        user.bio = bio;
    if (avatar !== undefined)
        user.avatar = avatar;
    if (backgroundUrl !== undefined)
        user.backgroundUrl = backgroundUrl;
    if (parsedDob !== undefined)
        user.dateOfBirth = parsedDob;
    if (gender !== undefined)
        user.gender = gender;
    await user.save();
    (0, response_1.sendSuccess)(res, (0, user_dto_1.toUserProfile)(user), "Cập nhật thông tin thành công");
});
/**
 * @route   DELETE /api/users/:id
 * @desc    Xóa user (chỉ admin)
 * @access  Private + Admin
 */
exports.deleteUser = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    (0, validators_1.validateObjectId)(id, "User ID");
    if (currentUser.userId === id) {
        throw new errors_1.ForbiddenError("Bạn không thể xóa chính mình");
    }
    const user = await user_model_1.UserModel.findById(id);
    if (!user) {
        throw new errors_1.NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }
    await user.deleteOne();
    (0, response_1.sendSuccess)(res, null, "Xóa user thành công");
});
/**
 * @route   GET /api/users
 * @desc    Lấy danh sách users (có phân trang + filter)
 * @access  Private + Admin
 */
exports.getUsers = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { page: pageStr, limit: limitStr, search, role, isActive, isBlocked, } = req.query;
    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 10;
    if (page < 1) {
        throw new errors_1.ValidationError("Số trang phải lớn hơn 0");
    }
    if (limit < 1 || limit > 100) {
        throw new errors_1.ValidationError("Limit phải từ 1 đến 100");
    }
    if (role && !Object.values(user_model_1.UserRole).includes(role)) {
        throw new errors_1.ValidationError(`Role không hợp lệ. Các giá trị hợp lệ: ${Object.values(user_model_1.UserRole).join(", ")}`, "INVALID_ROLE");
    }
    const skip = (page - 1) * limit;
    // Build query
    const query = {};
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { phoneNumber: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }
    if (role)
        query.role = role;
    // isActive / isBlocked từ query string là string "true"/"false"
    if (isActive !== undefined)
        query.isActive = isActive === "true";
    if (isBlocked !== undefined)
        query.isBlocked = isBlocked === "true";
    const [users, total] = await Promise.all([
        user_model_1.UserModel.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
        user_model_1.UserModel.countDocuments(query),
    ]);
    (0, response_1.sendPaginated)(res, users.map(user_dto_1.toUserSummary), { page, limit, total });
});
