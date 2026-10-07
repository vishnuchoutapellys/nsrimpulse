# Database

The Prisma schema in `apps/backend/prisma/schema.prisma` models organization hierarchy, students, fee obligations, discounts, payment allocation, receipts, status history, and audit logs. Financial rows use restrictive deletes; historical student rows are retained and status-driven.
