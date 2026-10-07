"""Original synthesized sound effects, placed on the same beat grid as scene.js. Writes audio/sfx.wav (48 kHz stereo).
Everything here is generated with numpy, so there are no licensing questions. Edit the CUES section to match your scenes."""
import json, numpy as np, wave
cfg = json.load(open('config.json'))
SR = 48000; B = 60 / cfg['bpm']; D0 = cfg['leadBeats'] * B; END = cfg['end']
bar = lambda n, beat=0: D0 + (n * 4 + beat) * B
T = dict(product=bar(0), offer=bar(1), steps=bar(2), end=bar(3), hit=bar(4))   # keep in step with scene.js
out = np.zeros((int(SR * (END + .5)), 2))
rng = np.random.default_rng(11)

# ---------- Sound library: add(sound, time, gain, pan) ----------
def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); sig = sig[: len(out) - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:i + len(sig), 0] += sig * gain * l * 1.414
    out[i:i + len(sig), 1] += sig * gain * r * 1.414

def env(n, a=.002, d=.2):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)

def pop(f0=880, dur=.09):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f0 * (1 + .6 * np.exp(-t / .012))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .025)

def tink(f0=2100, dur=.9, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for ratio, amp, dec in [(1, 1, .35), (2.76, .55 * bright, .18), (5.40, .3 * bright, .09), (8.93, .15 * bright, .05)]:
        s += amp * np.sin(2 * np.pi * f0 * ratio * t + rng.uniform(0, 6)) * np.exp(-t / dec)
    click = rng.normal(0, 1, n) * np.exp(-t / .003) * .4
    return (s + click) * np.minimum(t / .001, 1) / 2

def chime(freqs, dur=1.8, dec=.6):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for k, f in enumerate(freqs):
        s += np.sin(2 * np.pi * f * t) * np.exp(-t / (dec * (1 - .12 * k))) / (k + 1) ** .3
        s += .25 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / (dec * .4))
    return s * np.minimum(t / .003, 1) / len(freqs)

def thump(dur=.4, f1=52):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + 70 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .12)

def lowpass_noise(n, cutoff):
    noise = rng.normal(0, 1, n); a = np.exp(-2 * np.pi * cutoff / SR); y = np.zeros(n); acc = 0.0
    for i in range(n): acc = a[i] * acc + (1 - a[i]) * noise[i]; y[i] = acc
    return y

def swoosh(dur=.3, up=True):
    n = int(dur * SR); t = np.arange(n) / SR
    cutoff = (500 + 6000 * (t / dur) ** 2) if up else (6500 - 6000 * (t / dur) ** .5)
    return lowpass_noise(n, cutoff) * np.sin(np.pi * np.minimum(t / dur, 1)) ** 1.5 * 3

def clack():
    # Slot-reel detent: a woody click plus a short bright tick.
    n = int(.06 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 620 * t) * np.exp(-t / .012)
    tick = (np.sin(2 * np.pi * 2600 * t) * .5 + rng.normal(0, 1, n) * .5) * np.exp(-t / .004)
    return body * .7 + tick * .6

def rattle(dur=.35):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for k in range(7):
        i = int((k * .045 + rng.uniform(0, .01)) * SR)
        m = min(n - i, int(.03 * SR)); tt = np.arange(m) / SR
        s[i:i + m] += (rng.normal(0, 1, m) * .5 + np.sin(2 * np.pi * rng.uniform(300, 600) * tt)) * np.exp(-tt / .008) * (1 - k / 8)
    return s

# ---------- CUES ----------
add(pop(880, .1), B, .12)                                           # lead-in nod
add(swoosh(.32), T['product'] - .26, .08)                           # title exits
add(thump(.45, 48), T['product'] + .1, .45); add(tink(1500, .6, .6), T['product'] + .12, .05)
add(clack(), bar(0, 2), .1)                                         # product push-in nudge
add(swoosh(.35, False), T['offer'] - .24, .07)
add(pop(700, .16), T['offer'], .3); add(pop(1400, .1), T['offer'] + .03, .15)
add(chime([1318.5, 1568.0, 2093.0, 2637.0], 1.8, .55), T['offer'] + .05, .12)
for i in range(6): add(tink(2600 + 300 * i, .5, .8), T['offer'] + .08 + i * .05, .045, (i - 2.5) * .3)
add(swoosh(.3, False), T['steps'] - .2, .05)
for k, f in enumerate([1046.5, 1318.5, 1568.0]):
    st = T['steps'] + k * B
    add(pop(700 + 120 * k, .1), st + .02, .14, (k - 1) * .3)
    add(chime([f * 2], .7, .2), st + .32, .07, (k - 1) * .3)
add(swoosh(.3), T['end'] - .22, .05)
add(pop(520, .14), T['end'] + .12, .14)                             # lockup
add(pop(760, .12), bar(3, 2) + .04, .14)                            # CTA button
add(chime([1046.5, 1318.5, 1568.0, 2093.0], 2.0, .7), T['hit'], .14); add(tink(2350, 1.4, 1.1), T['hit'], .12)

out = out * .9
pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)
with wave.open('audio/sfx.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('sfx peak', round(float(np.abs(out).max()), 3), 'END', END)
