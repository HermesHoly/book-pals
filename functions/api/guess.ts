import lockedAnswers from "../../data/answers-locked.json";
import rawBooks from "../../data/raw_books.json";
import {
  BookAttributes,
  evaluateBookGuess,
  GuessRequestPayload,
} from "../../src/lib/comparison";

interface LockedAnswerRecord {
  puzzleNumber: number;
  bookId: number;
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

const booksById = new Map<number, BookAttributes>(
  (rawBooks as BookAttributes[]).map((b) => [b.id, b])
);

const answersByPuzzle = new Map<number, BookAttributes>(
  (lockedAnswers as LockedAnswerRecord[]).map((a) => [
    a.puzzleNumber,
    {
      id: a.bookId,
      title: a.title,
      author: a.author,
      firstPublishYear: a.firstPublishYear,
      medianPages: a.medianPages,
      primaryGenre: a.primaryGenre,
      secondaryGenres: a.secondaryGenres,
      authorCountry: a.authorCountry,
      isSeries: a.isSeries,
      coverId: a.coverId,
    },
  ])
);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const onRequestPost: PagesFunction = async (context) => {
  let payload: Partial<GuessRequestPayload>;

  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const puzzleNumber = Number(payload.puzzleNumber);
  const guessId = Number(payload.guessId);
  const turn = Number(payload.turn ?? 1);

  if (!Number.isInteger(puzzleNumber) || puzzleNumber < 1) {
    return jsonResponse({ error: "Invalid puzzleNumber." }, 400);
  }
  if (!Number.isInteger(guessId) || guessId < 1) {
    return jsonResponse({ error: "Invalid guessId." }, 400);
  }
  if (!Number.isInteger(turn) || turn < 1 || turn > 6) {
    return jsonResponse({ error: "Turn must be between 1 and 6." }, 400);
  }

  // Wrap puzzleNumber seamlessly across the 365-day Year 1 schedule
  const totalPuzzles = answersByPuzzle.size;
  const normalizedPuzzle = ((puzzleNumber - 1) % totalPuzzles) + 1;

  const targetBook = answersByPuzzle.get(normalizedPuzzle);
  if (!targetBook) {
    return jsonResponse({ error: "Puzzle not found." }, 404);
  }

  const guessedBook = booksById.get(guessId);
  if (!guessedBook) {
    return jsonResponse({ error: "Guessed book ID not found." }, 404);
  }

  const result = evaluateBookGuess(guessedBook, targetBook, turn);
  return jsonResponse(result, 200);
};
