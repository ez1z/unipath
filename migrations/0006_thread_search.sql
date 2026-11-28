-- "Similar questions" while a student types a title (SPEC.md "Discussions").
-- An external-content FTS5 index over threads.title (rowid = threads.id), kept in
-- step by triggers, so no extra writes in the app. Same tokenizer as program
-- search: diacritics folded, so "ýasaýyş" finds "yasayys". Hidden threads stay in
-- the index; queries join threads and keep status = 'open'.
CREATE VIRTUAL TABLE `thread_search` USING fts5(
  `title`,
  content = 'threads',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
--> statement-breakpoint
CREATE TRIGGER `threads_search_insert` AFTER INSERT ON `threads` BEGIN
  INSERT INTO `thread_search` (`rowid`, `title`) VALUES (NEW.`id`, NEW.`title`);
END;
--> statement-breakpoint
CREATE TRIGGER `threads_search_delete` AFTER DELETE ON `threads` BEGIN
  INSERT INTO `thread_search` (`thread_search`, `rowid`, `title`) VALUES ('delete', OLD.`id`, OLD.`title`);
END;
--> statement-breakpoint
CREATE TRIGGER `threads_search_update` AFTER UPDATE OF `title` ON `threads` BEGIN
  INSERT INTO `thread_search` (`thread_search`, `rowid`, `title`) VALUES ('delete', OLD.`id`, OLD.`title`);
  INSERT INTO `thread_search` (`rowid`, `title`) VALUES (NEW.`id`, NEW.`title`);
END;
