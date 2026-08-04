-- Retires the table replaced by `document_progress`.
--
-- Apply this only AFTER running `npx tsx scripts/backfill-docs.ts`, which reads
-- the rows below and rewrites them as diffs. Applying it first discards every
-- student's ticked documents with no way back.
drop table if exists public.document_checklist_items;
