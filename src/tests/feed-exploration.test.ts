import { applyOutsideInterestExploration } from "../utils/feed-exploration.util";
import { TOP_INTEREST_TOPIC_COUNT } from "../constants/feed.constants";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  TOP_INTEREST_TOPIC_COUNT === 10,
  "Exploration phải dùng top 10 chủ đề có điểm cao nhất"
);

const ranked = Array.from({ length: 20 }, (_, index) => ({
  post: {
    _id: `post-${index + 1}`,
    topics:
      index < 17
        ? ["Công nghệ - Technology"]
        : ["Ẩm thực - Food"],
  },
  score: 100 - index,
  breakdown: {
    content: index < 17 ? 80 : 0,
    popularity: 50,
    social: 0,
    final: 100 - index,
  },
}));

const explored = applyOutsideInterestExploration(
  ranked,
  new Set(["Công nghệ - Technology"]),
  0.15,
  () => 0.5
);

assert(explored.length === ranked.length, "Exploration must preserve result size");
assert(
  new Set(explored.map((row) => row.post._id)).size === explored.length,
  "Exploration must not duplicate posts"
);
assert(
  explored.filter((row) => row.post.topics.includes("Ẩm thực - Food")).length === 3,
  "Fifteen percent of a 20-post feed must come from outside top interests"
);
assert(
  explored.slice(0, -3).some((row) => row.post.topics.includes("Ẩm thực - Food")),
  "Exploration posts must be interleaved instead of appended as one tail block"
);

const fallback = applyOutsideInterestExploration(
  ranked,
  new Set(),
  0.15,
  () => 0.5
);
assert(
  fallback.length === ranked.length &&
    new Set(fallback.map((row) => row.post._id)).size === fallback.length,
  "Exploration without a profile must fall back safely without duplicates"
);

console.log("feed exploration test passed");
