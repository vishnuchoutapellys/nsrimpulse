# Architecture

```mermaid
flowchart LR
  PWA[React PWA] --> API[Central REST API /api/v1]
  Native[Future native clients] --> API
  API --> Auth[JWT + refresh sessions]
  API --> Services[Controllers -> Services -> Data access]
  Services --> DB[(PostgreSQL via Prisma)]
  Services --> Blob[Azure Blob or S3]
  Services --> Gateway[Payment provider adapter]
```

The system is multi-tenant by scope: College Admin access is constrained to assigned colleges/branches; Super Admin has organization scope. Student identity is the central `Student` record and `studentUid` is unique and immutable.
