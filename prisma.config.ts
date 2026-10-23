import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/infra/database-url.ts";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Generation works without production credentials. Runtime still validates its environment.
    url: resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./dev.db"),
  },
});
