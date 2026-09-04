# Photopea MCP — the default bridge

Photopea runs the PSD in a browser tab and the MCP talks to it over a WebSocket. It is the
default path in this skill. The Photoshop MCP still works and the workflow is the same shape;
what changes is how scripts get in and how files get out. Read this before the first tool call —
two of the differences below are silent, not loud.

Install (once):

```
claude mcp add -s user photopea -- npx -y photopea-mcp-server
```

A browser window opens by itself on the first tool call. That is expected — Photopea *is* the
browser. Leave it open for the whole session.

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
Photopea — the output path belongs to `photopea_export_image`, and batching is not available
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
something that identifies the document instead — the cheapest reliable probe is the top-level
layer names:

```js
var d = app.activeDocument, n = [];
for (var i = 0; i < d.layers.length; i++) n.push(d.layers[i].name);
app.echoToOE(JSON.stringify({docs: app.documents.length, w: d.width, h: d.height, topo: n}));
```

Compare that list against the psd-tools dump of the same file (remembering the orders are
reversed — index 0 is the top layer here, and psd-tools iterates bottom-up), and check
`app.documents.length` while you are there: more than one open document is the condition that
makes "active document" ambiguous in the first place. If either disagrees, stop and re-open — do
not send visibility toggles, deletes or recolors first. If the bridge itself looks unreliable,
work read-only from Python instead: `psd-tools-fallback.md`.

## Heavy PSDs: the script times out, the bridge is fine

`photopea_run_script` is cut off at 30s, and on a large document that limit is reached by
**reading**, not by writing. Measured on a 99 MB, 73-layer PSD: walking the tree to collect
`L.bounds` timed out, twice — once with the Action Manager calls for fills and gradients, and
again with those removed. A one-line probe on the same document answered instantly, so the
bridge was never the problem; computing layer bounds is.

Do not conclude the bridge is dead and do not retry the same script. Split the work by what each
tool is actually good at:

| | |
|---|---|
| tree, bounds, text specs, transforms, glyph coverage | psd-tools, locally — seconds, no timeout |
| rendering a plate faithfully | the bridge, because psd-tools drops Stroke effects |

`inspect_psd.jsx` is a single call that returns everything at once, which is exactly why it is
the first thing to fail on a heavy document. Its dump is still the right thing to want; on a
heavy PSD, get the same fields from Python and use the bridge only to export.

## A lighter export loop when no spec needs recolor / lift / shift / clip

`export_plates.jsx` duplicates the whole document and deletes everything outside `keep`, which
is what makes `recolor`, `lift`, `shift` and `clip` possible — and what makes it heavy. When
every plate in the piece is a plain "keep these layers", there is a cheaper loop that never
duplicates and never deletes:

1. **`photopea_run_script`** — set `visible` from a list of index paths: a layer is visible when
   it is one of the targets, a descendant of one, or an ancestor of one. Nothing else changes.
2. **`photopea_export_image`** — write the whole 1920x1080 canvas to a temp path.
3. **crop locally** to the alpha bbox with Pillow (`Image.getbbox()`), and save under the plate's
   name.

Two calls per plate instead of three, the source document is never mutated beyond visibility, and
there is no stale-reference risk because no layer is ever moved, merged or removed. It also gives
a *better* number than the script does: the alpha bbox of the rendered result is the plate's true
canvas coordinate, whereas a reported layer bound is the thing that lies when a clipping mask
silently releases (`extendscript-gotchas.md`).

Reach for `export_plates.jsx` when you actually need to synthesize a state the designer drew
once; reach for this when you are only cutting apart what is already there.

## Running a long batch: the bridge degrades, and it lies while degrading

Measured over one night, extracting 44 plates from 21 PSDs in a single browser session. None of
these is rare — each happened repeatedly, and each is silent.

