# Manifest format

Write **both** files into the plates folder. They serve different readers and neither replaces
the other: `assets.json` is what the HTML consumes, `ASSETS.md` is what a person skims to check
the extraction was faithful before any code gets written.

The folder is `<category>/<psd name in lowercase>`, extension stripped — `L3_Pergunta.psd` →
`l3/l3_pergunta/` (see `bundle-conventions.md`). The manifest's `source` field keeps the PSD's
original path and name, so the two can always be matched.

```
<assets>/l3/l3_pergunta/
├── assets.json
├── ASSETS.md
├── plate_question.png
├── answer_a_normal.png
└── ...
```

## assets.json

```json
{
  "source": "Broadcast/L3_Pergunta/L3_Pergunta.psd",
  "canvas": { "w": 1920, "h": 1080 },

  "palette": {
    "rowTop": "#12121E",
    "rowBottom": "#26263A",
    "accent":   "#E24E1B",
    "white":    "#FFFFFF"
  },

  "fonts": {
    "body":    { "family": "Inter", "psName": "Inter-Medium",   "weight": 500 },
    "emphasis":{ "family": "Inter", "psName": "Inter-SemiBold", "weight": 600 }
  },

  "gradients": {
    "meterFill": "linear-gradient(90deg, #E24E1B 0%, #C81E5A 100%)"
  },

  "plates": [
    { "id": "logo",     "file": "logo_show.png",      "x":  70, "y":  70, "w":  226, "h": 135 },
    { "id": "question", "file": "plate_question.png", "x": 319, "y": 776, "w": 1284, "h": 104 },

    { "id": "answer_a", "slot": "a", "x": 319, "y": 894, "w": 644, "h": 58,
      "states": { "normal": "answer_a_normal.png", "correct": "answer_a_correct.png" } }
  ],

  "fields": [
    { "id": "questionText", "type": "text", "plate": "question",
      "box": { "x": 21, "y": 14, "w": 1240, "h": 78 },
      "font": "body", "sizePx": 31, "lineHeightPx": 38, "color": "#FFFFFF",
      "align": "center", "maxLines": 2 },

    { "id": "answerA", "type": "text", "plate": "answer_a",
      "box": { "x": 91, "y": 0, "w": 520, "h": 58 },
      "font": "body", "fontWhenCorrect": "emphasis",
      "sizePx": 31, "color": "#FFFFFF", "align": "left", "verticalAlign": "center" },

    { "id": "likeMeter", "type": "fill", "plate": "meter_track",
      "fillBox": { "x": 4, "y": 6, "w": 420, "h": 92 },
      "direction": "ltr", "gradient": "meterFill",
      "cap": { "file": "meter_cap.png", "w": 47, "h": 104 },
      "max": 5000 }
  ]
}
```

### Field rules that matter

**`plates[].x/y/w/h` are canvas coordinates**: where the PNG sits in the 1920×1080 frame.
They go straight into `position:absolute; left:Xpx; top:Ypx`.

**`fields[].box` and `fillBox` are plate-local**: measured from that plate's top-left, not the
canvas. A field nested inside its plate then moves with the plate, and a fill's percentage
width resolves against the track rather than the screen. Derive with
`local = fieldCanvasX - plateCanvasX`.

**`box` is the span, `measured` is the mockup's glyphs; never conflate them.** Photoshop has
two kinds of text layer and `inspect_psd.jsx` reports which via `textKind`:

- **`point`**: the layer's bounds are just the outline of whatever placeholder the designer
  typed. `"Escrever aqui"` measures 183px; that is not a span, only the width of that
  string. Use it as a width and the first real answer longer than the placeholder overflows.
  There is no designed span — you have to derive one from the plate's geometry (plate width
  minus the field's inset minus breathing room at the far edge, tighter if the plate has an
  angled edge).
- **`paragraph`**: the designer drew a real text box, reported in `span`. Sanity-check it
  against `measured` before trusting it: Photoshop reports `span` in the layer's own
  coordinate space, so a transformed layer gives numbers that don't match the document. When
  they disagree, `measured` is what the reference image actually shows.

Record both plus `spanSource` (`designed` / `measured` / `derivedFromPlate`) so the next
reader knows which numbers are load-bearing and which are estimates worth revisiting.

**If every text layer reports the same `FontSize`, the designer scaled the layers.**
Example: 16 text layers all reporting `37.22`, from a 121px `?` down to a 21px nickname (real
sizes 121.1, 81.4, 62.2, 36.5, 35.4, 35.1, 31.1, 20.9). When a dump shows one repeated nominal
size across visibly different type, do not write any of them down: every field needs the
multiplication below.

**A transformed text layer's size is `FontSize × transform scale`, not `FontSize`.** Photoshop
stores a nominal size and a transform separately, and designers scale text layers often: a
layer reporting 26.87 can render at 53px. Multiply, then cross-check against the font's own
advance widths and the layer's ink height before writing the number down; agreement within a
couple of pixels is your evidence. Record the derivation, not just the result, so the next reader
can tell a measured number from a guess. Vertical scale often differs slightly from horizontal
(a 3.4% squash is common and invisible); note it as an optional `scaleY()` rather than averaging
the two into a size that matches neither.

**Convert the baseline to a CSS `top` rather than nudging by eye.** The PSD gives a baseline; CSS
positions a line box. With `line-height: L`, ascent `a` and descent `d` in em:
`top = baseline − ((L − (a+d)·size)/2 + a·size)`. Check the font's `USE_TYPO_METRICS` flag to know
whether the browser uses `sTypo*` or `usWin*`; the wrong pair puts the text several pixels off.

