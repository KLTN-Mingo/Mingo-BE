// src/controllers/user.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors";
import { validateObjectId, validateLength } from "../utils/validators";
import { UserModel, Gender, UserRole } from "../models/user.model";
import { sendSuccess, sendPaginated } from "../utils/response";
import {
  toUserProfile,
  toPublicUser,
  toUserSummary,
  type UpdateProfileDto,
} from "../dtos/user.dto";
import { UserService } from "../services/user.service";

/**
 * @route   GET /api/users/me
 * @desc    Lấy thông tin user hiện tại
 * @access  Private
 */
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;

    const user = await UserModel.findById(userId);

    if (!user) {
      throw new NotFoundError("Không tìm thấy thông tin người dùng");
    }

    sendSuccess(res, toUserProfile(user));
  }
);

/**
 * @route   GET /api/users/:id
 * @desc    Lấy public profile của user theo ID
 * @access  Private
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  validateObjectId(id, "User ID");

  const user = await UserModel.findById(id);

  if (!user) {
    throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
  }

  // Trả public profile - ẩn thông tin nhạy cảm
  sendSuccess(res, toPublicUser(user));
});

/**
 * @route   PUT /api/users/me
 * @desc    Cập nhật thông tin user
 * @access  Private
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const { name, bio, avatar, backgroundUrl, dateOfBirth, gender } =
      req.body as UpdateProfileDto;

    // Validate
    if (name !== undefined) {
      validateLength(name, 2, 100, "Tên");
    }

    if (bio !== undefined && bio.length > 500) {
      throw new ValidationError("Bio không được vượt quá 500 ký tự");
    }

    if (gender !== undefined && !Object.values(Gender).includes(gender)) {
      throw new ValidationError(
        `Giới tính không hợp lệ. Các giá trị hợp lệ: ${Object.values(Gender).join(", ")}`,
        "INVALID_GENDER"
      );
    }

    let parsedDob: Date | undefined;
    if (dateOfBirth !== undefined) {
      parsedDob = new Date(dateOfBirth);
      if (isNaN(parsedDob.getTime())) {
        throw new ValidationError("Ngày sinh không hợp lệ", "INVALID_DATE");
      }
      if (parsedDob > new Date()) {
        throw new ValidationError(
          "Ngày sinh không được ở tương lai",
          "INVALID_DATE"
        );
      }
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw new NotFoundError("Không tìm thấy người dùng");
    }

    // Chỉ update các field được gửi lên (undefined = không thay đổi)
    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (backgroundUrl !== undefined) user.backgroundUrl = backgroundUrl;
    if (parsedDob !== undefined) user.dateOfBirth = parsedDob;
    if (gender !== undefined) user.gender = gender;

    await user.save();

    sendSuccess(res, toUserProfile(user), "Cập nhật thông tin thành công");
  }
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Xóa user (chỉ admin)
 * @access  Private + Admin
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const currentUser = (req as any).user;

  validateObjectId(id, "User ID");

  if (currentUser.userId === id) {
    throw new ForbiddenError("Bạn không thể xóa chính mình");
  }

  const user = await UserModel.findById(id);

  if (!user) {
    throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
  }

  await user.deleteOne();

  sendSuccess(res, null, "Xóa user thành công");
});

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách users (có phân trang + filter)
 * @access  Private + Admin
 */
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const {
    page: pageStr,
    limit: limitStr,
    search,
    role,
    isActive,
    isBlocked,
  } = req.query as Record<string, string>;

  const page = parseInt(pageStr) || 1;
  const limit = parseInt(limitStr) || 10;

  if (page < 1) {
    throw new ValidationError("Số trang phải lớn hơn 0");
  }

  if (limit < 1 || limit > 100) {
    throw new ValidationError("Limit phải từ 1 đến 100");
  }

  if (role && !Object.values(UserRole).includes(role as UserRole)) {
    throw new ValidationError(
      `Role không hợp lệ. Các giá trị hợp lệ: ${Object.values(UserRole).join(", ")}`,
      "INVALID_ROLE"
    );
  }

  const skip = (page - 1) * limit;

  // Build query
  const query: Record<string, any> = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role) query.role = role;

  // isActive / isBlocked từ query string là string "true"/"false"
  if (isActive !== undefined) query.isActive = isActive === "true";
  if (isBlocked !== undefined) query.isBlocked = isBlocked === "true";

  const [users, total] = await Promise.all([
    UserModel.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    UserModel.countDocuments(query),
  ]);

  sendPaginated(res, users.map(toUserSummary), { page, limit, total });
});

/**
 * @route   GET /api/users/:userId/stats
 * @desc    Thống kê user (admin / chi tiết)
 * @access  Private
 */
export const getUserStats = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params as { userId: string };
    validateObjectId(userId, "User ID");
    const stats = await UserService.getUserStats(userId);
    sendSuccess(res, stats);
  }
);
