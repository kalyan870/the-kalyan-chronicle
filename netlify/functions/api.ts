import serverless from 'serverless-http';
import { createApp } from '../../src/server/createApp.ts';

// Reuse the same server-authenticated Express API used by Vercel and local runs.
process.env.RUNTIME_DEPLOYMENT = 'netlify';
const app = createApp();
export const handler = serverless(app, { basePath: '/.netlify/functions/api' });
