/**
 * scripts/eval-e2e.ts
 *
 * Chạy toàn bộ pipeline ModerationService.moderateContent() thật (Tier 1 rule-based
 * + Tier 2 specialized model PhoBERT/ViHateT5) trên tập test uitnlp/vihsd, so với
 * nhãn thật để tính F1 end-to-end.
 *
 * Gemini (AIApiService.analyzeContent) bị MOCK — không gọi API thật — vì quyết định
 * cuối (auto_hide/review/approve) không phụ thuộc vào "reason" do Gemini sinh ra,
 * chỉ cần reason không bị lỗi để không trigger needsManualReview.
 *
 * YÊU CẦU TRƯỚC KHI CHẠY:
 *  1. FastAPI service (main.py) phải đang chạy ở localhost:8000 (uvicorn main:app --port 8000)
 *  2. Đã chạy export_dataset.py để có file vihsd_test.json ở root project
 *  3. Chạy bằng ts-node từ root project:
 *       npx ts-node scripts/eval-e2e.ts --limit 50
 *       npx ts-node scripts/eval-e2e.ts   (chạy full sau khi verify limit 50 ổn)
 */

import * as fs from "fs";
import * as path from "path";

// ⚠️ QUAN TRỌNG: mở 2 file dưới đây trong repo thật, kiểm tra:
//   - đường dẫn relative từ scripts/ tới file có đúng không
//   - tên export có đúng là ModerationService, ModerationStatus, AIApiService không
// rồi sửa 2 dòng import dưới đây nếu cần khớp với code thật:
import { ModerationService } from "../src/services/moderation/moderation.service";
import { ModerationStatus } from "../src/models/post.model";
import { AIApiService } from "../src/services/moderation/ai-api.service";

// ────────────────────────────────────────────────────────────
// MOCK GEMINI — không gọi API thật, trả reason rỗng hợp lệ
// ────────────────────────────────────────────────────────────
AIApiService.analyzeContent = async (_text: string) => {
  return {
    toxic: 0,
    hateSpeech: 0,
    spam: 0,
    reason: "mocked_for_eval",
  };
};

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface DatasetItem {
  text: string;
  label: 0 | 1; // 0 = CLEAN, 1 = TOXIC
}

interface PredictionRow {
  text: string;
  true_label: 0 | 1;
  pred_flagged: 0 | 1; // 1 nếu hệ thống flag (auto_hide hoặc review/FLAGGED)
  action: string;
  method: string;
}

// ────────────────────────────────────────────────────────────
// Helper: map kết quả moderation 3-trạng-thái → binary flagged/clean
// ────────────────────────────────────────────────────────────
function toBinaryFlag(status: ModerationStatus): 0 | 1 {
  // APPROVED → clean (0). Còn lại (REJECTED, FLAGGED, VIOLATED) → flagged (1).
  return status === ModerationStatus.APPROVED ? 0 : 1;
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  const dataPath = path.join(__dirname, "..", "vihsd_test.json");
  console.log(`Loading dataset: ${dataPath}`);
  const raw = fs.readFileSync(dataPath, "utf-8");
  let data: DatasetItem[] = JSON.parse(raw);

  if (limit) {
    data = data.slice(0, limit);
    console.log(`⚠️  Limit mode: chỉ chạy ${limit} mẫu đầu (dùng để verify trước khi chạy full)`);
  }

  console.log(`Total samples: ${data.length}`);

  const predictions: PredictionRow[] = [];
  const BATCH_SIZE = 10; // chạy song song theo batch để tăng tốc, tránh quá tải specialized model service

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await ModerationService.moderateContent(item.text, {});
          return {
            text: item.text,
            true_label: item.label,
            pred_flagged: toBinaryFlag(result.status),
            action: result.action,
            method: result.method,
          } as PredictionRow;
        } catch (err) {
          console.error(`Lỗi tại mẫu "${item.text.slice(0, 30)}...":`, err);
          return {
            text: item.text,
            true_label: item.label,
            pred_flagged: 1,
            action: "error",
            method: "error",
          } as PredictionRow;
        }
      })
    );

    predictions.push(...batchResults);

    if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= data.length) {
      console.log(`Processed ${Math.min(i + BATCH_SIZE, data.length)}/${data.length}`);
    }
  }

  const outPath = path.join(__dirname, "..", "predictions.json");
  fs.writeFileSync(outPath, JSON.stringify(predictions, null, 2), "utf-8");
  console.log(`\n✅ Done. Predictions saved to: ${outPath}`);

  const actionCounts: Record<string, number> = {};
  for (const p of predictions) {
    actionCounts[p.action] = (actionCounts[p.action] ?? 0) + 1;
  }
  console.log("\nAction distribution:", actionCounts);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
