ALTER TABLE "FeeAssignment"
ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true;

WITH ranked_assignments AS (
  SELECT
    assignment."id",
    ROW_NUMBER() OVER (
      PARTITION BY assignment."studentId"
      ORDER BY structure."academicYear" DESC, assignment."id" DESC
    ) AS position
  FROM "FeeAssignment" AS assignment
  INNER JOIN "FeeStructure" AS structure
    ON structure."id" = assignment."feeStructureId"
)
UPDATE "FeeAssignment" AS assignment
SET "isCurrent" = (ranked_assignments.position = 1)
FROM ranked_assignments
WHERE assignment."id" = ranked_assignments."id";

CREATE UNIQUE INDEX "FeeAssignment_one_current_per_student"
ON "FeeAssignment" ("studentId")
WHERE "isCurrent" = true;
