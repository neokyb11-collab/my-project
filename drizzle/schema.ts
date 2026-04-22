import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Audio files uploaded by users for subtitle generation
 */
export const audioFiles = mysqlTable("audioFiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: varchar("projectId", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  originalSize: int("originalSize").notNull(),
  compressedSize: int("compressedSize"),
  duration: int("duration"),
  storageKey: varchar("storageKey", { length: 512 }),
  transcriptionStatus: mysqlEnum("transcriptionStatus", ["pending", "processing", "completed", "failed"]).default("pending"),
  transcriptionData: text("transcriptionData"),
  fileOrder: int("fileOrder").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AudioFile = typeof audioFiles.$inferSelect;
export type InsertAudioFile = typeof audioFiles.$inferInsert;

/**
 * Subtitle projects containing multiple audio files
 */
export const subtitleProjects = mysqlTable("subtitleProjects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  script: text("script"),
  srtContent: text("srtContent"),
  status: mysqlEnum("status", ["draft", "processing", "completed", "failed"]).default("draft").notNull(),
  totalDuration: int("totalDuration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubtitleProject = typeof subtitleProjects.$inferSelect;
export type InsertSubtitleProject = typeof subtitleProjects.$inferInsert;

/**
 * User settings for API keys and preferences
 */
export const userSettings = mysqlTable("userSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  claudeApiKey: varchar("claudeApiKey", { length: 512 }),
  geminiApiKey: varchar("geminiApiKey", { length: 512 }),
  preferredLlm: mysqlEnum("preferredLlm", ["claude", "gemini"]).default("claude"),
  deepgramApiKey: varchar("deepgramApiKey", { length: 512 }),
  preferredTranscriber: mysqlEnum("preferredTranscriber", ["whisper", "deepgram"]).default("whisper"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSetting = typeof userSettings.$inferSelect;
export type InsertUserSetting = typeof userSettings.$inferInsert;
