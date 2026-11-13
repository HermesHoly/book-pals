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

const INPUT_FILE = path.resolve(process.cwd(), "data/curated_365.json");
const CSV_FILE = path.resolve(process.cwd(), "data/audit_365.csv");

function escapeCsv(val: string | number | boolean): string {
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function run() {
  console.log("[📋 Week 2 • Day 2] Exporting 365 Answer Pool to CSV for Ground-Truth Audit...");

  const raw = await fs.readFile(INPUT_FILE, "utf-8");
  const books: CuratedBook[] = JSON.parse(raw);

  const headers = [
    "id",
    "title",
    "author",
    "firstPublishYear",
    "medianPages",
    "primaryGenre",
    "secondaryGenres",
    "authorCountry",
    "isSeries",
  ];

  const rows = [headers.join(",")];

  for (const b of books) {
    rows.push(
      [
        escapeCsv(b.id),
        escapeCsv(b.title),
        escapeCsv(b.author),
        escapeCsv(b.firstPublishYear),
        escapeCsv(b.medianPages),
        escapeCsv(b.primaryGenre),
        escapeCsv(b.secondaryGenres.join("|")),
        escapeCsv(b.authorCountry),
        escapeCsv(b.isSeries),
      ].join(",")
    );
  }

  await fs.writeFile(CSV_FILE, rows.join("\n"), "utf-8");
  console.log(`✅ Exported ${books.length} rows -> ${CSV_FILE}`);
  console.log(
    "💡 Tip: You can inspect or edit years/page counts directly in data/audit_365.csv before running npm run build:schedule."
  );
}

run();
