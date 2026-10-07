// Every frame is a pure function of t: window.seek(t) sets every element's style for time t.
// No timers, no CSS transitions or animations, no Date.now(). That makes renders deterministic and lets
// render.mjs take several sub-samples per frame for motion blur.

// ---------- Helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));          // 0..1 progress of t through [a, b]
const lerp = (a, b, p) => a + (b - a) * p;
const eo3 = p => 1 - Math.pow(1 - p, 3);
const eio3 = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const eoExpo = p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);
const eiQuad = p => p * p;
// Closed-form damped spring: 0 before dt=0, settles at 1. w = stiffness, z = damping (lower = more overshoot).
function spring(dt, w = 14, z = .58) {
  if (dt <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z * w / wd) * Math.sin(wd * dt));
}
// Decaying pulse that starts at t0 (for hits on the beat).
const kick = (t, t0, k = 8) => t >= t0 ? Math.exp(-k * (t - t0)) : 0;
const $ = id => document.getElementById(id);
const css = (el, s) => Object.assign(el.style, s);
// Slide a masked line up into view at tin and out at tout. tin < 0 means visible from frame 0.
function maskY(el, t, tin, tout = null, dur = .5) {
  let y = 112;
  if (t >= tin) y = 112 * (1 - eoExpo(seg(t, tin, tin + dur)));
  if (tout !== null && t >= tout) y = -112 * eio3(seg(t, tout, tout + .3));
  el.style.transform = `translateY(${y}%)`;
  el.style.visibility = Math.abs(y) >= 111.9 ? 'hidden' : 'visible';
}

// ---------- Beat map (from config.json; keep audio/sfx.py on the same grid) ----------
let B, D0, bar, T, END, bursts;

window.ready = (async () => {
  const cfg = await (await fetch('config.json')).json();
  B = 60 / cfg.bpm; D0 = cfg.leadBeats * B; END = cfg.end;
  bar = (n, beat = 0) => D0 + (n * 4 + beat) * B;               // bar 0 is the first downbeat after the lead-in
  // Scene starts on downbeats. Retime the whole film by editing these.
  T = { product: bar(0), offer: bar(1), steps: bar(2), end: bar(3), hit: bar(4) };
  window.FILM = { B, END, T };
  await document.fonts.load('900 italic 100px Geist'); await document.fonts.load('500 20px Plex'); await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  bursts = Array.from({ length: 6 }, () => {
    const d = document.createElement('div'); d.className = 'burst';
    d.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5L7 14l-5.3-5 7.2-.9z" fill="#e5c774" stroke="#29273e" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    $('bursts').appendChild(d); return d;
  });
  return true;
})();

// Shared exit: falls away under gravity around t0.
const fall = (t, t0) => eiQuad(seg(t, t0 - .22, t0 + .14));

