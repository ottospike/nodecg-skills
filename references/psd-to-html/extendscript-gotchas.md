# ExtendScript traps

Everything here was learned by watching a script return confident, wrong output. The bundled
scripts already handle all of it — this file exists for when you write custom JSX, or when a
result looks plausible but the PNG is wrong.

**Applies to both bridges.** Photopea's scripting API is ExtendScript-shaped — same
`app.activeDocument`, `ArtLayer`, `LayerSet`, and the same silent invalidation of layer
references after a move or reorder. The traps below are about the language and the document
model, not about which MCP delivers the script. Only the last section is Photoshop-specific;
the Photopea equivalents live in `photopea-mcp.md`.

## Layer references go stale after any reorder

The single most expensive trap. `move()`, `remove()`, `translate()` on a sibling, merging a
group — any of these silently invalidate `ArtLayer` **and** `LayerSet` references you're
holding. The stale reference doesn't throw; it starts pointing at a neighbouring layer.

```js
var art = grp.layers[14];
var plate = grp.layers[16];
art.move(plate, ElementPlacement.PLACEBEFORE);
art.grouped = true;              // may now be operating on some other layer
```

**Fix: tag then re-find.** Resolve each path once, rename the layer to a unique marker, and
re-locate by that name before every operation. Renaming doesn't disturb the layer stack, so
the marker stays valid for the life of the document.

```js
grp.layers[14].name = "__ART";
// ...mutations...
findByName(doc, "__ART").translate(dx, dy);
findByName(doc, "__ART").grouped = true;   // fresh lookup each time
```

`export_plates.jsx` does exactly this with `__P0`, `__P1`… tags.

## Clipping masks

**Inserting a layer above the mask releases it.** A clipping mask clips to the layer directly
below. Moving anything into the stack above it quietly breaks the clip — and the DOM keeps
reporting `grouped === true`. Keep the clip pair isolated: move unrelated layers out to the
document root first (`layer.move(doc, ElementPlacement.PLACEATBEGINNING)`), clip last.

**The DOM `.grouped` setter is a no-op when it thinks nothing changed.** Because Photoshop
releases clips on its own during reordering, the DOM value and the real state drift apart.
Setting `.grouped = true` on something the DOM already believes is clipped does nothing, and
you export unclipped art. Use Action Manager, which doesn't cache:

```js
function amClip(doc, layer, create) {
  doc.activeLayer = layer;
  var d = new ActionDescriptor(), r = new ActionReference();
  r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
  d.putReference(charIDToTypeID("null"), r);
  executeAction(charIDToTypeID(create ? "GrpL" : "Ungr"), d, DialogModes.NO);
}
```

Release-then-create guarantees a real state transition. Wrap the release in `try/catch` —
`"Release Clipping Mask is not currently available"` just means it wasn't clipped.

**Deleting a clip's base re-clips it to whatever is now underneath.** If you prune the layer a
mask was clipped to, Photoshop silently re-targets rather than releasing. Re-establish the
clip explicitly instead of assuming inherited state.

**`merge()` on a clipped layer is blocked.** Merge the enclosing *group* instead — group merge
resolves clipping correctly. This is also why you can't skip merging: saving a PNG straight
from a document with an active clipping mask exports the mask's full untrimmed artwork, not
the clipped result.

## Merging and flattening

**Merge inside-out.** `LayerSet.merge()` on a group that still contains subgroups fails with
`"The command Select is not currently available"`. Find the deepest group with no child groups,
merge it, repeat.

**`mergeVisibleLayers()` throws when only one layer is visible.** Guard on
`doc.layers.length > 1`, or wrap in `try/catch`.

**Delete instead of hide.** Hiding unwanted layers and calling `mergeVisibleLayers()` is
unreliable: it fails on single-layer cases, and the hidden layers stay in the stack — so
`doc.layers[0]` afterwards is the topmost *hidden* layer, not your merged result, and you read
its bounds by mistake. Deleting sidesteps all of it and costs nothing on a duplicated document.

