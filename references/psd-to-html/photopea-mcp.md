# Photopea MCP — the default bridge

Photopea runs the PSD in a browser tab and the MCP talks to it over a WebSocket. It is the
default path in this skill. The Photoshop MCP still works and the workflow is the same shape;
what changes is how scripts get in and how files get out. Read this before the first tool call:
two of the differences below fail silently.

Install (once):

```
claude mcp add -s user photopea -- npx -y photopea-mcp-server
```

A browser window opens by itself on the first tool call. That is expected: Photopea runs in
the browser. Leave it open for the whole session.

## Tool map

| What you need | Photopea | Photoshop equivalent |
|---|---|---|
| Open the PSD | `photopea_open_file` — absolute local path **or** URL | open + `photoshop_ping` |
| Prove you're on the right document | `photopea_get_document_info` — name, w/h, DPI, layer count, mode | `photoshop_get_state` |
| Layer tree | `photopea_get_layers` — name, type, index, visible, opacity, blendMode, bounds; groups nest their children | `photoshop_get_layers` |
| Full dump: fonts, sizes, fills, gradients | `photopea_run_script` with `inspect_psd.jsx` inlined | `execute_script` + `$.evalFile` |
| Compose one plate | `photopea_run_script` with `export_plates.jsx` inlined | same script, batched |
| Write the PNG | `photopea_export_image` `{format:"png", outputPath}` | the script's own `saveAs` |
| Flattened reference image | `photopea_export_image` to a temp path, then read it back | `photoshop_get_preview` |

`photopea_get_layers` covers structure and bounds, but **not** font, size, colour or gradient —
that is what the `inspect_psd.jsx` dump is for. Use the tool to orient, the script to plan.

## Three differences that change how you work

**1. There is no `$.evalFile` and no local filesystem.** The script runs inside the browser
sandbox. You cannot point Photopea at a path on disk. Paste the **entire contents** of
`inspect_psd.jsx` / `export_plates.jsx` into `photopea_run_script` instead.

**2. There is no `$.global`.** Configuration goes in as plain top-level `var`s declared *above*
the pasted body, using the `_IN` names:

```js
var SPECS_IN = [ { out: "plate_question", keep: [[1,1],[1,2]], note: "question panel" } ];
// ...contents of export_plates.jsx pasted below this line...
```

The bundled scripts read `$.global` when it exists and these top-level vars otherwise, so the
same file serves both MCPs. `OUTDIR_IN` and `ONLY_IN` exist too, but neither does anything on
Photopea: the output path belongs to `photopea_export_image`, and batching is not available
(see below).

**3. Nothing comes back unless the script calls `app.echoToOE(...)`, and it returns a string.**
ExtendScript hands back the last expression; Photopea does not. Both bundled scripts already
call `echoToOE` with `JSON.stringify`, so parse the result. A custom script that just
`return`s a value will look like it did nothing.

## Prove the document before you touch it

There is no `photopea_ping`, and the failure it guards against still exists: the active document
can silently be some other file, and destructive ops would then edit someone else's work.

Call `photopea_get_document_info` and match the canvas w/h and the layer count against the PSD
you meant to open. **The name will not help you**: a file opened by local path comes back as
`{"name":"file", ...}`, not the PSD's filename, so a name check can never pass. Match on
something that identifies the document instead; the cheapest reliable probe is the top-level
layer names:

```js
var d = app.activeDocument, n = [];
for (var i = 0; i < d.layers.length; i++) n.push(d.layers[i].name);
app.echoToOE(JSON.stringify({docs: app.documents.length, w: d.width, h: d.height, topo: n}));
```

Compare that list against the psd-tools dump of the same file (remembering the orders are
reversed: index 0 is the top layer here, and psd-tools iterates bottom-up), and check
`app.documents.length` while you are there: more than one open document is the condition that
makes "active document" ambiguous. If either disagrees, stop and re-open; do not send
visibility toggles, deletes or recolors first. If the bridge itself looks unreliable,
work read-only from Python instead: `psd-tools-fallback.md`.

## Heavy PSDs: the script times out, the bridge is fine

