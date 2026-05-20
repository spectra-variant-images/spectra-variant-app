import { createRequestHandler } from '@remix-run/node';
import { installGlobals } from '@remix-run/node';

installGlobals();

const port = process.env.PORT || 3000;

console.log('Loading build from ./build/server/index.js...');

let build;
try {
  build = await import('./build/server/index.js');
  console.log('Build loaded successfully');
} catch (err) {
  console.error('Failed to load build:', err);
  process.exit(1);
}

const handler = createRequestHandler(build);

import { createServer } from 'http';

const server = createServer(async (req, res) => {
  try {
    const request = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      // @ts-ignore
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
    });

    const response = await handler(request);

    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch (err) {
    console.error('Request error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
