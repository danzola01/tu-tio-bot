CREATE TABLE "DeadlockSchedule" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "objectives" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
