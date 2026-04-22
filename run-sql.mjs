import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const statements = [
  "ALTER TABLE userSettings ADD COLUMN deepgramApiKey varchar(255) DEFAULT NULL",
  "ALTER TABLE userSettings ADD COLUMN claudeApiKey varchar(255) DEFAULT NULL",
  "ALTER TABLE userSettings ADD COLUMN geminiApiKey varchar(255) DEFAULT NULL",
  "ALTER TABLE userSettings ADD COLUMN preferredLlm enum('claude','gemini') DEFAULT 'claude'",
  "ALTER TABLE userSettings ADD COLUMN preferredTranscriber enum('whisper','deepgram') DEFAULT 'whisper'"
];

for (const stmt of statements) {
  try {
    await connection.execute(stmt);
    console.log("✓", stmt);
  } catch (err) {
    console.log("⊘", stmt, "-", err.message);
  }
}

await connection.end();
