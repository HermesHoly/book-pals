import * as fs from "node:fs/promises";
import * as path from "node:path";
import { gzipSync } from "node:zlib";

interface ValidatedBook {
  id: number;
  title: string;
  author: string;
  firstPublishYear: number;
}

// Compact client tuple: [id, title, author, year]
export type PublicBookTuple = [
  id: number,
  title: string,
  author: string,
  year: number
];

const RAW_BOOKS_FILE = path.resolve(process.cwd(), "data/raw_books.json");
const LOCKED_ANSWERS_FILE = path.resolve(process.cwd(), "data/answers-locked.json");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/books-public.json");

async function run() {
  console.log("[⚡ Week 2 • Day 3] Building Compressed Autocomplete Payload...");

  const rawText = await fs.readFile(RAW_BOOKS_FILE, "utf-8");
  const allBooks: ValidatedBook[] = JSON.parse(rawText);

  // Sync any manual title/author/year fixes from answers-locked.json
  const overrideMap = new Map<number, { title: string; author: string; year: number }>();
  try {
    const lockedRaw = await fs.readFile(LOCKED_ANSWERS_FILE, "utf-8");
    const lockedList: Array<{
      bookId: number;
      title: string;
      author: string;
      firstPublishYear: number;
    }> = JSON.parse(lockedRaw);

    for (const item of lockedList) {
      overrideMap.set(item.bookId, {
        title: item.title,
        author: item.author,
        year: item.firstPublishYear,
      });
    }
  } catch {
    // Optional override if answers-locked.json hasn't been generated yet
  }

  const tuples: PublicBookTuple[] = allBooks.map((b) => {
    const override = overrideMap.get(b.id);
    return [
      b.id,
      override ? override.title : b.title,
      override ? override.author : b.author,
      override ? override.year : b.firstPublishYear,
    ];
  });

  // Minified JSON (no whitespace) for smallest possible bundle size
  const minifiedJson = JSON.stringify(tuples);
  await fs.writeFile(OUTPUT_FILE, minifiedJson, "utf-8");

  const rawBytes = Buffer.byteLength(minifiedJson, "utf-8");
  const gzipBytes = gzipSync(Buffer.from(minifiedJson, "utf-8")).length;

  const rawKb = (rawBytes / 1024).toFixed(2);
  const gzipKb = (gzipBytes / 1024).toFixed(2);

  console.log(`\n✅ Exported ${tuples.length} public search tuples -> ${OUTPUT_FILE}`);
  console.log(`📦 Payload Size Check:`);
  console.log(`   • Minified Raw Size: ${rawKb} KB (${rawBytes.toLocaleString()} bytes)`);
  console.log(`   • Gzipped Size:      ${gzipKb} KB (${gzipBytes.toLocaleString()} bytes) [Target: < 250 KB]`);
  console.log(`\n🔎 Sample Tuples (First 5):`);
  for (const t of tuples.slice(0, 5)) {
    console.log(`   • ${JSON.stringify(t)}`);
  }
}

run();
