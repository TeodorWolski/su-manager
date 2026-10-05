CREATE TABLE `bits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'testing' NOT NULL,
	`length_min` integer,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`travel_minutes` integer,
	`has_lodging` integer DEFAULT false NOT NULL,
	`priority` integer DEFAULT 3 NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cities_name_unique` ON `cities` (`name`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`aliases` text,
	`role` text NOT NULL,
	`contact_info` text,
	`relation` text DEFAULT 'none' NOT NULL,
	`ignore_in_report` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gig_bits` (
	`gig_id` integer NOT NULL,
	`bit_id` integer NOT NULL,
	PRIMARY KEY(`gig_id`, `bit_id`),
	FOREIGN KEY (`gig_id`) REFERENCES `gigs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bit_id`) REFERENCES `bits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gig_contacts` (
	`gig_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	PRIMARY KEY(`gig_id`, `contact_id`),
	FOREIGN KEY (`gig_id`) REFERENCES `gigs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gig_logs` (
	`gig_id` integer PRIMARY KEY NOT NULL,
	`rating` integer NOT NULL,
	`attendance` integer,
	`minutes_played` integer,
	`minutes_available` integer,
	`thoughts` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`gig_id`) REFERENCES `gigs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gigs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`venue_id` integer,
	`city_id` integer,
	`status` text DEFAULT 'interested' NOT NULL,
	`context` text,
	`headliner_id` integer,
	`url` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`headliner_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer NOT NULL,
	`date` text NOT NULL,
	`channel` text NOT NULL,
	`topic` text,
	`replied` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`city_id` integer,
	`recurrence` text,
	`organizer_id` integer,
	`travel_minutes` integer,
	`has_lodging` integer DEFAULT false NOT NULL,
	`blacklisted` integer DEFAULT false NOT NULL,
	`blacklist_reason` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organizer_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
