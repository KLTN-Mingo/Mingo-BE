// src/services/moderation/data/hate-patterns.ts

export const HATE_PATTERNS: readonly RegExp[] = [
  // ── Xúc phạm bằng so sánh với động vật ──────────────────────────────────
  /\b(?:đồ\s+chó|đồ\s+lợn|đồ\s+khỉ|đồ\s+súc\s+vật|con\s+súc\s+vật)\b/gi,

  // ── Đe dọa tính mạng ─────────────────────────────────────────────────────
  /\b(?:mày\s+chết|tao\s+giết|đập\s+chết|chết\s+đi|giết\s+mày|cho\s+mày\s+chết)\b/gi,

  // ── Xúc phạm phẩm giá ────────────────────────────────────────────────────
  /\b(?:đồ\s+đĩ|con\s+đĩ|đồ\s+cặn\s+bã|đồ\s+rác\s+rưởi|đồ\s+phế\s+vật)\b/gi,

  // ── Miệt thị trí tuệ ─────────────────────────────────────────────────────
  /\b(?:thằng\s+ngu|con\s+ngu|đồ\s+ngu\s+dốt|não\s+cá\s+vàng|không\s+có\s+não)\b/gi,

  // ── Miệt thị xuất thân / gia đình ────────────────────────────────────────
  /\b(?:con\s+hoang|đồ\s+không\s+cha|không\s+có\s+mẹ|mồ\s+côi\s+não)\b/gi,

  // ── Kích động thù hận nhóm ───────────────────────────────────────────────
  /\b(?:đồ\s+phản\s+động|lũ\s+phản\s+động|bọn\s+phản\s+động)\b/gi,

  // ── Tiếng Anh ────────────────────────────────────────────────────────────
  /\b(?:kill\s+yourself|kys|go\s+die|you\s+should\s+die)\b/gi,
  /\b(?:sub?human|worthless\s+piece\s+of\s+shit|waste\s+of\s+space)\b/gi,
];
