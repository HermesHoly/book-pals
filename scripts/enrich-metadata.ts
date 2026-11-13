import * as fs from "node:fs/promises";
import * as path from "node:path";

interface CategorizedBook {
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
}

export interface EnrichedBook extends CategorizedBook {
  authorCountry: string;
  isSeries: boolean;
}

const INPUT_FILE = path.resolve(process.cwd(), "data/categorized_books.json");
const CACHE_FILE = path.resolve(process.cwd(), "data/author_countries.json");
const OUTPUT_FILE = path.resolve(process.cwd(), "data/enriched_books.json");

const USER_AGENT = "BookPalsBot/0.1.0 (contact: test@example.com)";
const SPARQL_BATCH_SIZE = 50;
const RATE_LIMIT_MS = 1100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fast ground-truth map for major authors (avoids ambiguity like dual/historical citizenships)
const KNOWN_AUTHOR_COUNTRIES: Record<string, string> = {
  "jane austen": "United Kingdom",
  "george orwell": "United Kingdom",
  "j. k. rowling": "United Kingdom",
  "j.k. rowling": "United Kingdom",
  "j. r. r. tolkien": "United Kingdom",
  "j.r.r. tolkien": "United Kingdom",
  "charles dickens": "United Kingdom",
  "william shakespeare": "United Kingdom",
  "mary shelley": "United Kingdom",
  "bram stoker": "Ireland",
  "oscar wilde": "Ireland",
  "james joyce": "Ireland",
  "samuel beckett": "Ireland",
  "c. s. lewis": "United Kingdom",
  "agatha christie": "United Kingdom",
  "arthur conan doyle": "United Kingdom",
  "virginia woolf": "United Kingdom",
  "aldous huxley": "United Kingdom",
  "william golding": "United Kingdom",
  "charlotte brontë": "United Kingdom",
  "emily brontë": "United Kingdom",
  "anne brontë": "United Kingdom",
  "thomas hardy": "United Kingdom",
  "george eliot": "United Kingdom",
  "h. g. wells": "United Kingdom",
  "roald dahl": "United Kingdom",
  "neil gaiman": "United Kingdom",
  "terry pratchett": "United Kingdom",
  "kazuo ishiguro": "United Kingdom",
  "ian mcewan": "United Kingdom",
  "salman rushdie": "United Kingdom",
  "zadie smith": "United Kingdom",
  "philip pullman": "United Kingdom",
  "f. scott fitzgerald": "United States",
  "harper lee": "United States",
  "ernest hemingway": "United States",
  "john steinbeck": "United States",
  "mark twain": "United States",
  "herman melville": "United States",
  "nathaniel hawthorne": "United States",
  "edgar allan poe": "United States",
  "j. d. salinger": "United States",
  "ray bradbury": "United States",
  "frank herbert": "United States",
  "isaac asimov": "United States",
  "philip k. dick": "United States",
  "ursula k. le guin": "United States",
  "stephen king": "United States",
  "toni morrison": "United States",
  "cormac mccarthy": "United States",
  "kurt vonnegut": "United States",
  "joseph heller": "United States",
  "william faulkner": "United States",
  "truman capote": "United States",
  "sylvia plath": "United States",
  "maya angelou": "United States",
  "colleen hoover": "United States",
  "suzanne collins": "United States",
  "rick riordan": "United States",
  "george r. r. martin": "United States",
  "brandon sanderson": "United States",
  "robert greene": "United States",
  "dale carnegie": "United States",
  "fyodor dostoevsky": "Russia",
  "leo tolstoy": "Russia",
  "anton chekhov": "Russia",
  "vladimir nabokov": "Russia",
  "mikhail bulgakov": "Russia",
  "aleksandr solzhenitsyn": "Russia",
  "alexander pushkin": "Russia",
  "victor hugo": "France",
  "alexandre dumas": "France",
  "albert camus": "France",
  "jean-paul sartre": "France",
  "gustave flaubert": "France",
  "marcel proust": "France",
  "antoine de saint-exupéry": "France",
  "jules verne": "France",
  "voltaire": "France",
  "honoré de balzac": "France",
  "gabriel garcía márquez": "Colombia",
  "isabel allende": "Chile",
  "pablo neruda": "Chile",
  "jorge luis borges": "Argentina",
  "julio cortázar": "Argentina",
  "paulo coelho": "Brazil",
  "miguel de cervantes": "Spain",
  "carlos ruiz zafón": "Spain",
  "franz kafka": "Czech Republic",
  "milan kundera": "Czech Republic",
  "hermann hesse": "Germany",
  "thomas mann": "Germany",
  "johann wolfgang von goethe": "Germany",
  "erich maria remarque": "Germany",
  "friedrich nietzsche": "Germany",
  "umberto eco": "Italy",
  "italo calvino": "Italy",
  "dante alighieri": "Italy",
  "elena ferrante": "Italy",
  "haruki murakami": "Japan",
  "yukio mishima": "Japan",
  "osamu dazai": "Japan",
  "margaret atwood": "Canada",
  "alice munro": "Canada",
  "yann martel": "Canada",
  "l. m. montgomery": "Canada",
  "chinua achebe": "Nigeria",
  "chimamanda ngozi adichie": "Nigeria",
  "khaled hosseini": "Afghanistan",
  "homer": "Greece",
  "nikos kazantzakis": "Greece",
  "henrik ibsen": "Norway",
  "stieg larsson": "Sweden",
  "astrid lindgren": "Sweden",
  "fredrik backman": "Sweden",
  "hans christian andersen": "Denmark",
  "andrzej sapkowski": "Poland",
  "olga tokarczuk": "Poland",
};

