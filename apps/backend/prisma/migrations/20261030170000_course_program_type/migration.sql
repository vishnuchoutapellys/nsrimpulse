ALTER TABLE "Course"
ADD COLUMN "programType" TEXT NOT NULL DEFAULT 'INTERMEDIATE';

DROP INDEX "Course_name_key";

CREATE UNIQUE INDEX "Course_programType_name_key"
ON "Course" ("programType", "name");
