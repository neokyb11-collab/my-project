import mysql from 'mysql2/promise';

const connection = await mysql.createConnection('mysql://root:udKkxcvvnzGyOFarjIiwISrdSFtvXfIF@switchback.proxy.rlwy.net:22454/railway');

const statements = [
  `CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, openId VARCHAR(64) NOT NULL UNIQUE, name TEXT, email VARCHAR(320), loginMethod VARCHAR(64), role ENUM('user','admin') DEFAULT 'user' NOT NULL, createdAt TIMESTAMP DEFAULT NOW() NOT NULL, updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL, lastSignedIn TIMESTAMP DEFAULT NOW() NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS subtitleProjects (id VARCHAR(64) PRIMARY KEY, userId INT NOT NULL, projectName VARCHAR(255) NOT NULL, script TEXT, srtContent TEXT, status ENUM('draft','processing','completed','failed') DEFAULT 'draft' NOT NULL, totalDuration INT, createdAt TIMESTAMP DEFAULT NOW() NOT NULL, updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audioFiles (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, projectId VARCHAR(64) NOT NULL, fileName VARCHAR(255) NOT NULL, originalSize INT, compressedSize INT, duration INT, storageKey VARCHAR(512), transcriptionStatus ENUM('pending','processing','completed','failed') DEFAULT 'pending', transcriptionData TEXT, fileOrder INT NOT NULL, createdAt TIMESTAMP DEFAULT NOW() NOT NULL, updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS userSettings (userId INT PRIMARY KEY, claudeApiKey TEXT, geminiApiKey TEXT, deepgramApiKey TEXT, preferredLlm ENUM('claude','gemini') DEFAULT 'claude', preferredTranscriber ENUM('whisper','deepgram') DEFAULT 'whisper', createdAt TIMESTAMP DEFAULT NOW() NOT NULL, updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL)`
];

for (const stmt of statements) {
  try {
    await connection.execute(stmt);
    console.log("OK:", stmt.substring(0, 50));
  } catch (err) {
    console.log("ERR:", err.message);
  }
}

await connection.end();
console.log("Done!");