// Optional Cloudflare Worker for AMap JS API securityJsCode.
// Set AMAP_SECURITY_JSCODE as a Worker secret, never in GitHub Pages files.
const SITE_ORIGIN = 'https://kailell.github.io';
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {
      'Access-Control-Allow-Origin': SITE_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    };
    if (origin && origin !== SITE_ORIGIN) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });
    if (!env.AMAP_SECURITY_JSCODE) return new Response('Proxy secret not configured', { status: 503, headers });
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/_AMapService/')) return new Response('Not found', { status: 404, headers });
    const path = url.pathname.slice('/_AMapService'.length);
    if (!/^\/v[345]\//.test(path)) return new Response('Unsupported AMap path', { status: 404, headers });
    const host = path.startsWith('/v4/map/styles') ? 'https://webapi.amap.com' : 'https://restapi.amap.com';
    const upstream = new URL(host + path + url.search);
    upstream.searchParams.set('jscode', env.AMAP_SECURITY_JSCODE);
    const response = await fetch(upstream.toString(), { method: 'GET', redirect: 'follow' });
    const resultHeaders = new Headers(response.headers);
    for (const [name, value] of Object.entries(headers)) resultHeaders.set(name, value);
    resultHeaders.delete('set-cookie');
    return new Response(response.body, { status: response.status, headers: resultHeaders });
  }
};
