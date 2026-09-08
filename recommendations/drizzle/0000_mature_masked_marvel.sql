CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`album` text NOT NULL,
	`artist` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`visitor_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recommendations_visitor_time` ON `recommendations` (`visitor_hash`,`created_at`);