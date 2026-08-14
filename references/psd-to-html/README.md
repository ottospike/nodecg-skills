# PSD → dynamic HTML graphics

> **Read this whole document when the art for a graphic arrives as a `.psd`/`.psb`** —
> "extract the plates", "turn this mockup into HTML", "I need the PNGs from this design",
> "make this progress bar work", or any request pairing a PSD with a web/graphic
> implementation, even when the person only asks for "the assets".
>
> This is a subskill of `nodecg`. It ends where the graphic starts: once the plates and
> the manifest exist, go back to the parent SKILL.md and `assets/grafico-modelo.html` to
> build the piece. `bundle-conventions.md`, next to this file, is the bridge — it says what
> a lower third, a fullscreen and a meter each need from the extraction, and it is written
> from graphics that shipped.

Turn a layered PSD into two things: a folder of clean **plates** (trimmed PNGs of the static
art) and a **manifest** describing where each one goes, what fonts and colors the design uses,
and which boxes hold live data. With both, rebuilding the layout in HTML is mechanical.

The instinct to resist is exporting layer-by-layer. A PSD with 45 layers does not become 45
assets — it becomes maybe 6 plates. A plate is a *visual unit* the design treats as one thing:
a lower-third bar, a question panel, an answer card, a progress track. Fragmenting past that
produces a pile of shapes nobody can reassemble.

## Workflow

**1. Look at the flattened reference first.** Most PSDs ship next to an exported PNG. Read it
as an image before touching Photoshop and describe the composition out loud: what's static
decoration, what's live data, what states exist (empty/full, normal/highlighted), how the piece
behaves over time, and what an operator would trigger. This is the single highest-leverage step
— it tells you what the plates *are*. Without it you're reverse-engineering intent from layer
names like "Retângulo 3 copiar 2".

Measure it too, don't just look — `scripts/analyze_png.py` returns the backdrop colour, the
palette, and every block's canvas box, plus 1x/3x crops to inspect. It costs one command and
it replaces a round of eyeballed numbers that don't add up. See `png-analysis.md`.

Keep these observations; they become the overview section of `ASSETS.md` in step 5. Writing
them down at the end from memory produces something vaguer and less useful.

If there's no reference PNG, open the PSD and use `photoshop_get_preview`.

**If there is no PSD at all** — only the flattened image — this workflow doesn't apply.
Go to `png-analysis.md`: it covers measuring, describing, and being explicit about what
can't be recovered without layers.

**2. Inspect the document.** `photoshop_ping` once per session, then open the PSD.

Before trusting the bridge, prove it works: `execute_script` can return
`"Custom script executed"` while doing nothing, and the active document can silently be some
file the user had open rather than the one you just opened. Set a layer name as a probe, confirm
it via `photoshop_get_layers`, and match `photoshop_get_state`'s document name and layer count
against your PSD. If either check fails, work read-only from Python instead —
`psd-tools-fallback.md`. Do not send visibility toggles to a document you have not
identified; that edits someone else's work.

With the bridge verified, run:

```
$.evalFile(new File("../../scripts/inspect_psd.jsx"))
```

One call returns the layer tree with **index paths** (`"2/16"`), every text layer's font /
size / color / alignment / bbox, every solid fill's hex, and every gradient already converted
to a CSS `linear-gradient()` string. Index 0 is the **topmost** layer — this matters, because
a clipping mask always clips to the layer directly beneath it.

Large PSDs produce a lot of output. Return only the slices you need (`r.gradients`,
`r.texts`, filtered `r.layers`) rather than the whole object.

**3. Decide the plates and the dynamic fields.** For each plate, note which index paths
compose it. For each dynamic field, note its type:

| Type | What varies | What to record |
|---|---|---|
| `text` | a string or number | font, size, color, align, box |
| `fill` | a width/height percentage | **fillBox in plate-local coords**, gradient, direction, cap asset |
| `image` | a photo/logo swapped at runtime | box, object-fit, fallback asset |
| `state` | the whole plate swaps art | one plate PNG per state |

**4. Export the plates.** Set the spec and run `scripts/export_plates.jsx` (spec language
below). Verify each PNG by reading it back as an image — bounds that look plausible in the
return value are routinely wrong art.

**5. Write the manifest — this is the deliverable, not a bonus.** The PNGs alone are unusable:
nothing in them says where they go or what font the missing text used. Write both files *into
the same folder as the plates*, so the whole thing travels as one unit.

**The folder is named after the PSD**, extension stripped, original casing kept —
`LT_MetaLike.psd` → `LT_MetaLike/`. That name is the link back to the source: a revised PSD
tells you which folder to re-export without anyone having to remember the mapping.

```
graphics/assets/LT_MetaLike/
├── assets.json     ← the graphic fetches this at runtime and builds the DOM from it
├── ASSETS.md       ← the human-readable version: reference image, tables, CSS scaffold
├── *.png           ← runtime plates
└── _*.png          ← references and proofs, never on air
```

`export_plates.jsx` drops a raw `_plates.json` as it goes — that's a build artifact with
filenames and boxes, not the manifest. Fold it into `assets.json` and add what the script
can't know: roles, states, dynamic fields, palette tokens, font mappings.

Never leave a second, competing layout file behind. One manifest, one truth.

See `manifest-format.md` for the annotated template.

**6. Rebuild in HTML.** See `html-rebuild.md` for the positioning, fill-box,
state-swap and gradient patterns.

## Exporting plates

`scripts/export_plates.jsx` turns N layers into 1 trimmed PNG and records where it sat on the
canvas. Drive it with globals, then `$.evalFile`:

