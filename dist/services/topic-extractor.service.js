"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.topicExtractorService = void 0;
// src/services/topic-extractor.service.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MAX_TOPICS_PER_POST = 3;
// ─── Service ─────────────────────────────────────────────────────────────────
class TopicExtractorService {
    constructor() {
        this.topics = [];
        this.countries = [];
        this.ready = false;
        try {
            // process.cwd() = project root khi chạy ts-node / node
            const filePath = path.join(process.cwd(), "data", "social_media_topics_v2.json");
            const raw = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(raw);
            this.topics = data.topics ?? [];
            // Flatten countries từ metadata
            const countriesMap = data.metadata?.countries ?? {};
            this.countries = Object.values(countriesMap)
                .flat()
                .filter((v) => typeof v === "string");
            this.ready = true;
            console.log(`[TopicExtractor] Loaded ${this.topics.length} topics, ` +
                `${this.countries.length} country names`);
        }
        catch (err) {
            console.warn("[TopicExtractor] Cannot load topics.json — topics will be [].", err.message);
        }
    }
    // ─── Public ───────────────────────────────────────────────────────────────
    extract(input) {
        if (!this.ready || this.topics.length === 0)
            return [];
        const { contentText, hashtags = [], mediaTypes = [] } = input;
        const scoreMap = new Map();
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
            const TRAVEL_TOPIC = this.topics.find((t) => t.id === "T011")?.topic ?? "Du lịch - Travel";
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
                const entertainmentTopic = this.topics.find((t) => t.id === "T016" || t.id === "T019")?.topic;
                if (entertainmentTopic)
                    return [entertainmentTopic];
            }
            return [];
        }
        return Array.from(scoreMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_TOPICS_PER_POST)
            .map(([topicName]) => topicName);
    }
    // Trả về tên topic theo id — dùng trong Scoring Engine nếu cần
    getTopicById(id) {
        return this.topics.find((t) => t.id === id)?.topic;
    }
    // ─── Helper ───────────────────────────────────────────────────────────────
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
}
exports.topicExtractorService = new TopicExtractorService();
