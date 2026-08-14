# Rebuilding the design in HTML

The manifest gives you absolute coordinates on a fixed canvas, which is exactly what a
broadcast overlay wants. Don't fight it with flexbox — the design was laid out by hand at
1920×1080, so reproduce that and scale the whole stage if a different output size is needed.

**This holds for a lower third too.** A 421×106 bar in the bottom-left corner still lives on
a full 1920×1080 stage at `left:157px; top:805px` — never build the graphic at the size of the
bar. The browser source is always full-frame, canvas coordinates are what land the piece where
the designer drew it, and two pieces have to coexist in the frame without recomputing anything.

## Stage and positioning

```css
body { background: transparent; margin: 0; }   /* overlays composite over video */

.stage { position: relative; width: 1920px; height: 1080px; transform-origin: top left; }
.stage > * { position: absolute; }
```

Every plate becomes a div with the manifest's `x/y/w/h` and the PNG as a background. Fields
nest *inside* their plate and use plate-local coordinates, so moving a plate carries its text
along:

```html
<div class="stage">
  <div class="plate" id="question" style="left:319px; top:776px; width:1284px; height:104px;
       background:url(plates/plate_question.png) no-repeat; background-size:100% 100%;">
    <div class="field" id="questionText"
         style="left:21px; top:14px; width:1240px; height:78px;"></div>
  </div>
</div>
```

Use `background-size: 100% 100%` with the plate's native dimensions rather than `cover` — the
PNG is already exactly the right size, and `cover` will crop it the moment a rounding error
creeps in.

To target a different resolution, scale the stage instead of touching any coordinate:
`transform: scale(calc(var(--out-w) / 1920))`.

## Text fields

Vertical centering inside a field box is worth doing with flex, because PSD text bounds are
glyph bounds and don't include the leading the design implies:

```css
.field { display: flex; align-items: center; }
.field.center { justify-content: center; text-align: center; }
```

Load the design's real fonts with `@font-face` and `font-display: swap`. Two things bite here:
font filenames containing spaces fail to load over a NodeCG-style URL (rename to no-space), and
a PostScript name like `Inter-SemiBold` is a *separate file*, not `font-weight: 600` applied to
the regular. If you only have the regular, say so in the manifest rather than faking the weight
— synthetic bold shifts glyph widths and the layout stops matching the mockup.

Numbers in broadcast graphics usually want fixed width so they don't jitter as they count:

```css
.numeric { font-variant-numeric: tabular-nums; }
```

## Fill boxes (progress bars, meters)

The track plate is the background; the fill is a child clipped to `fillBox` whose width is a
percentage. Because `fillBox` is plate-local, the percentage resolves against the track:

```html
<div class="plate" id="meter" style="left:1055px; top:408px; width:428px; height:104px;
     background:url(plates/meter_track.png) no-repeat; background-size:100% 100%;">
  <div class="fill-clip" style="left:4px; top:6px; width:420px; height:92px;">
    <div class="fill"></div>
    <img class="cap" src="plates/meter_cap.png">
  </div>
</div>
```

```css
.fill-clip { position: absolute; overflow: hidden; }
.fill {
  position: absolute; inset: 0;
  width: var(--pct, 0%);
  background: linear-gradient(90deg, #E24E1B 0%, #C81E5A 100%);
  transition: width .6s cubic-bezier(.22,1,.36,1);
}
.cap { position: absolute; top: 0; height: 100%; left: var(--pct, 0%); transform: translateX(-100%); }
```

```js
function setMeter(el, value, max) {
  el.style.setProperty("--pct", Math.max(0, Math.min(1, value / max)) * 100 + "%");
}
```

Notes that save time:

- **Use the CSS gradient, not a stretched fill PNG.** A PNG scaled horizontally smears its
  gradient; CSS re-renders it at every width. Export the fill PNG only if the fill carries
  texture that can't be expressed in CSS.
- **The cap rides the fill edge.** Anchoring it with `left: var(--pct)` and pulling it back by
  its own width keeps the shaped end attached as the bar animates, and it shares the same
  custom property so the two can never desync.
- **Clamp before converting.** Live counters overshoot their goal, and `width: 117%` escapes
  the track.
- **Animate `width`, not `transform: scaleX`.** Scaling distorts the cap and any texture.
- **Vertical meters** swap `width`/`height` and use `bottom: 0` on the fill so it grows upward.

## State swaps

When a plate has variants, keep the box fixed and change only the image. Nothing reflows, and
the transition is a crossfade rather than a jump:

```js
function setState(plateId, state) {
  const p = document.getElementById(plateId);
  p.style.backgroundImage = `url(plates/${manifest.plates[plateId].states[state]})`;
}
```

For a reveal with a bit of weight, stack both states and fade the top one — it avoids the
one-frame flash of a background swap on a slow disk:

```html
<div class="plate">
  <div class="layer normal"></div>
  <div class="layer correct" style="opacity:0"></div>
</div>
```

```js
gsap.to(el.querySelector(".correct"), { opacity: 1, duration: .35, ease: "power2.out" });
```

If the state also changes typography (a win state set in semibold, say), toggle a class on the
plate and let CSS handle the field — don't rewrite inline styles per state.

## Entrance and exit

Overlays that composite in a switcher generally animate their own reveal. Diagonal clip wipes
suit angled broadcast plates because they follow the artwork's existing geometry:

```js
gsap.fromTo(el,
  { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)" },
  { clipPath: "polygon(0% 0%, 200% 0%, 0% 200%)", duration: .5, ease: "power2.out" });
```

Stagger rows with `inset(0 0 100% 0)` → `inset(0 0 0% 0)`, reversing `from: "end"` on the way
out. Two habits prevent most on-air bugs: default the container to `opacity: 0` so a
half-loaded graphic never flashes, and have the entrance timeline `gsap.set()` every animated
child back to its start state at the top — otherwise a second play begins from the end state
and simply doesn't animate.

## Wiring live data

Keep the graphic dumb: it renders whatever shape arrives and knows nothing about where the data
came from. One `update(data)` entry point, one `play()`, one `stop()`. That way the data source
can change without touching layout code.

Render placeholder data on load while you're building — you can't align fields against empty
boxes. Remove it, or gate it behind a dev flag, before the graphic goes on air.

Images that arrive at runtime need a fallback, because a broken `<img>` on a live overlay is
unrecoverable:

```js
function loadWithFallback(el, primary, fallback) {
  const img = new Image();
  img.onload  = () => el.style.backgroundImage = `url(${primary})`;
  img.onerror = () => el.style.backgroundImage = `url(${fallback})`;
  img.src = primary;
}
```

For NodeCG/vMix specifics — replicants, dashboard wiring, vMix HTTP control — see the
parent SKILL.md (state, naming, dashboard wiring) and `../vmix.md`; this file stops at the HTML boundary.

## Checking the rebuild against the mockup

Drop the original flattened PNG over the stage at 50% opacity and toggle it. Misalignment that
is invisible in isolation is obvious the moment the reference is on top:

```html
<div class="ref" style="position:absolute; inset:0; z-index:9999; opacity:.5;
     pointer-events:none; background:url(../L3_Pergunta.png) no-repeat; background-size:100% 100%;"></div>
```

Delete it before shipping — a leftover reference overlay on air is a memorable mistake.
