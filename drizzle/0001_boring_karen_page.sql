CREATE TABLE `project_sql` (
	`project` text PRIMARY KEY NOT NULL,
	`image` text NOT NULL,
	`revision` integer NOT NULL,
	FOREIGN KEY (`project`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
