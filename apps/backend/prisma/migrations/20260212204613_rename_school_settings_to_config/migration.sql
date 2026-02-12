/*
  Warnings:

  - You are about to drop the column `aiSettings` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `ssoSettings` on the `School` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "School" DROP COLUMN "aiSettings",
DROP COLUMN "ssoSettings",
ADD COLUMN     "aiConfig" JSONB,
ADD COLUMN     "ssoConfig" JSONB;
