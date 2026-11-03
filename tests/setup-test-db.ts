// tests/setup-test-db.ts
// Runs before every test file (see vitest.config.mts).
//
// 1. The tests NEVER touch the real database. DATABASE_URL (from .env.local, maybe Turso) is replaced by a
//    throw-away SQLite file in ./.test-db, and the Turso token is removed.
// 2. The tables are created from the ./drizzle migrations. If the migration folder is older than the schema
//    (no mobile_no / caretaker_comment), the two missing columns are added so the tests still run.
//    (Google Drive is never called in tests: the storage code checks the VITEST variable itself.)
// 3. createTestDatabase() is still here for tests that want their own separate in-memory database.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import * as schema from "../src/server/db/schema";

const dir = path.resolve(process.cwd(), ".test-db");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `hms-${process.pid}.db`);

// A relative URL keeps this working on Windows (no drive letter inside the URL).
process.env.DATABASE_URL = `file:./.test-db/hms-${process.pid}.db`;
delete process.env.TURSO_AUTH_TOKEN;

// Fresh file for this process, unless the app client is already open on it.
if (!(globalThis as { client?: unknown }).client) {
  for (const f of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
}

// Imported only now, so the client above sees the test URL.
const { db } = await import("@/server/db/client");

await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });

// The ./drizzle migration may be older than the schema. These two columns are added when they are missing.
async function ensureColumns(target: { all: typeof db.all; run: typeof db.run }) {
  const ensure = async (table: string, column: string) => {
    const cols = (await target.all(sql.raw(`PRAGMA table_info(${table})`))) as { name: string }[];
    if (!cols.some((c) => c.name === column)) await target.run(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${column} text`));
  };
  await ensure("student", "mobile_no");
  await ensure("swap_request", "caretaker_comment");
}
await ensureColumns(db);

export async function createTestDatabase() {
  const client = createClient({ url: "file::memory:" });
  const memoryDb = drizzle(client, { schema });
  await migrate(memoryDb, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  await ensureColumns(memoryDb);
  await client.execute(`PRAGMA foreign_keys = ON;`);
  return { db: memoryDb, client };
}
