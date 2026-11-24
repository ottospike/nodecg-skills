# Spritesheet mask reveal

> **Leia este documento inteiro quando a transição de entrada/saída for um matte de
> vídeo** — o designer entregou um `.mov`/`.webm` de tinta, pincel, dissolve ou riscos
> (luminância ou alfa) e ele precisa virar reveal de um elemento HTML; ou quando as
> tentativas com gradiente CSS, `clip-path` ou `feDisplacementMap` saíram erradas
> (barn-door, conteúdo esticado, barras de veneziana).
>
> Subskill de `nodecg`. Para animação comum de entrada/saída, o caminho é
> `animacao-gsap.md` — este aqui é só para o matte orgânico.

The reliable way to play a designer's organic reveal matte over HTML content.
Only the **mask** carries the texture; the content (video/text/logos) stays
pixel-crisp. Beats CSS-generated attempts:

- `clip-path` inset → reads as a wipe / "change width", not a dissolve.
- `feDisplacementMap` on the content → **stretches/melts** the content.
- `scaleX` a frayed rect → **barn-door**.
- tiled gradient threshold → **venetian-blind bars**, mechanical grid.
- animated video-as-mask → not supported in CSS; canvas compositing can't reach DOM content.

A prebaked spritesheet stepped through `mask-position` sidesteps all of these.

## 1. Probe the matte
```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,pix_fmt,r_frame_rate,nb_frames,duration \
  -of default=noprint_wrappers=1 "mask reveal.mov"
```
- `pix_fmt` with `a` (e.g. `yuva444p12le`, VP9 alpha) → has **alpha**. Prefer this source.
- no alpha (e.g. `yuv420p`) → **luminance** matte (white = reveal). Usable, but you must turn luminance into alpha, or set `mask-mode: luminance`.

## 2. Find the transition frames (don't sprite the whole clip)
Most mattes reveal fast then hold. Sprite ONLY the transition. Eyeball it with a montage:
```bash
# every 4th of the first 40 frames, tiled 5x2, alpha shown as gray
ffmpeg -y -i "mask reveal.mov" \
  -vf "select='lt(n\,40)*not(mod(n\,4))',alphaextract,scale=300:169,tile=5x2" \
  -frames:v 1 montage.png
```
Read `montage.png`: black = hidden, white = revealed. Note first fully-black frame and first fully-white frame → that's your range.

## 3. Build the spritesheet (single row is simplest)
```bash
# frames A..B, one row, alpha preserved
ffmpeg -y -i "mask reveal.mov" \
  -vf "select='between(n\,A\,B)',scale=CW:CH,setsar=1,format=rgba,tile=Nx1" \
  -frames:v 1 IN.png
```
- **GPU texture limit ≈ 16384 px per side.** `N * CW` and `N * CH` must stay under it. If a single row overflows, use a grid (`tile=colsxrows`) and step in 2-D.
- Verify: `node -e "const b=require('fs').readFileSync('IN.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"`
- These sheets are small (a 27-frame 427×240 strip ≈ 250 KB).

## 4. OUT = invert the alpha (not reverse playback)
Inverting alpha and playing **forward** keeps the brush moving the same
direction as IN (looks intentional); reverse playback retraces backwards.
```bash
ffmpeg -y -i "IN.png" -vf "format=rgba,lut=a=negval" OUT.png
```
IN frame0 = hidden → OUT frame0 = revealed, so OUT's first frame matches the
rest (revealed) state — no jump when you switch sheets at `stop()`.

**Combine IN + OUT into ONE sheet — do NOT swap `mask-image` at runtime.**
Switching `mask-image` from IN.png to OUT.png on OUT causes a **1-frame flicker**
(Chromium paints one frame with no mask → the whole block flashes fully
revealed). Fix: stack them into a single 2-row sheet and only move
`mask-position` (X = frame, Y = row):
```bash
ffmpeg -y -i IN.png -i OUT.png -filter_complex "[0:v][1:v]vstack=inputs=2,format=rgba" INOUT.png
```
Row 0 = IN, row 1 = OUT. `mask-image` never changes → no flicker.

