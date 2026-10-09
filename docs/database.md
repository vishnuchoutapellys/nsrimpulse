# Database

The Prisma schema in `apps/backend/prisma/schema.prisma` models organization hierarchy, students, fee obligations, discounts, payment allocation, receipts, status history, and audit logs. Financial rows use restrictive deletes; historical student rows are retained and status-driven. Student profiles include optional mother name, date of birth, nationality, religion, caste/community, medium of instruction, and language fields used to prefill transfer and conduct certificates.

The `20261010120000_student_certificate_profile` migration adds these nullable profile columns, preserving existing student records. Apply pending migrations with `npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma` in deployment environments.
