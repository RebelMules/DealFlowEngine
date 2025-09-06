import { randomUUID } from "crypto";
import * as schema from "@shared/schema";

// Use SQLite by default, PostgreSQL if DATABASE_URL is provided
const dbDialect = process.env.DB_DIALECT || "sqlite";
const databaseUrl = process.env.DATABASE_URL || "file:./data/app.db";

let db: any;

if (dbDialect === "sqlite" || databaseUrl.startsWith("file:")) {
  // SQLite setup
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const Database = (await import('better-sqlite3')).default;
  
  // Ensure data directory exists
  const path = await import('path');
  const fs = await import('fs');
  
  const dbPath = databaseUrl.replace("file:", "");
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  const sqlite = new Database(dbPath);
  
  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON');
  
  db = drizzle({ client: sqlite, schema });
  
  console.log(`📁 Connected to SQLite database: ${dbPath}`);
} else {
  // PostgreSQL setup
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const ws = await import("ws");
  
  neonConfig.webSocketConstructor = ws.default;
  
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set for PostgreSQL. Set DB_DIALECT=sqlite to use SQLite.",
    );
  }
  
  const pool = new Pool({ connectionString: databaseUrl });
  db = drizzle({ client: pool, schema });
  
  console.log(`🐘 Connected to PostgreSQL database`);
}

export { db };
