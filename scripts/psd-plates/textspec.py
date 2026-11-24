"""textspec.py <psd> — dump every type layer's real typography (psd-tools).
size_px = FontSize * transform scale; baseline = transform ty; origin x = tx.
Paths are psd-tools bottom-up index paths."""
import sys, json
from psd_tools import PSDImage

def plain(o):
    if isinstance(o, dict): return {str(k): plain(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [plain(v) for v in o]
    if hasattr(o, 'value'): return plain(o.value)
    return o

JUST = {0: 'left', 1: 'right', 2: 'center'}

def fx(l):
    out = []
    for e in (l.effects or []):
        if not getattr(e, 'enabled', False):
            continue
        d = {'t': e.__class__.__name__}
        for a in ('size', 'opacity', 'distance', 'angle', 'position', 'blend_mode'):
            try: d[a] = str(getattr(e, a))
            except Exception: pass
        try:
            c = e.color
            d['color'] = '#%02X%02X%02X' % (round(float(c[b'Rd  '])), round(float(c[b'Grn '])), round(float(c[b'Bl  '])))
        except Exception: pass
        out.append(d)
    return out

def walk(g, path, out):
    for i, l in enumerate(g):
        p = path + [i]
        if l.is_group():
            walk(l, p, out)
        elif l.kind == 'type':
            ed = plain(l.engine_dict)
            rd = plain(l.resource_dict)
            runs = ed['StyleRun']['RunArray']
            ss = runs[0]['StyleSheet']['StyleSheetData']
            fonts = rd['FontSet']
            t = l.transform
            sx = (t[0] ** 2 + t[1] ** 2) ** 0.5
            sy = (t[2] ** 2 + t[3] ** 2) ** 0.5
            fc = ss.get('FillColor', {}).get('Values', [1, 0, 0, 0])
            col = '#%02X%02X%02X' % tuple(round(v * 255) for v in fc[1:4])
            para = ed['ParagraphRun']['RunArray'][0]['ParagraphSheet']['Properties']
            just = JUST.get(para.get('Justification', 0), para.get('Justification'))
            box = None
            try:
                bb = ed['Rendered']['Shapes']['Children'][0]['Cookie']['Photoshop']['BoxBounds']
                if ed['Rendered']['Shapes']['Children'][0]['Cookie']['Photoshop'].get('ShapeType') == 1:
                    box = [round(v * sx, 2) for v in bb]
            except Exception:
                pass
            run_fonts = sorted(set(fonts[r['StyleSheet']['StyleSheetData'].get('Font', 0)]['Name'] for r in runs))
            out.append({
                'path': '/'.join(map(str, p)), 'name': l.name, 'text': l.text,
                'font': fonts[ss.get('Font', 0)]['Name'], 'runFonts': run_fonts,
                'sizePx': round(ss.get('FontSize', 0) * sy, 2), 'scaleX': round(sx / sy, 4) if sy else 1,
                'color': col, 'trackingEm': round(ss.get('Tracking', 0) / 1000, 4),
                'leadingPx': round(ss['Leading'] * sy, 2) if 'Leading' in ss and not ss.get('AutoLeading', True) else None,
                'caps': {0: None, 1: 'smallcaps', 2: 'allcaps'}.get(ss.get('FontCaps', 0)),
                'just': just, 'originX': round(t[4], 2), 'baselineY': round(t[5], 2),
                'paraBox': box, 'bbox': list(l.bbox), 'visible': l.visible,
                'effects': fx(l),
            })

psd = PSDImage.open(sys.argv[1])
out = []
walk(psd, [], out)
print(json.dumps(out, ensure_ascii=False, indent=1, default=str))
