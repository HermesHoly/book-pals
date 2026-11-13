import type { GuessComparisonResult } from "./comparison.js";
import type { GameStatus } from "./storage.js";

export interface ShareOptions {
  puzzleNumber: number;
  guesses: GuessComparisonResult[];
  gameStatus: GameStatus;
  usedHint: boolean;
  highContrast?: boolean;
  shareUrl?: string;
}

export function buildShareText(opts: ShareOptions): string {
  const {
    puzzleNumber,
    guesses,
    gameStatus,
    usedHint,
    highContrast = false,
    shareUrl = typeof window !== "undefined" ? window.location.origin : "https://book-pals.pages.dev",
  } = opts;

  const exactSquare = highContrast ? "🟦" : "🟩";
  const closeSquare = highContrast ? "🟧" : "🟨";
  const missSquare = "⬛";

  const scoreLabel =
    gameStatus === "WON" ? `${guesses.length}/6` : "X/6";
  const hintTag = usedHint ? " 💡" : "";

  const rows = guesses.map((g) => {
    const ev = g.evaluation;

    // 1. Year (color + direction)
    const yearCell =
      ev.year.status === "exact"
        ? exactSquare
        : ev.year.status === "close"
        ? `${closeSquare}${ev.year.direction === "up" ? "⬆️" : "⬇️"}`
        : `${missSquare}${ev.year.direction === "up" ? "⬆️" : "⬇️"}`;

    // 2. Pages (color + direction)
    const pagesCell =
      ev.pages.status === "exact"
        ? exactSquare
        : ev.pages.status === "close"
        ? `${closeSquare}${ev.pages.direction === "up" ? "⬆️" : "⬇️"}`
        : `${missSquare}${ev.pages.direction === "up" ? "⬆️" : "⬇️"}`;

    // 3. Genre
    const genreCell =
      ev.genre.status === "exact"
        ? exactSquare
        : ev.genre.status === "partial"
        ? closeSquare
        : missSquare;

    // 4. Author Country
    const countryCell =
      ev.country.status === "exact" ? exactSquare : missSquare;

    // 5. Series Status
    const seriesCell =
      ev.series.status === "exact" ? exactSquare : missSquare;

    return `${yearCell}${pagesCell}${genreCell}${countryCell}${seriesCell}`;
  });

  return [
    `📚 Book Pals #${puzzleNumber} ${scoreLabel}${hintTag}`,
    ...rows,
    shareUrl,
  ].join("\n");
}

export async function shareOrCopyResult(
  text: string
): Promise<"shared" | "copied" | "failed"> {
  // Prefer native mobile share sheet on touch/mobile browsers when available
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Book Pals",
        text,
      });
      return "shared";
    } catch (err) {
      // If user cancelled native share, do not overwrite clipboard; otherwise fall through
      if (err instanceof Error && err.name === "AbortError") {
        return "failed";
      }
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    // Fallback textarea copy for older/restricted contexts
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return "copied";
    } catch {
      return "failed";
    }
  }
}
