// src/models/user.model.ts
import { Schema, model } from "mongoose";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}
const UserSchema = new Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
    },
    bio: {
      type: String,
      maxlength: 500,
      default: "",
    },

    avatar: {
      type: String, // URL ảnh
      default: "",
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },

  { timestamps: true }
);

export const UserModel = model("User", UserSchema);
