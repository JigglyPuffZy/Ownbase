CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`name` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`project`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_project_name` ON `collections` (`project`,`name`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`type` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`project`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`collection` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`collection`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
