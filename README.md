# SUPERFRAME — Motion Reel

A 15-second realtime motion graphics piece that runs entirely in a single
HTML file. No video files, no build step, no dependencies, no network
requests at runtime.

Click to play. `Space` replays, `F` goes fullscreen.

## What it is

Fifteen one-second scenes cut on a hard timeline, each one a different
visual idea:

| # | Scene | Technique |
|---|-------|-----------|
| 01 | PULSE | expanding shock rings, additive bloom |
| 02 | TITLE CARD | raymarched SDF wordmark, fly-in and dolly-out |
| 03 | EXPLODE | particle core, per-particle colour and size |
| 04 | NOISE FIELD | fbm domain warping |
| 05 | MODULAR GRID | instanced module field with per-cell hierarchy |
| 06 | LIQUID CHROME | metaballs, raymarched, studio light probe |
| 07 | ORBITAL RIG | orbiting camera, dark metal, tight specular |
| 08 | TUNNEL DIVE | corridor SDF, camera inside the geometry |
| 09 | TYPE / SLICE | three sheared slice layers |
| 10 | RGB SPLIT | channel-separated flow field |
| 11 | WARP STREAKS | horizontal speed lines with hot leading tips |
| 12 | PARTICLE VORTEX | 2400 GPU sprites on a spiral |
| 13 | APERTURE | eight-blade camera iris |
| 14 | LOGO LOCKUP | corner-cut mark, built in three beats |
| 15 | END / TAG | card and contact |

## How it is built

- **Rendering** — WebGL, one fragment shader program per scene. Each
  fragment shader is a self-contained scene description; there is no
  uber-shader with an index dispatch, because that path renders black on
  some drivers.
- **Typography in 3D** — the SUPERFRAME wordmark is a signed distance
  field built from stroked polyline glyph skeletons, extruded along z and
  raymarched. There is no font file and no texture atlas.
- **Audio** — one `AudioContext`, synthesised from scratch. Kick, snare,
  hats and risers from filtered noise; bass from detuned saw and square
  through a resonant lowpass; a pentatonic motif with one note per scene;
  a compressor on the master bus; the whole envelope runs on the same
  15-second clock as the visuals. No audio files.
- **Layering** — a WebGL canvas underneath, a 2D canvas on top for type,
  slate and timecode, and a third for realtime grain in `overlay` blend.
- **Frame pacing** — render scale adapts to measured frame time, so the
  reel holds 60fps on modest hardware and scales back up when it can.

## Running it

Open `index.html` in Chrome. That is the whole procedure.

To publish:

```
git clone https://github.com/felipebossolani/space-bunny-animation
cd space-bunny-animation
# serve locally
python3 -m http.server
```

GitHub Pages works as is: the file is self-contained and makes no network
requests, so it can sit at the root of a repository with no changes.

## Origin

This was built from a single-sentence brief in one shot, with no
follow-up corrections to the original instruction. The prompt is kept
verbatim in [`PROMPT.md`](PROMPT.md).

Felipe Bossolani — [felipe@bossolani.com](mailto:felipe@bossolani.com)

## Browser support

Built and verified in Chrome. WebGL and Web Audio are both required; a
missing `AudioContext` degrades to silent playback rather than failing.
Not yet verified in Firefox or Safari.