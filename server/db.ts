import { randomUUID } from "crypto";
import * as schema from "@shared/schema";

// Database setup - use PostgreSQL as primary, SQLite as fallback
const databaseUrl = process.env.DATABASE_URL;

let db: any;

async function initializeDatabase() {
  if (databaseUrl && !databaseUrl.startsWith("file:")) {
    // PostgreSQL setup
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    const ws = await import("ws");
    
    neonConfig.webSocketConstructor = ws.default;
    
    const pool = new Pool({ connectionString: databaseUrl });
    db = drizzle({ client: pool, schema });
    
    console.log(`🐘 Connected to PostgreSQL database`);
  } else {
    // SQLite fallback setup
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const Database = (await import('better-sqlite3')).default;
    
    // Ensure data directory exists
    const path = await import('path');
    const fs = await import('fs');
    
    const dbPath = "./data/app.db";
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const sqlite = new Database(dbPath);
    
    // Enable foreign keys
    sqlite.pragma('foreign_keys = ON');
    
    db = drizzle({ client: sqlite, schema });
    
    console.log(`📁 Connected to SQLite database: ${dbPath}`);
  }
}

await initializeDatabase();

export { db };
