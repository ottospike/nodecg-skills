# Fallback: extracting without Photoshop

The MCP bridge is the primary path (Photopea by default, Photoshop as the alternative), but it
can be dead in ways that look like success; see
[Is the bridge actually working?](#is-the-bridge-actually-working). When it is, drive everything
from Python with **psd-tools**: it is read-only, deterministic, never touches the user's open
documents, and on a well-behaved PSD it reproduces Photoshop's own export pixel for pixel.

```
python -m pip install psd-tools aggdraw fonttools
```

All three are required, `aggdraw` included (see below).

## Is the bridge actually working?

Before trusting either MCP with anything, prove two things. Both fail silently and produce
confident, wrong output rather than an error.

**1. Does `execute_script` actually run?** It can return `"Custom script executed"` and
`Result: undefined` while doing nothing at all. Probe it with an observable side effect and check
the effect, not the return value:

```js
app.activeDocument.layers[0].name = "__PROBE__";
```

Then call `photoshop_get_layers` and look for `__PROBE__`. If it isn't there, `$.evalFile` is not
running and the whole JSX path in this skill is unavailable. Switch to psd-tools.

**2. Which document is active?** `photoshop_open_image` returning a document id does **not** mean
that document stays active: focus can sit on a document that was already open. Call
`photoshop_get_state` and match the name and layer count against the PSD you opened. If
`get_state` and `get_layers` disagree with each other (e.g. 21 vs 41 layers), the bridge is stale;
stop and do not send mutating calls.

Layer-visibility toggles are how plates get exported, and a toggle sent to the wrong document
silently edits another file. Verify before the first mutation, not after.

## The `composite(force=True)` trap

**`composite()` is faithful. `composite(force=True)` is not.**

- `psd.composite()` reuses the flattened image Photoshop stored inside the PSD. Measured against
  a designer's own PNG export: **0 differing pixels, max channel delta 0.**
- `psd.composite(force=True)` makes psd-tools re-render everything itself, including layer
  effects, and it gets **Gradient Overlay wrong**. Example: a `#E24E1B → #FF0176` ramp comes out
  compressed to a near-flat `#FF1845 → #FF2233` (8602 differing pixels, max delta 58). The result
  looks plausible.

`force=True` is what you need to render a subset of layers, so **every plate is rendered
through the unreliable path.** Rule:

> Never read a colour, gradient or effect value off a plate render. Read it from the layer
> descriptor, then verify against plain `composite()` or the designer's exported PNG.

**A Stroke effect is dropped entirely.** Compared with the same plates exported through
Photopea: a badge comes back 118x118 instead of 124x124 (**516 outline pixels missing**), a
plaque 514x184 instead of 520x188 (**1734 missing**). The alpha bbox shrinks with it, so the
canvas coordinate you record is wrong too. Only plates with no effects match exactly (e.g. a
flat text mark, 25x146, byte-identical). Geometry is reliable only on effect-free layers. Rule:

> **Never ship a plate rendered by psd-tools when the layer or its group carries a Stroke, Drop
> Shadow or Gradient Overlay.** Audit first (`layer.effects` per kept path); if anything is
> enabled, that plate goes through the bridge. Geometry and plain artwork on an effect-free
> layer are still fine.

Two practical consequences:

1. `pip install 'psd-tools[composite]'` is what makes `force=True` run at all: without `aggdraw`
   it raises on vector shapes and without `scikit-image` it raises on effects. Installing them
   stops the exception but does **not** make the effect faithful; a successful render is not
   evidence of a correct one.
2. It splits the work when several agents extract in parallel: reading, measuring and deciding
the plates is local, deterministic and parallel; **the export is serial, because the bridge has
one active document.** Have the parallel workers emit a spec — `[{ "out": "...", "keep":
["9", "7/2"] }, ...]` in index paths — and run the exports from it yourself, one at a time.

**Color Overlay has a related bug:** psd-tools applies it only to fully-opaque pixels, so the
layer's original artwork bleeds through the antialiased edges (e.g. a navy `#1E1E30` overlay on
orange art leaves a magenta fringe). Rebuild such a layer by hand: take its alpha, fill it with
the overlay colour:

```python
notch_alpha = render_only([6]).split()[3]
notch = Image.new("RGBA", CANVAS, (0x19, 0x19, 0x32, 0))
notch.putalpha(notch_alpha)
flat = Image.alpha_composite(base, notch)
```

**A clipping layer rendered alone comes back 100% transparent.** Hide everything
but one layer whose `clipping` flag is set and `composite(force=True)` returns an
image with `alpha.max == 0`, with no error or warning. The layer has nothing to clip
against, so it renders nothing. `getbbox()` then returns `None`, and any export
helper that falls back to the nominal crop box writes a plausibly-sized, entirely
empty PNG that looks right in the file listing and is blank on air.

Check the flag before exporting (`layer._record.clipping`), and to get the art at
full extent (what you want, because in HTML the clipping is done by the slot's
`overflow: hidden`), clear it for the render and put it back:

```python
antes = layer._record.clipping
layer._record.clipping = 0
img = psd.composite(force=True, ignore_preview=True)
layer._record.clipping = antes
```

Guard: assert `img.getchannel("A").getextrema()[1] > 0` on every plate you write. A plate
whose alpha never exceeds 0 is empty.

