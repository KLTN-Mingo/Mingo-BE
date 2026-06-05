// src/controllers/user.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors";
import { validateObjectId, validateLength, validatePhoneNumber } from "../utils/validators";
import { UserModel, Gender, UserRole } from "../models/user.model";
import { sendSuccess, sendPaginated } from "../utils/response";
import { cloudinaryService } from "../services/cloudinary.service";
import {
  toUserProfile,
  toPublicUser,
  toUserSummary,
  type UpdateProfileDto,
} from "../dtos/user.dto";
import { UserService } from "../services/user.service";
import { PostService } from "../services/post.service";
import { ShareService } from "../services/share.service";

function getCurrentUserId(req: Request): string {
  const userId = (req as any).user?.userId;
  if (!userId) {
    throw new ValidationError("Không tìm thấy thông tin người dùng");
  }
  return userId;
}

function ensureImageFile(file?: Express.Multer.File): Express.Multer.File {
  if (!file) {
    throw new ValidationError("Vui lòng chọn file ảnh");
  }

  if (!file.mimetype.startsWith("image/")) {
    throw new ValidationError(
      "Chỉ hỗ trợ upload file ảnh cho avatar/background"
    );
  }

  return file;
}

async function deletePreviousCloudinaryImage(url?: string): Promise<void> {
  if (!url) {
    return;
  }

  const publicId = cloudinaryService.extractPublicIdFromUrl(url);
  if (!publicId) {
    return;
  }

  await cloudinaryService.deleteFile(publicId, "image").catch(() => undefined);
}

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
    const userId = getCurrentUserId(req);
    const {
      name,
      bio,
      avatar,
      backgroundUrl,
      relationship,
      hobby,
      work,
      currentAddress,
      hometown,
      dateOfBirth,
      gender,
    } = req.body as UpdateProfileDto;

    // Validate
    if (name !== undefined) {
      validateLength(name, 2, 100, "Tên");
    }

    if (bio !== undefined && bio.length > 500) {
      throw new ValidationError("Bio không được vượt quá 500 ký tự");
    }

    if (relationship !== undefined) {
      validateLength(relationship, 0, 100, "Tình trạng mối quan hệ");
    }

    if (hobby !== undefined) {
      if (!Array.isArray(hobby)) {
        throw new ValidationError("Hobby phải là mảng chuỗi", "INVALID_HOBBY");
      }

      for (const item of hobby) {
        if (typeof item !== "string") {
          throw new ValidationError("Mỗi hobby phải là chuỗi", "INVALID_HOBBY");
        }

        if (item.length > 100) {
          throw new ValidationError(
            "Mỗi hobby không được vượt quá 100 ký tự",
            "INVALID_HOBBY"
          );
        }
      }
    }

    if (work !== undefined) {
      validateLength(work, 0, 150, "Công việc");
    }

    if (currentAddress !== undefined) {
      validateLength(currentAddress, 0, 255, "Nơi ở");
    }

    if (hometown !== undefined) {
      validateLength(hometown, 0, 255, "Quê quán");
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
    if (relationship !== undefined) user.relationship = relationship;
    if (hobby !== undefined) user.hobby = hobby;
    if (work !== undefined) user.work = work;
    if (currentAddress !== undefined) user.currentAddress = currentAddress;
    if (hometown !== undefined) user.hometown = hometown;
    if (parsedDob !== undefined) user.dateOfBirth = parsedDob;
    if (gender !== undefined) user.gender = gender;

    await user.save();

    sendSuccess(res, toUserProfile(user), "Cập nhật thông tin thành công");
  }
);

/**
 * @route   POST /api/users/me/avatar
 * @route   PUT /api/users/me/avatar
 * @desc    Upload/Cập nhật avatar user qua Cloudinary
 * @access  Private
 */
export const uploadAvatar = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    const file = ensureImageFile(req.file as Express.Multer.File | undefined);

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError("Không tìm thấy người dùng");
    }

    await deletePreviousCloudinaryImage(user.avatar);

    const uploadResult = await cloudinaryService.uploadImage(
      file,
      "social-network/users/avatars"
    );

    user.avatar = uploadResult.url;
    await user.save();

    sendSuccess(
      res,
      {
        avatar: user.avatar,
        user: toUserProfile(user),
      },
      "Cập nhật avatar thành công"
    );
  }
);

/**
 * @route   POST /api/users/me/background
 * @route   PUT /api/users/me/background
 * @desc    Upload/Cập nhật ảnh bìa user qua Cloudinary
 * @access  Private
 */
export const uploadBackground = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getCurrentUserId(req);
    const file = ensureImageFile(req.file as Express.Multer.File | undefined);

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError("Không tìm thấy người dùng");
    }

    await deletePreviousCloudinaryImage(user.backgroundUrl);

    const uploadResult = await cloudinaryService.uploadImage(
      file,
      "social-network/users/backgrounds"
    );

    user.backgroundUrl = uploadResult.url;
    await user.save();

    sendSuccess(
      res,
      {
        backgroundUrl: user.backgroundUrl,
        user: toUserProfile(user),
      },
      "Cập nhật ảnh bìa thành công"
    );
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

/**
 * @route   GET /api/users/:id/posts
 * @desc    Lấy danh sách bài viết theo user (phân trang)
 * @access  Private
 */
export const getUserPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const currentUserId = (req as any).user?.userId as string | undefined;
    const { page: pageStr, limit: limitStr } = req.query as Record<
      string,
      string
    >;

    validateObjectId(id, "User ID");

    const page = parseInt(pageStr, 10) || 1;
    const limit = parseInt(limitStr, 10) || 10;

    if (page < 1) {
      throw new ValidationError("Số trang phải lớn hơn 0");
    }

    if (limit < 1 || limit > 20) {
      throw new ValidationError("Limit phải từ 1 đến 20");
    }

    const result = await PostService.getPostsByUser(
      id,
      page,
      limit,
      currentUserId
    );

    sendPaginated(res, result.posts, result.pagination);
  }
);

/**
 * @route   GET /api/users/:id/reposts
 * @desc    Lấy danh sách repost theo user (phân trang)
 * @access  Private
 */
export const getUserReposts = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const currentUserId = (req as any).user?.userId as string | undefined;
    const { page: pageStr, limit: limitStr } = req.query as Record<
      string,
      string
    >;

    validateObjectId(id, "User ID");

    const page = parseInt(pageStr, 10) || 1;
    const limit = parseInt(limitStr, 10) || 10;

    if (page < 1) {
      throw new ValidationError("Số trang phải lớn hơn 0");
    }

    if (limit < 1 || limit > 20) {
      throw new ValidationError("Limit phải từ 1 đến 20");
    }

    const result = await ShareService.getUserReposts(
      id,
      page,
      limit,
      currentUserId
    );

    sendPaginated(res, result.reposts, result.pagination);
  }
);

/**
 * @route   GET /api/users/phone/:phoneNumber
 * @desc    Tìm user theo số điện thoại
 * @access  Private
 */
export const getUserByPhone = asyncHandler(
  async (req: Request, res: Response) => {
    const { phoneNumber } = req.params as { phoneNumber: string };

    validatePhoneNumber(phoneNumber);

    const user = await UserModel.findOne({ phoneNumber });

    if (!user) {
      throw new NotFoundError(`Không tìm thấy user với số điện thoại: ${phoneNumber}`);
    }

    sendSuccess(res, toPublicUser(user));
  }
);