```js
$.global.OUTDIR = "C:\\...\\graphics\\assets\\LT_MetaLike";   // = nome do PSD
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
| `dropText` | strip text inside kept groups (default `true` — dynamic text is rebuilt in HTML) |
| `recolor` | `[{path,hex}]` — repaint a solid fill; this is how you synthesize state variants |
| `lift` | move layers out of their group to the document root, keeping the listed order (first = topmost) |
| `shift` | `[{path,dx,dy}]` — translate in pixels |
| `clip` | `{art,base,dx,dy}` — place `art` above `base`, offset it, create a clipping mask |
| `note` | carried into the manifest |

Everything not in `keep` is deleted, so the mockup's grey backdrop and the placeholder text
disappear for free. Each run returns `{file,x,y,w,h}` per plate and appends to `_plates.json`
in `OUTDIR`.

**Batch your runs.** Each spec duplicates the whole document; a heavy PSD will blow the MCP's
script timeout after roughly 4–6 plates. Use `$.global.ONLY` to run 2–3 at a time. A timeout
leaves the source document intact, so just re-run the remainder.

### Synthesizing states the designer only drew once

Mockups usually show one card in its highlight state and the rest neutral. You need every
combination. Rather than asking for a new PSD, rebuild the states from the pieces that exist:
`recolor` the plate's fill to the highlight color, then `clip` the texture artwork over it with
a `dx/dy` that moves it onto the target plate. Run it in reverse — recolor to the neutral color,
skip the clip — to get the neutral version of the one card that was drawn highlighted.

Work out `dx/dy` from the bounds `inspect_psd.jsx` already gave you: it's just
`targetPlate.x - sourceArt.x`.

### Baking vs. keeping separate

Bake anything that never changes into the plate — badge circles, index letters, static labels,
icons. Fewer moving parts in the HTML, fewer alignment bugs, and the typography stays exactly
as designed. Keep separate only what genuinely varies at runtime. When unsure, ask: "would an
operator ever need to change this mid-broadcast?"

## Progress bars and meters

These need more than a picture, because the fill is computed. Export three things — the empty
**track**, the **fill** at full extent, and the shaped **cap** if the fill has an angled or
decorative end — then record the fill's box *relative to the plate's own top-left*, not the
canvas:

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

Plate-local coordinates are what make `width: 47%` land correctly inside the track — canvas
coordinates only tell you where the plate goes, not where the liquid goes inside it. Derive
them by subtracting: `fillBox.x = fillLayer.x - trackPlate.x`.

Read the fill's gradient off `inspect_psd.jsx` rather than eyedropping it; the script already
converts Photoshop's 0–4096 stops and right-facing 0° angle into CSS percentages and degrees.
Prefer a CSS gradient over a stretched PNG — it scales without banding and recolors trivially.

**Then check the gradient against the designer's flattened PNG before you write it down.** Read
the stops from the descriptor, sample the same region out of the reference image, and confirm
they agree. Sample the *saturated core* of the shape (e.g. `R >= 250` for a red ramp), never the
mean of all its pixels — antialiased edges pull the average toward the background and flatten the
ramp into something that looks like a near-flat fill. A gradient recorded from a renderer instead
of the descriptor, or averaged instead of cored, is the failure a designer spots in one glance.

Mockups often draw the bar at 3 sample values (say 7%, 64%, 94%). Those widths won't divide
into one consistent track length, because they were placed by eye. Trust the track's geometry,
not the samples.

## Reference files

- `png-analysis.md` — **the no-PSD path**, and the measuring step for the PSD path. How to
  run `analyze_png.py`, how to read what it returns, what it can't see, and how to write the
  descriptive markdown — including the section listing what must be requested from the designer.
- `bundle-conventions.md` — **read before deciding the plates.** What a lower third, a
  fullscreen (two flavours — switcher input vs. HTML-built) and a meter each need from the
  extraction, where the files live in the bundle, what must *not* be baked into a plate, and
  how to verify. Written from graphics that shipped.
- `extendscript-gotchas.md` — the Photoshop scripting traps that cost real debugging
  time (stale references, clipping masks that silently release, merge ordering). Read this
  before writing any custom JSX beyond the bundled scripts, and whenever a script returns
  plausible-looking but wrong bounds.
- `psd-tools-fallback.md` — the read-only Python path for when the Photoshop MCP is
  dead or untrustworthy. Also the place to look for deriving a text layer's real px size from its
  transform, converting a baseline to a CSS `top`, and verifying plates against the designer's
  own export. Read it the moment a bridge probe fails.
- `manifest-format.md` — annotated `assets.json` + `ASSETS.md` templates.
- `html-rebuild.md` — CSS/JS patterns for positioning plates, driving fill boxes,
  swapping states, and wiring the result into a broadcast bundle.

## Verifying

Bounds in a return value are not evidence the art is right — a released clipping mask reports
confident, wrong numbers. Read the exported PNGs back as images and check them against the
reference. Specific things that go wrong:

- A plate that should be one row comes out several times too tall → the clipping mask released.
- A state variant looks like stripes on the wrong base color → you clipped the texture over a
  plate you forgot to `recolor`.
- Placeholder text still baked in → the layer was inside a `keep`ed group and `dropText` was off.
- The grey mockup backdrop survived → its layer landed inside a kept group.

When several plates share a row or column, check that their `x`/`y` line up in the manifest.
Two cards on the same row must report the same `y`; if they don't, one of the specs grabbed a
neighbouring layer.