**`aggdraw` is mandatory.** Without it, vector shape layers raise on `composite()`; if you
catch or skip that, they render *fully transparent* and the shape disappears from the plate
while the export looks clean. Install it, then re-verify anything exported before it was
present.

## Reading the document

psd-tools indexes **bottom-up** — `list(psd)[0]` is the bottom layer. Photoshop's own scripting
DOM and `photoshop_get_layers` index **top-down**. Convert with `ps_index = count - 1 - pt_index`
and say which convention your manifest uses.

Descriptor keys are the raw four-character IDs, often with significant trailing spaces
(`"Rd  "`, `"Clr "`, `"Scl "`), and effect blocks use short names — `GrFl` for Gradient Overlay,
`SoFi` for Color Overlay, not the `gradientFill` / `solidFill` names the ExtendScript path uses.
Enumerate `tagged_blocks` and print the keys rather than guessing:

```python
from psd_tools.constants import Tag
fx = layer.tagged_blocks.get_data(Tag.OBJECT_BASED_EFFECTS_LAYER_INFO)
# -> Scl , masterFXSwitch, dropShadowMulti, OrGl, GrFl, SoFi, frameFXMulti, IrGl, ebbl, ChFX
```

Gradient stop `location` is 0–4096 → `pct = location / 4096 * 100`. Photoshop's 0° points right,
CSS `0deg` points up, so `cssAngle = (90 - psAngle) % 360`. A PS angle of 90 becomes CSS `0deg`,
which is bottom→top: **the first stop sits at the bottom.**

## Text: font size is not `FontSize`

A text layer stores a nominal `FontSize` *and* a transform. The rendered size is the product, and
using `FontSize` alone can be off by 2× or more.

```python
run = plain(layer.engine_dict)["StyleRun"]["RunArray"][0]["StyleSheet"]["StyleSheetData"]
sx = layer.transform[0]          # horizontal scale
size_px = run["FontSize"] * sx   # 26.87039 * 1.974299 = 53.05px
```

Cross-check it against the font's own metrics before writing it down — this catches both a wrong
`FontSize` and a wrong transform:

```python
# advance width of the exact rendered string, plus tracking, must match the layer's ink box
adv_em = sum(glyphset[cmap[ord(c)]].width for c in text) / upm
predicted_w = adv_em * size_px + len(text) * tracking_em * size_px
```

Agreement within a couple of pixels means the size is right. `transform[3]` (vertical scale) is
often slightly different from `transform[0]` — a 3.4% squash is invisible but worth recording as
an optional `scaleY()`.

Other things to pull from the style run: `FillColor.Values` is ARGB in 0–1 floats, not 0–255.
`FontCaps: 2` means All Caps, so a layer whose contents read `example` renders `EXAMPLE` —
record it or you will ship lowercase names. `Tracking` is 1/1000 em → `letter-spacing: 0.026em`.
The font's PostScript name comes from `resource_dict["FontSet"][run["Font"]]["Name"]`.

## Baseline → CSS `top`

The PSD gives you a baseline (`transform[5]`); CSS positions the top of a line box. Convert it
instead of nudging by eye:

```python
os2 = TTFont(path)["OS/2"]
use_typo = bool(os2.fsSelection & (1 << 7))       # USE_TYPO_METRICS
asc, desc = ((os2.sTypoAscender, -os2.sTypoDescender) if use_typo
             else (os2.usWinAscent, os2.usWinDescent))
content   = (asc + desc) / upm * size_px          # inline content-box height
half      = (line_height_px - content) / 2
css_top   = baseline_y - (half + asc / upm * size_px)
```

Check `USE_TYPO_METRICS` — it decides which pair of metrics the browser uses, and getting it
wrong shifts the text by several pixels. When the flag is set the result is deterministic rather
than approximate.

## Verify against the designer's export, not against your own render

The PSD usually ships next to a flattened PNG. That file is Photoshop's own answer and it is the
only ground truth available without a working Photoshop.

```python
diff = ImageChops.difference(psd.composite().convert("RGB"), ref).convert("L")
hist = diff.histogram()
print(sum(hist[1:]), "differing px, max delta", max(i for i, c in enumerate(hist) if c))
```

Expect `0, max delta 0`. Anything else means a layer is being mis-rendered and you should find out
which before exporting a single plate.

For plates, recomposite over the mockup's backdrop colour (sample it, don't assume `#808080`:
on a `#7C7C7C` backdrop, assuming grey 128 can triple the apparent error), and diff only outside
the boxes where dynamic text was removed. Separate *interior* from *edge* differences: interior
pixels should match within rounding, while the plate's outermost antialiased rows will always
differ, because lifting antialiased art off a backdrop cannot be lossless. Report both numbers
rather than one aggregate.

Finally, round-trip the typography: re-render the strings from the `.otf` files using the sizes,
tracking, origins and baselines you wrote down, then compare ink bounding boxes against the
designer's render. Matching within 1px on every field confirms the numbers before any HTML gets
written. Antialiasing will differ; box geometry should not.

For a gradient, sample the **saturated core** of each glyph row (`R >= 250`), not the mean of all
glyph pixels: antialiased edge pixels drag the average toward the background and flatten the
ramp you are trying to measure.
