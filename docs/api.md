# API contract

All endpoints use `/api/v1` and return `{ success, data, message }` on success or `{ success: false, error: { code, message, details } }` on failure. Validation is centralized with Zod. OpenAPI generation should be added alongside the route modules as the API surface grows.
