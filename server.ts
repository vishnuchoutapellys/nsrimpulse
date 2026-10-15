import type { Request, Response } from 'express';

type BackendApp = typeof import('./apps/backend/src/server.js').default;

let backendAppPromise: Promise<BackendApp> | undefined;

export default async function handler(req: Request, res: Response) {
	backendAppPromise ??= import('./apps/backend/src/server.js').then((module) => module.default);
	const app = await backendAppPromise;
	return app(req, res);
}
