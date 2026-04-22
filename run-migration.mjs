import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);

const sqlFiles = [
  "drizzle/0001_regular_namorita.sql",
];

for (const file of sqlFiles) {
  const filePath = resolve(__dirname, file);
  let sql;
  try {
    sql = readFileSync(filePath, "utf8");
  } catch (e) {
    console.log(`Skipping ${file}: not found`);
    continue;
  }
  // Split on drizzle statement separator
  const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      await connection.execute(stmt);
      console.log(`✓ Executed statement from ${file}`);
    } catch (err) {
      if (err.code === "ER_TABLE_EXISTS_ERROR" || err.message?.includes("already exists")) {
        console.log(`  Table already exists, skipping.`);
      } else {
        console.error(`✗ Error in ${file}:`, err.message);
      }
    }
  }
}

await connection.end();
console.log("Migration complete.");
