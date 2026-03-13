"use strict";
// src/dtos/auth.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAuthUser = toAuthUser;
function toAuthUser(user) {
    return {
        id: user._id.toString(),
        phoneNumber: user.phoneNumber,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        verified: user.verified,
    };
}
