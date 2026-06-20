import {
  computeClassificationMetrics,
  computePrecisionAtK,
  computeDetectionMetrics,
} from "../utils/evaluation-metrics.util";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertAlmostEqual(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 0.0001) {
    throw new Error(`${message}. Expected ${expected}, received ${actual}`);
  }
}

function testClassificationMetrics() {
  const metrics = computeClassificationMetrics(
    [
      { expected: "approved", predicted: "approved" },
      { expected: "approved", predicted: "flagged" },
      { expected: "flagged", predicted: "flagged" },
      { expected: "rejected", predicted: "rejected" },
      { expected: "rejected", predicted: "approved" },
    ],
    ["approved", "flagged", "rejected"]
  );

  assertAlmostEqual(metrics.accuracy, 0.6, "Accuracy must be correct");
  assertAlmostEqual(
    metrics.perLabel.approved.precision,
    0.5,
    "Approved precision must be correct"
  );
  assertAlmostEqual(
    metrics.perLabel.rejected.recall,
    0.5,
    "Rejected recall must be correct"
  );
}

function testPrecisionAtK() {
  const value = computePrecisionAtK(
    [
      { id: "p1", relevant: true },
      { id: "p2", relevant: false },
      { id: "p3", relevant: true },
      { id: "p4", relevant: true },
    ],
    3
  );

  assertAlmostEqual(value, 2 / 3, "Precision@K must use the top-K slice");
}

function testDetectionMetrics() {
  const metrics = computeDetectionMetrics(
    [
      { expected: ["noob", "flex"], predicted: ["noob", "spam"] },
      { expected: [], predicted: [] },
      { expected: ["cringe"], predicted: ["cringe"] },
    ]
  );

  assert(metrics.truePositive === 2, "True positives must be counted");
  assert(metrics.falsePositive === 1, "False positives must be counted");
  assert(metrics.falseNegative === 1, "False negatives must be counted");
  assertAlmostEqual(metrics.precision, 2 / 3, "Detection precision must match");
  assertAlmostEqual(metrics.recall, 2 / 3, "Detection recall must match");
}

try {
  testClassificationMetrics();
  testPrecisionAtK();
  testDetectionMetrics();
  console.log("evaluation metrics test passed");
} catch (error) {
  console.error("evaluation metrics test failed:", error);
  process.exit(1);
}
