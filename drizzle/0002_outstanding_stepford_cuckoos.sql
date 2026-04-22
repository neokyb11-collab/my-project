ALTER TABLE `userSettings` ADD `deepgramApiKey` varchar(512);--> statement-breakpoint
ALTER TABLE `userSettings` ADD `preferredTranscriber` enum('whisper','deepgram') DEFAULT 'whisper';