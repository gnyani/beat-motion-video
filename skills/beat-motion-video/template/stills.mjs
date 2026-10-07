// Screenshot chosen moments for review. Usage: node stills.mjs 0 1.2 3.4 ...   (writes stills/s_<t>.png)
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.cwd(), cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); }).listen(9065);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: 1 });
page.on('console', m => console.log('console:', m.text())); page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('http://localhost:9065/film.html'); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
const times = process.argv.slice(2).map(Number);
fs.mkdirSync('stills', { recursive: true });
for (const t of times) { await page.evaluate(t => window.seek(t), t); await page.screenshot({ path: `stills/s_${t.toFixed(2)}.png` }); }
await browser.close(); server.close();
