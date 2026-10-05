CREATE TABLE `hidden_titles` (
	`normalized_title` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
