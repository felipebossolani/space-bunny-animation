PROMPT / 2026-02-11

Brief exactly as submitted, one shot, no follow-up corrections to the
initial instruction:

---
in one html file, make a dynamic 15-second motion graphics video that shows
what an incredible motion designer you are, like it's your showreel for a
resume. go all out. 16:9 fullscreen, sound made with web audio, click to play
---

Context: single sentence of intent, deliberately open ended. No tech stack,
no scene list, no art direction, no brand, no copy, no audio brief. The
model chose everything.

What came out of it, for the record:

- 15 one-second scenes on a hard cut timeline, each a distinct visual idea
- 15 separate GLSL fragment shaders, one program per scene
- A signed-distance-field wordmark built from stroked polyline glyphs,
  raymarched in 3D with a fly-in and dolly-out
- Metaball liquid chrome, an orbital rig, a corridor tunnel, a particle
  vortex at 2400 sprites, an eight-blade camera iris
- Procedural Web Audio score: pentatonic motif, one note per scene,
  sub bass, kick/snare/hat, risers into every cut
- Realtime grain, vignette, letterboxed type, safe-area marks, timecode
- Adaptive resolution scaling driven by measured frame time

Debugging was the real work. See the git log for the individual fixes; the
most interesting ones were a uber-shader that rendered pure black on
ANGLE, a `#elif defined` chain silently mis-parsed by the GLSL ES
preprocessor, and a fresnel term that flooded an object made of thin tori.

The whole thing ships as one HTML file with no build step, no dependencies
and no network requests at runtime.