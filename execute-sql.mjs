import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const sql = `
ALTER TABLE userSettings ADD COLUMN deepgramApiKey varchar(255) DEFAULT NULL;
ALTER TABLE userSettings ADD COLUMN claudeApiKey varchar(255) DEFAULT NULL;
ALTER TABLE userSettings ADD COLUMN geminiApiKey varchar(255) DEFAULT NULL;
ALTER TABLE userSettings ADD COLUMN preferredLlm enum('claude','gemini') DEFAULT 'claude';
ALTER TABLE userSettings ADD COLUMN preferredTranscriber enum('whisper','deepgram') DEFAULT 'whisper';
`;

const statements = sql.split(';').filter(s => s.trim());

for (const statement of statements) {
  if (statement.trim()) {
    try {
      console.log(`Executing: ${statement.trim()}`);
      await connection.execute(statement.trim());
      console.log('✓ Success');
    } catch (err) {
      console.log(`Note: ${err.message}`);
    }
  }
}

await connection.end();
console.log('Done');
