import { createRequestHandler } from '@remix-run/node';
import { installGlobals } from '@remix-run/node';
import * as build from './build/server/index.js';

installGlobals();

const port = process.env.PORT || 3000;

const handler = createRequestHandler(build);

import { createServer } from 'http';

const server = createServer(async (req, res) => {
  const request = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    // @ts-ignore
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
  });

  const response = await handler(request);

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
