// src/models/user.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
  PREFER_NOT_TO_SAY = "prefer_not_to_say",
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  phoneNumber: string;
  email?: string;
  passwordHash: string;

  name?: string;
  bio?: string;
  avatar?: string;
  backgroundUrl?: string;
  relationship?: string;
  hobby?: string[];
  work?: string;
  currentAddress?: string;
  hometown?: string;
  dateOfBirth?: Date;
  gender?: Gender;

  googleId?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  verified: boolean;

  role: UserRole;
  isActive: boolean;
  isBlocked: boolean;
  isBanned: boolean;          // bị khóa tài khoản (tạm hoặc vĩnh viễn)
  bannedUntil: Date | null;    // null = vĩnh viễn, có date = khóa đến ngày đó
  onlineStatus: boolean;

  followersCount: number;
  followingCount: number;
  postsCount: number;

  lastLogin?: Date;
  lastWarnedAt?: Date;         // thời điểm cảnh cáo gần nhất
  violationCount: number;
  violationLogs: {
    reason: string;
    adminId?: Types.ObjectId;
    action: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;

  toJSON(): any;
}

/**
 * Kiểm tra và tự động unban user nếu hết hạn khóa tạm.
 * Gọi hàm này mỗi khi user login hoặc mỗi khi fetch thông tin user.
 *
 * Quy tắc:
 * - isBlocked: true + bannedUntil: null  → khóa vĩnh viễn → không unban
 * - isBlocked: true + bannedUntil <= now → hết hạn → tự unban
 * - isBlocked: false                     → bình thường → không làm gì
 */
export async function checkAndUnbanUser(
  userId: string | Types.ObjectId
): Promise<boolean> {
  const oid = typeof userId === "string" ? new Types.ObjectId(userId) : userId;
  const user = await UserModel.findById(oid).select(
    "isBlocked bannedUntil"
  ).lean();
  if (!user) return false;

  const now = new Date();
  const isExpired =
    user.isBlocked &&
    user.bannedUntil !== null &&
    (user.bannedUntil as Date) <= now;

  if (!isExpired) return false;

  await UserModel.findByIdAndUpdate(oid, {
    isBlocked: false,
    bannedUntil: null,
  });
  return true;
}

const UserSchema = new Schema<IUser>(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    bio: {
      type: String,
      maxlength: 500,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    backgroundUrl: {
      type: String,
      default: "",
    },
    relationship: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    hobby: {
      type: [String],
      default: [],
    },
    work: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },
    currentAddress: {
      type: String,
      trim: true,
      maxlength: 255,
      default: "",
    },
    hometown: {
      type: String,
      trim: true,
      maxlength: 255,
      default: "",
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
    },
    verified: {
      type: Boolean,
      default: false,
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },
    bannedUntil: {
      type: Date,
      default: null,
    },
    onlineStatus: {
      type: Boolean,
      default: false,
    },

    followersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    postsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastLogin: {
      type: Date,
    },

    lastWarnedAt: {
      type: Date,
    },
    violationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    violationLogs: {
      type: [
        new Schema(
          {
            reason: { type: String, required: true },
            adminId: { type: Schema.Types.ObjectId, ref: "User" },
            action: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        const { passwordHash, twoFactorSecret, __v, ...rest } = ret;
        return rest;
      },
    },
  }
);

UserSchema.index({ createdAt: -1 });
UserSchema.index({ isActive: 1, createdAt: -1 });
UserSchema.index({ isBanned: 1 });
UserSchema.index({ bannedUntil: 1 });
UserSchema.index({ name: "text" });

export const UserModel = model<IUser>("User", UserSchema);
