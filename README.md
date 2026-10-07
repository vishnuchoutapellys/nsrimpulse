# NSR Impulse Knowledge Park

A multi-tenant education management PWA foundation for students, college administrators, and super administrators. The workspace is organized as a TypeScript monorepo with a React/Vite PWA, Express API, Prisma/PostgreSQL model, and shared contracts.

## Start here

1. Install PostgreSQL for Windows and remember the password you chose for the `postgres` user. Keep the PostgreSQL service running.
2. Open **SQL Shell (psql)** from the Start menu. Use these values when prompted:
	- Server: `127.0.0.1`
	- Database: `postgres`
	- Port: `5432`
	- Username: `postgres`
	- Password: the password chosen during PostgreSQL installation
3. Create the application database:
	```sql
	CREATE DATABASE nsr_impulse;
	\q
	```
4. In this repository, copy `.env.example` to `.env` and update the password in `DATABASE_URL`:
	```env
	DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/nsr_impulse
	```
	If your PostgreSQL password contains `@`, `#`, `/`, `:` or spaces, URL-encode it or choose a development password without those characters.
5. Install dependencies with `npm install`.
6. Generate Prisma Client: `npm run db:generate`.
7. Create all tables and the first migration: `npm run db:migrate -- --name init`.
8. Insert the demo hierarchy and student `NSRTSHYD-001`: `npm run db:seed`.
9. Start the API: `npm run dev:backend`.
10. In another terminal, start the PWA: `npm run dev:web`.

The seed is safe to run again for this demo. It reuses Telangana, Pragathi Nagar, the NSR college, branch, MPC course, and Student ID `NSRTSHYD-001` rather than creating a duplicate student.

### Verify the database

Run `npx prisma studio --schema apps/backend/prisma/schema.prisma` from the repository root and open the displayed local URL. Select `Student` to see CH Vishnu and `FeeAssignment`/`FeeInstallment` to see the ₹180,000 two-year fee split into two ₹90,000 installments.

If `P1001: Can't reach database server` appears, PostgreSQL is not running, the port is not `5432`, or the password in `.env` is incorrect. If the VS Code PostgreSQL extension asks for a hostname, enter `127.0.0.1`.

The API is centralized under `/api/v1`. The current vertical slice includes health, public overview, and validated student creation input. Prisma preserves immutable `studentUid`, separates fee obligations from payments, and retains status and audit history for future modules.

## Planned modules

Authentication/RBAC, tenant-scoped administration, fee allocation, provider-independent payment verification/webhooks, receipts, results, documents, notifications, reports, and Playwright coverage should be implemented against the schema and shared response contract as the next increments.

## Quality commands

- `npm run build`
- `npm test`
- `npm run db:generate`
