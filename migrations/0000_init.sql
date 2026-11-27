CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`admin_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`diff` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `countries` (
	`code` text PRIMARY KEY NOT NULL,
	`popular_rank` integer
);
--> statement-breakpoint
CREATE TABLE `mistake_reports` (
	`id` integer PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "mistake_reports_status" CHECK("mistake_reports"."status" in ('open', 'resolved', 'dismissed'))
);
--> statement-breakpoint
CREATE INDEX `mistake_reports_status_idx` ON `mistake_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `pathway_colleges` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`country_code` text NOT NULL,
	`city` text NOT NULL,
	`website` text,
	`last_checked` text NOT NULL,
	`source_url` text,
	`published` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`country_code`) REFERENCES `countries`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pathway_colleges_published_source" CHECK("pathway_colleges"."published" = 0 or "pathway_colleges"."source_url" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pathway_colleges_slug_unique` ON `pathway_colleges` (`slug`);--> statement-breakpoint
CREATE INDEX `pathway_colleges_country_idx` ON `pathway_colleges` (`country_code`);--> statement-breakpoint
CREATE TABLE `pathways` (
	`id` integer PRIMARY KEY NOT NULL,
	`from_program_id` integer NOT NULL,
	`to_program_id` integer NOT NULL,
	`entry_guaranteed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`from_program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pathways_from_to_unique` ON `pathways` (`from_program_id`,`to_program_id`);--> statement-breakpoint
CREATE INDEX `pathways_to_idx` ON `pathways` (`to_program_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`preferred_lang` text DEFAULT 'tk' NOT NULL,
	`quiz` text,
	`reminder_channel` text DEFAULT 'none' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profiles_preferred_lang" CHECK("profiles"."preferred_lang" in ('tk', 'ru', 'en')),
	CONSTRAINT "profiles_reminder_channel" CHECK("profiles"."reminder_channel" in ('email', 'telegram', 'none'))
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`provider_type` text NOT NULL,
	`university_id` integer,
	`college_id` integer,
	`level` text NOT NULL,
	`name` text NOT NULL,
	`field` text,
	`language_of_study` text NOT NULL,
	`duration_years` real NOT NULL,
	`tuition_per_year_usd` integer,
	`intakes` text DEFAULT '[]' NOT NULL,
	`requirements` text DEFAULT '{"ieltsMin":null,"otherTests":[],"documents":[]}' NOT NULL,
	`application_deadline` text,
	`pre_year_required` text,
	`last_checked` text NOT NULL,
	`source_url` text,
	`published` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`college_id`) REFERENCES `pathway_colleges`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "programs_level" CHECK("programs"."level" in ('bachelor', 'foundation', 'language')),
	CONSTRAINT "programs_field" CHECK("programs"."field" is null or "programs"."field" in ('business', 'computing', 'engineering', 'medicine', 'law', 'sciences', 'social_sciences', 'arts', 'education', 'architecture')),
	CONSTRAINT "programs_provider" CHECK(("programs"."provider_type" = 'university' and "programs"."university_id" is not null and "programs"."college_id" is null)
        or ("programs"."provider_type" = 'college' and "programs"."college_id" is not null and "programs"."university_id" is null)),
	CONSTRAINT "programs_pre_year_required" CHECK(("programs"."level" = 'bachelor' and "programs"."pre_year_required" is not null and "programs"."pre_year_required" in ('yes', 'no', 'unknown'))
        or ("programs"."level" <> 'bachelor' and "programs"."pre_year_required" is null)),
	CONSTRAINT "programs_duration" CHECK("programs"."duration_years" > 0),
	CONSTRAINT "programs_tuition" CHECK("programs"."tuition_per_year_usd" is null or "programs"."tuition_per_year_usd" >= 0),
	CONSTRAINT "programs_published_source" CHECK("programs"."published" = 0 or "programs"."source_url" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `programs_slug_unique` ON `programs` (`slug`);--> statement-breakpoint
CREATE INDEX `programs_level_university_idx` ON `programs` (`level`,`university_id`);--> statement-breakpoint
CREATE INDEX `programs_field_idx` ON `programs` (`field`);--> statement-breakpoint
CREATE INDEX `programs_published_level_idx` ON `programs` (`published`,`level`);--> statement-breakpoint
CREATE INDEX `programs_university_idx` ON `programs` (`university_id`);--> statement-breakpoint
CREATE INDEX `programs_college_idx` ON `programs` (`college_id`);--> statement-breakpoint
CREATE TABLE `reminder_log` (
	`tracker_item_id` integer NOT NULL,
	`days_before` integer NOT NULL,
	`sent_at` integer NOT NULL,
	PRIMARY KEY(`tracker_item_id`, `days_before`),
	FOREIGN KEY (`tracker_item_id`) REFERENCES `tracker_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reminder_log_days_before" CHECK("reminder_log"."days_before" in (30, 7, 1))
);
--> statement-breakpoint
CREATE TABLE `replies` (
	`id` integer PRIMARY KEY NOT NULL,
	`thread_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`helpful_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "replies_status" CHECK("replies"."status" in ('open', 'hidden'))
);
--> statement-breakpoint
CREATE INDEX `replies_thread_idx` ON `replies` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `replies_author_idx` ON `replies` (`author_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reply_votes` (
	`user_id` text NOT NULL,
	`reply_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `reply_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_id`) REFERENCES `replies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reply_votes_reply_idx` ON `reply_votes` (`reply_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reports_target_type" CHECK("reports"."target_type" in ('thread', 'reply'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_target_reporter_unique` ON `reports` (`target_type`,`target_id`,`reporter_id`);--> statement-breakpoint
CREATE INDEX `reports_created_idx` ON `reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `saved_items` (
	`user_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `item_type`, `item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "saved_items_item_type" CHECK("saved_items"."item_type" in ('program', 'university', 'scholarship'))
);
--> statement-breakpoint
CREATE TABLE `scholarship_programs` (
	`scholarship_id` integer NOT NULL,
	`program_id` integer NOT NULL,
	PRIMARY KEY(`scholarship_id`, `program_id`),
	FOREIGN KEY (`scholarship_id`) REFERENCES `scholarships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scholarship_programs_program_idx` ON `scholarship_programs` (`program_id`);--> statement-breakpoint
CREATE TABLE `scholarship_universities` (
	`scholarship_id` integer NOT NULL,
	`university_id` integer NOT NULL,
	PRIMARY KEY(`scholarship_id`, `university_id`),
	FOREIGN KEY (`scholarship_id`) REFERENCES `scholarships`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scholarship_universities_university_idx` ON `scholarship_universities` (`university_id`);--> statement-breakpoint
CREATE TABLE `scholarships` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`country_code` text NOT NULL,
	`coverage` text NOT NULL,
	`covers` text DEFAULT '[]' NOT NULL,
	`covers_pre_year` text DEFAULT 'unknown' NOT NULL,
	`amount_text` text,
	`deadline` text,
	`rolling` integer DEFAULT false NOT NULL,
	`open_to_turkmen` text DEFAULT 'unknown' NOT NULL,
	`eligibility` text DEFAULT '[]' NOT NULL,
	`how_to_apply` text,
	`last_checked` text NOT NULL,
	`source_url` text,
	`published` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`country_code`) REFERENCES `countries`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "scholarships_coverage" CHECK("scholarships"."coverage" in ('full', 'partial')),
	CONSTRAINT "scholarships_covers_pre_year" CHECK("scholarships"."covers_pre_year" in ('yes', 'no', 'unknown')),
	CONSTRAINT "scholarships_open_to_turkmen" CHECK("scholarships"."open_to_turkmen" in ('yes', 'no', 'unknown')),
	CONSTRAINT "scholarships_published_source" CHECK("scholarships"."published" = 0 or "scholarships"."source_url" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scholarships_slug_unique` ON `scholarships` (`slug`);--> statement-breakpoint
CREATE INDEX `scholarships_deadline_idx` ON `scholarships` (`deadline`);--> statement-breakpoint
CREATE INDEX `scholarships_published_deadline_idx` ON `scholarships` (`published`,`deadline`);--> statement-breakpoint
CREATE INDEX `scholarships_country_idx` ON `scholarships` (`country_code`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`item_id` integer,
	`lang` text DEFAULT 'tk' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `tracker_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "share_links_scope" CHECK("share_links"."scope" in ('tracker', 'item')),
	CONSTRAINT "share_links_item" CHECK(("share_links"."scope" = 'item' and "share_links"."item_id" is not null) or ("share_links"."scope" = 'tracker' and "share_links"."item_id" is null))
);
--> statement-breakpoint
CREATE INDEX `share_links_user_idx` ON `share_links` (`user_id`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` integer PRIMARY KEY NOT NULL,
	`topic_slug` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author_id` text NOT NULL,
	`university_id` integer,
	`program_id` integer,
	`lang` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`helped_reply_id` integer,
	`reply_count` integer DEFAULT 0 NOT NULL,
	`last_activity_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`topic_slug`) REFERENCES `topics`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`helped_reply_id`) REFERENCES `replies`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "threads_status" CHECK("threads"."status" in ('open', 'hidden')),
	CONSTRAINT "threads_lang" CHECK("threads"."lang" in ('tk', 'ru', 'en'))
);
--> statement-breakpoint
CREATE INDEX `threads_topic_activity_idx` ON `threads` (`topic_slug`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `threads_university_idx` ON `threads` (`university_id`);--> statement-breakpoint
CREATE INDEX `threads_program_idx` ON `threads` (`program_id`);--> statement-breakpoint
CREATE INDEX `threads_author_idx` ON `threads` (`author_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `topics` (
	`slug` text PRIMARY KEY NOT NULL,
	`sort` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tracker_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`program_id` integer,
	`pathway_id` integer,
	`scholarship_id` integer,
	`stage` text DEFAULT 'planning' NOT NULL,
	`notes` text,
	`deadline_override` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pathway_id`) REFERENCES `pathways`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scholarship_id`) REFERENCES `scholarships`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tracker_items_stage" CHECK("tracker_items"."stage" in ('planning', 'preparing', 'submitted', 'accepted', 'waitlisted', 'rejected', 'enrolled')),
	CONSTRAINT "tracker_items_target" CHECK("tracker_items"."program_id" is not null or "tracker_items"."pathway_id" is not null or "tracker_items"."scholarship_id" is not null)
);
--> statement-breakpoint
CREATE INDEX `tracker_items_user_idx` ON `tracker_items` (`user_id`);--> statement-breakpoint
CREATE TABLE `tracker_tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`item_id` integer NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`due_date` text,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `tracker_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tracker_tasks_item_idx` ON `tracker_tasks` (`item_id`,`sort`);--> statement-breakpoint
CREATE TABLE `translations` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`lang` text NOT NULL,
	`field` text NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`, `lang`, `field`),
	CONSTRAINT "translations_entity_type" CHECK("translations"."entity_type" in ('country', 'university', 'college', 'program', 'scholarship', 'topic')),
	CONSTRAINT "translations_lang" CHECK("translations"."lang" in ('tk', 'ru', 'en'))
);
--> statement-breakpoint
CREATE TABLE `universities` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`country_code` text NOT NULL,
	`city` text NOT NULL,
	`type` text,
	`website` text,
	`logo_key` text,
	`ministry_status` text DEFAULT 'unchecked' NOT NULL,
	`ministry_basis` text,
	`ranking_qs` integer,
	`ranking_the` integer,
	`ranking_arwu` integer,
	`ranking_moscow` integer,
	`last_checked` text NOT NULL,
	`source_url` text,
	`published` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`country_code`) REFERENCES `countries`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "universities_ministry_status" CHECK("universities"."ministry_status" in ('approved', 'not_listed', 'unchecked')),
	CONSTRAINT "universities_type" CHECK("universities"."type" is null or "universities"."type" in ('public', 'private')),
	CONSTRAINT "universities_published_source" CHECK("universities"."published" = 0 or "universities"."source_url" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `universities_slug_unique` ON `universities` (`slug`);--> statement-breakpoint
CREATE INDEX `universities_country_ministry_idx` ON `universities` (`country_code`,`ministry_status`);--> statement-breakpoint
CREATE INDEX `universities_published_ministry_idx` ON `universities` (`published`,`ministry_status`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'student' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`university_id` integer,
	`verified_by` text,
	`verified_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`university_id`) REFERENCES `universities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "user_badges_type" CHECK("user_badges"."type" in ('studies_here', 'team')),
	CONSTRAINT "user_badges_university" CHECK(("user_badges"."type" = 'studies_here' and "user_badges"."university_id" is not null) or ("user_badges"."type" = 'team' and "user_badges"."university_id" is null))
);
--> statement-breakpoint
CREATE INDEX `user_badges_user_idx` ON `user_badges` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_badges_pending_idx` ON `user_badges` (`verified_at`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);