import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const directory = await mkdtemp(join(tmpdir(), "tu-tio-tests-"));
  const databaseUrl = `file:${join(directory, "test.sqlite")}`;
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    project.provide("databaseUrl", databaseUrl);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return () => rm(directory, { recursive: true, force: true });
}
