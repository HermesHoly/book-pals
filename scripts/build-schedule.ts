import * as fs from "node:fs/promises";
import * as path from "node:path";

interface CuratedBook {
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

export interface LockedDailyAnswer {
  puzzleNumber: number;
  bookId: number;
  openLibraryKey: string;
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

const JSON_INPUT = path.resolve(process.cwd(), "data/curated_365.json");
const CSV_INPUT = path.resolve(process.cwd(), "data/audit_365.csv");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/answers-locked.json");

// Deterministic FNV-1a 32-bit string hash
function hashSeed(secret: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < secret.length; i++) {
    h ^= secret.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Seeded Mulberry32 PRNG
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function loadAuditedBooks(): Promise<CuratedBook[]> {
  const jsonRaw = await fs.readFile(JSON_INPUT, "utf-8");
  const baseBooks: CuratedBook[] = JSON.parse(jsonRaw);
  const byId = new Map<number, CuratedBook>(baseBooks.map((b) => [b.id, b]));

  try {
    const csvRaw = await fs.readFile(CSV_INPUT, "utf-8");
    const lines = csvRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let updatedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const id = Number(cols[0]);
      const existing = byId.get(id);
      if (!existing) continue;

      const title = cols[1].trim();
      const author = cols[2].trim();
      const firstPublishYear = Number(cols[3]);
      const medianPages = Number(cols[4]);
      const primaryGenre = cols[5].trim();
      const secondaryGenres = cols[6]
        ? cols[6].split("|").map((s) => s.trim()).filter(Boolean)
        : [];
      const authorCountry = cols[7].trim();
      const isSeries = cols[8].trim().toLowerCase() === "true";

      if (
        existing.title !== title ||
        existing.author !== author ||
        existing.firstPublishYear !== firstPublishYear ||
        existing.medianPages !== medianPages ||
        existing.primaryGenre !== primaryGenre ||
        existing.authorCountry !== authorCountry ||
        existing.isSeries !== isSeries
      ) {
        updatedCount++;
      }

      byId.set(id, {
        ...existing,
        title,
        author,
        firstPublishYear,
        medianPages,
        primaryGenre,
        secondaryGenres,
        authorCountry,
        isSeries,
      });
    }

    console.log(`[📝 Audit Sync] Applied ${updatedCount} manual CSV edits from ${CSV_INPUT}.`);
  } catch {
    console.log("[ℹ️ Info] No audit CSV edits found; using curated_365.json directly.");
  }

  return Array.from(byId.values());
}

async function run() {
  const secret = process.env.SCHEDULE_SECRET || "book-pals-year-1-dev-secret";
  console.log("[🔐 Week 2 • Day 2] Generating Deterministic 365-Day Schedule...");

  const books = await loadAuditedBooks();
  const rng = createRng(hashSeed(secret));

  // 1. Seeded Fisher-Yates shuffle
  const pool = [...books];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 2. Anti-streak pass: avoid same primaryGenre back-to-back or same author within 14 days
  const scheduled: CuratedBook[] = [];
  const remaining = [...pool];

  while (remaining.length > 0) {
    const prevGenre = scheduled.length > 0 ? scheduled[scheduled.length - 1].primaryGenre : null;
    const recentAuthors = new Set(
      scheduled.slice(-14).map((b) => b.author.toLowerCase())
    );

    let chosenIdx = remaining.findIndex(
      (b) => b.primaryGenre !== prevGenre && !recentAuthors.has(b.author.toLowerCase())
    );

    // Relax genre constraint if only matching genres remain at tail
    if (chosenIdx === -1) {
      chosenIdx = remaining.findIndex((b) => !recentAuthors.has(b.author.toLowerCase()));
    }
    if (chosenIdx === -1) chosenIdx = 0;

    scheduled.push(remaining[chosenIdx]);
    remaining.splice(chosenIdx, 1);
  }

  const lockedAnswers: LockedDailyAnswer[] = scheduled.map((b, idx) => ({
    puzzleNumber: idx + 1,
    bookId: b.id,
    openLibraryKey: b.openLibraryKey,
    title: b.title,
    author: b.author,
    firstPublishYear: b.firstPublishYear,
    medianPages: b.medianPages,
    primaryGenre: b.primaryGenre,
    secondaryGenres: b.secondaryGenres,
    authorCountry: b.authorCountry,
    isSeries: b.isSeries,
    coverId: b.coverId,
  }));

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(lockedAnswers, null, 2), "utf-8");

  console.log(`\n✅ Locked Year 1 Schedule (${lockedAnswers.length} days) -> ${OUTPUT_FILE}`);
  console.log("\n📅 First 7 Days Preview:");
  for (const day of lockedAnswers.slice(0, 7)) {
    console.log(
      `   • Day #${day.puzzleNumber}: "${day.title}" by ${day.author} (${day.firstPublishYear}, ${day.medianPages}p, ${day.primaryGenre}, ${day.authorCountry})`
    );
  }
}

run();
