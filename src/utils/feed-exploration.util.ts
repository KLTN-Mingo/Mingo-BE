export interface ExplorationCandidate {
  post: {
    _id: unknown;
    topics?: string[];
  };
}

/** Tạo random xác định để tái lập thứ tự exploration trong demo và test. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function postId(candidate: ExplorationCandidate): string {
  return String(candidate.post._id);
}

function isOutsideTopInterests(
  candidate: ExplorationCandidate,
  topInterestTopics: Set<string>
): boolean {
  const topics = candidate.post.topics ?? [];
  return (
    topInterestTopics.size > 0 &&
    topics.every((topic) => !topInterestTopics.has(topic.replace(/\./g, "_")))
  );
}

export function applyOutsideInterestExploration<T extends ExplorationCandidate>(
  ranked: T[],
  topInterestTopics: Set<string>,
  explorationRate: number,
  random: () => number = Math.random
): T[] {
  if (ranked.length <= 1 || explorationRate <= 0) return ranked;

  const explorationCount = Math.min(
    ranked.length - 1,
    Math.max(1, Math.round(ranked.length * explorationRate))
  );
  const exploitationCount = ranked.length - explorationCount;
  const lowerRanked = ranked.slice(exploitationCount);
  const outsideInterest = ranked.filter((candidate) =>
    isOutsideTopInterests(candidate, topInterestTopics)
  );

  const preferredPool = [
    ...outsideInterest.filter((candidate) => lowerRanked.includes(candidate)),
    ...outsideInterest.filter((candidate) => !lowerRanked.includes(candidate)),
  ];
  const selected: T[] = shuffle(preferredPool, random).slice(
    0,
    explorationCount
  );
  const selectedIds = new Set(selected.map(postId));

  if (selected.length < explorationCount) {
    const fallbackPool = lowerRanked.filter(
      (candidate) => !selectedIds.has(postId(candidate))
    );
    for (const candidate of shuffle(fallbackPool, random)) {
      selected.push(candidate);
      selectedIds.add(postId(candidate));
      if (selected.length === explorationCount) break;
    }
  }

  const exploitation = ranked
    .filter((candidate) => !selectedIds.has(postId(candidate)))
    .slice(0, ranked.length - selected.length);
  if (selected.length === 0) return exploitation;

  const result = [...exploitation];
  selected.forEach((candidate, index) => {
    const position = Math.min(
      result.length,
      Math.floor(((index + 1) * ranked.length) / (selected.length + 1))
    );
    result.splice(position, 0, candidate);
  });
  return result;
}