`photopea_run_script` is cut off at 30s. On a large document (e.g. 99 MB, 73 layers) that limit
is reached by **reading**: walking the tree to collect `L.bounds` times out, with or without the
Action Manager calls for fills and gradients, while a one-line probe on the same document answers
instantly. The bridge is fine; computing layer bounds is the cost.

Do not conclude the bridge is dead and do not retry the same script. Split the work by what each
tool does well:

| | |
|---|---|
| tree, bounds, text specs, transforms, glyph coverage | psd-tools, locally — seconds, no timeout |
| rendering a plate faithfully | the bridge, because psd-tools drops Stroke effects |

`inspect_psd.jsx` returns everything in a single call, so it is the first thing to fail on a
heavy document. On a heavy PSD, get the same fields from Python and use the bridge only to export.

## A lighter export loop when no spec needs recolor / lift / shift / clip

`export_plates.jsx` duplicates the whole document and deletes everything outside `keep`, which
is what makes `recolor`, `lift`, `shift` and `clip` possible, and what makes it heavy. When
every plate in the piece is a plain "keep these layers", use a cheaper loop that never
duplicates and never deletes:

1. **`photopea_run_script`**: set `visible` from a list of index paths. A layer is visible when
   it is one of the targets, a descendant of one, or an ancestor of one. Nothing else changes.
2. **`photopea_export_image`**: write the whole 1920x1080 canvas to a temp path.
3. **Crop locally** to the alpha bbox with Pillow (`Image.getbbox()`), and save under the plate's
   name.

Advantages: two calls per plate instead of three; the source document is never mutated beyond
visibility; no stale-reference risk, because no layer is moved, merged or removed. The alpha bbox
of the rendered result is also the plate's true canvas coordinate, whereas a reported layer bound
is wrong when a clipping mask silently releases (`extendscript-gotchas.md`).

Use `export_plates.jsx` when you need to synthesize a state the designer drew once; use this loop
when you are only cutting apart what is already there. In a long batch, add the `ping` round-trip
described below between steps 1 and 2.

## Running a long batch: the bridge degrades silently

Each of these occurs repeatedly over a long session (dozens of plates from many PSDs in one
browser tab), and each is silent.

