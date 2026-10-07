// Deterministic capture: for each sub-frame, call seek(t), screenshot, pipe PNG to FFmpeg.
// With --sub=N > 1, N sub-samples per frame are averaged (tmix) for real motion blur.
// Usage: node render.mjs --sub=5 [--start=S --end=E --port=P --out=out/silent.mp4]
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const FPS = cfg.fps, SUB = Number(args.sub ?? 5), START = Number(args.start ?? 0), PORT = Number(args.port ?? 8766);
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); }).listen(PORT);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(`http://localhost:${PORT}/film.html`); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready);
const END = Number(args.end ?? cfg.end);
const out = args.out ?? 'out/silent.mp4';
fs.mkdirSync(path.dirname(out), { recursive: true });
const vf = SUB > 1 ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB` : 'null';
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-i', '-', '-vf', vf, '-r', String(FPS),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const total = Math.round((END - START) * FPS * SUB);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  // Sub-samples are centred on the frame's timestamp.
  const t = START + i / (FPS * SUB) - (SUB - 1) / (2 * FPS * SUB);
  await page.evaluate(t => window.seek(t), Math.max(0, t));
  const buf = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 120 === 0) console.log(`${i}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end(); await new Promise(r => ff.on('close', r));
await browser.close(); server.close();
console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
