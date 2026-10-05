CREATE TABLE `goals` (
	`key` text PRIMARY KEY NOT NULL,
	`target` integer NOT NULL,
	`deadline` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
