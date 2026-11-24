# PSD → dynamic HTML graphics

> **Read this whole document when the art for a graphic arrives as a `.psd`/`.psb`** —
> "extract the plates", "turn this mockup into HTML", "I need the PNGs from this design",
> "make this progress bar work", or any request pairing a PSD with a web/graphic
> implementation, even when the request is only for "the assets".
>
> This is a subskill of `nodecg`. It ends where the graphic starts: once the plates and
> the manifest exist, go back to the parent SKILL.md and `assets/grafico-modelo.html` to
> build the piece. `bundle-conventions.md`, next to this file, is the bridge: it says what
> a lower third, a fullscreen and a meter each need from the extraction.

Turn a layered PSD into two things: a folder of clean **plates** (trimmed PNGs of the static
art) and a **manifest** describing where each one goes, what fonts and colors the design uses,
and which boxes hold live data. With both, rebuilding the layout in HTML is mechanical.

Do not export layer-by-layer. A PSD with 45 layers does not become 45 assets; it becomes
maybe 6 plates. A plate is a *visual unit* the design treats as one thing: a lower-third bar,
a question panel, an answer card, a progress track. Fragmenting past that produces shapes
nobody can reassemble.

## Workflow

**1. Look at the flattened reference first.** Most PSDs ship next to an exported PNG. Read it
as an image before touching the editor and describe the composition:

- **which type of piece this is** (`tipos-de-peca.md`: lower third, fullscreen, in-game or bug,
  and what each one implies);
- what is static decoration and what is live data;
- what states exist (empty/full, normal/highlighted) and how the piece behaves over time;
- what an operator would trigger.

This step tells you what the plates *are*. Without it you reverse-engineer intent from layer
names like "Retângulo 3 copiar 2".

Measure it too: `scripts/analyze_png.py` returns the backdrop colour, the palette, and every
block's canvas box, plus 1x/3x crops to inspect. See `png-analysis.md`.

Keep these observations; they become the overview section of `ASSETS.md` in step 5. Write them
down now, not from memory at the end.

If there's no reference PNG, make one: `photopea_open_file` with the PSD's absolute path,
then `photopea_export_image` to a temp path and read that file back as an image.
(Photoshop MCP: `photoshop_get_preview`.)

**If there is no PSD at all** (only the flattened image), this workflow doesn't apply.
Go to `png-analysis.md`: it covers measuring, describing, and stating what can't be recovered
without layers.

**2. Inspect the document.** Open the PSD with `photopea_open_file` (absolute local path).
The browser tab opens by itself on the first call; that is Photopea, leave it open.

Before any mutation, prove which document you are on. The active document can silently be
another file that was already open, and a destructive op would then edit it.

1. Match `photopea_get_document_info`'s **name and canvas w/h** against your PSD.
2. Sanity-check the tree with `photopea_get_layers`.
3. If either disagrees, re-open. Do not send visibility toggles, deletes or recolors first.
4. If the bridge itself looks unreliable, work read-only from Python: `psd-tools-fallback.md`.

With the document confirmed, paste the **entire contents** of `scripts/inspect_psd.jsx` into
`photopea_run_script`. Photopea has no `$.evalFile`: the script runs in a browser sandbox with
no disk access, so the body goes in inline and the dump comes back as a JSON string via
`app.echoToOE`.

Read `photopea-mcp.md` before the first PSD on this bridge; it has the tool map and the three
silent differences.

(Photoshop MCP: `photoshop_ping`, then `$.evalFile(new File("../../scripts/inspect_psd.jsx"))`.)

One call returns the layer tree with **index paths** (`"2/16"`), every text layer's font /
size / color / alignment / bbox, every solid fill's hex, and every gradient already converted
to a CSS `linear-gradient()` string. Index 0 is the **topmost** layer; a clipping mask always
clips to the layer directly beneath it.

On large PSDs, return only the slices you need (`r.gradients`, `r.texts`, filtered `r.layers`)
rather than the whole object.