window.seek = t => {
  // Camera: a pulse on every downbeat, a bigger thump on the first one and on the final hit.
  let th = .9 * kick(t, T.product, 7) * Math.cos((t - T.product) * 22) + .7 * kick(t, T.hit, 7) * Math.cos((t - T.hit) * 22);
  for (let c = T.product + 2 * B; c < END; c += 2 * B) th += .25 * kick(t, c, 10);
  css($('cam'), { transform: `scale(${1 + .012 * th})` });

  // 1. Title card: visible from frame 0, exits just before the first downbeat.
  maskY($('hK'), t, -1, T.product - .34, .45);
  maskY($('h1'), t, -1, T.product - .32, .45);
  maskY($('h2'), t, -1, T.product - .29, .45);
  maskY($('hS'), t, -1, T.product - .32, .45);

  // 2. Product: window rises on the downbeat, slow push-in, falls away into the offer.
  maskY($('pK'), t, T.product + .02, T.offer - .3, .45);
  maskY($('p1'), t, T.product + .06, T.offer - .28, .45);
  const pr = spring(t - (T.product - .02), 12, .78), px = fall(t, T.offer);
  css($('product'), { display: t > T.product - .05 && px < 1 ? 'block' : 'none',
    transform: `translateY(${(1 - pr) * 900 + px * 1150}px) rotate(${(1 - clamp(pr)) * 3 - px * 6}deg) scale(${1 + .015 * kick(t, bar(0, 2), 9)})`,
    opacity: 1 - seg(px, .75, 1) });
  css($('product').querySelector('.shot'), { transform: `scale(${1 + .12 * eio3(seg(t, T.product + .2, T.offer - .1))})` });

  // 3. Offer: ticket pops in on the downbeat with a star burst.
  maskY($('o1'), t, T.offer + .02, T.steps - .3, .45);
  maskY($('o2'), t, T.offer + B / 2, T.steps - .27, .45);
  const q = spring(t - (T.offer - .02), 12, .5), tOut = eio3(seg(t, T.steps - .26, T.steps + .08));
  css($('ticket'), { display: t > T.offer - .03 && tOut < 1 ? 'block' : 'none', opacity: clamp(q * 3) * (1 - tOut),
    transform: `translateY(${(1 - clamp(q, 0, 1.2)) * 120 - tOut * 60}px) scale(${Math.max(0, lerp(.35, 1, q))}) rotate(${Math.sin(t * 2.4) * 1.5}deg)` });
  bursts.forEach((d, i) => {
    const ang = i < 3 ? Math.PI + (i - 1) * .32 : (i - 4) * .32, p = eo3(seg(t, T.offer, T.offer + .7)), r = 300 + 140 * p;
    css(d, { left: (540 + Math.cos(ang) * r * 1.12 - 35) + 'px', top: (755 + Math.sin(ang) * r * .6 - 35) + 'px',
      opacity: t > T.offer ? 1 - seg(t, T.offer + .9, T.offer + 1.4) : 0, transform: `scale(${lerp(.3, i % 2 ? .8 : 1.1, p)}) rotate(${i * 40 + p * 90}deg)` });
  });

  // 4. Steps: one per beat; the circle fills a little after each lands.
  maskY($('sK'), t, T.steps + .02, T.end - .3, .45);
  [0, 1, 2].forEach(k => {
    const el = $('st' + k), st = T.steps + k * B, p = spring(t - st, 14, .62);
    const ex = eio3(seg(t, T.end - .28 + k * .04, T.end + .06 + k * .04));
    css(el, { top: (430 + k * 170) + 'px', display: t >= st - .02 && ex < 1 ? 'flex' : 'none', opacity: clamp(p * 3) * (1 - ex),
      transform: `translateX(${(1 - clamp(p, 0, 1.2)) * 140 - ex * 160}px)` });
    maskY(el.querySelector('.mask > span'), t, st + .03, null, .42);
    const n = el.querySelector('.n'); n.classList.toggle('done', t >= st + .32);
    n.style.transform = `scale(${1 + .16 * kick(t, st + .32, 9) * Math.cos((t - st - .32) * 20)})`;
  });

  // 5. End card: lockup, date, hours, then the CTA button, which "presses" on the final hit.
  const lk = spring(t - (T.end + .04), 14, .6);
  css($('lockup'), { visibility: t > T.end ? 'visible' : 'hidden', opacity: clamp(lk * 3), display: 'inline-flex',
    transform: `translateY(${(1 - clamp(lk, 0, 1.2)) * -40}px) scale(${lerp(.9, 1, clamp(lk))})` });
  maskY($('e1'), t, T.end + B / 2, null, .5);
  maskY($('e2'), t, T.end + B, null, .5);
  const cp = spring(t - bar(3, 2), 14, .55);
  const press = t >= T.hit ? Math.exp(-10 * (t - T.hit)) * Math.max(0, Math.sin((t - T.hit) * 12)) : 0;
  const cw = $('cta').offsetWidth;   // keep the element laid out (never display:none) so its width is stable
  css($('cta'), { left: (540 - cw / 2) + 'px', top: '820px', opacity: clamp(cp * 2),
    transform: `translateY(${(1 - cp) * 60 + press * 6}px) scale(${1 + .04 * kick(t, T.hit, 6)})`, boxShadow: `0 ${7 - press * 6}px 0 #29273e` });
};
