# beat-motion-video

A Claude skill for short, beat-synced motion videos: launch clips, partnership announcements, product promos.

Claude builds each video as an HTML scene and renders it frame by frame in headless Chromium, then encodes it with FFmpeg:

- Every cut lands on the music's downbeats.
- Text slides in through masks and objects move on springs.
- Each frame blends five sub-samples for real motion blur.
- The mix is mastered to -14 LUFS, the level social platforms play at.

![Example render](examples/preview.gif)

*The bundled template as rendered, with placeholder content. [Full-quality MP4 with sound](examples/example.mp4).*

## Install

```sh
npx skills add gnyani/beat-motion-video -g
```

That works for any agent the [skills CLI](https://github.com/vercel-labs/skills) supports. To pick one and skip the prompts:

```sh
npx skills add gnyani/beat-motion-video -g -a claude-code -y
npx skills add gnyani/beat-motion-video -g -a cursor -y
npx skills add gnyani/beat-motion-video -g -a codex -y
```

Drop `-g` to install it for the current project only.

**Claude Code plugin**

```text
/plugin marketplace add gnyani/beat-motion-video
/plugin install beat-motion-video@gnyani
```

**Claude app (claude.ai and desktop)**

1. Download [beat-motion-video.zip](https://github.com/gnyani/beat-motion-video/raw/main/dist/beat-motion-video.zip).
2. In Claude, open **Customize > Skills**, click **+**, then **Create skill**, then **Upload a skill**, and choose the zip.

Code execution must be on. Rendering needs a browser and FFmpeg, so it runs best where the agent has a full machine (Claude Code, Cowork, Cursor, Codex).

## Use it

Ask Claude for a video and give it what's on screen:

> Make a 15-second 4:5 launch video for Acme's new offline mode. Here's our logo, colours and a screenshot. Track is 112 BPM, the drop is at 0:41. End on acme.com/offline.

Claude settles the brief, maps the scenes to the beat, builds and reviews stills, renders, mixes, and hands back the MP4 with a thumbnail, poster and storyboard.

## What's inside

```text
skills/beat-motion-video/
  SKILL.md          the instructions Claude follows
  template/
    config.json     size, fps, BPM, length, music offset
    film.html       the stage and every element
    scene.js        seek(t): every frame as a pure function of time
    render.mjs      seek, screenshot, pipe to FFmpeg, average sub-frames
    render-all.sh   parallel chunked render
    stills.mjs      review frames at chosen times
    audio/sfx.py    synthesized sound effects on the beat grid
    audio/mix.sh    music + SFX, two-pass loudness normalisation
    assets/         Geist and IBM Plex Mono (SIL OFL)
```

## Requirements

Node 18+, `playwright` with Chromium (`npm i playwright && npx playwright install chromium`), FFmpeg, and Python 3 with numpy.

## Music

No music is included. Use a track you're licensed to use in ads and social posts, and don't commit it to a repo.

## Licence

MIT, see [LICENSE](LICENSE). The bundled fonts are under the SIL Open Font License 1.1.

Built by [Gnyani](https://github.com/gnyani) for the [Nines Championship](https://nonines.dev) launch videos.
