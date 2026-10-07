CREATE TABLE `recurring_series` (
	`key` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`interval` text,
	`title` text NOT NULL,
	`city_name` text,
	`venue_name` text,
	`url` text,
	`anchor` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
