# Database

The Prisma schema in `apps/backend/prisma/schema.prisma` models organization hierarchy, students, fee obligations, discounts, payment allocation, receipts, status history, and audit logs. Financial rows use restrictive deletes; historical student rows are retained and status-driven. Student profiles include optional mother name, date of birth, nationality, religion, caste/community, medium of instruction, and language fields used to prefill transfer and conduct certificates.

The `20261010120000_student_certificate_profile` migration adds these nullable profile columns, preserving existing student records.

## Vercel Postgres

1. Copy `.env.example` to the repository-root `.env` if `.env` does not exist.
2. Set `DATABASE_URL` in `.env` to the Vercel Postgres connection string. Keep `.env` private; it is ignored by Git.
3. Run `npm run db:generate`.
4. Run `npm run db:deploy` to apply the committed migrations to the hosted database.
5. Optionally run `npm run db:seed` only when demo data is wanted in that database.

Use `npm run db:migrate -- --name <migration-name>` only while developing a new schema migration. Use `npm run db:deploy` for hosted and production databases.
