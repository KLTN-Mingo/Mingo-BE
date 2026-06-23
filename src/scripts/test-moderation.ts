/**
 * src/scripts/test-moderation.ts
 *
 * Script đánh giá độ chính xác (precision / recall / F1) của hệ thống
 * AI Content Moderation, chạy ở 3 chế độ:
 *
 *   1. rule    -> chỉ RuleBasedService.checkContent()        (offline, không cần API)
 *   2. ai      -> chỉ AIApiService.analyzeContent()           (cần GEMINI_API_KEY_*)
 *   3. pipeline-> ModerationService.moderateContent() (rule -> AI -> approve, đúng luồng thật)
 *
 * Cách chạy:
 *   npx ts-node src/scripts/test-moderation.ts --mode=rule
 *   npx ts-node src/scripts/test-moderation.ts --mode=ai
 *   npx ts-node src/scripts/test-moderation.ts --mode=pipeline
 *   npx ts-node src/scripts/test-moderation.ts --mode=all        (chạy cả 3, mặc định)
 *
 * Tuỳ chọn:
 *   --data=path/to/file.json   (mặc định: src/scripts/test-data/test-data.json)
 *   --out=path/to/report       (mặc định: src/scripts/test-data/report)
 *   --concurrency=3            (số request AI chạy song song, mặc định 3 — tránh rate-limit)
 *
 * Yêu cầu:
 *   - File .env có GEMINI_API_KEY_1 (và/hoặc GEMINI_API_KEY_2) nếu muốn chạy mode=ai/pipeline/all.
 *     Nếu thiếu key, script sẽ tự bỏ qua các mode cần AI và chỉ chạy rule-based.
 *   - Không cần kết nối MongoDB vì script gọi thẳng RuleBasedService / AIApiService /
 *     ModerationService.moderateContent() (hàm thuần, không đụng DB). Hàm moderateAndUpdate
 *     (có ghi DB) KHÔNG được dùng ở đây.
 *
 * LƯU Ý VỀ TÍNH KHÔNG ỔN ĐỊNH (non-determinism) CỦA MODE "pipeline":
 *   shouldCallAI() trong moderation.service.ts có nhánh `Math.random() < 0.05`
 *   (quét ngẫu nhiên 5%). Với context mặc định (reportCount=0, isNewAccount=false),
 *   một mẫu "clean" đôi khi được gọi AI và đôi khi không, giữa các lần chạy khác nhau.
 *   Đây là ĐÚNG THIẾT KẾ của hệ thống thật (tối ưu chi phí), nhưng nghĩa là accuracy/F1
 *   của mode=pipeline có thể dao động nhẹ (thường <2%) giữa các lần chạy lặp lại.
 *   Để có số liệu ổn định/tái lặp được, nên ưu tiên đọc kết quả mode=rule và mode=ai
 *   riêng biệt; mode=pipeline minh hoạ hành vi tổng thể, không phải con số cố định tuyệt đối.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

import { RuleBasedService } from "../services/moderation/rule-based.service";
import { AIApiService } from "../services/moderation/ai-api.service";
import { ModerationService } from "../services/moderation/moderation.service";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type GroundTruthLabel =
  | "clean"
  | "toxic"
  | "hate_speech"
  | "spam"
  | "spam_soft";

interface TestSample {
  id: string;
  text: string;
  label: GroundTruthLabel;
  category: string;
}

type PredictedLabel = "clean" | "toxic" | "hate_speech" | "spam";

type EvalMode = "rule" | "ai" | "pipeline";

interface SampleResult {
  id: string;
  text: string;
  category: string;
  groundTruth: GroundTruthLabel;
  predicted: PredictedLabel;
  rawAction?: string;
  rawStatus?: string;
  scores?: { toxic: number; hateSpeech: number; spam: number };
  correct: boolean;
  durationMs: number;
}

interface ClassMetrics {
  label: string;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

interface ModeReport {
  mode: EvalMode;
  totalSamples: number;
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  perClass: ClassMetrics[];
  confusionMatrix: Record<string, Record<string, number>>;
  results: SampleResult[];
  totalDurationMs: number;
  skipped?: string;
}

// ────────────────────────────────────────────────────────────
// CLI args
// ────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return {
    mode: (out.mode as EvalMode | "all") ?? "all",
    dataPath: out.data ?? path.join(__dirname, "test-data", "test-data.json"),
    outPath: out.out ?? path.join(__dirname, "test-data", "report"),
    concurrency: out.concurrency ? parseInt(out.concurrency, 10) : 3,
  };
}

// ────────────────────────────────────────────────────────────
// Label mapping — quy đổi output hệ thống → 1 trong 4 nhãn so sánh
// ────────────────────────────────────────────────────────────

/**
 * Ground truth "spam_soft" được coi là ĐÚNG nếu hệ thống dự đoán "spam" HOẶC "clean"
 * (vì đây là vùng xám mà cả rule lẫn AI có thể hợp lý đi 1 trong 2 hướng).
 * Để đơn giản hoá việc tính metric, ta gộp spam_soft vào nhóm "spam" cho ground truth
 * nhưng đánh dấu riêng để xem riêng trong báo cáo (xem buildConfusion).
 */
