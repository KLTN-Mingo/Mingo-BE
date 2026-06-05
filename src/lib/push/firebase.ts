// src/lib/push/firebase.ts
import admin from "firebase-admin";

/**
 * Khởi tạo Firebase Admin SDK lazy: chỉ init khi có cấu hình ENV và lần đầu cần dùng.
 *
 * Hỗ trợ 2 cách cấu hình credentials:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON   = chuỗi JSON đã stringify của service account
 *   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *      (private key dùng \n thay xuống dòng — sẽ được .replace lại)
 *
 * Nếu chưa cấu hình -> push tắt (graceful fallback) và log warning.
 */

let _initialized = false;
let _enabled = false;

interface ServiceAccountLike {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function loadServiceAccountFromEnv(): admin.ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ServiceAccountLike;
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch (err) {
      console.error("[push] FIREBASE_SERVICE_ACCOUNT_JSON parse error:", err);
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function ensureInitialized(): void {
  if (_initialized) return;
  _initialized = true;

  const sa = loadServiceAccountFromEnv();
  if (!sa) {
    console.warn(
      "[push] Firebase chưa cấu hình — push notification sẽ bị bỏ qua."
    );
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
    });
    _enabled = true;
    console.log("[push] Firebase Admin SDK đã sẵn sàng.");
  } catch (err) {
    console.error("[push] Firebase initialize failed:", err);
  }
}

export function isPushEnabled(): boolean {
  ensureInitialized();
  return _enabled;
}

export function getMessaging(): admin.messaging.Messaging | null {
  ensureInitialized();
  if (!_enabled) return null;
  return admin.messaging();
}
