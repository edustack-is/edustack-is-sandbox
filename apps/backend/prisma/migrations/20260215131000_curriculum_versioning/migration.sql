-- CreateTable: Semester
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CurriculumVersion
CREATE TABLE "CurriculumVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CurriculumEntry
CREATE TABLE "CurriculumEntry" (
    "id" TEXT NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL,
    "rvpDescription" TEXT,
    "svpApproach" TEXT,
    "equipmentRequirements" JSONB,
    "needsComputerLab" BOOLEAN NOT NULL DEFAULT false,
    "curriculumVersionId" TEXT NOT NULL,
    "subjectTemplateId" TEXT NOT NULL,
    "gradeLevelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable: AcademicYear – add optional curriculumVersionId
ALTER TABLE "AcademicYear" ADD COLUMN "curriculumVersionId" TEXT;

-- AlterTable: SubjectTemplate – add optional curriculumVersionId
ALTER TABLE "SubjectTemplate" ADD COLUMN "curriculumVersionId" TEXT;

-- AlterTable: SubjectInstance – add optional curriculumVersionId
ALTER TABLE "SubjectInstance" ADD COLUMN "curriculumVersionId" TEXT;

-- CreateIndex: Semester unique per year
CREATE UNIQUE INDEX "Semester_academicYearId_number_key" ON "Semester"("academicYearId", "number");

-- CreateIndex: CurriculumEntry unique per version/subject/grade
CREATE UNIQUE INDEX "CurriculumEntry_curriculumVersionId_subjectTemplateId_gradeLevelId_key" ON "CurriculumEntry"("curriculumVersionId", "subjectTemplateId", "gradeLevelId");

-- AddForeignKey: Semester → AcademicYear
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CurriculumVersion → School
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CurriculumEntry → CurriculumVersion (cascade delete)
ALTER TABLE "CurriculumEntry" ADD CONSTRAINT "CurriculumEntry_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CurriculumEntry → SubjectTemplate
ALTER TABLE "CurriculumEntry" ADD CONSTRAINT "CurriculumEntry_subjectTemplateId_fkey" FOREIGN KEY ("subjectTemplateId") REFERENCES "SubjectTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CurriculumEntry → GradeLevel
ALTER TABLE "CurriculumEntry" ADD CONSTRAINT "CurriculumEntry_gradeLevelId_fkey" FOREIGN KEY ("gradeLevelId") REFERENCES "GradeLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: AcademicYear → CurriculumVersion (optional)
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: SubjectTemplate → CurriculumVersion (optional)
ALTER TABLE "SubjectTemplate" ADD CONSTRAINT "SubjectTemplate_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: SubjectInstance → CurriculumVersion (optional)
ALTER TABLE "SubjectInstance" ADD CONSTRAINT "SubjectInstance_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