**Capture leading, tracking and case, not just family and size.** `leadingPx: null` from the
script means Photoshop auto-leading, which is 120% of the size: compute it (`31px → 37px`)
rather than eyeballing a round number. Tracking is in 1/1000 em, so `26` is
`letter-spacing: 0.026em`. Check `capitalization`: an `ALLCAPS` layer whose contents read
`"a"` renders as `A`; record it.

**`states`** replaces a `file` key when a plate has variants. The HTML swaps `src`; the box
never changes, so nothing reflows.

**`font`** points into the `fonts` map rather than repeating the family everywhere; when the
real font file arrives, one edit fixes every field.

**Record the PostScript name** (`Inter-SemiBold`), not just "semibold". It's what identifies
the actual file, and PSDs regularly mix optical sizes that look identical in a mockup.

## ASSETS.md

Keep it scannable. Someone should be able to open it, glance at the tables, and say "that's
wrong, the C row is at 952 not 894" without reading any JSON.

**Lead with a plain-language overview of what the graphic *is*.** Measurements can't carry
this and layer names obscure it. Without it, whoever builds the graphic re-derives the intent
from the mockup, and wrong assumptions get baked into code. Write down what you worked out in
step 1 of the extraction.

Cover: what the piece is and where it sits on screen, how it behaves over time (states and the
sequence between them), what the operator triggers, and what data has to arrive. Also state the
constraints the artwork silently implies — a 2×2 grid means exactly four slots forever; a single
highlight state means there's no "wrong answer" treatment; a fixed-width label box means long
strings need truncating. These assumptions cause rework when discovered late.

Keep it short: a few paragraphs and a small table. It's orientation, not a spec.

````markdown
# l3_pergunta — extracted assets      ← same name as the folder, derived from the PSD

**Source:** `Broadcast/L3_Pergunta/L3_Pergunta.psd` · **Canvas:** 1920×1080
**Reference:** ![](../../L3_Pergunta/L3_Pergunta.png)

## What this is

Quiz card — a question in the lower third with four answers in a 2×2 grid; the correct one
lights up orange. Occupies y 776→1010 plus a logo top-left; the centre band stays clear for
the presenter's camera. Transparent everywhere else — this is an OBS/vMix overlay.

| Moment | What happens |
|---|---|
| In | Question panel enters, answers follow staggered |
| Reading | All four plates in `normal` |
| Reveal | The correct plate swaps to `correct` |
| Out | Everything collapses |

Exactly one answer is correct — the art has no "wrong" state. The four slots are fixed; there
is no dynamic grid.

**Operator:** load question + answers, mark the correct letter, then PLAY / REVEAL / OUT.
Reveal is a separate trigger from entry — the card sits on air during voting.

**Data needed:** question string (fits 2 lines), four short strings, the correct letter.
Labels over ~533px will overflow.

## Plates

| File | x | y | w | h | Role | Notes |
|---|---|---|---|---|---|---|
| `logo_show.png` | 70 | 70 | 226 | 135 | logo | — |
| `plate_question.png` | 319 | 776 | 1284 | 104 | question panel | text removed |
| `answer_a_normal.png` | 319 | 894 | 644 | 58 | answer A | badge + letter baked in |
| `answer_a_correct.png` | 319 | 894 | 644 | 58 | answer A · win | synthesized: recolor + clipped texture |

## Palette

| Token | Hex | Used by |
|---|---|---|
| `rowTop` | `#12121E` | answer plates, top row |
| `accent` | `#E24E1B` | win state, badge ring |

## Gradients

| Token | CSS |
|---|---|
| `meterFill` | `linear-gradient(90deg, #E24E1B 0%, #C81E5A 100%)` |

Record the CSS string **and** the evidence that it's right: the descriptor values, plus what you
measured out of the designer's flattened PNG at a few positions along the ramp. Gradients are
the most error-prone values in a manifest, so add a `"verified"` block naming the sampled
positions and their hexes. Note the direction in words too: `0deg` is bottom→top in CSS, which
puts the *first* stop at the bottom.

## Typography

| Element | Font (PostScript) | Size | Color | Align |
|---|---|---|---|---|
| Question | `Inter-Medium` | 31px | `#FFFFFF` | center, max 2 lines |
| Answer label | `Inter-Medium` | 31px | `#FFFFFF` | left |
| Answer label (win) | `Inter-SemiBold` | 31px | `#FFFFFF` | left |

> Font files not in the repo; falling back to a system sans until the `.otf`s arrive.

## Dynamic fields

| id | Type | Plate | Box (plate-local) | Notes |
|---|---|---|---|---|
| `questionText` | text | question | 21, 14, 1240×78 | wraps to 2 lines |
| `answerA` | text | answer_a | 91, 0, 520×58 | vertically centered |
| `likeMeter` | fill | meter_track | 4, 6, 420×92 | ltr, max 5000, `meterFill` |

## States

`answer_{a,b,c,d}` each ship `normal` and `correct`. The PSD only drew the win state on slot B;
the rest were synthesized by recoloring the plate fill to `#E24E1B` and re-clipping the
lightning texture over it. Slot B's neutral version came from the reverse operation.

## CSS scaffold

```css
.stage { position: relative; width: 1920px; height: 1080px; }
.stage > * { position: absolute; }

.logo     { left:  70px; top:  70px; width:  226px; height: 135px; }
.question { left: 319px; top: 776px; width: 1284px; height: 104px; }
.answer-a { left: 319px; top: 894px; width:  644px; height:  58px; }
```
````

Always embed the reference PNG at the top and the CSS scaffold at the bottom; without them
the file only repeats the JSON.
