import * as fs from "node:fs/promises";
import * as path from "node:path";

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  language?: string[];
  cover_i?: number;
  edition_count?: number;
  ratings_count?: number;
  readinglog_count?: number;
}

interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: OpenLibraryDoc[];
}

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

const SEEDS_FILE = path.resolve(process.cwd(), "scripts/seeds.json");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/raw_dump.json");
const USER_AGENT = "BookPalsBot/0.1.0 (contact: test@example.com)";
const RATE_LIMIT_MS = 1100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFromOpenLibrary(query: string, page = 1): Promise<OpenLibraryDoc[]> {
  const fields = [
    "key",
    "title",
    "author_name",
    "first_publish_year",
    "number_of_pages_median",
    "subject",
    "language",
    "cover_i",
    "edition_count",
    "ratings_count",
    "readinglog_count"
  ].join(",");

  const isSubjectQuery = query.startsWith("subject:");
  const limit = isSubjectQuery ? 100 : 10;
  const sortParam = isSubjectQuery ? "&sort=readinglog" : "";
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}&page=${page}${sortParam}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Open Library API responded with ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as OpenLibrarySearchResponse;
  return data.docs || [];
}

function normalizeDoc(doc: OpenLibraryDoc): RawCandidateBook | null {
  if (!doc.key || !doc.title) return null;

  return {
    openLibraryKey: doc.key,
    title: doc.title.trim(),
    author: doc.author_name?.[0]?.trim() || "Unknown Author",
    firstPublishYear: doc.first_publish_year ?? null,
    medianPages: doc.number_of_pages_median ?? null,
    subjects: (doc.subject || []).slice(0, 25),
    languages: doc.language || [],
    coverId: doc.cover_i ?? null,
    popularityScore: (doc.readinglog_count || 0) + (doc.ratings_count || 0) + (doc.edition_count || 0)
  };
}

async function run() {
  console.log(`[🚀 Day 2 Scaling] Starting Open Library Batch Scraper...`);

  const seedRaw = await fs.readFile(SEEDS_FILE, "utf-8");
  const seedQueries: string[] = JSON.parse(seedRaw);

  const cache = new Map<string, RawCandidateBook>();

  try {
    const raw = await fs.readFile(OUTPUT_FILE, "utf-8");
    const list: RawCandidateBook[] = JSON.parse(raw);
    for (const item of list) {
      cache.set(item.openLibraryKey, item);
    }
  } catch {
    // Starting fresh if no dump exists
  }

  console.log(`[📦 State] Loaded ${cache.size} existing records from disk.`);

  for (let i = 0; i < seedQueries.length; i++) {
    const query = seedQueries[i];
    const isSubjectQuery = query.startsWith("subject:");
    const pagesToFetch = isSubjectQuery ? 3 : 1; // Top 300 most-read per subject
    const indexStr = `[${i + 1}/${seedQueries.length}]`;

    for (let page = 1; page <= pagesToFetch; page++) {
      try {
        console.log(`${indexStr} Querying: "${query}" (page ${page}/${pagesToFetch})...`);
        const docs = await fetchFromOpenLibrary(query, page);

        let addedThisPage = 0;
        for (const doc of docs) {
          const candidate = normalizeDoc(doc);
          if (candidate && !cache.has(candidate.openLibraryKey)) {
            cache.set(candidate.openLibraryKey, candidate);
            addedThisPage++;
          }
        }

        console.log(`   ↳ Found ${docs.length} docs (${addedThisPage} new | Total pool: ${cache.size}).`);

        await fs.writeFile(
          OUTPUT_FILE,
          JSON.stringify(Array.from(cache.values()), null, 2),
          "utf-8"
        );

        if (docs.length === 0) break;
      } catch (err) {
        console.error(`   ❌ Failed querying "${query}" p.${page}:`, err instanceof Error ? err.message : err);
      }

      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log(`\n🎉 Batch Ingestion Complete! Total raw pool: ${cache.size} books in ${OUTPUT_FILE}`);
}

run();