## 5. CSS — apply as a mask
```css
#target {
  -webkit-mask-image: url("IN.png");  mask-image: url("IN.png");
  -webkit-mask-repeat: no-repeat;     mask-repeat: no-repeat;
  /* combined 2-row sheet, N cols: */
  -webkit-mask-size: calc(N*100%) 200%;  mask-size: calc(N*100%) 200%;
  /* rest = revealed = last IN frame (row 0): */
  -webkit-mask-position: 100% 0%;      mask-position: 100% 0%;
}
```
2-row `setFrame(i,row)`: `px = i/(N-1)*100`, `py = row ? 100 : 0`, set
`mask-position: px% py%`. IN = row 0, OUT = row 1. Never touch `mask-image`.
PNG alpha masks use the **alpha** channel by default (opaque = shows). If you
sprited a luminance matte instead, add `mask-mode: luminance` (white = shows).
Cell aspect ≠ target aspect → the matte stretches; crop the source to the
target region first if that matters.

## 6. GSAP frame-stepping (single row)
```js
const SP_N = N;                 // frames per row (combined 2-row sheet)
const el = document.getElementById("target");
const proxy = { f: SP_N - 1 };  // start revealed

function setFrame(i, row){       // row 0 = IN, row 1 = OUT — mask-image NEVER changes
  i = Math.max(0, Math.min(SP_N - 1, Math.round(i)));
  const px = (i/(SP_N-1))*100, py = row ? 100 : 0;
  el.style.webkitMaskPosition = px + "% " + py + "%";
  el.style.maskPosition        = px + "% " + py + "%";
}
setFrame(SP_N - 1, 0);

function playIn(){
  proxy.f = 0; setFrame(0, 0);
  gsap.to(proxy, { f: SP_N-1, duration: 0.8, ease: "steps("+(SP_N-1)+")",
                   onUpdate: () => setFrame(proxy.f, 0) });
}
function playOut(onDone){
  proxy.f = 0; setFrame(0, 1);
  gsap.to(proxy, { f: SP_N-1, duration: 0.7, ease: "steps("+(SP_N-1)+")",
                   onUpdate: () => setFrame(proxy.f, 1), onComplete: onDone });
}
```
`ease: "steps(N-1)"` = true frame-by-frame playback (no interpolation blur).
Bigger grids: `col=i%COLS, row0=(i/COLS|0)`, `px=col/(COLS-1)*100`,
`py=rowIdx/(ROWS-1)*100`, `mask-size: calc(COLS*100%) calc(ROWS*100%)`.

## 7. Preload before ANY animation (no first-play flash)
```js
function preload(){
  const imgs = ["IN.png","OUT.png"].map(s => {
    const im = new Image(); im.src = s;
    return im.decode ? im.decode().catch(()=>{}) : Promise.resolve();
  });
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  return Promise.all([...imgs, fonts]);
}
const ready = preload();
// gate: function playIn(){ ready.then(() => { ...gsap... }); }
```
`Image().decode()` forces the bitmap into the shared cache, so the CSS mask
(same URL) paints instantly. The rest-state sheet is already applied in CSS, so
it loads at boot; only the *other* sheet needs the warm-up.

## Rotating the reveal orientation (e.g. vertical streaks → horizontal)
There is no `mask-rotate` in CSS, and rotating the element rotates the content
too. Rotate the **sheet cells** instead. Rotating each frame in place and
keeping the grid layout is **equivalent** to rotating the whole image and
swapping the traversal axis — pick the per-cell way so the stepping code and
`mask-size` stay unchanged.

