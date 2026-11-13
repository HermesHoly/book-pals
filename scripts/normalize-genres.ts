import * as fs from "node:fs/promises";
import * as path from "node:path";

export type CanonicalGenre =
  | "Sci-Fi"
  | "Fantasy"
  | "Dystopian"
  | "Mystery/Thriller"
  | "Romance"
  | "Historical Fiction"
  | "Horror"
  | "Literary Fiction"
  | "Classics"
  | "Non-Fiction/Biography"
  | "YA"
  | "Adventure"
  | "Satire"
  | "Philosophy";

interface CleanedBook {
  openLibraryKey: string;
  title: string;
  author: string;
  firstPublishYear: number;
  medianPages: number;
  subjects: string[];
  coverId: number | null;
  popularityScore: number;
}

export interface CategorizedBook extends CleanedBook {
  primaryGenre: CanonicalGenre;
  secondaryGenres: CanonicalGenre[];
}

const INPUT_FILE = path.resolve(process.cwd(), "data/cleaned_books.json");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/categorized_books.json");

const GENRE_KEYWORDS: Record<CanonicalGenre, string[]> = {
  "Sci-Fi": [
    "science fiction",
    "sci-fi",
    "space",
    "alien",
    "time travel",
    "cyberpunk",
    "robots",
    "interplanetary",
    "extraterrestrial",
    "artificial intelligence",
    "future",
    "mars",
  ],
  Fantasy: [
    "fantasy",
    "magic",
    "wizards",
    "dragons",
    "elves",
    "fairy tales",
    "mythology",
    "sword and sorcery",
    "middle earth",
    "supernatural",
    "witchcraft",
  ],
  Dystopian: [
    "dystopia",
    "dystopian",
    "totalitarianism",
    "post-apocalyptic",
    "apocalyptic",
    "utopias",
    "surveillance",
    "authoritarianism",
    "oppression",
  ],
  "Mystery/Thriller": [
    "mystery",
    "detective",
    "thriller",
    "suspense",
    "crime",
    "murder",
    "espionage",
    "spy",
    "police",
    "investigation",
    "noir",
    "whodunit",
  ],
  Romance: [
    "romance",
    "love stories",
    "courtship",
    "marriage",
    "relationships",
    "regency",
    "romantic",
    "lovers",
  ],
  "Historical Fiction": [
    "historical fiction",
    "world war",
    "civil war",
    "victorian",
    "medieval",
    "19th century",
    "18th century",
    "ancient",
    "french revolution",
    "historical",
    "history",
  ],
  Horror: [
    "horror",
    "vampires",
    "ghosts",
    "gothic",
    "monsters",
    "haunted",
    "occult",
    "zombies",
    "werewolves",
    "terror",
    "macabre",
  ],
  "Literary Fiction": [
    "literary fiction",
    "psychological fiction",
    "domestic fiction",
    "family",
    "coming of age",
    "bildungsroman",
    "human condition",
    "modernism",
    "contemporary fiction",
    "social life and customs",
  ],
  Classics: [
    "classic literature",
    "classics",
    "world literature",
    "english literature",
    "american literature",
    "french literature",
    "russian literature",
    "canon",
    "epic poetry",
  ],
  "Non-Fiction/Biography": [
    "biography",
    "autobiography",
    "memoir",
    "nonfiction",
    "non-fiction",
    "essays",
    "true crime",
    "journalism",
    "science",
    "psychology",
    "economics",
    "self-help",
  ],
  YA: [
    "young adult",
    "juvenile fiction",
    "teenagers",
    "adolescence",
    "high school",
    "coming-of-age",
    "children's",
    "youth",
  ],
  Adventure: [
    "adventure",
    "action & adventure",
    "voyages and travels",
    "survival",
    "pirates",
    "exploration",
    "expeditions",
    "sea stories",
    "westerns",
  ],
  Satire: [
    "satire",
    "humorous stories",
    "parody",
    "dark humor",
    "black humor",
    "irony",
    "political satire",
    "comedy",
  ],
  Philosophy: [
    "philosophy",
    "existentialism",
    "ethics",
    "metaphysics",
    "stoicism",
    "political philosophy",
    "morality",
    "absurdism",
    "nihilism",
    "religion",
  ],
};

