// src/controllers/user.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../errors/app-error";
import {
  validateObjectId,
  validateRequired,
  validateLength,
} from "../utils/validators";
import { UserModel } from "../models/user.model";

/**
 * @route   GET /api/users/me
 * @desc    Lấy thông tin user hiện tại
 * @access  Private
 */
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;

    const user = await UserModel.findById(userId).select("-passwordHash");

    if (!user) {
      throw new NotFoundError("Không tìm thấy thông tin người dùng");
    }

    res.json({
      success: true,
      data: { user },
    });
  }
);

/**
 * @route   GET /api/users/:id
 * @desc    Lấy thông tin user theo ID
 * @access  Private
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate ObjectId
  validateObjectId(id as string, "User ID");

  const user = await UserModel.findById(id).select("-passwordHash");

  if (!user) {
    throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
  }

  res.json({
    success: true,
    data: { user },
  });
});

/**
 * @route   PUT /api/users/me
 * @desc    Cập nhật thông tin user
 * @access  Private
 */
export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const { name, bio, avatar } = req.body;

    // Validate input
    if (name) {
      validateLength(name, 2, 50, "Tên");
    }

    if (bio && bio.length > 500) {
      throw new ValidationError("Bio không được vượt quá 500 ký tự");
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw new NotFoundError("Không tìm thấy người dùng");
    }

    // Update fields
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      data: { user },
      message: "Cập nhật thông tin thành công",
    });
  }
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Xóa user (chỉ admin)
 * @access  Private + Admin
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = (req as any).user;

  // Validate ObjectId
  validateObjectId(id as string, "User ID");

  // Không cho phép tự xóa chính mình
  if (currentUser.userId === id) {
    throw new ForbiddenError("Bạn không thể xóa chính mình");
  }

  const user = await UserModel.findById(id);

  if (!user) {
    throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
  }

  await user.deleteOne();

  res.json({
    success: true,
    message: "Xóa user thành công",
  });
});

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách users (có phân trang)
 * @access  Private
 */
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;

  // Validate pagination
  if (page < 1) {
    throw new ValidationError("Số trang phải lớn hơn 0");
  }

  if (limit < 1 || limit > 100) {
    throw new ValidationError("Limit phải từ 1 đến 100");
  }

  const skip = (page - 1) * limit;

  // Build query
  const query: any = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
    ];
  }

  // Execute query
  const [users, total] = await Promise.all([
    UserModel.find(query)
      .select("-passwordHash")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    UserModel.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    },
  });
});