**3. Decide the plates and the dynamic fields.** For each plate, note which index paths
compose it. For each dynamic field, note its type:

| Type | What varies | What to record |
|---|---|---|
| `text` | a string or number | font, size, color, align, box |
| `fill` | a width/height percentage | **fillBox in plate-local coords**, gradient, direction, cap asset |
| `image` | a photo/logo swapped at runtime | box, object-fit, fallback asset |
| `state` | the whole plate swaps art | one plate PNG per state |

**4. Export the plates.** Set the spec and run `scripts/export_plates.jsx` (spec language
below). On Photopea this is **three calls per plate** (compose, export, close), because
`photopea_export_image` writes the whole active document and the script cannot touch your disk;
the loop is in `photopea-mcp.md`. Verify each PNG by reading it back as an image: bounds that
look plausible in the return value are often wrong art.

**5. Write the manifest.** It is the deliverable. The PNGs alone are unusable: nothing in them
says where they go or what font the missing text used. Write both files *into the same folder
as the plates*, so the whole thing travels as one unit.

**Derive the folder from the PSD's name**, inside its category folder, inside the bundle's
served assets folder `<assets>/` (`shared/assets/` in most bundles, `graphics/assets/` where
that is already the convention; `drive-to-graphics.md` §2 has the criterion). Name rule: all
lowercase, every word after the first capitalised, acronyms included: `L3_MetaLike.psd` →
`l3/l3_metaLike/`. The name links back to the source, so a revised PSD tells you which folder
to re-export. The category is the piece type's short code (`l3`, `fs`, `ig`, `bug`); see
`tipos-de-peca.md`.

```
<assets>/l3/l3_metaLike/
├── assets.json     ← the graphic fetches this at runtime and builds the DOM from it
├── ASSETS.md       ← the human-readable version: reference image, tables, CSS scaffold
├── *.png           ← runtime plates
└── _*.png          ← references and proofs, never on air
```

`export_plates.jsx` drops a raw `_plates.json` as it goes. That is a build artifact with
filenames and boxes, not the manifest. Fold it into `assets.json` and add what the script
can't know: roles, states, dynamic fields, palette tokens, font mappings.

Never leave a second, competing layout file behind. One manifest, one truth.

See `manifest-format.md` for the annotated template.

**6. Rebuild in HTML.** See `html-rebuild.md` for the positioning, fill-box,
state-swap and gradient patterns.

## Exporting plates

`scripts/export_plates.jsx` turns N layers into 1 trimmed PNG and records where it sat on the
canvas.

On **Photopea**, declare one spec as a top-level var and paste the script body under it:

```js
var SPECS_IN = [
  { out: "plate_question", keep: [[1,1],[1,2]], note: "question panel, no text" }
];
// ...entire contents of export_plates.jsx below this line...
```

It leaves the trimmed plate as the active document; `photopea_export_image` writes it, then
close it before the next plate. Three calls, one plate; see `photopea-mcp.md`.

On the **Photoshop MCP**, drive it with globals and batch, then `$.evalFile`:

```js
$.global.OUTDIR = "/.../<assets>/l3/l3_metaLike";   // = derived from the PSD name
$.global.SPECS = [
  { out: "plate_question", keep: [[1,1],[1,2]], note: "question panel, no text" },
  { out: "answer_a_win",   keep: [[2,16],[2,10],[2,8]],
    recolor: [{ path:[2,16], hex:"#E24E1B" }],
    lift:    [[2,10],[2,8]],
    shift:   [{ path:[2,8], dx:-633, dy:0 }],
    clip:    { art:[2,14], base:[2,16], dx:-639, dy:0 },
    note: "answer A in win state" }
];
$.global.ONLY = "plate_question";   // optional: run a subset
$.evalFile(new File("../../scripts/export_plates.jsx"))
```

