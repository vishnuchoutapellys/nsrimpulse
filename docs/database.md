# Database

The Prisma schema in `apps/backend/prisma/schema.prisma` models organization hierarchy, students, fee obligations, discounts, payment allocation, receipts, status history, and audit logs. Financial rows use restrictive deletes; historical student rows are retained and status-driven. Student profiles include optional mother name, date of birth, nationality, religion, caste/community, medium of instruction, and language fields used to prefill transfer and conduct certificates.

The `20261010120000_student_certificate_profile` migration adds these nullable profile columns, preserving existing student records.

The `20261112120000_admin_account_status` migration adds persisted `ACTIVE`, `HOLD`, and `BLOCKED` states for admin accounts. Existing inactive accounts are migrated to `BLOCKED`; College Admin access is denied unless the status is `ACTIVE`.

The `20261113130000_pocket_money_withdrawals_and_fee_breakdown` migration adds the student pocket-money balance, fee components on each fee assignment, and the audited withdrawal request/receipt records. Apply it with `npm run db:deploy` before using the updated portals. New admissions store the course fee and fee components as a fixed student assignment; only Super Admin can correct the course fee. Pocket-money requests reserve the requested amount while pending and debit the wallet balance when approved.

The `20261113180000_custom_college_location` migration allows Super Admin to enter a college location directly without requiring a preconfigured State/Location dropdown. Existing state-linked locations are unchanged; newly entered locations may have no state assigned.

## Local PostgreSQL connection errors

The local API reads `DATABASE_URL` from the repository-root `.env`. If login reports that the PostgreSQL credentials are invalid, update the URL with the actual password configured for the local `postgres` role; the application cannot reset or infer that password. URL-encode special characters in the password, then restart the backend. Confirm PostgreSQL is running and that the URL points to the intended host, port, and database before retrying admin login.

## Vercel Postgres

1. Copy `.env.example` to the repository-root `.env` if `.env` does not exist.
2. Set `DATABASE_URL` in `.env` to the Vercel Postgres connection string. Keep `.env` private; it is ignored by Git.
3. Run `npm run db:generate`.
4. Run `npm run db:deploy` to apply the committed migrations to the hosted database.
5. Optionally run `npm run db:seed` only when demo data is wanted in that database.

Use `npm run db:migrate -- --name <migration-name>` only while developing a new schema migration. Use `npm run db:deploy` for hosted and production databases.
