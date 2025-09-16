CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`initial_balance_cents` integer DEFAULT 0,
	`active` integer DEFAULT 1,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY NOT NULL,
	`transaction_id` integer NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`diff` text
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`active` integer DEFAULT 1,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text,
	`completed` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY NOT NULL,
	`account_id` integer,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`category_id` integer NOT NULL,
	`method` text,
	`reference` text,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
