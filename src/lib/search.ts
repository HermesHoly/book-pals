export type PublicBookTuple = [
  id: number,
  title: string,
  author: string,
  year: number
];

export interface SearchResult {
  id: number;
  title: string;
  author: string;
  year: number;
  score: number;
}

export function searchBooks(
  catalog: PublicBookTuple[],
  rawQuery: string,
  excludedIds: Set<number>,
  limit = 8
): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 1) return [];

  const matches: SearchResult[] = [];

  for (let i = 0; i < catalog.length; i++) {
    const [id, title, author, year] = catalog[i];
    if (excludedIds.has(id)) continue;

    const titleLower = title.toLowerCase();
    const authorLower = author.toLowerCase();

    let score = 0;
    if (titleLower === query) {
      score = 100;
    } else if (titleLower.startsWith(query)) {
      score = 80;
    } else if (titleLower.includes(` ${query}`)) {
      score = 65;
    } else if (titleLower.includes(query)) {
      score = 50;
    } else if (authorLower.startsWith(query)) {
      score = 40;
    } else if (authorLower.includes(query)) {
      score = 25;
    }

    if (score > 0) {
      // Slight popularity tie-breaker (lower catalog ID = higher popularity)
      const popularityBoost = Math.max(0, 10 - id / 250);
      matches.push({
        id,
        title,
        author,
        year,
        score: score + popularityBoost,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score || a.id - b.id);
  return matches.slice(0, limit);
}
