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

Call `photopea_get_document_info` and match **the document name and the canvas w/h** against the
PSD you meant to open. If either disagrees, stop and re-open — do not send visibility toggles,
deletes or recolors first. If the bridge itself looks unreliable, work read-only from Python
instead: `psd-tools-fallback.md`.

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