function normalizeCountryName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  if (
    lower.includes("united states") ||
    lower === "usa" ||
    lower === "u.s." ||
    lower === "america"
  ) {
    return "United States";
  }
  if (
    lower.includes("united kingdom") ||
    lower === "england" ||
    lower === "scotland" ||
    lower === "wales" ||
    lower === "great britain" ||
    lower === "britain" ||
    lower === "uk"
  ) {
    return "United Kingdom";
  }
  if (
    lower.includes("russia") ||
    lower.includes("soviet union") ||
    lower.includes("russian empire")
  ) {
    return "Russia";
  }
  if (lower.includes("germany") || lower.includes("weimar") || lower.includes("prussia")) {
    return "Germany";
  }
  if (lower.includes("france")) return "France";
  if (lower.includes("ireland") || lower.includes("irish free state")) return "Ireland";
  if (lower.includes("canada")) return "Canada";
  if (lower.includes("australia")) return "Australia";
  if (lower.includes("japan")) return "Japan";
  if (lower.includes("china")) return "China";
  if (lower.includes("india")) return "India";
  if (lower.includes("italy")) return "Italy";
  if (lower.includes("spain")) return "Spain";
  if (lower.includes("czechoslovakia") || lower.includes("czech")) return "Czech Republic";
  if (lower.includes("austria")) return "Austria";
  if (lower.includes("poland")) return "Poland";
  if (lower.includes("sweden")) return "Sweden";
  if (lower.includes("norway")) return "Norway";
  if (lower.includes("denmark")) return "Denmark";
  if (lower.includes("netherlands") || lower === "holland") return "Netherlands";
  if (lower.includes("switzerland")) return "Switzerland";
  if (lower.includes("brazil")) return "Brazil";
  if (lower.includes("argentina")) return "Argentina";
  if (lower.includes("colombia")) return "Colombia";
  if (lower.includes("chile")) return "Chile";
  if (lower.includes("mexico")) return "Mexico";
  if (lower.includes("nigeria")) return "Nigeria";
  if (lower.includes("south africa")) return "South Africa";
  if (lower.includes("new zealand")) return "New Zealand";
  if (lower.includes("greece")) return "Greece";

  return raw.trim();
}

