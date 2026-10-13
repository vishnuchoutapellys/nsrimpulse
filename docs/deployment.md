# Deployment

Build the web app as static assets behind HTTPS and deploy the API as a separate Node service. Set secrets through the deployment environment, run Prisma migrations as a release step, restrict CORS to the deployed origin, and configure object storage and payment webhook URLs outside source control.

For separate Vercel projects, configure these environment variables before building:

- Web project: `VITE_API_URL=https://<backend-project>.vercel.app`
- Backend project: `WEB_ORIGIN=https://<web-project>.vercel.app`

`VITE_API_URL` is embedded during the Vite build, so redeploy the web project after changing it. Do not include a trailing slash or port `4000` in production. When the API and web app share one origin with API rewrites, `VITE_API_URL` may be omitted.
