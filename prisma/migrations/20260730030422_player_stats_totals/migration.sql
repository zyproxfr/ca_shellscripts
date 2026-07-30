-- AlterTable
ALTER TABLE "PlayerStats" ADD COLUMN     "totalDartsThrown" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalScoreThrown" INTEGER NOT NULL DEFAULT 0;
