# Deployment

The production frontend and API use separate Vercel projects:

- Frontend: `https://www.nsrimpulse.com`
- API: `https://nsr-impulse-api-nine.vercel.app`

## Environment variables

Set this variable on the **frontend Vercel project** for Production, Preview, and Development as appropriate:

```text
VITE_API_URL=https://nsr-impulse-api-nine.vercel.app
```

Set this variable on the **backend Vercel project**:

```text
WEB_ORIGIN=https://www.nsrimpulse.com
```

The values must not have a trailing slash. `VITE_API_URL` is embedded during the Vite build, so redeploy the frontend after adding or changing it. Redeploy the backend after changing `WEB_ORIGIN`.

Keep `DATABASE_URL`, JWT secrets, SMTP credentials, and SMS credentials in the backend Vercel project's environment settings. Never commit them to the repository.

## Verification

1. Open `https://nsr-impulse-api-nine.vercel.app/api/v1/public/overview` and confirm it returns JSON.
2. In the browser Network panel, sign in and confirm the request URL is `https://nsr-impulse-api-nine.vercel.app/api/v1/auth/login`.
3. Confirm the login response has an `application/json` content type and `Access-Control-Allow-Origin: https://www.nsrimpulse.com`.
4. Invalid credentials should return JSON with HTTP `401` and error code `INVALID_CREDENTIALS`, not a Vercel `404` or CORS error.

The login request body is `{ "studentId": "<college-issued-id>", "password": "<password>" }`. Do not use real credentials in deployment logs or command-line verification.
