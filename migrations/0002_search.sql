-- Full-text search for the SearchBox ("Program, university or field").
-- One FTS5 row per program and per university, with rowid = the record's id.
-- `body` holds the record's names in all three languages plus its provider,
-- city, country and field labels, so a Turkmen, Russian or English word finds it.
-- unicode61 with remove_diacritics folds ä, ç, ň, ö, ş, ü, ý, ž (and Cyrillic case),
-- so "turkiye" finds "Türkiýe". The prefix index serves "comp*"-style queries.
-- Rows are written by src/lib/db/search-index.ts (seed now, admin saves in M7).
CREATE VIRTUAL TABLE `program_search` USING fts5(
  `body`,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE `university_search` USING fts5(
  `body`,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
