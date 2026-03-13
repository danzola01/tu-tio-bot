-- AlterTable
ALTER TABLE "Match" ADD COLUMN "season" TEXT;

-- CreateIndex
CREATE INDEX "Match_guildId_season_idx" ON "Match"("guildId", "season");