async function queryWikidataBatch(authorNames: string[]): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  if (authorNames.length === 0) return resolved;

  const escapedValues = authorNames
    .map((name) => `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"@en`)
    .join(" ");

  const sparql = `
    SELECT ?authorLabel ?countryLabel WHERE {
      VALUES ?authorLabel { ${escapedValues} }
      ?author rdfs:label ?authorLabel ;
              wdt:P31 wd:Q5 ;
              wdt:P27 ?country .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/sparql-results+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL error ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    results: {
      bindings: Array<{
        authorLabel?: { value: string };
        countryLabel?: { value: string };
      }>;
    };
  };

  for (const row of data.results.bindings) {
    const author = row.authorLabel?.value;
    const country = row.countryLabel?.value;
    if (author && country && !resolved[author.toLowerCase()]) {
      resolved[author.toLowerCase()] = normalizeCountryName(country);
    }
  }

  return resolved;
}

const SERIES_TITLE_PATTERNS: RegExp[] = [
  /\bbook\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|i|ii|iii|iv|v)\b/i,
  /\bvol(?:ume)?\.?\s*(?:\d+|i|ii|iii|iv|v)\b/i,
  /\bpart\s+(?:\d+|one|two|three|i|ii|iii)\b/i,
  /#\d+\b/,
  /\b(?:trilogy|tetralogy|quartet|duology|chronicles|saga|series)\b/i,
  /\(\s*[^)]+#\d+\s*\)/i,
];

const KNOWN_SERIES_KEYWORDS: string[] = [
  "harry potter",
  "lord of the rings",
  "the hobbit",
  "dune",
  "song of ice and fire",
  "game of thrones",
  "hunger games",
  "percy jackson",
  "chronicles of narnia",
  "lion, the witch and the wardrobe",
  "wheel of time",
  "discworld",
  "foundation",
  "hitchhiker's guide",
  "ender's game",
  "dark tower",
  "twilight",
  "divergent",
  "maze runner",
  "mortal instruments",
  "outlander",
  "witcher",
  "mistborn",
  "stormlight archive",
  "his dark materials",
  "golden compass",
  "northern lights",
  "sherlock holmes",
  "hercule poirot",
  "bridgerton",
  "jack reacher",
  "anne of green gables",
  "little house",
  "diary of a wimpy kid",
  "goosebumps",
  "magic tree house",
];

function detectIsSeries(book: CategorizedBook): boolean {
  const titleLower = book.title.toLowerCase();

  // 1. Regex patterns on title/subtitle
  if (SERIES_TITLE_PATTERNS.some((rx) => rx.test(book.title))) {
    return true;
  }

  // 2. Known multi-volume series titles
  if (KNOWN_SERIES_KEYWORDS.some((kw) => titleLower.includes(kw))) {
    return true;
  }

  // 3. Open Library subject tags indicating series/sequels
  for (const subj of book.subjects) {
    const s = subj.toLowerCase();
    if (
      s.startsWith("series:") ||
      s.includes("fiction, series") ||
      s.includes("sequels") ||
      s.includes("trilogies")
    ) {
      return true;
    }
  }

  return false;
}

async function run() {
  console.log("[🌍 Day 4] Starting Author Nationality & Series Enrichment...");

  const rawBooks = await fs.readFile(INPUT_FILE, "utf-8");
  const books: CategorizedBook[] = JSON.parse(rawBooks);
  console.log(`[📦 Input] Loaded ${books.length} categorized books.`);

  // Load existing author country cache if present
  let authorCache: Record<string, string> = {};
  try {
    const cachedRaw = await fs.readFile(CACHE_FILE, "utf-8");
    authorCache = JSON.parse(cachedRaw);
    console.log(`[💾 Cache] Loaded ${Object.keys(authorCache).length} cached author nationalities.`);
  } catch {
    // Fresh cache
  }

  // Collect unique authors that still need lookup
  const uniqueAuthors = Array.from(new Set(books.map((b) => b.author.trim())));
  const uncachedAuthors: string[] = [];

  for (const author of uniqueAuthors) {
    const key = author.toLowerCase();
    if (KNOWN_AUTHOR_COUNTRIES[key]) {
      authorCache[key] = KNOWN_AUTHOR_COUNTRIES[key];
    } else if (!authorCache[key]) {
      uncachedAuthors.push(author);
    }
  }

  console.log(
    `[🔍 Lookup] ${uniqueAuthors.length} unique authors total | ${uncachedAuthors.length} querying via Wikidata SPARQL...`
  );

  const totalBatches = Math.ceil(uncachedAuthors.length / SPARQL_BATCH_SIZE);
  for (let i = 0; i < totalBatches; i++) {
    const batch = uncachedAuthors.slice(i * SPARQL_BATCH_SIZE, (i + 1) * SPARQL_BATCH_SIZE);
    try {
      console.log(`   [${i + 1}/${totalBatches}] Querying Wikidata batch (${batch.length} authors)...`);
      const results = await queryWikidataBatch(batch);

      for (const author of batch) {
        const key = author.toLowerCase();
        authorCache[key] = results[key] || "Unknown";
      }

      await fs.writeFile(CACHE_FILE, JSON.stringify(authorCache, null, 2), "utf-8");
    } catch (err) {
      console.error(
        `   ❌ Wikidata batch ${i + 1} failed:`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < totalBatches - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  let resolvedCount = 0;
  let seriesCount = 0;
  const countryCounts = new Map<string, number>();

  const enriched: EnrichedBook[] = books.map((book) => {
    const country = authorCache[book.author.trim().toLowerCase()] || "Unknown";
    const isSeries = detectIsSeries(book);

    if (country !== "Unknown") resolvedCount++;
    if (isSeries) seriesCount++;
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1);

    return {
      ...book,
      authorCountry: country,
      isSeries,
    };
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(enriched, null, 2), "utf-8");

  console.log("\n📊 Enrichment Summary:");
  console.log(
    `   • Author Country Resolved: ${resolvedCount}/${enriched.length} books (${(
      (resolvedCount / enriched.length) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `   • Series Books Flagged:    ${seriesCount}/${enriched.length} books (${(
      (seriesCount / enriched.length) *
      100
    ).toFixed(1)}%)`
  );

  console.log("\n🌎 Top 10 Author Countries:");
  const topCountries = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  for (const [country, count] of topCountries) {
    console.log(`   • ${country.padEnd(20)} ${count}`);
  }

  console.log(`\n✅ Enriched pool saved: ${enriched.length} books -> ${OUTPUT_FILE}`);
}

run();
