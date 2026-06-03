// Cloudflare Worker: SEC EDGAR + Yahoo Finance CORS Proxy
// Deployed at: https://sec-proxy.jacob-ad2.workers.dev  (Cloudflare account ad22c326...)
//
// THIS IS A VERSION-CONTROLLED MIRROR of the live Worker (read from the dashboard 6/3/26,
// version 718d4be7). The live Worker is edited in the Cloudflare dashboard — keep this in sync.
//
// Shared by: proxy-lookup, Company Overview Generator (SEC), and the /refresh portfolio
// skill (Yahoo). Do NOT remove the /yahoo route or the CORS origin allowlist.
//
// Usage:
//   SEC:   GET https://sec-proxy.<subdomain>.workers.dev/?url=<encoded-sec-url>
//   Yahoo: GET https://sec-proxy.<subdomain>.workers.dev/yahoo/<yahoo-api-path>

const ALLOWED_ORIGINS = [
  'https://wa-jm.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

const ALLOWED_SEC_HOSTS = [
  'www.sec.gov',
  'data.sec.gov',
  'efts.sec.gov',
];

const ALLOWED_YAHOO_HOSTS = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
];

const SEC_USER_AGENT = 'stock-lookup-web/1.0 (jacob@wadvisorslp.com)';
const YAHOO_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(request, new Response(null, { status: 204 }));
    }

    if (request.method !== 'GET') {
      return handleCors(request, new Response('Method not allowed', { status: 405 }));
    }

    const reqUrl = new URL(request.url);

    // Route: /yahoo/* -> proxy to Yahoo Finance
    if (reqUrl.pathname.startsWith('/yahoo/')) {
      return handleYahoo(request, reqUrl);
    }

    // Route: ?url= -> proxy to SEC EDGAR
    return handleSec(request, reqUrl);
  },
};

async function handleSec(request, reqUrl) {
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return handleCors(request, new Response('Missing ?url= parameter', { status: 400 }));
  }

  // Validate the target is a SEC domain
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return handleCors(request, new Response('Invalid URL', { status: 400 }));
  }

  if (!ALLOWED_SEC_HOSTS.includes(parsed.hostname)) {
    return handleCors(request, new Response('Only SEC EDGAR URLs are allowed', { status: 403 }));
  }

  // ─── EDGE CACHE (added 6/3/26) ──────────────────────────────────────────────
  // company_tickers.json (and other /files/ statics) change ~daily, but www.sec.gov
  // throttles per egress IP (429) — and the worker shares Cloudflare's IP pool. Serving
  // these from the edge cache means most lookups never touch SEC, killing the 429s.
  const isCacheable = parsed.hostname === 'www.sec.gov' && parsed.pathname.startsWith('/files/');
  const cache = caches.default;
  const cacheKey = new Request(parsed.toString(), { method: 'GET' });
  if (isCacheable) {
    const cached = await cache.match(cacheKey);
    if (cached) return handleCors(request, cached);
  }
  // ────────────────────────────────────────────────────────────────────────────

  // Fetch from SEC with proper headers
  try {
    const secResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': SEC_USER_AGENT,
        'Accept': 'application/json, text/html, */*',
        'Accept-Encoding': 'gzip',
      },
    });

    // Clone response with CORS headers
    const body = await secResponse.arrayBuffer();
    // Cacheable statics get a 6h edge TTL; everything else keeps the original 5 min.
    const cacheControl = (isCacheable && secResponse.ok)
      ? 'public, max-age=21600'
      : 'public, max-age=300';
    const response = new Response(body, {
      status: secResponse.status,
      statusText: secResponse.statusText,
      headers: {
        'Content-Type': secResponse.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': cacheControl,
      },
    });

    // Store successful cacheable responses at the edge (never cache a 429/403).
    if (isCacheable && secResponse.ok) {
      await cache.put(cacheKey, response.clone());
    }

    return handleCors(request, response);
  } catch (err) {
    return handleCors(request, new Response(`Proxy error: ${err.message}`, { status: 502 }));
  }
}

async function handleYahoo(request, reqUrl) {
  // Strip /yahoo prefix: /yahoo/v8/finance/chart/AAPL -> /v8/finance/chart/AAPL
  const remainingPath = reqUrl.pathname.slice('/yahoo'.length);
  const targetUrl = `https://query1.finance.yahoo.com${remainingPath}${reqUrl.search}`;

  try {
    const yahooResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': YAHOO_USER_AGENT,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
      },
    });

    const body = await yahooResponse.arrayBuffer();
    const response = new Response(body, {
      status: yahooResponse.status,
      statusText: yahooResponse.statusText,
      headers: {
        'Content-Type': yahooResponse.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });

    return handleCors(request, response);
  } catch (err) {
    return handleCors(request, new Response(`Yahoo proxy error: ${err.message}`, { status: 502 }));
  }
}

function handleCors(request, response) {
  const origin = request.headers.get('Origin') || '';
  // Exact match for production; localhost/127.0.0.1 allow any port
  // NOTE: Configure Cloudflare rate limiting in the dashboard for abuse prevention
  const isAllowed =
    origin === 'https://wa-jm.github.io' ||
    origin === 'null' ||
    origin === 'http://localhost' || origin.startsWith('http://localhost:') ||
    origin === 'http://127.0.0.1' || origin.startsWith('http://127.0.0.1:');

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', isAllowed ? origin : ALLOWED_ORIGINS[0]);
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
