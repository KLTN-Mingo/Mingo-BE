// src/services/culture-translation/slang-detector.service.ts
import { SlangEntryModel } from "../../models/culture-translation.model";

export interface DetectedTerm {
  term: string;
  startIndex: number;
  endIndex: number;
}

// In-memory cache — avoids DB query for every new post
let _cache: Array<{ term: string; regexPattern: string }> | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const SlangDetectorService = {
  async loadDictionary() {
    if (_cache && Date.now() < _cacheExpiry) return _cache;
    const entries = await SlangEntryModel
      .find({ isActive: true })
      .select("term regexPattern")
      .lean();
    _cache = entries as Array<{ term: string; regexPattern: string }>;
    _cacheExpiry = Date.now() + CACHE_TTL_MS;
    console.log(`[SlangDetector] Loaded ${entries.length} entries`);
    return _cache;
  },

  clearCache() {
    _cache = null;
    _cacheExpiry = 0;
  },

  async detectTerms(content: string): Promise<DetectedTerm[]> {
    const dictionary = await SlangDetectorService.loadDictionary();
    const detected: DetectedTerm[] = [];
    const seenPositions = new Set<string>();

    for (const entry of dictionary) {
      try {
        const regex = new RegExp(entry.regexPattern, "gi");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          const posKey = `${match.index}:${match.index + match[0].length}`;
          if (seenPositions.has(posKey)) continue;
          seenPositions.add(posKey);
          detected.push({
            term:       entry.term,
            startIndex: match.index,
            endIndex:   match.index + match[0].length,
          });
        }
      } catch (err) {
        console.error(`[SlangDetector] Invalid regex for "${entry.term}":`, err);
      }
    }
    return detected;
  },
};