function normalizeGroundTruth(label: GroundTruthLabel): PredictedLabel {
  if (label === "spam_soft") return "spam";
  return label;
}

/** Map kết quả RuleCheckResult -> nhãn dự đoán */
function predictFromRule(rule: {
  isClearViolation: boolean;
  violationType?: string;
  score: number;
}): PredictedLabel {
  if (!rule.isClearViolation) {
    // rule không tự kết luận vi phạm rõ ràng -> coi như "clean" ở chế độ rule-only
    // (vùng nghi vấn spam_soft vẫn tính là clean vì rule chưa tự chặn)
    return "clean";
  }
  switch (rule.violationType) {
    case "hate_speech":
      return "hate_speech";
    case "spam":
      return "spam";
    case "profanity":
    case "too_short":
    default:
      return "toxic";
  }
}

/** Map AIScoreResult (analyzeContent) -> nhãn dự đoán, dùng ngưỡng REVIEW của hệ thống */
function predictFromAiScores(scores: {
  toxic: number;
  hateSpeech: number;
  spam: number;
}): PredictedLabel {
  const REVIEW_THRESHOLD = 0.5; // khớp REVIEW trong moderation.service.ts
  const { toxic, hateSpeech, spam } = scores;
  const max = Math.max(toxic, hateSpeech, spam);
  if (max < REVIEW_THRESHOLD) return "clean";
  if (hateSpeech === max) return "hate_speech";
  if (spam === max) return "spam";
  return "toxic";
}

/** Map ModerationResult (pipeline) -> nhãn dự đoán */
function predictFromPipeline(result: {
  status: string;
  scores: { toxic: number; hateSpeech: number; spam: number };
}): PredictedLabel {
  if (result.status === "approved") return "clean";
  return predictFromAiScores(result.scores);
}

// ────────────────────────────────────────────────────────────
// Metrics
// ────────────────────────────────────────────────────────────

const ALL_LABELS: PredictedLabel[] = ["clean", "toxic", "hate_speech", "spam"];

function computeMetrics(results: SampleResult[]): {
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  perClass: ClassMetrics[];
  confusionMatrix: Record<string, Record<string, number>>;
} {
  const confusionMatrix: Record<string, Record<string, number>> = {};
  for (const a of ALL_LABELS) {
    confusionMatrix[a] = {};
    for (const p of ALL_LABELS) confusionMatrix[a][p] = 0;
  }

  let correctCount = 0;
  for (const r of results) {
    const gt = normalizeGroundTruth(r.groundTruth);
    confusionMatrix[gt][r.predicted] =
      (confusionMatrix[gt][r.predicted] ?? 0) + 1;
    if (gt === r.predicted) correctCount++;
  }

  const perClass: ClassMetrics[] = ALL_LABELS.map((label) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let support = 0;

    for (const r of results) {
      const gt = normalizeGroundTruth(r.groundTruth);
      if (gt === label) support++;
      if (gt === label && r.predicted === label) tp++;
      if (gt !== label && r.predicted === label) fp++;
      if (gt === label && r.predicted !== label) fn++;
    }

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);

    return { label, tp, fp, fn, precision, recall, f1, support };
  });

  const labelsWithSupport = perClass.filter((c) => c.support > 0);
  const macroPrecision =
    labelsWithSupport.reduce((s, c) => s + c.precision, 0) /
    (labelsWithSupport.length || 1);
  const macroRecall =
    labelsWithSupport.reduce((s, c) => s + c.recall, 0) /
    (labelsWithSupport.length || 1);
  const macroF1 =
    labelsWithSupport.reduce((s, c) => s + c.f1, 0) /
    (labelsWithSupport.length || 1);

  return {
    accuracy: results.length ? correctCount / results.length : 0,
    macroPrecision,
    macroRecall,
    macroF1,
    perClass,
    confusionMatrix,
  };
}

