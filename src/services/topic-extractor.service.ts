// src/services/topic-extractor.service.ts
import * as fs   from "fs";
import * as path from "path";

const MAX_TOPICS_PER_POST = 3;

// ─── Types khớp với social_media_topics_v2.json ──────────────────────────────

interface TopicEntry {
  id:           string;
  topic:        string;          // "Công nghệ - Technology"
  category:     string;
  keywords: {
    vi?:  string[];
    en?:  string[];
    zh?:  string[];
    ja?:  string[];
    ko?:  string[];
  };
  hashtags:     string[];
  keywords_vi:  string[];        // flat list — dùng cái này để match
  keywords_en:  string[];        // flat list — dùng cái này để match
}

interface TopicsData {
  version:      string;
  topics:       TopicEntry[];
  metadata?: {
    countries?:        Record<string, string[]>;
    slang_indicators?: { vi: string[]; en: string[] };
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

class TopicExtractorService {
  private topics:    TopicEntry[] = [];
  private countries: string[]     = [];
  private ready      = false;

  constructor() {
    try {
      // process.cwd() = project root khi chạy ts-node / node
      const filePath = path.join(
        process.cwd(),
        "data",
        "social_media_topics_v2.json"
      );
      const raw            = fs.readFileSync(filePath, "utf-8");
      const data: TopicsData = JSON.parse(raw);

      this.topics = data.topics ?? [];

      // Flatten countries từ metadata
      const countriesMap = data.metadata?.countries ?? {};
      this.countries = Object.values(countriesMap)
        .flat()
        .filter((v): v is string => typeof v === "string");

      this.ready = true;
      console.log(
        `[TopicExtractor] Loaded ${this.topics.length} topics, ` +
        `${this.countries.length} country names`
      );
    } catch (err) {
      console.warn(
        "[TopicExtractor] Cannot load topics.json — topics will be [].",
        (err as Error).message
      );
    }
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  extract(input: {
    contentText?: string | null;
    hashtags?:    string[];
    mediaTypes?:  string[];
  }): string[] {
    if (!this.ready || this.topics.length === 0) return [];

    const { contentText, hashtags = [], mediaTypes = [] } = input;
    const scoreMap = new Map<string, number>();

    // 1. Hashtag matching — score x2
    for (const tag of hashtags) {
      const normalized = tag.replace(/^#/, "").toLowerCase().trim();
      for (const topic of this.topics) {
        if (topic.hashtags.some((h) => h.toLowerCase() === normalized)) {
          // Dùng topic.topic làm key — đây là tên canonical
          scoreMap.set(topic.topic, (scoreMap.get(topic.topic) ?? 0) + 2);
        }
      }
    }

    // 2. Keyword matching trong content (VI + EN)
    if (contentText?.trim()) {
      const normContent = this.normalizeText(contentText);

      for (const topic of this.topics) {
        const allKeywords = [
          ...(topic.keywords_vi ?? []),
          ...(topic.keywords_en ?? []),
        ];
        for (const kw of allKeywords) {
          if (normContent.includes(this.normalizeText(kw))) {
            scoreMap.set(topic.topic, (scoreMap.get(topic.topic) ?? 0) + 1);
          }
        }
      }

      // 3. Country name → boost "Du lịch - Travel"
      const TRAVEL_TOPIC = this.topics.find((t) =>
        t.id === "T011"
      )?.topic ?? "Du lịch - Travel";

      for (const country of this.countries) {
        if (normContent.includes(this.normalizeText(country))) {
          scoreMap.set(TRAVEL_TOPIC, (scoreMap.get(TRAVEL_TOPIC) ?? 0) + 1);
          break;
        }
      }
    }

    // 4. Fallback khi không extract được gì
    if (scoreMap.size === 0) {
      if (mediaTypes.includes("video")) {
        // Tìm topic giải trí theo id T016 hoặc T019
        const entertainmentTopic = this.topics.find((t) =>
          t.id === "T016" || t.id === "T019"
        )?.topic;
        if (entertainmentTopic) return [entertainmentTopic];
      }
      return [];
    }

    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TOPICS_PER_POST)
      .map(([topicName]) => topicName);
  }

  // Trả về tên topic theo id — dùng trong Scoring Engine nếu cần
  getTopicById(id: string): string | undefined {
    return this.topics.find((t) => t.id === id)?.topic;
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")   // bỏ dấu tiếng Việt
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export const topicExtractorService = new TopicExtractorService();