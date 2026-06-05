// src/controllers/device.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess, sendCreated } from "../utils/response";
import { ValidationError, UnauthorizedError } from "../errors";
import { PushService } from "../services/push.service";

function getAuthUserId(req: Request): string {
  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;
  if (!userId) {
    throw new UnauthorizedError("Cần đăng nhập");
  }
  return userId;
}

/**
 * @route POST /api/notifications/devices
 * Body: { token: string, platform: 'ios'|'android'|'web', deviceLabel?: string, appVersion?: string }
 */
export const registerDevice = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthUserId(req);
    const { token, platform, deviceLabel, appVersion } = req.body as {
      token?: string;
      platform?: string;
      deviceLabel?: string;
      appVersion?: string;
    };

    if (!token || !platform) {
      throw new ValidationError("token và platform là bắt buộc");
    }

    const device = await PushService.registerDevice({
      userId,
      token,
      platform,
      deviceLabel,
      appVersion,
    });

    sendCreated(res, device, "Đăng ký thiết bị thành công");
  }
);

/**
 * @route DELETE /api/notifications/devices/:token
 * Bỏ đăng ký 1 token (logout, đổi máy).
 */
export const unregisterDevice = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthUserId(req);
    const rawToken = req.params.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    if (!token) {
      throw new ValidationError("Thiếu token");
    }

    const device = await PushService.unregisterDevice({ userId, token });
    sendSuccess(res, device, "Đã bỏ đăng ký thiết bị");
  }
);

/**
 * @route GET /api/notifications/devices
 * Liệt kê các thiết bị đang nhận push của user.
 */
export const listDevices = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthUserId(req);
    const devices = await PushService.listDevicesByUser(userId);
    sendSuccess(res, devices);
  }
);
