export interface ClassificationPair<TLabel extends string> {
  expected: TLabel;
  predicted: TLabel;
}

export interface LabelMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
}

export interface ClassificationMetrics<TLabel extends string> {
  accuracy: number;
  perLabel: Record<TLabel, LabelMetrics>;
}

export interface RankedItem {
  id: string;
  relevant: boolean;
}

export interface DetectionPair {
  expected: string[];
  predicted: string[];
}

export interface DetectionMetrics {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

export function computeClassificationMetrics<TLabel extends string>(
  pairs: Array<ClassificationPair<TLabel>>,
  labels: TLabel[]
): ClassificationMetrics<TLabel> {
  const total = pairs.length;
  const correct = pairs.filter((pair) => pair.expected === pair.predicted).length;

  const perLabel = Object.fromEntries(
    labels.map((label) => {
      const truePositive = pairs.filter(
        (pair) => pair.expected === label && pair.predicted === label
      ).length;
      const falsePositive = pairs.filter(
        (pair) => pair.expected !== label && pair.predicted === label
      ).length;
      const falseNegative = pairs.filter(
        (pair) => pair.expected === label && pair.predicted !== label
      ).length;
      const support = pairs.filter((pair) => pair.expected === label).length;

      const precision = safeDivide(truePositive, truePositive + falsePositive);
      const recall = safeDivide(truePositive, truePositive + falseNegative);
      const f1 = safeDivide(2 * precision * recall, precision + recall);

      const metrics: LabelMetrics = {
        precision,
        recall,
        f1,
        support,
        truePositive,
        falsePositive,
        falseNegative,
      };

      return [label, metrics];
    })
  ) as Record<TLabel, LabelMetrics>;

  return {
    accuracy: safeDivide(correct, total),
    perLabel,
  };
}

export function computePrecisionAtK(items: RankedItem[], k: number): number {
  const topK = items.slice(0, Math.max(0, k));
  const relevant = topK.filter((item) => item.relevant).length;
  return safeDivide(relevant, topK.length);
}

export function computeDetectionMetrics(
  pairs: DetectionPair[]
): DetectionMetrics {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  for (const pair of pairs) {
    const expected = new Set(pair.expected.map(normalizeTerm));
    const predicted = new Set(pair.predicted.map(normalizeTerm));

    for (const term of predicted) {
      if (expected.has(term)) {
        truePositive += 1;
      } else {
        falsePositive += 1;
      }
    }

    for (const term of expected) {
      if (!predicted.has(term)) {
        falseNegative += 1;
      }
    }
  }

  const precision = safeDivide(truePositive, truePositive + falsePositive);
  const recall = safeDivide(truePositive, truePositive + falseNegative);
  const f1 = safeDivide(2 * precision * recall, precision + recall);

  return {
    truePositive,
    falsePositive,
    falseNegative,
    precision,
    recall,
    f1,
  };
}
