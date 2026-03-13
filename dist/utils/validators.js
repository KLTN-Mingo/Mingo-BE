"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhoneNumber = validatePhoneNumber;
exports.validateEmail = validateEmail;
exports.validatePassword = validatePassword;
exports.validateRequired = validateRequired;
exports.validateObjectId = validateObjectId;
exports.validateLength = validateLength;
exports.validateEnum = validateEnum;
// src/utils/validators.ts
const app_error_1 = require("../errors/app-error");
/**
 * Validate phone number (Vietnam format)
 */
function validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
        throw new app_error_1.ValidationError("Số điện thoại không hợp lệ");
    }
}
/**
 * Validate email
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new app_error_1.ValidationError("Email không hợp lệ");
    }
}
/**
 * Validate password strength
 */
function validatePassword(password, minLength = 6) {
    if (!password || password.length < minLength) {
        throw new app_error_1.ValidationError(`Mật khẩu phải có ít nhất ${minLength} ký tự`);
    }
    // Optional: Add more rules
    // if (!/[A-Z]/.test(password)) {
    //   throw new ValidationError("Mật khẩu phải có ít nhất 1 chữ hoa");
    // }
    // if (!/[0-9]/.test(password)) {
    //   throw new ValidationError("Mật khẩu phải có ít nhất 1 chữ số");
    // }
}
/**
 * Validate required fields
 */
function validateRequired(data, fields) {
    const missingFields = fields.filter((field) => !data[field] || data[field] === "");
    if (missingFields.length > 0) {
        throw new app_error_1.ValidationError(`Thiếu trường bắt buộc: ${missingFields.join(", ")}`);
    }
}
/**
 * Validate MongoDB ObjectId
 */
function validateObjectId(id, fieldName = "ID") {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(id)) {
        throw new app_error_1.ValidationError(`${fieldName} không hợp lệ`);
    }
}
/**
 * Validate string length
 */
function validateLength(value, min, max, fieldName = "Trường") {
    if (value.length < min || value.length > max) {
        throw new app_error_1.ValidationError(`${fieldName} phải có độ dài từ ${min} đến ${max} ký tự`);
    }
}
/**
 * Validate enum value
 */
function validateEnum(value, allowedValues, fieldName = "Giá trị") {
    if (!allowedValues.includes(value)) {
        throw new app_error_1.ValidationError(`${fieldName} không hợp lệ. Các giá trị cho phép: ${allowedValues.join(", ")}`);
    }
}
