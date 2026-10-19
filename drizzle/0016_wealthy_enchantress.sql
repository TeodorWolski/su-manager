CREATE TABLE `supports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`headliner_id` integer NOT NULL,
	`support_id` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_seen` text,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`headliner_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`support_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supports_pair` ON `supports` (`headliner_id`,`support_id`);