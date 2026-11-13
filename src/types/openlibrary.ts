export interface OpenLibraryDoc {
  key: string;                          // e.g. "/works/OL45804W"
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

export interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: OpenLibraryDoc[];
}

export interface RawCandidateBook {
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