**The export returns the PREVIOUS composition.** Set visibility, export, and you get the frame
from before the toggle. It is a consistent one-step lag, not a race: on one piece, plate 3 came
out with plate 2's art and plate 4 with plate 3's. Touching `activeLayer` inside the same script
is *not* enough. What fixes it is **a separate round-trip between the toggle and the export** —
any trivial `photopea_run_script` will do. Three calls per plate, and the third is a `ping`.

**`photopea_open_file` reports success without opening, and reports a timeout after opening.**
Both directions happen. Never trust the return value: probe afterwards
(`app.documents.length`, then the layer count) and re-open if it is 0. A `loadFile timed out`
often means the document *did* land — probe before retrying, or you end up with two copies open.

**`app.documents.length` disagrees with itself between consecutive calls.** Two reads seconds
apart returned 2 and then 0, with no close in between; another pair returned the layer names of
two *different* documents. This is the stale-bridge condition `psd-tools-fallback.md` warns
about, and the guidance there — stop, do not mutate — is right, but a long batch cannot stop at
every flicker. The way through is to stop asking the bridge who it is and verify the *output*
instead: see the two guards in `README.md`, "Verifying".

**Walking the layer tree in a loop times out; direct indexed writes do not.** On an 86 MB PSD, a
loop over 11 top-level layers building strings blew the 30s limit, while
`d.layers[2].visible = false` on three layers returned instantly. Two consequences: keep the
visibility script as short as possible, and **do not descend into a group you are keeping
whole** — recursion into a kept group is pure cost, and it is what actually exhausts the timeout.

**The bridge exhausts, and closing every document revives it.** After roughly twenty heavy PSDs
loaded and closed, timeouts stop being occasional and `photopea_export_image` starts returning
`data ... Received null`. The recovery that works is
`while (app.documents.length) app.activeDocument.close(SaveOptions.DONOTSAVECHANGES)` — after
which scripts answer normally again. Past a certain point even that stops helping and the tab
itself needs a reload; if you are automating unattended, **budget for that** and checkpoint your
progress to disk (a `_geo.json` per piece with the measured coordinates) so the batch is
resumable instead of restartable.

**A `null` write is usually transient.** Re-issuing the same `photopea_export_image` succeeds
most of the time. Two failures in a row mean the bridge needs the close-all above.

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
call's "active document" is then the wrong one — which produces plates that look plausible and
contain the wrong art. This is the Photopea version of the stale-reference trap in
`extendscript-gotchas.md`.

There is no `_plates.json` on this path, because the script cannot write files. Fold the return
values straight into `assets.json` (`manifest-format.md`).

## What this path does not prove

**Gradients are the weak spot.** `inspect_psd.jsx` reads them through Photoshop action
descriptors (`executeActionGet`, `stringIDToTypeID`), converting stops from 0–4096 and the
right-facing 0° angle into CSS. Photopea implements only part of that descriptor API, and this
has not been verified end to end here.

So: if `r.gradients` comes back empty, or the call throws, while the art plainly has a gradient
— **do not write down a guess.** Sample it from the designer's flattened PNG the way
`png-analysis.md` describes (saturated core, never the mean), or switch to `psd-tools-fallback.md`.
The README already tells you to check every gradient against the reference image; on Photopea
treat that check as the source of truth rather than a second opinion.

**Fonts may be substituted silently.** Photopea swaps a font it does not have, which moves the
glyph outline and therefore the `measured` box of a text layer. Dynamic text is rebuilt in HTML
anyway, so this rarely reaches the graphic — but when a font is missing, trust `span` (the box
the designer drew, paragraph text only) over `measured`, and get the real family name from the
designer rather than from the dump.

**Everything in `extendscript-gotchas.md` still applies.** Photopea's scripting API is
ExtendScript-shaped — same `app.activeDocument`, `ArtLayer`, `LayerSet`, same silent
invalidation of layer references after a move or reorder. That is why `export_plates.jsx` renames
every target to a unique tag before touching anything, and why it re-finds layers by tag.
