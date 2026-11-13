export type MatchStatus = "exact" | "close" | "partial" | "miss";
export type Direction = "up" | "down" | "match";

export interface GuessRequestPayload {
  puzzleNumber: number;
  guessId: number;
  turn: number; // 1..6
}

export interface BookAttributes {
  id: number;
  title: string;
  author: string;
  firstPublishYear: number;
  medianPages: number;
  primaryGenre: string;
  secondaryGenres: string[];
  authorCountry: string;
  isSeries: boolean;
  coverId: number | null;
}

export interface GuessComparisonResult {
  guess: {
    id: number;
    title: string;
    author: string;
    firstPublishYear: number;
    medianPages: number;
    primaryGenre: string;
    authorCountry: string;
    isSeries: boolean;
  };
  evaluation: {
    isCorrect: boolean;
    year: {
      status: "exact" | "close" | "miss";
      direction: Direction; // "up" = target is newer (higher year), "down" = target is older
    };
    pages: {
      status: "exact" | "close" | "miss";
      direction: Direction; // "up" = target has more pages, "down" = target has fewer pages
    };
    genre: {
      status: "exact" | "partial" | "miss";
    };
    country: {
      status: "exact" | "miss";
    };
    series: {
      status: "exact" | "miss";
    };
  };
  // Revealed automatically when turn >= 3 and guess is incorrect
  authorSurnameHint?: string;
  // Revealed ONLY when isCorrect === true or turn >= 6
  revealedAnswer?: {
    id: number;
    title: string;
    author: string;
    firstPublishYear: number;
    medianPages: number;
    primaryGenre: string;
    authorCountry: string;
    isSeries: boolean;
    coverId: number | null;
  };
}

export function extractSurnameInitial(author: string): string {
  const cleaned = author.replace(/\(.*?\)/g, "").trim();
  const parts = cleaned.split(/\s+/);
  const surname = parts[parts.length - 1] || cleaned;
  return surname.charAt(0).toUpperCase();
}

export function evaluateBookGuess(
  guess: BookAttributes,
  target: BookAttributes,
  turn: number
): GuessComparisonResult {
  const isCorrect = guess.id === target.id;

  // 1. Publication Year (±10 years = close)
  const yearDiff = target.firstPublishYear - guess.firstPublishYear;
  const yearStatus: "exact" | "close" | "miss" =
    yearDiff === 0 ? "exact" : Math.abs(yearDiff) <= 10 ? "close" : "miss";
  const yearDirection: Direction =
    yearDiff === 0 ? "match" : yearDiff > 0 ? "up" : "down";

  // 2. Page Count (±15% of target = close)
  const pageDiff = target.medianPages - guess.medianPages;
  const closePageMargin = Math.max(15, Math.round(target.medianPages * 0.15));
  const pagesStatus: "exact" | "close" | "miss" =
    pageDiff === 0
      ? "exact"
      : Math.abs(pageDiff) <= closePageMargin
      ? "close"
      : "miss";
  const pagesDirection: Direction =
    pageDiff === 0 ? "match" : pageDiff > 0 ? "up" : "down";

  // 3. Genre (exact primary match, or partial overlap across primary/secondary genres)
  const guessGenres = new Set([guess.primaryGenre, ...guess.secondaryGenres]);
  const targetGenres = new Set([target.primaryGenre, ...target.secondaryGenres]);
  const hasOverlap = Array.from(guessGenres).some((g) => targetGenres.has(g));

  const genreStatus: "exact" | "partial" | "miss" =
    guess.primaryGenre === target.primaryGenre
      ? "exact"
      : hasOverlap
      ? "partial"
      : "miss";

  // 4. Author Country & Series Status
  const countryStatus: "exact" | "miss" =
    guess.authorCountry.toLowerCase() === target.authorCountry.toLowerCase()
      ? "exact"
      : "miss";

  const seriesStatus: "exact" | "miss" =
    guess.isSeries === target.isSeries ? "exact" : "miss";

  const result: GuessComparisonResult = {
    guess: {
      id: guess.id,
      title: guess.title,
      author: guess.author,
      firstPublishYear: guess.firstPublishYear,
      medianPages: guess.medianPages,
      primaryGenre: guess.primaryGenre,
      authorCountry: guess.authorCountry,
      isSeries: guess.isSeries,
    },
    evaluation: {
      isCorrect,
      year: { status: yearStatus, direction: yearDirection },
      pages: { status: pagesStatus, direction: pagesDirection },
      genre: { status: genreStatus },
      country: { status: countryStatus },
      series: { status: seriesStatus },
    },
  };

  // Unlock author surname first letter after 3rd failed guess
  if (!isCorrect && turn >= 3) {
    result.authorSurnameHint = extractSurnameInitial(target.author);
  }

  // Only expose full answer payload on win or final 6th guess
  if (isCorrect || turn >= 6) {
    result.revealedAnswer = {
      id: target.id,
      title: target.title,
      author: target.author,
      firstPublishYear: target.firstPublishYear,
      medianPages: target.medianPages,
      primaryGenre: target.primaryGenre,
      authorCountry: target.authorCountry,
      isSeries: target.isSeries,
      coverId: target.coverId,
    };
  }

  return result;
}
