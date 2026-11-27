/**
 * `pnpm lighthouse`: Lighthouse performance on a throttled Slow 3G phone, for the
 * main pages of the local preview (start it first: `pnpm build && pnpm preview`).
 *
 * SPEC: performance 90+, first content visible in under 2 seconds.
 * Slow 3G here: 400 ms round trip, 400 kbit/s, CPU 4× slower (simulated).
 * Exits with 1 when a page misses either target.
 */
import { createServer } from 'node:http';
import { brotliCompressSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';

const ORIGIN = process.env['LIGHTHOUSE_ORIGIN'] ?? 'http://localhost:4321';
const PROXY_PORT = 4329;
const BASE = `http://localhost:${PROXY_PORT}`;

/**
 * `astro preview` sends everything uncompressed; Cloudflare compresses text with
 * brotli. This proxy does the same, so the throttled numbers match production.
 */
const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/;
const proxy = createServer((req, res) => {
  void (async () => {
    const upstream = await fetch(`${ORIGIN}${req.url ?? '/'}`, {
      headers: { accept: req.headers.accept ?? '*/*' },
      redirect: 'manual',
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    const headers = Object.fromEntries(upstream.headers);
    delete headers['content-length'];
    delete headers['content-encoding'];
    delete headers['transfer-encoding'];
    const type = upstream.headers.get('content-type') ?? '';
    const brotli = COMPRESSIBLE.test(type) && /\bbr\b/.test(String(req.headers['accept-encoding']));
    const out = brotli ? brotliCompressSync(body) : body;
    res.writeHead(upstream.status, {
      ...headers,
      ...(brotli ? { 'content-encoding': 'br', vary: 'accept-encoding' } : {}),
      'content-length': String(out.length),
    });
    res.end(out);
  })().catch((error: unknown) => {
    res.writeHead(502).end(String(error));
  });
});
await new Promise<void>((resolve) => proxy.listen(PROXY_PORT, resolve));
const PAGES = [
  '/tk',
  '/en/search',
  '/en/programs/demo-u6-computer-science',
  '/en/universities/demo-university-1',
  '/en/scholarships',
  '/en/scholarships/demo-scholarship-1',
];
const MIN_SCORE = 90;
const MAX_FCP_MS = 2000;
const PORT = 9333;

const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
let failed = false;
try {
  for (const path of PAGES) {
    const result = await lighthouse(
      `${BASE}${path}`,
      { port: PORT, output: 'json', logLevel: 'error', onlyCategories: ['performance'] },
      {
        extends: 'lighthouse:default',
        settings: {
          formFactor: 'mobile',
          screenEmulation: {
            mobile: true,
            width: 390,
            height: 844,
            deviceScaleFactor: 3,
            disabled: false,
          },
          throttlingMethod: 'simulate',
          throttling: { rttMs: 400, throughputKbps: 400, cpuSlowdownMultiplier: 4 },
        },
      },
    );
    const lhr = result?.lhr;
    if (!lhr) throw new Error(`No Lighthouse result for ${path}`);
    const score = Math.round((lhr.categories['performance']?.score ?? 0) * 100);
    const fcp = lhr.audits['first-contentful-paint']?.numericValue ?? Infinity;
    const lcp = lhr.audits['largest-contentful-paint']?.numericValue ?? Infinity;
    const ok = score >= MIN_SCORE && fcp < MAX_FCP_MS;
    if (!ok) failed = true;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${path.padEnd(42)} score ${String(score).padStart(3)}  ` +
        `FCP ${(fcp / 1000).toFixed(2)} s  LCP ${(lcp / 1000).toFixed(2)} s`,
    );
  }
} finally {
  await browser.close();
  proxy.close();
}
process.exitCode = failed ? 1 : 0;