**The export returns the PREVIOUS composition.** Set visibility, export, and you get the frame
from before the toggle: a consistent one-step lag, not a race (plate 3 comes out with plate 2's
art, plate 4 with plate 3's). Touching `activeLayer` inside the same script does *not* fix it.
Fix: **a separate round-trip between the toggle and the export**; any trivial
`photopea_run_script` works. Three calls per plate: toggle, `ping`, export.

**`photopea_open_file` reports success without opening, and reports a timeout after opening.**
Never trust the return value: probe afterwards (`app.documents.length`, then the layer count)
and re-open if it is 0. A `loadFile timed out` often means the document *did* load; probe before
retrying, or you end up with two copies open.

**`app.documents.length` disagrees with itself between consecutive calls.** Two reads seconds
apart can return 2 and then 0 with no close in between, or the layer names of two *different*
documents. This is the stale-bridge condition in `psd-tools-fallback.md` (stop, do not mutate),
but a long batch cannot stop at every flicker. Instead of asking the bridge which document it is
on, verify the *output*: the two guards in `README.md`, "Verifying".

**Walking the layer tree in a loop times out; direct indexed writes do not.** On an 86 MB PSD, a
loop over 11 top-level layers building strings exceeds the 30s limit, while
`d.layers[2].visible = false` on three layers returns instantly. So:

- keep the visibility script as short as possible;
- **do not descend into a group you are keeping whole**; that recursion is what exhausts the
  timeout.

**The bridge exhausts; closing every document revives it.** After roughly twenty heavy PSDs
loaded and closed, timeouts become frequent and `photopea_export_image` starts returning
`data ... Received null`. Recovery:

```js
while (app.documents.length) app.activeDocument.close(SaveOptions.DONOTSAVECHANGES)
```

After that, scripts answer normally again. Past a certain point even that stops helping and the
tab needs a reload. When automating unattended, plan for that: checkpoint progress to disk (a
`_geo.json` per piece with the measured coordinates) so the batch can resume instead of restart.

**A `null` write is usually transient.** Re-issuing the same `photopea_export_image` usually
succeeds. Two failures in a row mean the bridge needs the close-all above.

## The Stroke is part of the fill, and that silently destroys plates

🚨 This produces a plate that opens fine, passes both guards in `README.md`, and is missing
artwork. Photopea's flatten treats a shape's **Stroke as part of its fill**, so the layer's fill
opacity is applied to the outline too:

| `fillOpacity` | what you get |
|---|---|
| `0` (a stroke-only shape) | **the shape vanishes entirely** |
| between 0 and 255 | the outline comes out at *that* opacity |

Symptoms:

- A fullscreen's two 5px stroke-only window borders are lost, so its two video windows merge into
  one L-shaped hole (thousands of white and coloured pixels missing), while the piece still
  measures `0,0,1920,1080` and correlates at ~3 against the designer's flat.
- A meter track with `fillOpacity: 77` exports its opaque 5px black contour at alpha 77: **zero
  opaque pixels in the file**, an outline invisible over video.

**Audit before you trust an export**, straight from the PSD:

```python
tb = layer.tagged_blocks
v = tb.get(b"iOpa")            # BYTES key — "iOpa" as a str never matches, and
                               # tagged_blocks keys are Tag enum members, not strings
fill = 255 if v is None else (getattr(v, "data", v))[0]   # TaggedBlock -> .data
risco = layer.stroke and layer.stroke.enabled and fill < 255
```

A wrong reader fails silently: a `"iOpa" in tb` test returns False for every layer, so the audit
prints "0 at risk". Verify the reader against a layer you have already measured through the
bridge before believing a clean result.

**The fix, for both modes.**

1. Re-export the layer with `fillOpacity = 100` to get the solid silhouette.
2. Derive the stroke ring morphologically and recomposite it at alpha 255.
3. Take width and colour from the descriptor (`layer.stroke.line_width`, `layer.stroke.content`).
   Never sample them from the flat: on a camera frame the window interior is white in the flat
   and so is the border, so a colour fit grows the ring inward indefinitely.
4. For a **centered** stroke of width `w` the ring straddles the path:
   `dilate(sil, ceil(w/2)) & ~erode(sil, floor(w/2))`.

⚠️ **`fillOpacity = 0` does not isolate the stroke**; it erases the layer. No export gives you
the outline alone; you have to rebuild it.

**A third way to lose a stroke: the shape is a clipping base.** When a shape with a vector
stroke has a clipped layer directly above it (`ls[i+1]._record.clipping`), Photopea paints the
clipped layer **over the stroke**. The fill looks right and the outline is gone. Detect it from the
PSD: visible shape, `stroke.enabled`, and the next layer clipped to it.
`scripts/psd-plates/plates.py` → `auto_stroke_specs` finds all three cases (fill 0, partial fill,
clipping base) for the layers a plate keeps.

**Better rebuild: from the vector path, not the silhouette.** Morphology on the exported
silhouette works as a quick fix, but it ignores `line_alignment` and rounds corners wrong.
`fix_strokes`:

1. rasterises the layer's `vector_mask` (Bézier, 8× supersample);
2. takes a signed distance field (`scipy.ndimage.distance_transform_edt` inside and outside);
3. selects the ring by alignment (**inside** `0..w`, **outside** `-w..0`, **center** `±w/2`);
4. downsamples with BOX and composites it with straight alpha at the descriptor's colour.

The result matches the designer's flat at the pixel level, corners included.

## Exporting plates — one per call

`photopea_export_image` flattens and exports **the whole active document**. There is no
per-layer export and no batching. So the loop is three calls per plate:

1. **`photopea_run_script`** — `var SPECS_IN = [ ...one spec... ];` followed by the body of
   `export_plates.jsx`. It duplicates the document, applies `recolor` → `lift` → `shift` →
   `clip`, flattens, trims, and leaves the trimmed result as the **active document**. It returns
   `{exported:[{file, x, y, w, h, note, pending:true}]}` — `x`/`y` are the position on the
   original canvas, which is what the manifest needs.
2. **`photopea_export_image`** — `{format:"png", outputPath:"<plates folder>/<file>"}`.
3. **`photopea_run_script`** — `app.activeDocument.close(); app.echoToOE("ok");`

The script refuses more than one spec per call, on purpose: a second spec would compose over a
document that has not been written to disk yet, and you would lose the first plate.

**Step 3 is not optional.** Every skipped close leaves an extra document open, and the next
call's "active document" is then the wrong one, producing plates that look plausible and
contain the wrong art. This is the Photopea version of the stale-reference trap in
`extendscript-gotchas.md`.

There is no `_plates.json` on this path, because the script cannot write files. Fold the return
values straight into `assets.json` (`manifest-format.md`).

## Batch plates with psd-tools: full-frame export + `finish.py`

A variant of the loop above for many pieces at once
(`scripts/psd-plates/`, `pip install psd-tools aggdraw scipy pillow numpy fonttools`):

1. **In Photopea, export every plate at FULL FRAME** (visibility script → ping → export of the
   whole 1920×1080 canvas, no trim) into a temp folder **outside** the bundle (`pp/*.png`).
2. **`finish.py <spec.json>`** does the rest locally: rebuilds the lost strokes from the PSD
   (`"strokes": "auto"`), trims each plate by the alpha bbox (`trim_save` asserts the plate is not
   empty and returns `{x,y,w,h}` **from the file itself**, not from Photopea's report), writes it
   to the assets folder with a `_reference.png`, and prints geometry + verification as JSON.
3. **Verification by recomposition.** `verify` composites **all** plates bottom-up and diffs the
   result against the designer's flat, both over grey 60. Dynamic text boxes are masked out
   (`maskText`: the layer bbox ±4 px; `maskBoxes` for dynamic images). It reports
   `px>8`, `px>24`, `max` and `examined_opaque`. This catches **missing art between plates**,
   which a per-plate correlation never sees. `examined_opaque` near zero means the check
   looked at nothing. That is a failed check, not a passed one.
4. **`cmpshot.py <shot> <flat> <out>`** is the final gate on the **built HTML**: a browser
   screenshot (page background forced to grey 60) against the flat, stacked as flat / render /
   diff>24 in one image to look at.

**`textspec.py <psd>`** dumps each text layer's real typography. It includes fields the
inspector above misses: leading only when `AutoLeading=false`, `FontCaps` (small caps / all caps),
`paraBox` only for paragraph text (`ShapeType==1`), `runFonts` when one layer mixes fonts, and
the active effects with their colour (e.g. a Stroke on the text).

## What this path does not prove

**Gradients are the weak spot.** `inspect_psd.jsx` reads them through Photoshop action
descriptors (`executeActionGet`, `stringIDToTypeID`), converting stops from 0–4096 and the
right-facing 0° angle into CSS. Photopea implements only part of that descriptor API, and this
is not verified end to end.

If `r.gradients` comes back empty, or the call throws, while the art plainly has a gradient,
**do not write down a guess.** Sample it from the designer's flattened PNG the way
`png-analysis.md` describes (saturated core, never the mean), or switch to `psd-tools-fallback.md`.
The README already tells you to check every gradient against the reference image; on Photopea
treat that check as the source of truth rather than a second opinion.

**Fonts may be substituted silently.** Photopea swaps a font it does not have, which moves the
glyph outline and therefore the `measured` box of a text layer. Dynamic text is rebuilt in HTML
anyway, so this rarely reaches the graphic; but when a font is missing, trust `span` (the box
the designer drew, paragraph text only) over `measured`, and get the real family name from the
designer rather than from the dump.

**Everything in `extendscript-gotchas.md` still applies.** Photopea's scripting API is
ExtendScript-shaped: same `app.activeDocument`, `ArtLayer`, `LayerSet`, same silent
invalidation of layer references after a move or reorder. That is why `export_plates.jsx` renames
every target to a unique tag before touching anything, and why it re-finds layers by tag.
