import * as fs from "node:fs/promises";
import * as path from "node:path";

interface ValidatedBook {
  id: number;
  openLibraryKey: string;
  title: string;
  author: string;
  firstPublishYear: number;
  medianPages: number;
  subjects: string[];
  coverId: number | null;
  popularityScore: number;
  primaryGenre: string;
  secondaryGenres: string[];
  authorCountry: string;
  isSeries: boolean;
}

const INPUT_FILE = path.resolve(process.cwd(), "data/raw_books.json");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/curated_365.json");

const TARGET_COUNT = 365;
const MAX_PER_GENRE = 36; // Prevents one genre from exceeding ~10% of the year
const MAX_PER_AUTHOR = 4; // Keeps daily answers varied across authors
const MIN_GENRE_QUOTA = 12; // Guarantees representation for smaller genres (e.g., Adventure, Satire)

// Exclude study guides, box sets, or companions that sometimes slip into popular lists
const NON_STANDARD_TITLE_RX =
  /\b(?:study guide|summary|analysis|workbook|box set|boxed set|omnibus|complete works|collection|anthology)\b/i;

function getEraBucket(year: number): string {
  if (year < 1900) return "Pre-1900";
  if (year < 1950) return "1900–1949";
  if (year < 1980) return "1950–1979";
  if (year < 2000) return "1980–1999";
  if (year < 2015) return "2000–2014";
  return "2015–Present";
}

function getPageBucket(pages: number): string {
  if (pages < 200) return "Short (<200p)";
  if (pages < 350) return "Medium (200–349p)";
  if (pages < 550) return "Long (350–549p)";
  return "Epic (550p+)";
}

async function run() {
  console.log("[🎯 Week 2 • Day 1] Starting 365 Answer Pool Curation...");

  const rawText = await fs.readFile(INPUT_FILE, "utf-8");
  const allBooks: ValidatedBook[] = JSON.parse(rawText);
  console.log(`[📦 Input] Loaded ${allBooks.length} validated books.`);

  // Filter out compilations/study guides and sort by popularity descending
  const eligible = allBooks
    .filter((b) => !NON_STANDARD_TITLE_RX.test(b.title))
    .sort((a, b) => b.popularityScore - a.popularityScore);

  const selected: ValidatedBook[] = [];
  const selectedIds = new Set<number>();
  const genreCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();

  const canAdd = (book: ValidatedBook, maxGenreCap: number): boolean => {
    if (selectedIds.has(book.id)) return false;
    const gCount = genreCounts.get(book.primaryGenre) || 0;
    const aCount = authorCounts.get(book.author.toLowerCase()) || 0;
    return gCount < maxGenreCap && aCount < MAX_PER_AUTHOR;
  };

  const addBook = (book: ValidatedBook) => {
    selected.push(book);
    selectedIds.add(book.id);
    genreCounts.set(book.primaryGenre, (genreCounts.get(book.primaryGenre) || 0) + 1);
    authorCounts.set(
      book.author.toLowerCase(),
      (authorCounts.get(book.author.toLowerCase()) || 0) + 1
    );
  };

  // Pass 1: Guarantee minimum representation across all 14 genres
  const allGenres = Array.from(new Set(eligible.map((b) => b.primaryGenre)));
  for (const genre of allGenres) {
    const genreCandidates = eligible.filter((b) => b.primaryGenre === genre);
    for (const book of genreCandidates) {
      if ((genreCounts.get(genre) || 0) >= MIN_GENRE_QUOTA) break;
      if (canAdd(book, MAX_PER_GENRE)) {
        addBook(book);
      }
    }
  }

  // Pass 2: Fill remaining slots up to 365 with highest-popularity books respecting genre/author caps
  for (const book of eligible) {
    if (selected.length >= TARGET_COUNT) break;
    if (canAdd(book, MAX_PER_GENRE)) {
      addBook(book);
    }
  }

  // Sort final 365 pool by popularity for easy inspection before Day 2 shuffling
  selected.sort((a, b) => b.popularityScore - a.popularityScore);

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(selected, null, 2), "utf-8");

  // Distribution Diagnostics
  const eraDist = new Map<string, number>();
  const pageDist = new Map<string, number>();

  for (const b of selected) {
    const era = getEraBucket(b.firstPublishYear);
    const pageTier = getPageBucket(b.medianPages);
    eraDist.set(era, (eraDist.get(era) || 0) + 1);
    pageDist.set(pageTier, (pageDist.get(pageTier) || 0) + 1);
  }

  console.log(`\n✅ Selected ${selected.length} daily answer candidates -> ${OUTPUT_FILE}`);

  console.log("\n📊 Genre Balance (365 Pool):");
  for (const [genre, count] of Array.from(genreCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   • ${genre.padEnd(22)} ${String(count).padStart(3)} books`);
  }

  console.log("\n🕰️ Era Distribution:");
  for (const era of ["Pre-1900", "1900–1949", "1950–1979", "1980–1999", "2000–2014", "2015–Present"]) {
    console.log(`   • ${era.padEnd(16)} ${String(eraDist.get(era) || 0).padStart(3)} books`);
  }

  console.log("\n📄 Page Count Distribution:");
  for (const tier of ["Short (<200p)", "Medium (200–349p)", "Long (350–549p)", "Epic (550p+)"]) {
    console.log(`   • ${tier.padEnd(20)} ${String(pageDist.get(tier) || 0).padStart(3)} books`);
  }

  console.log("\n🏆 Top 10 Most Popular Answers in Pool:");
  for (const b of selected.slice(0, 10)) {
    console.log(
      `   • #${b.id} "${b.title}" (${b.author}, ${b.firstPublishYear}) — ${b.medianPages}p | ${b.primaryGenre} | ${b.authorCountry}`
    );
  }
}

run();
