import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const preflight = fileURLToPath(new URL("../../../scripts/check-checkout-databases.sh", import.meta.url));
const directories: string[] = [];

function repository() {
  const directory = mkdtempSync(join(tmpdir(), "tu-tio-checkout-"));
  directories.push(directory);
  const git = (...args: string[]) => execFileSync("git", [
    "-c", "user.name=Tests", "-c", "user.email=tests@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args,
  ], { cwd: directory, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "--initial-branch=main");
  writeFileSync(join(directory, "history.db"), "local history");
  git("add", ".");
  git("commit", "-m", "Legacy database");
  const legacy = git("rev-parse", "HEAD");
  unlinkSync(join(directory, "history.db"));
  git("add", "-u");
  git("commit", "--allow-empty", "-m", "Stop tracking database");
  const release = git("rev-parse", "HEAD");
  git("checkout", "--detach", legacy);
  return { directory, release };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("deployment database preflight", () => {
  it("refuses an upgrade that would remove local history and preserves the file", () => {
    const { directory, release } = repository();
    const result = spawnSync("bash", [preflight, release], { cwd: directory, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Release would remove SQLite file: history.db");
    expect(readFileSync(join(directory, "history.db"), "utf8")).toBe("local history");
  });

  it("allows the upgrade once database files have been moved outside the checkout", () => {
    const { directory, release } = repository();
    unlinkSync(join(directory, "history.db"));
    expect(spawnSync("bash", [preflight, release], { cwd: directory }).status).toBe(0);
  });
});
