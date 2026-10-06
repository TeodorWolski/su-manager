PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_interactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contact_id` integer,
	`gig_id` integer,
	`date` text NOT NULL,
	`channel` text NOT NULL,
	`topic` text,
	`replied` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gig_id`) REFERENCES `gigs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_interactions`("id", "contact_id", "gig_id", "date", "channel", "topic", "replied", "created_at") SELECT "id", "contact_id", NULL, "date", "channel", "topic", "replied", "created_at" FROM `interactions`;--> statement-breakpoint
DROP TABLE `interactions`;--> statement-breakpoint
ALTER TABLE `__new_interactions` RENAME TO `interactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `gig_bits` ADD `reaction` integer;--> statement-breakpoint
ALTER TABLE `gigs` ADD `status_changed_at` text;--> statement-breakpoint
UPDATE `interactions` SET `channel` = 'FB prywatny' WHERE `channel` = 'Messenger';
