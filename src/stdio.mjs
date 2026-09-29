#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCanvasClient } from './core.mjs';
import { createServer } from './server.mjs';
try {
 const client=createCanvasClient({origin:process.env.CANVAS_ORIGIN,token:process.env.CANVAS_TOKEN});
 await createServer(client).connect(new StdioServerTransport());
} catch { console.error('Set CANVAS_ORIGIN to your school HTTPS origin and CANVAS_TOKEN to your own Canvas access token. Never share the token.'); process.exitCode=1; }