// ────────────────────────────────────────────────────────────
// Runners
// ────────────────────────────────────────────────────────────

async function runRuleMode(samples: TestSample[]): Promise<ModeReport> {
  const start = Date.now();
  const results: SampleResult[] = samples.map((s) => {
    const t0 = Date.now();
    const rule = RuleBasedService.checkContent(s.text);
    const predicted = predictFromRule(rule);
    return {
      id: s.id,
      text: s.text,
      category: s.category,
      groundTruth: s.label,
      predicted,
      rawAction: rule.isClearViolation ? "block_rule" : "pass",
      rawStatus: rule.violationType,
      scores: undefined,
      correct: predicted === normalizeGroundTruth(s.label),
      durationMs: Date.now() - t0,
    };
  });

  const metrics = computeMetrics(results);
  return {
    mode: "rule",
    totalSamples: samples.length,
    totalDurationMs: Date.now() - start,
    results,
    ...metrics,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

function hasApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2);
}

async function runAiMode(
  samples: TestSample[],
  concurrency: number
): Promise<ModeReport> {
  if (!hasApiKey()) {
    return {
      mode: "ai",
      totalSamples: samples.length,
      accuracy: 0,
      macroPrecision: 0,
      macroRecall: 0,
      macroF1: 0,
      perClass: [],
      confusionMatrix: {},
      results: [],
      totalDurationMs: 0,
      skipped: "Không tìm thấy GEMINI_API_KEY_1/2 trong .env — bỏ qua mode=ai",
    };
  }

  const start = Date.now();
  const results = await runWithConcurrency(samples, concurrency, async (s) => {
    const t0 = Date.now();
    const scores = await AIApiService.analyzeContent(s.text);
    const predicted = predictFromAiScores(scores);
    return {
      id: s.id,
      text: s.text,
      category: s.category,
      groundTruth: s.label,
      predicted,
      rawStatus: scores.reason,
      scores: {
        toxic: scores.toxic,
        hateSpeech: scores.hateSpeech,
        spam: scores.spam,
      },
      correct: predicted === normalizeGroundTruth(s.label),
      durationMs: Date.now() - t0,
    } as SampleResult;
  });

  const metrics = computeMetrics(results);
  return {
    mode: "ai",
    totalSamples: samples.length,
    totalDurationMs: Date.now() - start,
    results,
    ...metrics,
  };
}

async function runPipelineMode(
  samples: TestSample[],
  concurrency: number
): Promise<ModeReport> {
  const start = Date.now();
  const results = await runWithConcurrency(samples, concurrency, async (s) => {
    const t0 = Date.now();
    const result = await ModerationService.moderateContent(s.text, {
      reportCount: 0,
      isNewAccount: false,
    });
    const predicted = predictFromPipeline({
      status: result.status,
      scores: result.scores,
    });
    return {
      id: s.id,
      text: s.text,
      category: s.category,
      groundTruth: s.label,
      predicted,
      rawAction: result.action,
      rawStatus: `${result.status} (${result.method})`,
      scores: {
        toxic: result.scores.toxic,
        hateSpeech: result.scores.hateSpeech,
        spam: result.scores.spam,
      },
      correct: predicted === normalizeGroundTruth(s.label),
      durationMs: Date.now() - t0,
    } as SampleResult;
  });

  const metrics = computeMetrics(results);
  return {
    mode: "pipeline",
    totalSamples: samples.length,
    totalDurationMs: Date.now() - start,
    results,
    ...metrics,
  };
}

// ────────────────────────────────────────────────────────────
// Reporting
// ────────────────────────────────────────────────────────────

