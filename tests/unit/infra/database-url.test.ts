import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl } from "../../../src/infra/database-url.js";

describe("SQLite database URL compatibility", () => {
  it("keeps legacy relative paths anchored to prisma rather than the process directory", () => {
    const expected = fileURLToPath(new URL("../../../prisma/dev.db", import.meta.url));
    expect(resolveDatabaseUrl("file:./dev.db")).toBe(`file:${expected}`);
  });

  it("preserves absolute database locations", () => {
    expect(resolveDatabaseUrl("file:/var/lib/tu-tio/history.sqlite")).toBe("file:/var/lib/tu-tio/history.sqlite");
  });

  it("rejects a missing file path or a non-SQLite URL", () => {
    expect(() => resolveDatabaseUrl("file:")).toThrow("database path");
    expect(() => resolveDatabaseUrl("postgresql://localhost/db")).toThrow("SQLite");
  });
});
