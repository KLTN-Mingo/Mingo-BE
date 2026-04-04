"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = exports.Gender = exports.UserRole = void 0;
// src/models/user.model.ts
const mongoose_1 = require("mongoose");
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
var Gender;
(function (Gender) {
    Gender["MALE"] = "male";
    Gender["FEMALE"] = "female";
    Gender["OTHER"] = "other";
    Gender["PREFER_NOT_TO_SAY"] = "prefer_not_to_say";
})(Gender || (exports.Gender = Gender = {}));
const UserSchema = new mongoose_1.Schema({
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
}, {
    timestamps: true,
    toJSON: {
        transform: function (_doc, ret) {
            const { passwordHash, twoFactorSecret, __v, ...rest } = ret;
            return rest;
        },
    },
});
UserSchema.index({ createdAt: -1 });
UserSchema.index({ name: "text" });
exports.UserModel = (0, mongoose_1.model)("User", UserSchema);
