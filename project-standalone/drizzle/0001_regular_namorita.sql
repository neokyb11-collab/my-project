CREATE TABLE `audioFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`originalSize` int NOT NULL,
	`compressedSize` int,
	`duration` int,
	`storageKey` varchar(512),
	`transcriptionStatus` enum('pending','processing','completed','failed') DEFAULT 'pending',
	`transcriptionData` text,
	`fileOrder` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audioFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subtitleProjects` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`script` text,
	`srtContent` text,
	`status` enum('draft','processing','completed','failed') NOT NULL DEFAULT 'draft',
	`totalDuration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subtitleProjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`claudeApiKey` varchar(512),
	`geminiApiKey` varchar(512),
	`preferredLlm` enum('claude','gemini') DEFAULT 'claude',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `userSettings_userId_unique` UNIQUE(`userId`)
);
