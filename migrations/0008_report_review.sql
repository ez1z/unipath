ALTER TABLE `reports` ADD `reviewed` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `reports_reviewed_target_idx` ON `reports` (`reviewed`,`target_type`,`target_id`);