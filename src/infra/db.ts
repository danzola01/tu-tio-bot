import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.js";
import { resolveDatabaseUrl } from "./database-url.js";

export type DbClient = PrismaClient;

export function createDatabase(url: string): DbClient {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3(
      { url: resolveDatabaseUrl(url) },
      { timestampFormat: "unixepoch-ms" },
    ),
  });
}
