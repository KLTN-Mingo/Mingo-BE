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
  dateOfBirth?: Date;
  gender?: Gender;

  googleId?: string;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  verified: boolean;

  role: UserRole;
  isActive: boolean;
  isBlocked: boolean;
  onlineStatus: boolean;

  followersCount: number;
  followingCount: number;
  postsCount: number;

  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;

  toJSON(): any;
}

const UserSchema = new Schema<IUser>(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
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

UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ name: "text" });

export const UserModel = model<IUser>("User", UserSchema);
