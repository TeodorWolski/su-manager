ALTER TABLE `gigs` ADD `skip_review` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `venues` ADD `verdict` text;--> statement-breakpoint
UPDATE `venues` SET `verdict` = 'never' WHERE `blacklisted` = 1;
