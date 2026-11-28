ALTER TABLE `user_badges` ADD `note` text;--> statement-breakpoint
ALTER TABLE `user_badges` ADD `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL;--> statement-breakpoint
CREATE INDEX `threads_status_activity_idx` ON `threads` (`status`,`last_activity_at`);