// src/utils/vn-regex-builder.ts

/**
 * Map các ký tự tiếng Việt có dấu → pattern regex khớp cả có dấu lẫn không dấu.
 * Giúp regex vẫn match khi người dùng gõ không dấu.
 */
const VIET_CHAR_MAP: Record<string, string> = {
  // a
  a: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  à: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  á: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  â: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ã: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ă: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ặ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ắ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ằ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ẳ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ẵ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ạ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ả: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ấ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ầ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ẩ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ẫ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  ậ: "[aàáâãäåăặắằẳẵạảấầẩẫậ]",
  // d
  đ: "[dđ]",
  // e
  e: "[eèéêëẹẻẽếềểễệ]",
  è: "[eèéêëẹẻẽếềểễệ]",
  é: "[eèéêëẹẻẽếềểễệ]",
  ê: "[eèéêëẹẻẽếềểễệ]",
  ẹ: "[eèéêëẹẻẽếềểễệ]",
  ẻ: "[eèéêëẹẻẽếềểễệ]",
  ẽ: "[eèéêëẹẻẽếềểễệ]",
  ế: "[eèéêëẹẻẽếềểễệ]",
  ề: "[eèéêëẹẻẽếềểễệ]",
  ể: "[eèéêëẹẻẽếềểễệ]",
  ễ: "[eèéêëẹẻẽếềểễệ]",
  ệ: "[eèéêëẹẻẽếềểễệ]",
  // i
  i: "[iìíîïịỉĩ]",
  ì: "[iìíîïịỉĩ]",
  í: "[iìíîïịỉĩ]",
  ị: "[iìíîïịỉĩ]",
  ỉ: "[iìíîïịỉĩ]",
  ĩ: "[iìíîïịỉĩ]",
  // o
  o: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ò: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ó: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ô: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  õ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ọ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ỏ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ố: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ồ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ổ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ỗ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ộ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ơ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ớ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ờ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ở: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ỡ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  ợ: "[oòóôõöọỏốồổỗộơớờởỡợ]",
  // u
  u: "[uùúûüụủũưứừửữự]",
  ù: "[uùúûüụủũưứừửữự]",
  ú: "[uùúûüụủũưứừửữự]",
  ụ: "[uùúûüụủũưứừửữự]",
  ủ: "[uùúûüụủũưứừửữự]",
  ũ: "[uùúûüụủũưứừửữự]",
  ư: "[uùúûüụủũưứừửữự]",
  ứ: "[uùúûüụủũưứừửữự]",
  ừ: "[uùúûüụủũưứừửữự]",
  ử: "[uùúûüụủũưứừửữự]",
  ữ: "[uùúûüụủũưứừửữự]",
  ự: "[uùúûüụủũưứừửữự]",
  // y
  y: "[yỳýỷỹỵ]",
  ỳ: "[yỳýỷỹỵ]",
  ý: "[yỳýỷỹỵ]",
  ỷ: "[yỳýỷỹỵ]",
  ỹ: "[yỳýỷỹỵ]",
  ỵ: "[yỳýỷỹỵ]",
};

/**
 * Escape các ký tự đặc biệt của regex (trừ ký tự tiếng Việt đã xử lý riêng).
 */
function escapeSpecialChars(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Chuyển 1 ký tự thành regex pattern tương ứng.
 * - Ký tự tiếng Việt → character class khớp mọi biến thể
 * - Ký tự đặc biệt regex → escape
 * - Ký tự thường → giữ nguyên
 */
function charToPattern(char: string): string {
  const lower = char.toLowerCase();
  if (VIET_CHAR_MAP[lower]) return VIET_CHAR_MAP[lower];
  return escapeSpecialChars(char);
}

/**
 * Build regex pattern an toàn cho cụm từ tiếng Việt.
 *
 * - Tự động xử lý ký tự có dấu → khớp cả có dấu lẫn không dấu
 * - Dùng lookaround thay vì \b (vì \b không hoạt động với Unicode tiếng Việt)
 * - Khoảng trắng giữa từ → \s+ để linh hoạt
 * - Dấu câu (phẩy, chấm...) → \s*[,.]?\s* để không bị miss
 *
 * @example
 * buildVietnameseRegex("cổ điển, tôn trọng")
 * // → "(?<![\\S])c[oòóôõöọỏốồổỗộơớờởỡợ]...\s*,?\s*..."
 */
export function buildVietnameseRegex(phrase: string): string {
  const words = phrase.trim().split(/\s+/);

  const wordPatterns = words.map((word) => {
    // Xử lý dấu câu cuối từ (phẩy, chấm, v.v.)
    const trailingPunct = word.match(/[,.]$/)?.[0] ?? "";
    const cleanWord = trailingPunct ? word.slice(0, -1) : word;

    const charPattern = [...cleanWord].map(charToPattern).join("");

    return trailingPunct
      ? `${charPattern}\\s*${escapeSpecialChars(trailingPunct)}?`
      : charPattern;
  });

  const inner = wordPatterns.join("\\s+");

  // Lookaround: không match nếu trước/sau là ký tự chữ cái (Latin hoặc Unicode)
  // Dùng \s|^ và \s|$ thay vì \b vì \b fail với tiếng Việt
  return `(?:^|(?<=[\\s,.:!?\"'()]))(${inner})(?=[\\s,.:!?\"'()]|$)`;
}

/**
 * Validate regex string — trả về lỗi nếu compile fail.
 */
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

/**
 * Test thử regex có match được chính term đó không.
 * Dùng để sanity check trước khi lưu DB.
 */
export function selfTest(term: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, "gi");
    return regex.test(` ${term} `); // thêm space để lookaround hoạt động
  } catch {
    return false;
  }
}
