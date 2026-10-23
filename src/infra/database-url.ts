import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const schemaDirectory = fileURLToPath(new URL("../../prisma/", import.meta.url));

// Prisma <= 6 resolved relative SQLite paths against the schema directory.
// Keep CLI migrations and the new driver adapter pointed at that same database.
export function resolveDatabaseUrl(url: string): string {
  if (!url.startsWith("file:")) throw new Error("DATABASE_URL must be a SQLite file: URL");
  const path = url.slice("file:".length);
  if (!path) throw new Error("DATABASE_URL must include a SQLite database path");
  return isAbsolute(path) ? url : `file:${resolve(schemaDirectory, path)}`;
}
