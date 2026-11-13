export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  lastCompletedPuzzle: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
}

const STATS_STORAGE_KEY = "bookpals_player_stats_v1";

export function createDefaultStats(): PlayerStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastCompletedPuzzle: null,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  };
}

export function loadPlayerStats(): PlayerStats {
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return createDefaultStats();
    const parsed = JSON.parse(raw) as Partial<PlayerStats>;
    return {
      ...createDefaultStats(),
      ...parsed,
      distribution: {
        ...createDefaultStats().distribution,
        ...(parsed.distribution || {}),
      },
    };
  } catch {
    return createDefaultStats();
  }
}

export function recordDailyOutcome(
  puzzleNumber: number,
  won: boolean,
  guessCount: number
): PlayerStats {
  const stats = loadPlayerStats();

  // Prevent double-counting the same daily puzzle
  if (stats.lastCompletedPuzzle === puzzleNumber) {
    return stats;
  }

  stats.gamesPlayed += 1;

  if (won) {
    stats.gamesWon += 1;
    const isConsecutive =
      stats.lastCompletedPuzzle === null ||
      stats.lastCompletedPuzzle === puzzleNumber - 1;
    stats.currentStreak = isConsecutive ? stats.currentStreak + 1 : 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

    const bucket = Math.min(6, Math.max(1, guessCount)) as 1 | 2 | 3 | 4 | 5 | 6;
    stats.distribution[bucket] = (stats.distribution[bucket] || 0) + 1;
  } else {
    stats.currentStreak = 0;
  }

  stats.lastCompletedPuzzle = puzzleNumber;

  try {
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors
  }

  return stats;
}
