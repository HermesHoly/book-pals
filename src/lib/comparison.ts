export type MatchStatus = "exact" | "close" | "partial" | "miss";
export type Direction = "up" | "down" | "match";

export interface GuessRequestPayload {
  puzzleNumber: number;
  guessId: number;
  turn: number; // 1..6
}

export interface BookAttributes {
  id: number;
  openLibraryKey?: string;
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
      direction: Direction;
    };
    pages: {
      status: "exact" | "close" | "miss";
      direction: Direction;
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
  authorSurnameHint?: string;
  revealedAnswer?: {
    id: number;
    openLibraryKey?: string;
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

  const yearDiff = target.firstPublishYear - guess.firstPublishYear;
  const yearStatus: "exact" | "close" | "miss" =
    yearDiff === 0 ? "exact" : Math.abs(yearDiff) <= 10 ? "close" : "miss";
  const yearDirection: Direction =
    yearDiff === 0 ? "match" : yearDiff > 0 ? "up" : "down";

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

  const guessGenres = new Set([guess.primaryGenre, ...guess.secondaryGenres]);
  const targetGenres = new Set([target.primaryGenre, ...target.secondaryGenres]);
  const hasOverlap = Array.from(guessGenres).some((g) => targetGenres.has(g));

  const genreStatus: "exact" | "partial" | "miss" =
    guess.primaryGenre === target.primaryGenre
      ? "exact"
      : hasOverlap
      ? "partial"
      : "miss";

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

  if (!isCorrect && turn >= 3) {
    result.authorSurnameHint = extractSurnameInitial(target.author);
  }

  if (isCorrect || turn >= 6) {
    result.revealedAnswer = {
      id: target.id,
      openLibraryKey: target.openLibraryKey,
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
