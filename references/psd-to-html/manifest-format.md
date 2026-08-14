# Manifest format

Write **both** files into the plates folder. They serve different readers and neither replaces
the other: `assets.json` is what the HTML consumes, `ASSETS.md` is what a person skims to check
the extraction was faithful before any code gets written.

The folder carries the PSD's own name, extension stripped — `L3_Pergunta.psd` →
`L3_Pergunta/` — so the manifest's `source` field and the folder always agree.

```
graphics/assets/L3_Pergunta/
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
    "navyRow1": "#0F0F23",
    "navyRow2": "#272740",
    "orange":   "#FF3C00",
    "white":    "#FFFFFF"
  },

  "fonts": {
    "body":    { "family": "Haffer", "psName": "Haffer-Medium",   "weight": 500 },
    "emphasis":{ "family": "Haffer", "psName": "Haffer-SemiBold", "weight": 600 }
  },

  "gradients": {
    "meterFill": "linear-gradient(90deg, #FF3C00 0%, #FF0078 100%)"
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

**`plates[].x/y/w/h` are canvas coordinates** — where the PNG sits in the 1920×1080 frame.
Straight into `position:absolute; left:Xpx; top:Ypx`.

**`fields[].box` and `fillBox` are plate-local** — measured from that plate's top-left, not the
canvas. This is the whole point: a field nested inside its plate moves with the plate, and a
fill's percentage width resolves against the track rather than the screen. Derive with
`local = fieldCanvasX - plateCanvasX`.

**`box` is the span, `measured` is the mockup's glyphs — never conflate them.** This is the
mistake that ships broken layouts. Photoshop has two kinds of text layer and
`inspect_psd.jsx` reports which via `textKind`:

- **`point`** — the layer's bounds are just the outline of whatever placeholder the designer
  typed. `"Escrever aqui"` measures 183px; that is not a span, it's a coincidence of that
  string. Use it as a width and the first real answer longer than the placeholder overflows.
  There is no designed span — you have to derive one from the plate's geometry (plate width
  minus the field's inset minus breathing room at the far edge, tighter if the plate has an
  angled edge).
- **`paragraph`** — the designer drew a real text box, reported in `span`. Sanity-check it
  against `measured` before trusting it: Photoshop reports `span` in the layer's own
  coordinate space, so a transformed layer gives numbers that don't match the document. When
  they disagree, `measured` is what the reference image actually shows.

Record both plus `spanSource` (`designed` / `measured` / `derivedFromPlate`) so the next
reader knows which numbers are load-bearing and which are estimates worth revisiting.

**A transformed text layer's size is `FontSize × transform scale`, not `FontSize`.** Photoshop
stores a nominal size and a transform separately, and designers scale text layers constantly — a
layer reporting 26.87 can render at 53px. Multiply, then cross-check against the font's own
advance widths and the layer's ink height before writing the number down; agreement within a
couple of pixels is your evidence. Record the derivation, not just the result, so the next reader
can tell a measured number from a guess. Vertical scale often differs slightly from horizontal
(a 3.4% squash is common and invisible) — note it as an optional `scaleY()` rather than averaging
the two into a size that matches neither.

**Convert the baseline to a CSS `top` rather than nudging by eye.** The PSD gives a baseline; CSS
positions a line box. With `line-height: L`, ascent `a` and descent `d` in em:
`top = baseline − ((L − (a+d)·size)/2 + a·size)`. Check the font's `USE_TYPO_METRICS` flag to know
whether the browser uses `sTypo*` or `usWin*` — pick wrong and the text sits several pixels off.

**Capture leading, tracking and case, not just family and size.** `leadingPx: null` from the
script means Photoshop auto-leading, which is 120% of the size — compute it (`31px → 37px`)
rather than eyeballing a round number. Tracking is in 1/1000 em, so `26` is
`letter-spacing: 0.026em`. And check `capitalization`: an `ALLCAPS` layer whose contents read
`"a"` renders as `A`, which is baffling later if you didn't write it down.

**`states`** replaces a `file` key when a plate has variants. The HTML swaps `src`; the box
never changes, so nothing reflows.

**`font`** points into the `fonts` map rather than repeating the family everywhere — when the
real font file turns up later, one edit fixes every field.

**Record the PostScript name** (`Haffer-SemiBold`), not just "semibold". It's what identifies
the actual file, and PSDs regularly mix optical sizes that look identical in a mockup.

## ASSETS.md

Keep it scannable. Someone should be able to open it, glance at the tables, and say "that's
wrong, the C row is at 952 not 894" without reading any JSON.

**Lead with a plain-language overview of what the graphic *is*.** This is the part measurements
can't carry and layer names actively obscure. Whoever builds the graphic — you, next week, or
someone else — otherwise has to re-derive the intent from the mockup all over again, and that
re-derivation is where wrong assumptions get baked into code. You worked it out in step 1 of
the extraction; write it down while it's fresh.

Cover: what the piece is and where it sits on screen, how it behaves over time (states and the
sequence between them), what the operator triggers, and what data has to arrive. Also state the
constraints the artwork silently implies — a 2×2 grid means exactly four slots forever; a single
highlight state means there's no "wrong answer" treatment; a fixed-width label box means long
strings need truncating. Those are the assumptions that cause rework when discovered late.

Keep it short — a few paragraphs and a small table. It's orientation, not a spec.

````markdown
# LT_MetaLike — extracted assets      ← same name as the PSD and the folder

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
| `navyRow1` | `#0F0F23` | answer plates, top row |
| `orange` | `#FF3C00` | win state, badge ring |

## Gradients

| Token | CSS |
|---|---|
| `meterFill` | `linear-gradient(90deg, #FF3C00 0%, #FF0078 100%)` |

Record the CSS string **and** the evidence that it's right: the descriptor values, plus what you
measured out of the designer's flattened PNG at a few positions along the ramp. A gradient is the
easiest thing in a manifest to get wrong and the easiest for a designer to spot, so a
`"verified"` block naming the sampled positions and their hexes earns its space. Note the
direction in words too — `0deg` is bottom→top in CSS, which puts the *first* stop at the bottom,
and that is the opposite of most people's intuition.

## Typography

| Element | Font (PostScript) | Size | Color | Align |
|---|---|---|---|---|
| Question | `Haffer-Medium` | 31px | `#FFFFFF` | center, max 2 lines |
| Answer label | `Haffer-Medium` | 31px | `#FFFFFF` | left |
| Answer label (win) | `Haffer-SemiBold` | 31px | `#FFFFFF` | left |

> Font files not in the repo — falling back to Outfit until the Haffer `.otf`s arrive.

## Dynamic fields

| id | Type | Plate | Box (plate-local) | Notes |
|---|---|---|---|---|
| `questionText` | text | question | 21, 14, 1240×78 | wraps to 2 lines |
| `answerA` | text | answer_a | 91, 0, 520×58 | vertically centered |
| `likeMeter` | fill | meter_track | 4, 6, 420×92 | ltr, max 5000, `meterFill` |

## States

`answer_{a,b,c,d}` each ship `normal` and `correct`. The PSD only drew the win state on slot B;
the rest were synthesized by recoloring the plate fill to `#FF3C00` and re-clipping the
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

Embedding the reference PNG at the top and shipping the CSS scaffold at the bottom is what
makes the file worth writing — otherwise it's a JSON dump in table clothing.
