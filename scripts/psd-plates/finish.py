"""finish.py <spec.json>
spec = {
  "psd": "<abs psd>", "flat": "<abs designer png>", "out": "<abs assets folder>",
  "plates": [ {"raw": "pp/x.png", "id": "barras", "keep": ["esquerda/barras"], "strokes": "auto"|[...] } ],
  "maskText": ["names/nickname", ...]   # dynamic text layers: excluded from the diff
  "maskBoxes": [[x0,y0,x1,y1], ...]       # extra exclusions (dynamic images)
}
Prints geometry + verification JSON.
"""
import sys, json, os, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plates import *

spec = json.load(open(sys.argv[1], encoding='utf-8'))
os.makedirs(spec['out'], exist_ok=True)
psd = PSDImage.open(spec['psd'])
base = os.path.dirname(os.path.abspath(__file__))
arrays, geo = [], []
for p in spec['plates']:
    img = load(os.path.join(base, p['raw']))
    strokes = p.get('strokes', 'auto')
    if strokes == 'auto':
        strokes = auto_stroke_specs(psd, p['keep'])
    if strokes:
        img = fix_strokes(psd, img, strokes)
    g = trim_save(img, os.path.join(spec['out'], p['id'] + '.png'))
    g.update({'id': p['id'], 'arquivo': p['id'] + '.png', 'strokesRefeitos': strokes})
    geo.append(g)
    arrays.append(img)
masks = [tuple(b) for b in spec.get('maskBoxes', [])]
for t in spec.get('maskText', []):
    l = find(psd, t)
    x0, y0, x1, y1 = l.bbox
    masks.append((x0 - 4, y0 - 4, x1 + 4, y1 + 4))
ver = verify(spec['flat'], compose(arrays), masks=masks)
shutil.copy(spec['flat'], os.path.join(spec['out'], '_reference.png'))
print(json.dumps({'plates': geo, 'verify': ver}, ensure_ascii=False, default=str))
