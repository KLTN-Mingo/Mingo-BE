// src/utils/suggest-ban.util.ts

export type SeverityLevel = "light" | "medium" | "heavy" | "critical";

export interface AIScoreInput {
  toxic?: number;
  hateSpeech?: number;
  spam?: number;
}

export interface BanSuggestion {
  preset: string | null; // "1d" | "3d" | "7d" | "30d" | "permanent" | null
  reason: string;
  autoEscalate: boolean;
}

// Map từ preset string → số ngày
export const PRESET_DAYS: Record<string, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

// Preset hợp lệ khi gửi request (ban_temp)
export const VALID_BAN_PRESETS = ["1d", "3d", "7d", "30d"] as const;

/**
 * Matrix chọn preset khóa theo severity + số lần vi phạm.
 * Columns: vc=0-2 | vc=3-4 | vc=5-6 | vc=7-9 | vc=10+
 */
const BAN_MATRIX: Record<SeverityLevel, readonly [string, string, string, string, string]> = {
  light:    ["1d",       "1d",       "3d",       "7d",       "30d"      ] as const,
  medium:   ["1d",       "3d",       "7d",       "30d",      "permanent"] as const,
  heavy:    ["3d",       "7d",       "30d",      "permanent", "permanent"] as const,
  critical: ["7d",       "30d",      "permanent", "permanent", "permanent"] as const,
};

/**
 * Tính toán preset khóa tài khoản được đề xuất dựa trên:
 * - violationCount: số lần vi phạm hiện tại của user
 * - aiScores: điểm AI từ moderation snapshot (tùy chọn)
 *
 * Returns:
 * - preset: "1d" | "3d" | "7d" | "30d" | "permanent" | null
 * - reason: chuỗi mô tả lý do chọn preset
 * - autoEscalate: true nếu preset = "permanent"
 */
export function suggestBanPreset(
  violationCount: number,
  aiScores?: AIScoreInput
): BanSuggestion {
  if (violationCount < 0) {
    return { preset: null, reason: "invalid violation count", autoEscalate: false };
  }

  const toxic = aiScores?.toxic ?? 0;
  const hate  = aiScores?.hateSpeech ?? 0;

  // ── Xác định severity ─────────────────────────────────────────────────
  let severity: SeverityLevel;
  if (hate >= 0.7 || toxic >= 0.9) {
    severity = "critical";
  } else if (toxic >= 0.7 || hate >= 0.4) {
    severity = "heavy";
  } else if (toxic >= 0.4) {
    severity = "medium";
  } else {
    severity = "light";
  }

  // ── Chọn cột theo violationCount ─────────────────────────────────────
  const col =
    violationCount >= 10 ? 4 :
    violationCount >= 7  ? 3 :
    violationCount >= 5  ? 2 :
    violationCount >= 3  ? 1 : 0;

  const preset = BAN_MATRIX[severity][col];

  return {
    preset,
    reason: `${severity} violation · ${violationCount} lần vi phạm trước`,
    autoEscalate: preset === "permanent",
  };
}

/**
 * Parse banPreset string thành số milliseconds.
 * Trả về null nếu preset không hợp lệ.
 */
export function presetToMs(preset: string): number | null {
  const days = PRESET_DAYS[preset];
  if (days === undefined) return null;
  return days * 24 * 60 * 60 * 1000;
}
