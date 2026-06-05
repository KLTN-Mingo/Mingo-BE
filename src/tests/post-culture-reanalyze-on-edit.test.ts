import { shouldReAnalyzeCultureForPostUpdate } from "../services/post.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function testContentTextEditRequiresCultureReAnalyze() {
  assert(
    shouldReAnalyzeCultureForPostUpdate({ contentText: "new text" }),
    "Expected contentText updates to trigger culture re-analysis"
  );

  assert(
    !shouldReAnalyzeCultureForPostUpdate({ visibility: "public" as any }),
    "Expected non-content updates to skip culture re-analysis"
  );
}

testContentTextEditRequiresCultureReAnalyze()
  .then(() => console.log("post culture re-analyze on edit test passed"))
  .catch((err) => {
    console.error("post culture re-analyze on edit test failed:", err);
    process.exit(1);
  });
