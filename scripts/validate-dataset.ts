import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";

const CANONICAL_GENRES = [
  "Sci-Fi",
  "Fantasy",
  "Dystopian",
  "Mystery/Thriller",
  "Romance",
  "Historical Fiction",
  "Horror",
  "Literary Fiction",
  "Classics",
  "Non-Fiction/Biography",
  "YA",
  "Adventure",
  "Satire",
  "Philosophy",
] as const;

const CanonicalGenreSchema = z.enum(CANONICAL_GENRES);

const EnrichedBookSchema = z.object({
  openLibraryKey: z.string().startsWith("/works/"),
  title: z.string().min(1),
  author: z.string().min(1),
  firstPublishYear: z.number().int().min(1450).max(new Date().getFullYear()),
  medianPages: z.number().int().min(50).max(2000),
  subjects: z.array(z.string()).min(1),
  coverId: z.number().int().nullable(),
  popularityScore: z.number().nonnegative(),
  primaryGenre: CanonicalGenreSchema,
  secondaryGenres: z.array(CanonicalGenreSchema).max(2),
  authorCountry: z.string().min(2).refine((val) => val !== "Unknown", {
    message: "Author country must be resolved (not Unknown)",
  }),
  isSeries: z.boolean(),
});

const ValidatedBookSchema = EnrichedBookSchema.extend({
  id: z.number().int().positive(),
});

export type ValidatedBook = z.infer<typeof ValidatedBookSchema>;

const INPUT_FILE = path.resolve(process.cwd(), "data/enriched_books.json");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/raw_books.json");

async function run() {
  console.log("[✅ Day 5] Starting Zod Schema Validation Harness...");

  const rawText = await fs.readFile(INPUT_FILE, "utf-8");
  const candidates: unknown[] = JSON.parse(rawText);
  console.log(`[📦 Input] Loaded ${candidates.length} enriched records.`);

  let droppedUnknownCountry = 0;
  let failedSchemaCount = 0;
  const validPreId: z.infer<typeof EnrichedBookSchema>[] = [];

  for (const item of candidates) {
    const record = item as { authorCountry?: string };
    if (record.authorCountry === "Unknown") {
      droppedUnknownCountry++;
      continue;
    }

    const parsed = EnrichedBookSchema.safeParse(item);
    if (!parsed.success) {
      failedSchemaCount++;
      continue;
    }

    validPreId.push(parsed.data);
  }

  // Sort by popularity descending and assign deterministic sequential IDs (1..N)
  validPreId.sort((a, b) => b.popularityScore - a.popularityScore);

  const finalValidatedBooks: ValidatedBook[] = validPreId.map((book, idx) =>
    ValidatedBookSchema.parse({
      id: idx + 1,
      ...book,
    })
  );

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(finalValidatedBooks, null, 2),
    "utf-8"
  );

  const seriesCount = finalValidatedBooks.filter((b) => b.isSeries).length;
  const uniqueGenres = new Set(finalValidatedBooks.map((b) => b.primaryGenre)).size;
  const uniqueCountries = new Set(finalValidatedBooks.map((b) => b.authorCountry)).size;

  console.log("\n📊 Final Week 1 Validation Report:");
  console.log(`   • Dropped (unresolved "Unknown" country): ${droppedUnknownCountry}`);
  console.log(`   • Dropped (Zod schema validation errors): ${failedSchemaCount}`);
  console.log(`   • Validated & ID-indexed books:           ${finalValidatedBooks.length}`);
  console.log(`   • Genre coverage:                         ${uniqueGenres}/14 canonical genres`);
  console.log(`   • Distinct author countries:              ${uniqueCountries}`);
  console.log(`   • Series vs. Standalone split:            ${seriesCount} series / ${finalValidatedBooks.length - seriesCount} standalone`);
  console.log(`\n🎉 Week 1 Complete! Master dataset exported -> ${OUTPUT_FILE}`);
}

run();
