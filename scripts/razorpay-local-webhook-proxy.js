/**
 * Local reverse proxy so ONE fixed ngrok domain can serve BOTH Phase 1 + Phase 2
 * Razorpay webhooks without changing the URL every time ngrok restarts.
 *
 *   /api/payments/razorpay/*     → Phase 1  (localhost:5000)
 *   /api/v1/payments/razorpay/*  → Phase 2  (localhost:5001)
 *
 * Start:  node scripts/razorpay-local-webhook-proxy.js
 * Then:   ngrok http --url=<your-fixed-domain> 5055
 */
const http = require('http');

const PROXY_PORT = Number(process.env.RAZORPAY_LOCAL_PROXY_PORT || 5055);
const PHASE1 = String(process.env.PHASE1_BACKEND_ORIGIN || 'http://127.0.0.1:5000').replace(/\/$/, '');
const PHASE2 = String(process.env.PHASE2_BACKEND_ORIGIN || 'http://127.0.0.1:5001').replace(/\/$/, '');

function pickUpstream(pathname) {
  if (pathname.startsWith('/api/v1/payments/razorpay')) return PHASE2;
  if (pathname.startsWith('/api/payments/razorpay')) return PHASE1;
  return null;
}

const server = http.createServer(async (req, res) => {
  const pathname = String(req.url || '').split('?')[0];
  const upstreamBase = pickUpstream(pathname);
  if (!upstreamBase) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Unknown path. Use /api/payments/razorpay/* (P1) or /api/v1/payments/razorpay/* (P2)',
      }),
    );
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const target = `${upstreamBase}${req.url}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        'x-razorpay-signature': req.headers['x-razorpay-signature'] || '',
        'x-razorpay-event-id': req.headers['x-razorpay-event-id'] || '',
        'user-agent': req.headers['user-agent'] || 'razorpay-local-proxy',
      },
      body: ['GET', 'HEAD'].includes(String(req.method || '').toUpperCase()) ? undefined : body,
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    });
    res.end(text);
    console.log(`[proxy] ${req.method} ${pathname} → ${upstreamBase} (${upstream.status})`);
  } catch (err) {
    console.error(`[proxy] ${req.method} ${pathname} failed:`, err?.message || err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: err?.message || 'Upstream failed' }));
  }
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[razorpay-local-proxy] listening on http://127.0.0.1:${PROXY_PORT}`);
  console.log(`  Phase 1 → ${PHASE1}/api/payments/razorpay/webhook`);
  console.log(`  Phase 2 → ${PHASE2}/api/v1/payments/razorpay/webhook`);
});
