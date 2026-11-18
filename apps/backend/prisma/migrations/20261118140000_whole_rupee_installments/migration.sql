-- Replace paise-level installment values with whole rupees while preserving
-- each assignment's rounded-up net payable amount.
WITH assignment_totals AS (
  SELECT
    fa."id" AS "feeAssignmentId",
    CEIL(fa."originalAmount")::BIGINT AS "grossRupees",
    COALESCE(SUM(sd."amount"), 0) AS "discountAmount",
    GREATEST(CEIL(fa."originalAmount" - COALESCE(SUM(sd."amount"), 0)), 0)::BIGINT AS "netRupees"
  FROM "FeeAssignment" fa
  LEFT JOIN "StudentDiscount" sd ON sd."feeAssignmentId" = fa."id"
  GROUP BY fa."id", fa."originalAmount"
), schedules AS (
  SELECT
    at."feeAssignmentId",
    at."grossRupees",
    at."discountAmount",
    at."netRupees",
    ARRAY_AGG(fi."id" ORDER BY fi."dueDate", fi."id") AS "installmentIds",
    COUNT(fi."id") AS "installmentCount"
  FROM assignment_totals at
  JOIN "FeeInstallment" fi ON fi."feeAssignmentId" = at."feeAssignmentId"
  GROUP BY at."feeAssignmentId", at."grossRupees", at."discountAmount", at."netRupees"
  HAVING COUNT(fi."id") = 3
), rounded AS (
  SELECT
    *,
    CEIL("grossRupees" / 3.0)::BIGINT AS "grossFirstPart",
    CASE
      WHEN "discountAmount" <= "grossRupees" - (2 * CEIL("grossRupees" / 3.0))
        THEN CEIL("grossRupees" / 3.0)::BIGINT
      ELSE CEIL("netRupees" / 3.0)::BIGINT
    END AS "firstTwoParts"
  FROM schedules
), installment_values AS (
  SELECT
    "feeAssignmentId",
    parts."installmentId",
    parts."ordinality",
    "firstTwoParts",
    "netRupees" - (2 * "firstTwoParts") AS "thirdPart"
  FROM rounded
  CROSS JOIN LATERAL UNNEST(rounded."installmentIds") WITH ORDINALITY AS parts("installmentId", "ordinality")
)
UPDATE "FeeInstallment" fi
SET "amount" = CASE WHEN iv."ordinality" = 3 THEN iv."thirdPart" ELSE iv."firstTwoParts" END
FROM installment_values iv
WHERE fi."id" = iv."installmentId";
