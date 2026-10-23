import { beforeEach, afterAll, inject } from "vitest";
import { createDatabase } from "../src/infra/db.js";

// Always use the isolated database provisioned by integration globalSetup.
export const testDb = createDatabase(inject("databaseUrl"));

beforeEach(async () => {
  await testDb.matchPlayer.deleteMany();
  await testDb.match.deleteMany();
});

afterAll(async () => {
  await testDb.$disconnect();
});
