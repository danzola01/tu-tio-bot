/*
  Warnings:

  - You are about to drop the column `season` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MatchPlayer" ADD COLUMN "hero" TEXT;
ALTER TABLE "MatchPlayer" ADD COLUMN "role" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "map" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "groupSize" INTEGER NOT NULL DEFAULT 1,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);
INSERT INTO "new_Match" ("deletedAt", "groupSize", "guildId", "id", "map", "mode", "playedAt", "reportedByUserId", "result") SELECT "deletedAt", "groupSize", "guildId", "id", "map", "mode", "playedAt", "reportedByUserId", "result" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE INDEX "Match_guildId_playedAt_idx" ON "Match"("guildId", "playedAt");
CREATE INDEX "Match_guildId_mode_idx" ON "Match"("guildId", "mode");
CREATE INDEX "Match_guildId_mode_map_idx" ON "Match"("guildId", "mode", "map");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