function printReport(report: ModeReport) {
  console.log("\n" + "=".repeat(70));
  console.log(`KẾT QUẢ MODE: ${report.mode.toUpperCase()}`);
  console.log("=".repeat(70));

  if (report.skipped) {
    console.log(`⏭️  SKIPPED: ${report.skipped}`);
    return;
  }

  console.log(`Tổng số mẫu: ${report.totalSamples}`);
  console.log(`Thời gian chạy: ${(report.totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`Accuracy tổng thể: ${(report.accuracy * 100).toFixed(2)}%`);
  console.log(`Macro Precision: ${(report.macroPrecision * 100).toFixed(2)}%`);
  console.log(`Macro Recall:    ${(report.macroRecall * 100).toFixed(2)}%`);
  console.log(`Macro F1-score:  ${(report.macroF1 * 100).toFixed(2)}%`);

  console.log("\nChi tiết theo nhãn (class):");
  console.table(
    report.perClass.map((c) => ({
      label: c.label,
      support: c.support,
      TP: c.tp,
      FP: c.fp,
      FN: c.fn,
      precision: c.precision.toFixed(3),
      recall: c.recall.toFixed(3),
      f1: c.f1.toFixed(3),
    }))
  );

  console.log("\nConfusion matrix (hàng = ground truth, cột = predicted):");
  console.table(report.confusionMatrix);

  const wrong = report.results.filter((r) => !r.correct);
  if (wrong.length) {
    console.log(
      `\n❌ ${wrong.length} mẫu dự đoán sai (xem chi tiết trong file report):`
    );
    for (const w of wrong.slice(0, 15)) {
      console.log(
        `  [${w.id}] gt=${w.groundTruth} pred=${w.predicted} text="${w.text.slice(0, 60)}${w.text.length > 60 ? "..." : ""}"`
      );
    }
    if (wrong.length > 15) {
      console.log(`  ... và ${wrong.length - 15} mẫu khác`);
    }
  }
}

function writeReportFiles(report: ModeReport, outBasePath: string) {
  if (report.skipped) return;

  const jsonPath = `${outBasePath}-${report.mode}.json`;
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");

  const csvLines = [
    "id,category,ground_truth,predicted,correct,toxic_score,hate_speech_score,spam_score,duration_ms,text",
  ];
  for (const r of report.results) {
    const text = r.text.replace(/"/g, '""').replace(/\n/g, " ");
    csvLines.push(
      [
        r.id,
        r.category,
        r.groundTruth,
        r.predicted,
        r.correct,
        r.scores?.toxic?.toFixed(3) ?? "",
        r.scores?.hateSpeech?.toFixed(3) ?? "",
        r.scores?.spam?.toFixed(3) ?? "",
        r.durationMs,
        `"${text}"`,
      ].join(",")
    );
  }
  const csvPath = `${outBasePath}-${report.mode}.csv`;
  fs.writeFileSync(csvPath, csvLines.join("\n"), "utf-8");

  console.log(`\n📁 Đã ghi báo cáo: ${jsonPath}`);
  console.log(`📁 Đã ghi báo cáo: ${csvPath}`);
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main() {
  const { mode, dataPath, outPath, concurrency } = parseArgs();

  if (!fs.existsSync(dataPath)) {
    console.error(`❌ Không tìm thấy file test data tại: ${dataPath}`);
    console.error(
      `   Dùng --data=path/to/test-data.json để chỉ định đường dẫn khác.`
    );
    process.exit(1);
  }

  const samples: TestSample[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  console.log(`📂 Đã tải ${samples.length} mẫu test từ ${dataPath}`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const modesToRun: EvalMode[] =
    mode === "all" ? ["rule", "ai", "pipeline"] : [mode];

  const allReports: ModeReport[] = [];

  for (const m of modesToRun) {
    let report: ModeReport;
    if (m === "rule") {
      report = await runRuleMode(samples);
    } else if (m === "ai") {
      report = await runAiMode(samples, concurrency);
    } else {
      report = await runPipelineMode(samples, concurrency);
    }
    printReport(report);
    writeReportFiles(report, outPath);
    allReports.push(report);
  }

  if (allReports.length > 1) {
    console.log("\n" + "=".repeat(70));
    console.log("SO SÁNH TỔNG QUAN GIỮA CÁC TẦNG");
    console.log("=".repeat(70));
    console.table(
      allReports.map((r) => ({
        mode: r.mode,
        skipped: r.skipped ? "yes" : "no",
        accuracy: r.skipped ? "-" : `${(r.accuracy * 100).toFixed(2)}%`,
        macroPrecision: r.skipped
          ? "-"
          : `${(r.macroPrecision * 100).toFixed(2)}%`,
        macroRecall: r.skipped ? "-" : `${(r.macroRecall * 100).toFixed(2)}%`,
        macroF1: r.skipped ? "-" : `${(r.macroF1 * 100).toFixed(2)}%`,
        durationSec: r.skipped ? "-" : (r.totalDurationMs / 1000).toFixed(2),
      }))
    );
  }

  console.log("\n✅ Hoàn tất.");
}

main().catch((err) => {
  console.error("💥 Lỗi khi chạy test:", err);
  process.exit(1);
});
