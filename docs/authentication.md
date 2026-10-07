# Authentication

Use short-lived JWT access tokens and rotated, revocable refresh tokens stored server-side. Student registration links an already-created `Student` through verified Student ID plus registered contact; it never creates a second master student row. All login, role, scope, and account state changes are audited.