`crop`'s `eval=frame` is missing in some ffmpeg builds (`Error applying option
'eval'`). Robust detile = crop each cell in a shell loop, `transpose`, re-tile:
```bash
S=/tmp/cells; rm -f "$S"/*.png
for i in $(seq 0 $((N-1))); do x=$((CW*i));
  ffmpeg -y -i IN.png  -vf "crop=CW:CH:$x:0,transpose=1,format=rgba" "$S/a_$i.png" 2>/dev/null
  ffmpeg -y -i OUT.png -vf "crop=CW:CH:$x:0,transpose=1,format=rgba" "$S/b_$i.png" 2>/dev/null
done
ffmpeg -y -start_number 0 -i "$S/a_%d.png" -vf "tile=${N}x1,format=rgba" IN_r.png
ffmpeg -y -start_number 0 -i "$S/b_%d.png" -vf "tile=${N}x1,format=rgba" OUT_r.png
ffmpeg -y -i IN_r.png -i OUT_r.png -filter_complex "[0:v][1:v]vstack=inputs=2,format=rgba" INOUT.png
```
- `transpose=1` = 90° CW, `transpose=2` = 90° CCW, `hflip,vflip` = 180°.
- The grid stays N×2 → `mask-size` and the `setFrame(i,row)` stepping don't change; only the image is swapped. Overwrite the existing `INOUT.png` and just hard-refresh.
- **Caveat:** a 90° turn makes each cell portrait; stretched into a landscape
  target it elongates the streaks (~3× here). If too smeared, crop the matte to
  the target region before spriting instead of stretching the whole frame.

## Match the mask orientation to the box aspect (avoid a distorted sweep)
`mask-size: <N*100%> 200%` makes each sprite cell **stretch to fill 100%×100%
of the element box** (exactly like stretching a frame PNG to fit). That stretch
is fine when the cell aspect ≈ the box aspect, but a paint reveal is a
**directional sweep** — stretching a portrait sweep onto a wide/short bar
squishes the sweep axis (reads as an obvious "bottom→top") and smears the
streaks. You can't fix it with "more scale" — it's *already* max-stretched. The
fix is a variant whose native direction matches the box:

- **Vertical sweep** (`INOUT_lite`, the 90°-rotated one) → tall/square boxes.
- **Horizontal sweep** (non-rotated) → wide/short bars. Build it WITHOUT
  `transpose`, just scale:
  ```bash
  # per cell: crop 427-wide cell → scale → tile; then vstack IN/OUT
  ffmpeg -y -i IN.png  -vf "crop=427:240:$((427*i)):0,scale=256:144,format=rgba" cell.png
  ```
- **Center-out** (opens from the middle to both edges) → symmetric bars. Mirror
  each cell: right half = the sweep (reveals center→right), left half = its
  hflip (reveals center→left):
  ```bash
  ffmpeg -y -i IN.png -filter_complex \
    "[0:v]crop=427:240:$((427*i)):0,scale=128:144,format=rgba,split[l0][r];[l0]hflip[l];[l][r]hstack=inputs=2" \
    -frames:v 1 cell.png
  ```
  (If it opens edges→center instead, the base sweeps the other way — swap which
  half gets `hflip`.)

All variants keep the **same 27×2 grid and stepping code** — only the PNG and
the CSS `mask-image` URL change. Keep a per-aspect set (`INOUT_lite`,
`INOUT_h_lite`, `INOUT_c_lite`) and point each graphic at the right one; they
all share one decoded texture per URL.

## Streak direction ≠ sweep direction (they're perpendicular)
A paint matte has TWO axes and they rotate together:
- **Streaks** = the brush/drip texture.
- **Sweep** = the direction the reveal front travels.

For the typical top-down paint matte: **non-rotated** = *vertical streaks + horizontal
sweep*; **90°-rotated** (`INOUT_lite`) = *horizontal streaks + vertical sweep*.
So a request like "make it horizontal" is ambiguous — confirm whether they mean
horizontal **streaks** or horizontal **sweep**. You cannot get horizontal streaks
AND horizontal sweep from one matte (rotating swaps both at once). Verify a cell
with `ffmpeg -i INOUT.png -vf "crop=CW:CH:$((13*CW)):0,alphaextract,scale=..." f.png`
and look before assigning a variant.

## OUT sweep direction (reverse it with hflip)
Alpha-inverting IN gives an OUT that hides in the **same** direction IN revealed.
To make OUT sweep the opposite way (e.g. IN left→right, OUT right→left), `hflip`
the OUT row when building the sheet:
```bash
ffmpeg -y -i OUT.png -vf "crop=CW:CH:$((CW*i)):0,scale=...,hflip,format=rgba" cell.png
```

## Performance & quality — the light + performant sweet spot
- **Spatial resolution is the cheapest lever.** A mask is stretched-to-fill and a
  soft edge looks *fine* (often better — less "granular"). Half the cell res = **¼
  the GPU texture**. Drop res before anything else.
- **Frames drive fluidity, but are capped by the SOURCE.** You can't be smoother
  than the real transition frames (~30 in a fast paint). Exceeding that needs
  `minterpolate` (heavier + optical-flow ghosting on organic mattes). ~30 frames
  over ~0.5s is already ~60fps-ish.
- **Keep `steps` + `Math.round`.** Continuous `mask-position` (no round) straddles
  two cells → a **seam glitch** (two half-frames spliced). Never fake smoothness
  that way; add real frames instead.
- **Runtime cost = the mask REPAINT per frame** (identical for CSS/GSAP/WAAPI).
  Smaller texture + fewer simultaneously-masked elements = smoother. GSAP's extra
  per-frame JS callback is negligible at broadcast scale; its flexibility
  (stagger, kill/interrupt, coordinated in-points) is worth it.
- **PNG raster is correct** for organic mattes; SVG gives no gain (it rasterizes
  to the same texture; complex paths cost more). SVG only wins for *geometric*
  masks (clean wipe, radial center-out, shapes) — but then you lose the paint.

## Per-element masking + overflowing decorations
- For a row of cards, mask **each card** (same URL = one shared decoded texture)
  with a stagger — cleaner and fits the card aspect better than masking the whole
  row.
- **Overflowing decorations get clipped.** If a card has props that poke OUTSIDE
  its box, masking the card box hides those parts **even at rest** (the mask cell
  only covers the box). Fix: wrap just the revealable body in the masked element
  and keep the overflowing props OUTSIDE it; give the props their own mask-in at
  chosen in-points (`paintProp(el,row,delayInSeconds,dur)`).
- **Interrupt-safety:** track the OUT finisher (`gsap.delayedCall`) in a var and
  `.kill()` it at the top of PLAY, so a stale OUT doesn't zero the opacity of
  freshly-played content.

## Kill the ~1px "last pixel" leak
The matte's hidden-extreme frame may not be 100% transparent → a thin residual
line leaks. Couple opacity to the mask ends: `el.style.opacity="1"` at IN start,
and `opacity:"0"` in the per-element OUT `onComplete` (and/or container opacity 0
when the whole OUT finishes).

## Production wiring (NodeCG/OBS overlay)
- Container `opacity: 0` at rest; `playIn` sets `opacity: 1` then reveals; on
  `playOut` complete set `opacity: 0`.
- Body `background: transparent`; drop any `#3c3c3c` dev bg and `!important`.
- Drive from `nodecg.listenFor("<gfx>Play", playIn)` / `"<gfx>Out", playOut)`;
  dashboard button `nodecg.sendMessage(...)`.
- Keep `window.testIn/testOut` for console debugging — harmless in prod.
- **Pause background videos when off-air.** A looping `autoplay` `<video>` decodes
  every frame even at `opacity:0`. Pattern: on `loadeddata` → `video.pause()`; in
  `playIn` → `video.currentTime=0; video.play()`; in `playOut` `onComplete` →
  `video.pause()`. Keep `muted` (else autoplay is blocked).

## Gotchas
- 16384 px GPU texture cap → grid, not one giant row.
- Filenames with spaces/`#` break over NodeCG URLs → rename or `%23`-encode.
- `mask` shorthand can reset other mask-* longhands; set `mask-image` etc. explicitly.
- Don't sprite the "hold" frames — wasted resolution; sprite only the transition.
- Viewing an alpha PNG on a white page hides transparent-vs-white; verify with
  `ffmpeg -i sheet.png -vf alphaextract view.png`.
