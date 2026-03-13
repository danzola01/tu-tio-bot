import { execSync } from "node:child_process";

export default function setup() {
  const TEST_DB_URL = "file:./test.sqlite";

  // Reset the database once before running tests
  console.log("Resetting test database (Global Setup)...");
  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DB_URL,
    },
  });
}
