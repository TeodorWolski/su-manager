CREATE TABLE `ideas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`bit_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`bit_id`) REFERENCES `bits`(`id`) ON UPDATE no action ON DELETE set null
);
