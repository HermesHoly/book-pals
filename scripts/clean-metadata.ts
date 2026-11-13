import * as fs from "node:fs/promises";
import * as path from "node:path";

interface RawCandidateBook {
  openLibraryKey: string;
  title: string;
  author: string;
  firstPublishYear: number | null;
  medianPages: number | null;
  subjects: string[];
  languages: string[];
  coverId: number | null;
  popularityScore: number;
}

export interface CleanedBook {
  openLibraryKey: string;
  title: string;
  author: string;
  firstPublishYear: number;
  medianPages: number;
  subjects: string[];
  coverId: number | null;
  popularityScore: number;
}

const INPUT_FILE = path.resolve(process.cwd(), "data/raw_dump.json");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/cleaned_books.json");

const MIN_PAGES = 50;
const MAX_PAGES = 2000;
const MIN_YEAR = 1450;
const MAX_YEAR = new Date().getFullYear();

function cleanTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s+/g, " ")
    .replace(/\s*\((?:Illustrated|Unabridged|Reprint|Classic|Edition|Annotated|Deluxe)[^)]*\)$/i, "")
    .trim();
}

function normalizeDedupeKey(title: string, author: string): string {
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normAuthor = author.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${normTitle}::${normAuthor}`;
}

async function run() {
  console.log("[🧹 Day 2] Starting Metadata Cleansing & Filtering...");

  const rawText = await fs.readFile(INPUT_FILE, "utf-8");
  const rawBooks: RawCandidateBook[] = JSON.parse(rawText);
  console.log(`[📦 Input] Loaded ${rawBooks.length} raw candidate records.`);

  const stats = {
    missingCoreFields: 0,
    invalidYear: 0,
    pageOutlier: 0,
    nonEnglishOrNoSubjects: 0,
    duplicatesMerged: 0,
  };

  const deduped = new Map<string, CleanedBook>();

  for (const book of rawBooks) {
    // 1. Check required fields
    if (
      !book.title ||
      !book.author ||
      book.author === "Unknown Author" ||
      book.firstPublishYear === null ||
      book.medianPages === null
    ) {
      stats.missingCoreFields++;
      continue;
    }

    // 2. Validate publication year bounds
    if (book.firstPublishYear < MIN_YEAR || book.firstPublishYear > MAX_YEAR) {
      stats.invalidYear++;
      continue;
    }

    // 3. Discard page count outliers (<50 or >2000)
    if (book.medianPages < MIN_PAGES || book.medianPages > MAX_PAGES) {
      stats.pageOutlier++;
      continue;
    }

    // 4. Require English edition & at least 1 subject tag for Day 3 genre mapping
    const hasEnglish = book.languages.length === 0 || book.languages.includes("eng");
    const cleanedSubjects = book.subjects
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 60);

    if (!hasEnglish || cleanedSubjects.length === 0) {
      stats.nonEnglishOrNoSubjects++;
      continue;
    }

    const sanitizedTitle = cleanTitle(book.title);
    const cleaned: CleanedBook = {
      openLibraryKey: book.openLibraryKey,
      title: sanitizedTitle,
      author: book.author.trim(),
      firstPublishYear: book.firstPublishYear,
      medianPages: Math.round(book.medianPages),
      subjects: Array.from(new Set(cleanedSubjects)),
      coverId: book.coverId,
      popularityScore: book.popularityScore,
    };

    // 5. Deduplicate same title + author (keep most popular work entry)
    const dedupeKey = normalizeDedupeKey(cleaned.title, cleaned.author);
    const existing = deduped.get(dedupeKey);

    if (existing) {
      stats.duplicatesMerged++;
      if (cleaned.popularityScore > existing.popularityScore) {
        deduped.set(dedupeKey, cleaned);
      }
    } else {
      deduped.set(dedupeKey, cleaned);
    }
  }

  // Sort by popularity descending so the most recognizable books sit at the top
  const finalBooks = Array.from(deduped.values()).sort(
    (a, b) => b.popularityScore - a.popularityScore
  );

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalBooks, null, 2), "utf-8");

  console.log("\n📊 Cleansing Breakdown:");
  console.log(`   • Dropped (missing year/pages/author): ${stats.missingCoreFields}`);
  console.log(`   • Dropped (invalid year):              ${stats.invalidYear}`);
  console.log(`   • Dropped (page outliers <50/>2000):   ${stats.pageOutlier}`);
  console.log(`   • Dropped (non-English/no subjects):   ${stats.nonEnglishOrNoSubjects}`);
  console.log(`   • Merged edition duplicates:           ${stats.duplicatesMerged}`);
  console.log(`\n✅ Clean pool saved: ${finalBooks.length} valid books -> ${OUTPUT_FILE}`);
}

run();
