CREATE TABLE `documents` (
	`id` integer PRIMARY KEY NOT NULL,
	`template_id` integer NOT NULL,
	`letterhead_override_id` integer,
	`title` text NOT NULL,
	`body_rendered` text NOT NULL,
	`body_source` text NOT NULL,
	`placeholders_filled` text DEFAULT '{}' NOT NULL,
	`pdf_url` text,
	`public_slug` text,
	`is_public` integer DEFAULT 0,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`letterhead_override_id`) REFERENCES `letterheads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `email_sends` (
	`id` integer PRIMARY KEY NOT NULL,
	`document_id` integer NOT NULL,
	`recipient_id` integer NOT NULL,
	`status` text NOT NULL,
	`message_id` text,
	`subject` text,
	`sent_at` integer,
	`error` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `recipients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `letterheads` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`file_url` text NOT NULL,
	`file_type` text NOT NULL,
	`pages` integer DEFAULT 1,
	`active` integer DEFAULT 1,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `list_recipients` (
	`id` integer PRIMARY KEY NOT NULL,
	`list_id` integer NOT NULL,
	`recipient_id` integer NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipient_id`) REFERENCES `recipients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`active` integer DEFAULT 1,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `recipients` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`tags` text DEFAULT '[]',
	`active` integer DEFAULT 1,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`letterhead_id` integer,
	`placeholders` text DEFAULT '[]' NOT NULL,
	`layout` text DEFAULT '{}' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1,
	`active` integer DEFAULT 1,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`letterhead_id`) REFERENCES `letterheads`(`id`) ON UPDATE no action ON DELETE no action
);
