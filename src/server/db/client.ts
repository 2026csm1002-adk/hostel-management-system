import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  client: Client | undefined;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not defined.");
}

const client =
  globalForDb.client ??
  createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db: LibSQLDatabase<typeof schema> = drizzle(client, { schema });