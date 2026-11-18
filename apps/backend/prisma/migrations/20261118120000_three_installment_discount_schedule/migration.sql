-- Convert existing two-part fee schedules into three parts while preserving
-- the total payable amount after discounts. Historical discounts larger than
-- one third are spread evenly across the three parts during this conversion.
WITH fee_totals AS (
  SELECT
    fa."id" AS "feeAssignmentId",
    ROUND(fa."originalAmount" * 100)::BIGINT AS "grossCents",
    ROUND(COALESCE(SUM(sd."amount"), 0) * 100)::BIGINT AS "discountCents"
  FROM "FeeAssignment" fa
  LEFT JOIN "StudentDiscount" sd ON sd."feeAssignmentId" = fa."id"
  GROUP BY fa."id", fa."originalAmount"
), two_part_schedules AS (
  SELECT
    ft."feeAssignmentId",
    ft."grossCents",
    ft."discountCents",
    ARRAY_AGG(fi."id" ORDER BY fi."dueDate", fi."id") AS "installmentIds",
    MAX(fi."dueDate") AS "lastDueDate",
    FLOOR(ft."grossCents" / 3.0)::BIGINT AS "grossBaseCents",
    GREATEST(ft."grossCents" - ft."discountCents", 0)::BIGINT AS "netCents"
  FROM fee_totals ft
  JOIN "FeeInstallment" fi ON fi."feeAssignmentId" = ft."feeAssignmentId"
  GROUP BY ft."feeAssignmentId", ft."grossCents", ft."discountCents"
  HAVING COUNT(fi."id") = 2
), target_parts AS (
  SELECT
    *,
    CASE
      WHEN "discountCents" <= "grossCents" - (2 * "grossBaseCents") THEN "grossBaseCents"
      ELSE FLOOR("netCents" / 3.0)::BIGINT
    END AS "firstTwoCents"
  FROM two_part_schedules
), existing_parts AS (
  SELECT
    tp."feeAssignmentId",
    part."id" AS "installmentId",
    tp."firstTwoCents"
  FROM target_parts tp
  CROSS JOIN LATERAL UNNEST(tp."installmentIds") AS part("id")
)
UPDATE "FeeInstallment" fi
SET "amount" = ep."firstTwoCents" / 100.0
FROM existing_parts ep
WHERE fi."id" = ep."installmentId";

WITH fee_totals AS (
  SELECT
    fa."id" AS "feeAssignmentId",
    ROUND(fa."originalAmount" * 100)::BIGINT AS "grossCents",
    ROUND(COALESCE(SUM(sd."amount"), 0) * 100)::BIGINT AS "discountCents"
  FROM "FeeAssignment" fa
  LEFT JOIN "StudentDiscount" sd ON sd."feeAssignmentId" = fa."id"
  GROUP BY fa."id", fa."originalAmount"
), two_part_schedules AS (
  SELECT
    ft."feeAssignmentId",
    ft."grossCents",
    ft."discountCents",
    MAX(fi."dueDate") AS "lastDueDate",
    FLOOR(ft."grossCents" / 3.0)::BIGINT AS "grossBaseCents",
    GREATEST(ft."grossCents" - ft."discountCents", 0)::BIGINT AS "netCents",
    COUNT(fi."id") AS "installmentCount"
  FROM fee_totals ft
  JOIN "FeeInstallment" fi ON fi."feeAssignmentId" = ft."feeAssignmentId"
  GROUP BY ft."feeAssignmentId", ft."grossCents", ft."discountCents"
  HAVING COUNT(fi."id") = 2
), target_parts AS (
  SELECT
    *,
    CASE
      WHEN "discountCents" <= "grossCents" - (2 * "grossBaseCents") THEN "grossBaseCents"
      ELSE FLOOR("netCents" / 3.0)::BIGINT
    END AS "firstTwoCents"
  FROM two_part_schedules
)
INSERT INTO "FeeInstallment" ("id", "feeAssignmentId", "dueDate", "amount")
SELECT
  gen_random_uuid()::TEXT,
  "feeAssignmentId",
  "lastDueDate" + INTERVAL '1 year',
  ("netCents" - 2 * "firstTwoCents") / 100.0
FROM target_parts;
