-- Pathway rules (SPEC.md "Data model"): a pathway goes from a pre-year program
-- (foundation or language) to a bachelor's program. A CHECK can't read another
-- row, so triggers enforce it on every write to pathways, and stop a program's
-- level changing in a way that would break an existing pathway.
-- Error messages are codes; the admin forms (M7) turn them into words.
CREATE TRIGGER `pathways_levels_insert`
BEFORE INSERT ON `pathways`
WHEN coalesce((SELECT `level` FROM `programs` WHERE `id` = NEW.`from_program_id`), '') NOT IN ('foundation', 'language')
  OR coalesce((SELECT `level` FROM `programs` WHERE `id` = NEW.`to_program_id`), '') <> 'bachelor'
BEGIN
  SELECT RAISE(ABORT, 'pathway_levels');
END;
--> statement-breakpoint
CREATE TRIGGER `pathways_levels_update`
BEFORE UPDATE OF `from_program_id`, `to_program_id` ON `pathways`
WHEN coalesce((SELECT `level` FROM `programs` WHERE `id` = NEW.`from_program_id`), '') NOT IN ('foundation', 'language')
  OR coalesce((SELECT `level` FROM `programs` WHERE `id` = NEW.`to_program_id`), '') <> 'bachelor'
BEGIN
  SELECT RAISE(ABORT, 'pathway_levels');
END;
--> statement-breakpoint
CREATE TRIGGER `programs_level_keeps_pathways`
BEFORE UPDATE OF `level` ON `programs`
WHEN (NEW.`level` NOT IN ('foundation', 'language')
       AND EXISTS (SELECT 1 FROM `pathways` WHERE `from_program_id` = NEW.`id`))
  OR (NEW.`level` <> 'bachelor'
       AND EXISTS (SELECT 1 FROM `pathways` WHERE `to_program_id` = NEW.`id`))
BEGIN
  SELECT RAISE(ABORT, 'pathway_levels');
END;
