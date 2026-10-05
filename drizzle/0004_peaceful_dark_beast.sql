CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`city_name` text,
	`venue_name` text,
	`performers` text,
	`dedupe_key` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_seen_at` text NOT NULL,
	`dismissed` integer DEFAULT false NOT NULL,
	`gig_id` integer,
	FOREIGN KEY (`gig_id`) REFERENCES `gigs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_dedupe_key_unique` ON `events` (`dedupe_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_source_id` ON `events` (`source`,`source_id`);