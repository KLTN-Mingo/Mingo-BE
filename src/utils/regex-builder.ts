/**
 * Build regex pattern an toàn cho tiếng Việt
 * Tự động escape + thay \b bằng lookaround phù hợp
 */
export function buildVietnameseRegex(phrase: string): string {
  const escaped = phrase
    .trim()
    .split(/\s+/)
    .map((word) => escapeRegexWord(word))
    .join("\\s+");

  // Dùng lookaround thay vì \b vì \b không hoạt động với Unicode tiếng Việt
  return `(?<![\\w\\p{L}])${escaped}(?![\\w\\p{L}])`;
}

function escapeRegexWord(word: string): string {
  // Escape các ký tự đặc biệt của regex
  return word.replace(/[.*+?^${}()|[\]\\,]/g, "\\$&");
}

/** Test thử regex trước khi lưu */
export function validateRegex(pattern: string): {
  valid: boolean;
  error?: string;
} {
  try {
    new RegExp(pattern, "gi");
    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}
