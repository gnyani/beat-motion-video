---
name: beat-motion-video
description: Make short beat-synced motion videos (launch clips, sponsor or partnership announcements, product promos) as HTML scenes rendered frame by frame to MP4, with motion blur and a mastered mix.
---

# Beat-synced motion video

Short social videos (about 10 to 20 s) built as an HTML/CSS stage and rendered frame by frame in headless Chromium, then encoded with FFmpeg. Every scene change lands on the music's downbeats, text slides in through masks, objects move on springs, and each frame averages several sub-samples for real motion blur. Sound effects are synthesised, so the only licensed audio is the music track you choose.

`template/` (next to this file) is a working 10.8 s, 4:5 example (title, product, offer, three steps, end card). Copy it to a working folder and change it there rather than starting from scratch.

## Requirements

Node 18+, `playwright` with Chromium, `ffmpeg`/`ffprobe`, Python 3 with numpy. If missing: `npm i playwright && npx playwright install chromium`, and install ffmpeg with the system package manager. Fonts in `template/assets/` are Geist and IBM Plex Mono (SIL OFL, licence included).

## 1. Settle the brief (ask once, briefly)

- Format: 4:5 (1080 x 1350, default), 9:16 (1080 x 1920) or 1:1 (1080 x 1080). Set `width`/`height` in `config.json` and the stage size in `film.html`.
- Length and the one message for each scene. Five or six words per line at most.
- Brand: logo file, colours, fonts, product screenshot, the CTA URL.
- Music: a track the user is licensed to use in ads and social posts. Note the BPM. Never ship or commit the music file.
- Every claim on screen must come from the user or the product's own site. No prices or terms unless the user gives them.

## 2. Beat map first

`config.json` holds `bpm`, `leadBeats` (beats before the first downbeat) and `end`. In `scene.js`, `bar(n, beat)` gives the time of any beat, and `T` names the scene starts:

```js
T = { product: bar(0), offer: bar(1), steps: bar(2), end: bar(3), hit: bar(4) };
```

- Scenes start on downbeats; their text leaves about 0.3 s before the next one.
- Find `music.offset`: the time in the track of a strong downbeat (a crash or the drop) minus `bar(0)`. Decode the track with ffmpeg to a WAV, compute a short-window energy envelope with numpy and pick the peaks near the expected grid, or ask the user for the drop's timestamp. Check by listening to the mix against the stills' timings.
- At 110 BPM one bar is 2.18 s: about two bars per scene reads well.

## 3. Build the scenes

`film.html` holds the elements; `scene.js` sets every style in `window.seek(t)`.

- **Pure function of t.** No CSS transitions or animations, no timers, no `Date.now()`. Anything that moves is computed in `seek(t)`.
- Helpers: `spring(dt, w, z)` (closed-form spring; lower `z` overshoots more), `maskY(el, t, tin, tout)` (text slides up through a mask), `kick(t, t0)` (decaying pulse for hits), `seg`, `lerp` and easing functions.
- **Frame 0 is the thumbnail.** The title card must be complete at t = 0 (`maskY(..., -1, ...)`).
- One idea per scene, big type (headlines 76 to 150 px on a 1080 px stage), each line readable for at least 1.5 s.
- A small camera pulse on downbeats sells the sync; keep it under 2 % scale.
- Load everything in `window.ready` (fonts, `img.decode()`), never inside `seek`.
- Do not toggle `display:none` on an element whose size you measure (e.g. to centre it); keep it laid out and use opacity.
- Footage: extract frames to JPG with ffmpeg and draw the frame for `t` onto a canvas. Keep frames as `Image` elements, not `ImageBitmap`s: decoded bitmaps exhaust memory and the render stalls at frame 0.
- Swap the placeholders: the CSS mark in `.lockup` for the real logo `<img>`, `#product .shot` for a screenshot, the tokens in `:root` for brand colours.

Review with stills at every scene change and fix overlaps, clipped text and springs overshooting into other elements:

```sh
node stills.mjs 0 1.6 3.0 4.2 6.3 8.6 10.3      # writes stills/s_<t>.png
```

## 4. Render

```sh
N=2 bash render-all.sh 5 out/silent.mp4
```

- The first argument is SUB, the sub-samples per frame averaged for motion blur. Use 5 for finals; 2 leaves visible ghosting; 1 is a fast draft.
- `N` parallel chunks. N=2 is safe on 8 GB of RAM.
- A final render can take longer than a tool call allows: start it with `nohup ... &`, then poll the logs in `out/chunks/`.

## 5. Sound

- Edit the CUES section of `audio/sfx.py` (pop, tink, chime, thump, swoosh, clack, rattle), placed with the same `bar()` grid.
- Set `music.file`, `music.offset` and `music.fadeOut` in `config.json`, or leave `file` empty for an SFX-only mix.
- `bash audio/mix.sh` mixes, pre-limits, then two-pass loudnorm to -14 LUFS with true peak below -1 dBFS after AAC. A sparse SFX-only mix can land slightly under -14; that's fine.

Mux:

```sh
ffmpeg -i out/silent.mp4 -i audio/final.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest final.mp4
```

## 6. Deliver

- `final.mp4` (H.264, 60 fps, AAC).
- `thumbnail.jpg`: `ffmpeg -i final.mp4 -frames:v 1 -q:v 2 thumbnail.jpg`.
- `poster.png`: a still of the settled end card.
- `storyboard.png`: `ffmpeg -i final.mp4 -vf "fps=1,scale=270:-1,tile=6x2" -frames:v 1 storyboard.png`.
- A short README: the beat map (time, scene), where each claim comes from, the music credit and licence, and asset sources.

## Troubleshooting

- Render stuck at 0 frames: too much decoded image memory (see Footage), or lower N.
- Fallback fonts in the render: load them in `window.ready` with `document.fonts.load` before returning.
- Elements jump between frames: something depends on layout that changes; measure once in `ready` and store it.
- Loudness off target: check that the music offset isn't cutting into silence and that the pre-limit runs before loudnorm.
