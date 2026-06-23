/**
 * LƯU Ý KỸ THUẬT (đã sửa so với bản gốc):
 * JavaScript's \b dựa trên \w = [A-Za-z0-9_], KHÔNG coi các chữ cái Việt có dấu
 * (đ, Đ, ư, ơ, ệ, ố...) là "word character". Vì vậy bất kỳ cụm nào bắt đầu/kết
 * thúc bằng chữ có dấu sẽ luôn bị \b chặn nhầm, khiến pattern không khớp dù
 * nội dung đúng (vd: "đồ chó", "đập chết" không khớp được).
 *
 * Sửa bằng lookaround Unicode-safe: (?<![\p{L}\p{N}]) ... (?![\p{L}\p{N}])
 * thay cho \b, kết hợp flag "u" để \p{L}/\p{N} hoạt động đúng trên toàn bộ
 * chữ cái Unicode (bao gồm cả chữ Việt có dấu).
 */
export const HATE_PATTERNS: readonly RegExp[] = [
  // ── Xúc phạm bằng so sánh với động vật ──────────────────────────────────
  /(?<![\p{L}\p{N}])(?:đồ\s+chó|đồ\s+lợn|đồ\s+khỉ|đồ\s+súc\s+vật|con\s+súc\s+vật)(?![\p{L}\p{N}])/giu,

  // ── Đe dọa tính mạng ─────────────────────────────────────────────────────
  /(?<![\p{L}\p{N}])(?:mày\s+chết|tao\s+giết|đập\s+chết|chết\s+đi|giết\s+mày|cho\s+mày\s+chết)(?![\p{L}\p{N}])/giu,

  // ── Xúc phạm phẩm giá ────────────────────────────────────────────────────
  /(?<![\p{L}\p{N}])(?:đồ\s+đĩ|con\s+đĩ|đồ\s+cặn\s+bã|đồ\s+rác\s+rưởi|đồ\s+phế\s+vật)(?![\p{L}\p{N}])/giu,

  // ── Miệt thị trí tuệ ─────────────────────────────────────────────────────
  /(?<![\p{L}\p{N}])(?:thằng\s+ngu|con\s+ngu|đồ\s+ngu\s+dốt|não\s+cá\s+vàng|không\s+có\s+não)(?![\p{L}\p{N}])/giu,

  // ── Miệt thị xuất thân / gia đình ────────────────────────────────────────
  /(?<![\p{L}\p{N}])(?:con\s+hoang|đồ\s+không\s+cha|không\s+có\s+mẹ|mồ\s+côi\s+não)(?![\p{L}\p{N}])/giu,

  // ── Kích động thù hận nhóm ───────────────────────────────────────────────
  /(?<![\p{L}\p{N}])(?:đồ\s+phản\s+động|lũ\s+phản\s+động|bọn\s+phản\s+động)(?![\p{L}\p{N}])/giu,

  // ── Tiếng Anh ────────────────────────────────────────────────────────────
  /(?<![\p{L}\p{N}])(?:kill\s+yourself|kys|go\s+die|you\s+should\s+die)(?![\p{L}\p{N}])/giu,
  /(?<![\p{L}\p{N}])(?:sub?human|worthless\s+piece\s+of\s+shit|waste\s+of\s+space)(?![\p{L}\p{N}])/giu,
];
