# API contract

All endpoints use `/api/v1` and return `{ success, data, message }` on success or `{ success: false, error: { code, message, details } }` on failure. Request validation uses Zod; unexpected server errors are logged server-side and returned as a generic `INTERNAL_ERROR`.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/health` | Public |
| GET | `/api/v1/public/overview` | Public |
| POST | `/api/v1/students/validate` | Public validation only; does not persist |
| POST | `/api/v1/auth/register` | Public; links credentials to an existing student record |
| POST | `/api/v1/auth/login` | Public; returns a 15-minute student access JWT |
| GET | `/api/v1/students/:studentUid/portal` | Student JWT for the same `studentUid` |
| GET | `/api/v1/students/:studentUid/payments` | Student JWT for the same `studentUid` |
| POST | `/api/v1/payments/student` | Student JWT; submitted `studentUid` must match token |
| POST | `/api/v1/admin/auth/login` | Public College Admin login |
| GET | `/api/v1/admin/context` | College Admin JWT |
| GET | `/api/v1/admin/students/:studentUid` | College Admin JWT plus assigned scope |
| POST | `/api/v1/admin/students` | College Admin JWT plus assigned scope |
| POST | `/api/v1/admin/students/:studentUid/offline-payments` | College Admin JWT plus assigned scope |
| POST | `/api/v1/admin/students/:studentUid/certificates/issue` | College Admin JWT plus assigned scope; audits TC or Bonafide/Conduct generation and returns current outstanding fees |

Student and College Admin credentials use `Authorization: Bearer <accessToken>`. Student IDs are authorization-bound on every student data/payment route; changing the URL or request body to another ID is denied. The student payment endpoint is a development simulation, not a provider-verified payment flow. Refresh-token rotation and payment provider order/verification/webhook routes are not implemented yet.

Certificate issuance accepts `{ "certificateType": "TRANSFER" | "BONAFIDE_CONDUCT", "fields": { ... } }`. The admin UI loads a scoped student record first, pre-fills available profile fields, and warns about unpaid fees. Outstanding fees do not block certificate generation; the issue endpoint recalculates the balance and writes the document fields and current due amount to the audit log.
