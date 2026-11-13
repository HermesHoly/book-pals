import type { GuessComparisonResult } from "./comparison.js";

export type GameStatus = "IN_PROGRESS" | "WON" | "LOST";

export interface DailyBoardState {
  puzzleNumber: number;
  dateKey: string; // YYYY-MM-DD in user's local timezone
  guesses: GuessComparisonResult[];
  gameStatus: GameStatus;
  authorHintLetter: string | null;
  revealedAnswer: GuessComparisonResult["revealedAnswer"] | null;
  updatedAt: string;
}

// Launch epoch: November 13, 2026 (local midnight -> Puzzle #1)
const LAUNCH_YEAR = 2026;
const LAUNCH_MONTH_INDEX = 10; // 0-indexed (10 = November)
const LAUNCH_DAY = 13;
const MS_PER_DAY = 86_400_000;

const STORAGE_KEY_DAILY = "bookpals_daily_state_v1";

export function getLocalDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayPuzzleNumber(now = new Date()): number {
  const localMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const epochMidnight = new Date(
    LAUNCH_YEAR,
    LAUNCH_MONTH_INDEX,
    LAUNCH_DAY
  ).getTime();

  const diffDays = Math.floor((localMidnight - epochMidnight) / MS_PER_DAY);
  return Math.max(1, diffDays + 1);
}

export function getTimeUntilNextMidnight(now = new Date()): {
  hours: string;
  minutes: string;
  seconds: string;
  totalMs: number;
} {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  ).getTime();

  const totalMs = Math.max(0, nextMidnight - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return { hours, minutes, seconds, totalMs };
}

export function loadDailyState(todayPuzzleNumber: number): DailyBoardState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_DAILY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DailyBoardState;
    if (parsed.puzzleNumber !== todayPuzzleNumber) {
      return null; // New calendar day -> start fresh daily board
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDailyState(state: DailyBoardState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(state));
  } catch {
    // Ignore quota/private-mode storage errors
  }
}
