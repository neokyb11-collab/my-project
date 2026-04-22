import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _pool: mysql.Pool | null = null;

function getPool(): mysql.Pool | null {
  if (!_pool && process.env.DATABASE_URL) {
    try {
      _pool = mysql.createPool(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to create pool:", error);
    }
  }
  return _pool;
}

export async function getConnection(): Promise<mysql.PoolConnection | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    return await pool.getConnection();
  } catch (error) {
    console.warn("[Database] Failed to get connection:", error);
    return null;
  }
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers (used by auth) ──────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Subtitle project helpers ─────────────────────────────────────────────────

export async function createSubtitleProject(
  userId: number,
  projectName: string,
  script: string
): Promise<string> {
  const connection = await getConnection();
  if (!connection) throw new Error("Database not available");

  const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();
  try {
    await connection.execute(
      `INSERT INTO subtitleProjects (id, userId, projectName, script, srtContent, status, totalDuration, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NULL, 'draft', NULL, ?, ?)`,
      [projectId, userId, projectName, script, now, now]
    );
    return projectId;
  } finally {
    connection.release();
  }
}

export async function getSubtitleProject(projectId: string, userId: number) {
  const connection = await getConnection();
  if (!connection) throw new Error("Database not available");
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM subtitleProjects WHERE id = ? AND userId = ?",
      [projectId, userId]
    );
    return (rows as any[])[0] ?? null;
  } finally {
    connection.release();
  }
}

export async function addAudioFile(
  userId: number,
  projectId: string,
  fileName: string,
  originalSize: number,
  fileOrder: number,
  storageKey?: string
): Promise<void> {
  const connection = await getConnection();
  if (!connection) throw new Error("Database not available");
  const now = new Date();
  try {
    await connection.execute(
      `INSERT INTO audioFiles (userId, projectId, fileName, originalSize, fileOrder, storageKey, transcriptionStatus, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [userId, projectId, fileName, originalSize, fileOrder, storageKey ?? null, now, now]
    );
  } finally {
    connection.release();
  }
}

export async function getProjectAudioFiles(projectId: string, userId: number) {
  const connection = await getConnection();
  if (!connection) return [];
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM audioFiles WHERE projectId = ? AND userId = ? ORDER BY fileOrder ASC",
      [projectId, userId]
    );
    return rows as any[];
  } finally {
    connection.release();
  }
}

export async function updateAudioFileTranscription(
  audioFileId: number,
  transcriptionData: string,
  duration: number
): Promise<void> {
  const connection = await getConnection();
  if (!connection) throw new Error("Database not available");
  try {
    await connection.execute(
      `UPDATE audioFiles SET transcriptionStatus = 'completed', transcriptionData = ?, duration = ?, updatedAt = ? WHERE id = ?`,
      [transcriptionData, duration, new Date(), audioFileId]
    );
  } finally {
    connection.release();
  }
}

export async function updateSubtitleProjectStatus(
  projectId: string,
  status: string,
  srtContent?: string,
  totalDuration?: number
): Promise<void> {
  const connection = await getConnection();
  if (!connection) throw new Error("Database not available");
  try {
    await connection.execute(
      `UPDATE subtitleProjects SET status = ?, srtContent = ?, totalDuration = ?, updatedAt = ? WHERE id = ?`,
      [status, srtContent ?? null, totalDuration ?? null, new Date(), projectId]
    );
  } finally {
    connection.release();
  }
}

// ─── User settings helpers ────────────────────────────────────────────────────

export async function getUserSettings(userId: number) {
  const connection = await getConnection();
  if (!connection) return null;
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM userSettings WHERE userId = ?",
      [userId]
    );
    return (rows as any[])[0] ?? null;
  } finally {
    connection.release();
  }
}

export async function upsertUserSettings(
  userId: number,
  claudeApiKey?: string,
  geminiApiKey?: string,
  deepgramApiKey?: string,
  preferredLlm?: string,
  preferredTranscriber?: string
): Promise<void> {
  const connection = await getConnection();
  if (!connection) throw new Error("Database not available");
  const now = new Date();
  try {
    await connection.execute(
      `INSERT INTO userSettings (userId, claudeApiKey, geminiApiKey, deepgramApiKey, preferredLlm, preferredTranscriber, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         claudeApiKey = VALUES(claudeApiKey),
         geminiApiKey = VALUES(geminiApiKey),
         deepgramApiKey = VALUES(deepgramApiKey),
         preferredLlm = VALUES(preferredLlm),
         preferredTranscriber = VALUES(preferredTranscriber),
         updatedAt = VALUES(updatedAt)`,
      [userId, claudeApiKey ?? null, geminiApiKey ?? null, deepgramApiKey ?? null, preferredLlm ?? "claude", preferredTranscriber ?? "whisper", now, now]
    );
  } finally {
    connection.release();
  }
}
