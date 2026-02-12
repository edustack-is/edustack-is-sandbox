/*
  Warnings:

  - The primary key for the `AuditLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `metadata` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `targetId` on the `AuditLog` table. All the data in the column will be lost.
  - Added the required column `entity` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_targetId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_pkey",
DROP COLUMN "metadata",
DROP COLUMN "targetId",
ADD COLUMN     "entity" TEXT NOT NULL,
ADD COLUMN     "entityId" TEXT NOT NULL,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "newValues" JSONB,
ADD COLUMN     "oldValues" JSONB,
ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "AuditLog_id_seq";