| Field | Meaning |
|---|---|
| `out` | filename without `.png` |
| `keep` | index paths composing the plate; a group path keeps everything inside |
| `dropText` | strip text inside kept groups (default `true`; dynamic text is rebuilt in HTML) |
| `recolor` | `[{path,hex}]`: repaint a solid fill; this is how you synthesize state variants |
| `lift` | move layers out of their group to the document root, keeping the listed order (first = topmost) |
| `shift` | `[{path,dx,dy}]`: translate in pixels |
| `clip` | `{art,base,dx,dy}`: place `art` above `base`, offset it, create a clipping mask |
| `note` | carried into the manifest |

Everything not in `keep` is deleted, so the mockup's grey backdrop and the placeholder text
disappear. Each run returns `{file,x,y,w,h}` per plate and appends to `_plates.json` in
`OUTDIR`.

**Batch your runs (Photoshop only).** Each spec duplicates the whole document; a heavy PSD
exceeds the MCP's script timeout after roughly 4–6 plates. Use `$.global.ONLY` to run 2–3 at a
time. A timeout leaves the source document intact; re-run the remainder.

Photopea has no batching: the script refuses more than one spec per call, because a second spec
would compose over a plate not yet written to disk and the first would be lost.

### Synthesizing states the designer only drew once

Mockups usually show one card in its highlight state and the rest neutral. You need every
combination. Rebuild the states from the pieces that exist instead of asking for a new PSD:

- **Highlight:** `recolor` the plate's fill to the highlight color, then `clip` the texture
  artwork over it with a `dx/dy` that moves it onto the target plate.
- **Neutral version of the drawn card:** recolor to the neutral color and skip the clip.

`dx/dy` comes from the bounds `inspect_psd.jsx` already gave you: `targetPlate.x - sourceArt.x`.

### Baking vs. keeping separate

Bake anything that never changes into the plate: badge circles, index letters, static labels,
icons. Fewer moving parts, fewer alignment bugs, and the typography stays exactly as designed.
Keep separate only what varies at runtime. Test: "would an operator ever need to change this
mid-broadcast?"

## Progress bars and meters

The fill is computed, so export three things: the empty **track**, the **fill** at full extent,
and the shaped **cap** if the fill has an angled or decorative end. Record the fill's box
*relative to the plate's own top-left*, not the canvas:

```json
"fill": {
  "track": "meta_track.png",
  "fillBox": { "x": 4, "y": 6, "w": 420, "h": 92 },
  "direction": "ltr",
  "gradient": "linear-gradient(90deg, #E24E1B 0%, #C81E5A 100%)",
  "cap": { "file": "meta_cap.png", "w": 47, "h": 104 },
  "max": 5000
}
```

Plate-local coordinates make `width: 47%` land correctly inside the track; canvas coordinates
only say where the plate goes. Derive them by subtracting: `fillBox.x = fillLayer.x - trackPlate.x`.

Read the fill's gradient off `inspect_psd.jsx` rather than eyedropping it; the script converts
Photoshop's 0–4096 stops and right-facing 0° angle into CSS percentages and degrees. On Photopea
this part may fail: it reads action descriptors, and Photopea implements only a subset. If the
gradients come back empty while the art clearly has one, don't guess: sample the reference PNG or
fall back to psd-tools (`photopea-mcp.md`). Prefer a CSS gradient over a stretched PNG; it scales
without banding and recolors trivially.

**Check the gradient against the designer's flattened PNG before you write it down.**

1. Read the stops from the descriptor.
2. Sample the same region out of the reference image.
3. Confirm they agree.

Sample the *saturated core* of the shape (e.g. `R >= 250` for a red ramp), never the mean of all
its pixels: antialiased edges pull the average toward the background and flatten the ramp into a
near-flat fill. Never record a gradient from a renderer instead of the descriptor.

Mockups often draw the bar at 3 sample values (say 7%, 64%, 94%). Those widths won't divide
into one consistent track length, because they were placed by eye. Trust the track's geometry,
not the samples.

## Reference files

