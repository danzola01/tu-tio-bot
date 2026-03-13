import { PrismaClient } from "@prisma/client";
import { beforeEach, afterAll } from "vitest";

const TEST_DB_URL = "file:./test.sqlite";

// Ensure we are using the test database
process.env.DATABASE_URL = TEST_DB_URL;

export const testDb = new PrismaClient();

beforeEach(async () => {
  // Wipe data before each test
  const tablenames = await testDb.$queryRaw<
    Array<{ name: string }>
  >`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'prisma_%' AND name NOT LIKE '_prisma_%';`;

  for (const { name } of tablenames) {
    if (name !== 'sqlite_sequence') {
      await testDb.$executeRawUnsafe(`DELETE FROM "${name}";`);
    }
  }
});

afterAll(async () => {
  await testDb.$disconnect();
});
