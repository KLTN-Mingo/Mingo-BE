// src/services/moderation/specialized-model.service.ts

export interface SpecializedScoreResult {
  isToxic: boolean;
  hateSpeech: number;
}

const MODEL_SERVICE_URL =
  process.env.MODEL_SERVICE_URL ?? "http://localhost:8000";

export const SpecializedModelService = {
  async getSpecializedScore(content: string): Promise<SpecializedScoreResult> {
    console.log("[SpecializedModel] Calling:", MODEL_SERVICE_URL);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${MODEL_SERVICE_URL}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.error(
          `[SpecializedModel] HTTP ${res.status} from ${MODEL_SERVICE_URL}/score`
        );
        return { isToxic: false, hateSpeech: 0 };
      }

      const data = (await res.json()) as { toxic: boolean; hateSpeech: number };

      const result = {
        isToxic: data.toxic ?? false,
        hateSpeech: typeof data.hateSpeech === "number" ? data.hateSpeech : 0,
      };

      console.log("[SpecializedModel] Score result:", result);
      return result;
    } catch (error) {
      clearTimeout(timeout);

      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        "[SpecializedModel] Call failed (fallback to false/0):",
        msg
      );

      return { isToxic: false, hateSpeech: 0 };
    }
  },
};