// Broad buckets get slightly lower weight so specific genres (e.g. Sci-Fi, Horror) win ties
const SPECIFICITY_WEIGHT: Record<CanonicalGenre, number> = {
  Dystopian: 1.4,
  Horror: 1.3,
  "Sci-Fi": 1.25,
  Fantasy: 1.25,
  "Mystery/Thriller": 1.25,
  Satire: 1.25,
  Philosophy: 1.25,
  Romance: 1.2,
  "Non-Fiction/Biography": 1.2,
  YA: 1.15,
  Adventure: 1.15,
  "Historical Fiction": 1.1,
  "Literary Fiction": 1.0,
  Classics: 0.95,
};

function classifyBook(book: CleanedBook): {
  primaryGenre: CanonicalGenre;
  secondaryGenres: CanonicalGenre[];
} {
  const scores = new Map<CanonicalGenre, number>();
  const normalizedSubjects = book.subjects.map((s) => s.toLowerCase());

  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS) as [
    CanonicalGenre,
    string[]
  ][]) {
    let rawMatches = 0;

    for (const subject of normalizedSubjects) {
      for (const kw of keywords) {
        if (subject === kw) {
          rawMatches += 2; // Exact subject match gets double points
        } else if (subject.includes(kw)) {
          rawMatches += 1;
        }
      }
    }

    if (rawMatches > 0) {
      scores.set(genre, rawMatches * SPECIFICITY_WEIGHT[genre]);
    }
  }

  // Era boost: pre-1928 works with literary/general tags are strong Classics candidates
  if (book.firstPublishYear <= 1928) {
    const currentClassics = scores.get("Classics") || 0;
    scores.set("Classics", currentClassics + 1.5);
  }

  // Fallback if no keywords matched at all
  if (scores.size === 0) {
    return {
      primaryGenre: book.firstPublishYear <= 1950 ? "Classics" : "Literary Fiction",
      secondaryGenres: [],
    };
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const primaryGenre = ranked[0][0];
  const secondaryGenres = ranked
    .slice(1, 3)
    .filter(([, score]) => score >= 1.0)
    .map(([genre]) => genre);

  return { primaryGenre, secondaryGenres };
}

async function run() {
  console.log("[🏷️ Day 3] Starting Genre Clustering Engine...");

  const rawText = await fs.readFile(INPUT_FILE, "utf-8");
  const books: CleanedBook[] = JSON.parse(rawText);
  console.log(`[📦 Input] Loaded ${books.length} cleaned books.`);

  const distribution = new Map<CanonicalGenre, number>();
  const categorized: CategorizedBook[] = books.map((book) => {
    const { primaryGenre, secondaryGenres } = classifyBook(book);
    distribution.set(primaryGenre, (distribution.get(primaryGenre) || 0) + 1);
    return {
      ...book,
      primaryGenre,
      secondaryGenres,
    };
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(categorized, null, 2), "utf-8");

  console.log("\n📊 Primary Genre Distribution (across 14 canonical buckets):");
  const sortedDist = Array.from(distribution.entries()).sort((a, b) => b[1] - a[1]);
  for (const [genre, count] of sortedDist) {
    const pct = ((count / categorized.length) * 100).toFixed(1);
    console.log(`   • ${genre.padEnd(22)} ${String(count).padStart(4)} (${pct}%)`);
  }

  console.log("\n🔎 Sample Classifications (Top 5 Popularity):");
  for (const sample of categorized.slice(0, 5)) {
    const sec = sample.secondaryGenres.length > 0 ? sample.secondaryGenres.join(", ") : "None";
    console.log(`   • "${sample.title}" → Primary: [${sample.primaryGenre}] | Secondary: [${sec}]`);
  }

  console.log(`\n✅ Categorized pool saved: ${categorized.length} books -> ${OUTPUT_FILE}`);
}

run();
