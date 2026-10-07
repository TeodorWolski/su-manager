CREATE TABLE `writing_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`minutes` integer,
	`bit_id` integer,
	`note` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`bit_id`) REFERENCES `bits`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `bits` ADD `doc_url` text;