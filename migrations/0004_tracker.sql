ALTER TABLE `tracker_tasks` ADD `code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tracker_items_user_program_unique` ON `tracker_items` (`user_id`,`program_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tracker_items_user_pathway_unique` ON `tracker_items` (`user_id`,`pathway_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tracker_items_user_scholarship_unique` ON `tracker_items` (`user_id`,`scholarship_id`);--> statement-breakpoint
CREATE INDEX `tracker_items_stage_idx` ON `tracker_items` (`stage`);