- `png-analysis.md`: **the no-PSD path**, and the measuring step for the PSD path. How to
  run `analyze_png.py`, how to read what it returns, what it can't see, and how to write the
  descriptive markdown, including the section listing what to request from the designer.
- `tipos-de-peca.md`: **read before interpreting the art.** What a lower third, a fullscreen,
  an in-game and a bug each are, what "area of interest" means (it belongs to the video
  underneath, not to the piece), and how plates get layered (the cut is decided by state, not
  by drawing).
- `bundle-conventions.md`: **read before deciding the plates.** What a lower third, a
  fullscreen (switcher input vs. HTML-built) and a meter each need from the extraction, where
  the files live in the bundle, what must *not* be baked into a plate, and how to verify.
- `photopea-mcp.md`: **read before the first PSD on this bridge.** Tool map, the three silent
  differences (no `$.evalFile`, no `$.global`, nothing returns without `app.echoToOE`), the
  identity probe that replaces `photoshop_ping`, the three-call export loop, and what this path
  does not prove.
- `extendscript-gotchas.md`: scripting traps (stale references, clipping masks that silently
  release, merge ordering). Read before writing custom JSX beyond the bundled scripts, and
  whenever a script returns plausible but wrong bounds.
- `psd-tools-fallback.md`: the read-only Python path for when the MCP bridge (either one) is
  dead or untrustworthy. Also covers deriving a text layer's real px size from its transform,
  converting a baseline to a CSS `top`, and verifying plates against the designer's export.
  Read it as soon as a bridge probe fails.
- `manifest-format.md`: annotated `assets.json` + `ASSETS.md` templates.
- `html-rebuild.md`: CSS/JS patterns for positioning plates, driving fill boxes,
  swapping states, and wiring the result into a broadcast bundle.

## Verifying

Bounds in a return value are not evidence the art is right: a released clipping mask reports
confident, wrong numbers. Read the exported PNGs back as images and check them against the
reference. Symptoms and causes:

- A plate that should be one row comes out several times too tall → the clipping mask released.
- A state variant looks like stripes on the wrong base color → you clipped the texture over a
  plate you forgot to `recolor`.
- Placeholder text still baked in → the layer was inside a `keep`ed group and `dropText` was off.
- The grey mockup backdrop survived → its layer landed inside a kept group.

When several plates share a row or column, check that their `x`/`y` line up in the manifest.
Two cards on the same row must report the same `y`; if they don't, one of the specs grabbed a
neighbouring layer.

### Two mechanical guards, and the one thing neither catches

On a long batch, run these two local checks on every plate. They catch wrong-document and
one-step-stale exports.

**1. Geometric containment**, for a plate cropped to less than the canvas.

- Take the union of the kept layers' bboxes from psd-tools.
- Require the exported alpha bbox to sit *inside* it, plus a slack of ~24px for stroke and glow.
- Use **containment, not equality**: a clipping mask makes the render much *smaller* than the
  union (a group whose smart objects bleed to `-1138,-458,3493,3783` renders as a 1920×226 bar),
  so equality rejects every masked group. A wrong document shows as the render landing *outside*
  the union.

**2. Correlation against the designer's own flat**, for a plate that fills the canvas. The
geometric guard is blind here (two different pieces both report `0,0,1920,1080`).

- Downscale both the plate and that piece's `_reference.png` and compare them **only where the
  plate is opaque**. Where it is transparent (a camera-frame's video window) the flat shows the
  mockup, and that difference is expected.
- Expected values: the right piece scores a mean channel error of 1–7, the wrong piece ~90.
- Mask by alpha. Unmasked, camera-frame plates score 74–178 and look like failures.

**Neither guard sees baked placeholder text.** A lower third exported with `NICKNAME` still on
it has the same bbox as the clean one (the text sits *inside* the bar) and correlates fine
against a flat that also shows the placeholder. Look at a contact sheet once per piece. The
guards reduce looking from once per plate to once per piece; they do not replace it.