**Read canvas position before trimming.** `trim(TrimType.TRANSPARENT)` throws away the offset.
Merge to one layer, read `layer.bounds` for `x`/`y`, then trim and read `doc.width`/`doc.height`
for `w`/`h`.

## Reading style off layers

Colors and gradients aren't on the DOM — go through Action Manager:

- **Solid fill**: `adjustment` list → object 0 → `color` → `Rd  ` / `Grn ` / `Bl  ` (note the
  trailing spaces in those four-character IDs; they're significant).
- **Gradient fill layer**: `adjustment` list → object 0 → `gradient` → `colors` list.
- **Gradient overlay effect**: `layerEffects` → `gradientFill` → `gradient` → `colors`.

Gradient stop `location` is 0–4096, so `pct = location / 4096 * 100`. Photoshop's 0° points
**right**; CSS 0deg points **up**, so `cssAngle = (90 - psAngle + 360) % 360`.

Text is friendlier — `textItem.font` (PostScript name), `.size`, `.color.rgb.hexValue`,
`.justification`, `.contents` all work directly.

## Working through the Photoshop MCP

Photopea is the default bridge — for its tool map, identity probe and export loop see
`photopea-mcp.md`. What follows is the Photoshop MCP path.

- `photoshop_ping` once per session, not per call.
- **`execute_script` can be a silent no-op.** It returns `"Custom script executed"` and
  `Result: undefined` whether or not your JSX ran. Probe it with an observable side effect —
  rename `layers[0]` and confirm the new name via `photoshop_get_layers` — before you trust
  anything downstream. When it isn't running, `$.evalFile` is unavailable and the whole JSX path
  here is dead; fall back to `psd-tools-fallback.md`.
- **The active document is not necessarily the one you opened.** `photoshop_open_image` returns an
  id, but focus can sit on a file the user already had open. Match `photoshop_get_state`'s name
  and layer count against your PSD; if `get_state` and `get_layers` disagree with each other, the
  bridge is stale. Never send visibility toggles or other mutations to an unidentified document —
  layer names like `Rectangle 3 copiar 2` and `Background` exist in every file in a project, so
  the calls will happily "succeed" against the wrong one.
- **`save_document` takes `path`, not `filePath`** — the wrong key fails with
  `Cannot read properties of undefined (reading 'replace')`.
- **Script timeouts.** Each document duplicate on a large PSD is slow; ~4–6 duplicates exceeds
  the limit. Batch with a filter global (`$.global.ONLY`) and run 2–3 at a time. A timeout
  leaves the source document untouched — just re-run the rest.
- **`$.evalFile` beats pasting.** Write the script to disk once, then call it repeatedly with
  different globals. `$.global` values persist across `photoshop_execute_script` calls within a
  session. Neither exists on Photopea: no filesystem, no `$` — the body goes in inline and the
  config goes in as top-level `SPECS_IN` / `OUTDIR_IN` vars declared above it.
- **The script body runs inside a wrapping IIFE** — you need an explicit `return`.
- **Photoshop blocks while the user interacts with it.** Calls fail with a `cscript` error;
  `photoshop_get_state` fails too. That's a busy UI, not a broken script. Wait and retry.
- **Windows paths**: escape backslashes in JSX string literals, and remember project paths
  containing `[brackets]` are glob patterns to PowerShell — the Bash tool handles them fine.

## Debugging technique that actually works

When a script returns wrong bounds, don't guess. Duplicate the document, run the steps
manually, and return the layer structure at each stage instead of exporting:

```js
var work = src.duplicate("dbg");
// ...steps...
var out = [];
for (var i = 0; i < grp.layers.length; i++)
  out.push(i + ":" + grp.layers[i].name + " grouped=" + grp.layers[i].grouped +
           " b=" + Math.round(grp.layers[i].bounds[0].as('px')));
return out;
```

Leave the debug document open between calls and keep poking at it. Seeing `grouped=false`
where you expected `true` — or a name you didn't expect at an index — locates the bug
immediately, where reasoning about the script's control flow rarely does.
