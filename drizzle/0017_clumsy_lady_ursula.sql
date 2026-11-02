CREATE TABLE `trips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gig_id` integer,
	`carrier` text,
	`train` text,
	`from_station` text NOT NULL,
	`to_station` text NOT NULL,
	`departs_at` text NOT NULL,
	`arrives_at` text,
	`price_gr` integer,
	`seat` text,
	`reference` text,
	`url` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`gig_id`) REFERENCES `gigs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trips_reference_unique` ON `trips` (`reference`);--> statement-breakpoint
ALTER TABLE `gigs` ADD `fee_gr` integer;