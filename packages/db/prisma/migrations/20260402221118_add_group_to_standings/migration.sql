/*
  Warnings:

  - A unique constraint covering the columns `[seasonId,teamId,group]` on the table `standings` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "standings_seasonId_teamId_key";

-- AlterTable
ALTER TABLE "standings" ADD COLUMN     "group" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "standings_seasonId_teamId_group_key" ON "standings"("seasonId", "teamId", "group");
