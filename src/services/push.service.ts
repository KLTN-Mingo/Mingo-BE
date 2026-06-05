// src/services/push.service.ts
import { Types } from "mongoose";
import { getMessaging, isPushEnabled } from "../lib/push/firebase";
import {
  DeviceTokenModel,
  DevicePlatform,
} from "../models/device-token.model";
import { ValidationError } from "../errors";

export interface PushPayload {
  title: string;
  body: string;
  /** Data payload cho FE deep link. Tất cả value sẽ được stringify. */
  data?: Record<string, string | number | boolean | undefined | null>;
  /** Ảnh hiển thị (nếu FCM hỗ trợ) */
  imageUrl?: string;
}

function isValidPlatform(p: string): p is DevicePlatform {
  return Object.values(DevicePlatform).includes(p as DevicePlatform);
}

/** Stringify mọi value -> string để FCM data field hợp lệ. */
function normalizeData(
  data: PushPayload["data"]
): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

export const PushService = {
  /**
   * Đăng ký device token cho user. Nếu token đã tồn tại (thiết bị từng đăng ký)
   * thì update userId/platform/lastSeenAt — vì 1 thiết bị có thể đổi user (logout/login).
   */
  async registerDevice(opts: {
    userId: string;
    token: string;
    platform: string;
    deviceLabel?: string;
    appVersion?: string;
  }) {
    if (!opts.token?.trim()) {
      throw new ValidationError("Thiếu device token");
    }
    if (!isValidPlatform(opts.platform)) {
      throw new ValidationError(
        `Platform không hợp lệ. Cho phép: ${Object.values(DevicePlatform).join(", ")}`,
        "INVALID_PLATFORM"
      );
    }

    const userObjectId = new Types.ObjectId(opts.userId);

    // Một token có thể đang gắn với userId khác (cùng máy, đổi tài khoản).
    // upsert by token để giữ unique và cập nhật chủ sở hữu mới.
    return DeviceTokenModel.findOneAndUpdate(
      { token: opts.token.trim() },
      {
        $set: {
          userId: userObjectId,
          platform: opts.platform,
          deviceLabel: opts.deviceLabel,
          appVersion: opts.appVersion,
          isActive: true,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true }
    ).lean();
  },

  /** Bỏ đăng ký 1 token (vd: user logout). */
  async unregisterDevice(opts: { userId: string; token: string }) {
    return DeviceTokenModel.findOneAndUpdate(
      { token: opts.token, userId: new Types.ObjectId(opts.userId) },
      { $set: { isActive: false } },
      { new: true }
    ).lean();
  },

  /** Liệt kê devices của user (debug + trang Settings). */
  async listDevicesByUser(userId: string) {
    return DeviceTokenModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    })
      .sort({ lastSeenAt: -1 })
      .lean();
  },

  /**
   * Gửi push tới toàn bộ device active của một user.
   * - Nếu Firebase chưa cấu hình -> noop, không throw.
   * - Tự dọn token chết khi FCM trả error code unregistered/invalid.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<{
    sent: number;
    failed: number;
  }> {
    if (!isPushEnabled()) {
      return { sent: 0, failed: 0 };
    }

    const messaging = getMessaging();
    if (!messaging) return { sent: 0, failed: 0 };

    const devices = await DeviceTokenModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    })
      .select("token")
      .lean();

    if (devices.length === 0) return { sent: 0, failed: 0 };

    const tokens = devices.map((d) => d.token);
    const data = normalizeData(payload.data);

    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data,
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      });

      // Dọn token bị FCM từ chối (uninstalled, invalid, ...) để bảng device không phình.
      const stale: string[] = [];
      response.responses.forEach((res, idx) => {
        if (res.success) return;
        const code = res.error?.code ?? "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          stale.push(tokens[idx]);
        }
      });

      if (stale.length) {
        await DeviceTokenModel.updateMany(
          { token: { $in: stale } },
          { $set: { isActive: false } }
        );
      }

      return {
        sent: response.successCount,
        failed: response.failureCount,
      };
    } catch (err) {
      console.error("[PushService.sendToUser] FCM error:", err);
      return { sent: 0, failed: tokens.length };
    }
  },
};
