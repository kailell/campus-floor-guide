const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('proxy attaches server secret only to allowlisted AMap paths', async () => {
  const worker = (await import(pathToFileURL(path.join(__dirname, '..', 'deployment', 'amap-security-proxy.mjs')))).default;
  const originalFetch = global.fetch;
  let upstream = null;
  global.fetch = async url => { upstream = new URL(url); return new Response('{}'); };
  try {
    const request = new Request('https://proxy.example/_AMapService/v3/direction/walking?key=public',
      { headers: { Origin: 'https://kailell.github.io' } });
    const response = await worker.fetch(request, { AMAP_SECURITY_JSCODE: 'private-code' });
    assert.equal(response.status, 200);
    assert.equal(upstream.hostname, 'restapi.amap.com');
    assert.equal(upstream.searchParams.get('jscode'), 'private-code');
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://kailell.github.io');
    const blocked = await worker.fetch(new Request('https://proxy.example/private'),
      { AMAP_SECURITY_JSCODE: 'private-code' });
    assert.equal(blocked.status, 404);
  } finally { global.fetch = originalFetch; }
});
