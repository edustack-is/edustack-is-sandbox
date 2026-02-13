/*
  Warnings:

  - You are about to drop the column `subjectId` on the `Grade` table. All the data in the column will be lost.
  - You are about to drop the column `subjectId` on the `ScheduleEvent` table. All the data in the column will be lost.
  - You are about to drop the `SchoolConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Subject` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `subjectInstanceId` to the `Grade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectInstanceId` to the `ScheduleEvent` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'PRINCIPAL';
ALTER TYPE "UserRole" ADD VALUE 'DEPUTY';

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduleEvent" DROP CONSTRAINT "ScheduleEvent_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_schoolId_fkey";

-- AlterTable
ALTER TABLE "Grade" DROP COLUMN "subjectId",
ADD COLUMN     "academicYearId" TEXT,
ADD COLUMN     "subjectInstanceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ScheduleEvent" DROP COLUMN "subjectId",
ADD COLUMN     "subjectInstanceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "allowStudentSelfRegistration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contactEmail" TEXT;

-- AlterTable
ALTER TABLE "SchoolMembership" ADD COLUMN     "workloadPercentage" DOUBLE PRECISION;

-- DropTable
DROP TABLE "SchoolConfig";

-- DropTable
DROP TABLE "Subject";

-- CreateTable
CREATE TABLE "ParentStudent" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "svpDescription" TEXT,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SubjectTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectInstance" (
    "id" TEXT NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeLevelId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "isComputerLab" BOOLEAN NOT NULL DEFAULT false,
    "specialEquipment" JSONB,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeLevelId" TEXT NOT NULL,
    "classroomId" TEXT,
    "residentialAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherWorkload" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "workloadPercentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherWorkload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "geminiApiKey" TEXT,
    "openAiApiKey" TEXT,
    "anthropicApiKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTokenUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "promptType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudent_parentId_studentId_key" ON "ParentStudent"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectTemplate_code_schoolId_key" ON "SubjectTemplate"("code", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectInstance_templateId_academicYearId_gradeLevelId_key" ON "SubjectInstance"("templateId", "academicYearId", "gradeLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_date_schoolId_key" ON "Attendance"("studentId", "date", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_name_schoolId_key" ON "Room"("name", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_name_schoolId_key" ON "AcademicYear"("name", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeLevel_levelNumber_schoolId_key" ON "GradeLevel"("levelNumber", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_academicYearId_key" ON "StudentEnrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherWorkload_teacherId_academicYearId_key" ON "TeacherWorkload"("teacherId", "academicYearId");

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudent" ADD CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectTemplate" ADD CONSTRAINT "SubjectTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectInstance" ADD CONSTRAINT "SubjectInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SubjectTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectInstance" ADD CONSTRAINT "SubjectInstance_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectInstance" ADD CONSTRAINT "SubjectInstance_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectInstance" ADD CONSTRAINT "SubjectInstance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_subjectInstanceId_fkey" FOREIGN KEY ("subjectInstanceId") REFERENCES "SubjectInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_subjectInstanceId_fkey" FOREIGN KEY ("subjectInstanceId") REFERENCES "SubjectInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeLevel" ADD CONSTRAINT "GradeLevel_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWorkload" ADD CONSTRAINT "TeacherWorkload_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherWorkload" ADD CONSTRAINT "TeacherWorkload_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTokenUsage" ADD CONSTRAINT "AiTokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTokenUsage" ADD CONSTRAINT "AiTokenUsage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
