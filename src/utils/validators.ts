// src/utils/validators.ts
import { ValidationError } from "../errors/app-error";

/**
 * Validate phone number (Vietnam format)
 */
export function validatePhoneNumber(phoneNumber: string): void {
  const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;

  if (!phoneRegex.test(phoneNumber)) {
    throw new ValidationError("Số điện thoại không hợp lệ");
  }
}

/**
 * Validate email
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new ValidationError("Email không hợp lệ");
  }
}

/**
 * Validate password strength
 */
export function validatePassword(
  password: string,
  minLength: number = 6
): void {
  if (!password || password.length < minLength) {
    throw new ValidationError(`Mật khẩu phải có ít nhất ${minLength} ký tự`);
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
export function validateRequired(
  data: Record<string, any>,
  fields: string[]
): void {
  const missingFields = fields.filter(
    (field) => !data[field] || data[field] === ""
  );

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Thiếu trường bắt buộc: ${missingFields.join(", ")}`
    );
  }
}

/**
 * Validate MongoDB ObjectId
 */
export function validateObjectId(id: string, fieldName: string = "ID"): void {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;

  if (!objectIdRegex.test(id)) {
    throw new ValidationError(`${fieldName} không hợp lệ`);
  }
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  min: number,
  max: number,
  fieldName: string = "Trường"
): void {
  if (value.length < min || value.length > max) {
    throw new ValidationError(
      `${fieldName} phải có độ dài từ ${min} đến ${max} ký tự`
    );
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T>(
  value: T,
  allowedValues: T[],
  fieldName: string = "Giá trị"
): void {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} không hợp lệ. Các giá trị cho phép: ${allowedValues.join(", ")}`
    );
  }
}
