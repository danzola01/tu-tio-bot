-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "map" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "Match_guildId_playedAt_idx" ON "Match"("guildId", "playedAt");

-- CreateIndex
CREATE INDEX "Match_guildId_mode_idx" ON "Match"("guildId", "mode");

-- CreateIndex
CREATE INDEX "Match_guildId_mode_map_idx" ON "Match"("guildId", "mode", "map");
