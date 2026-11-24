"""plates.py — finish Photopea full-canvas exports into trimmed plates.

Usage (as module):
  from plates import fix_strokes, trim_save, verify
  img = fix_strokes(psd, rgba_array, ['barras/Shape 5'])   # layer names (paths by name)
  geo = trim_save(img, out_png)                             # {x,y,w,h}
  verify(psd_png, [plate arrays...], masks=[(x0,y0,x1,y1),...])

Why: Photopea paints clipped layers OVER a shape's vector stroke (the stroke
vanishes when the shape is a clipping base). We rebuild the ring from the
vector path + stroke descriptor and composite it on top.
"""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from psd_tools import PSDImage

W, H = 1920, 1080


def find(psd, spec):
    """spec = 'Group/Sub/Layer' by names (first match per level)."""
    parts = spec.split('/')
    cur = psd
    for p in parts:
        nxt = [l for l in cur if l.name == p]
        if not nxt:
            raise KeyError(f'{p!r} not in {[l.name for l in cur]}')
        cur = nxt[0]
    return cur


def path_mask(layer, S=8):
    vm = layer.vector_mask
    im = Image.new('L', (W * S, H * S), 0)
    dr = ImageDraw.Draw(im)

    def P(yx):
        return np.array([yx[1] * W * S, yx[0] * H * S])

    for path in vm.paths:
        ks = list(path)
        pts = []
        n = len(ks)
        segs = n if path.is_closed() else n - 1
        for i in range(segs):
            k0, k1 = ks[i], ks[(i + 1) % n]
            t = np.linspace(0, 1, 32)[:, None]
            p0, c0, c1, p1 = P(k0.anchor), P(k0.leaving), P(k1.preceding), P(k1.anchor)
            seg = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c0 + 3 * (1 - t) * t ** 2 * c1 + t ** 3 * p1
            pts.extend(map(tuple, seg))
        if len(pts) > 2:
            # operation: combine mode; most shapes here are single additive paths
            dr.polygon(pts, fill=255)
    return np.array(im) > 127, S


def ring_for(layer):
    st = layer.stroke
    w = float(st.line_width)
    al = str(st.line_alignment)
    c = st.content
    rgb = None
    try:
        cc = c[b'Clr '] if b'Clr ' in c else c['Clr ']
        rgb = np.array([float(cc[b'Rd  ']), float(cc[b'Grn ']), float(cc[b'Bl  '])]) / 255.0
    except Exception:
        rgb = np.array([0.149, 0.043, 0.098])
    big, S = path_mask(layer)
    din = ndi.distance_transform_edt(big)
    dout = ndi.distance_transform_edt(~big)
    sd = (dout - din) / S  # >0 outside
    if 'inside' in al or 'inner' in al:
        sel = (sd <= 0) & (sd >= -w)
    elif 'outside' in al or 'outer' in al:
        sel = (sd >= 0) & (sd <= w)
    else:
        sel = np.abs(sd) <= w / 2
    ring = np.array(Image.fromarray((sel * 255).astype('uint8')).resize((W, H), Image.BOX)).astype(float) / 255
    return ring, rgb


def over_rgba(top_a, top_rgb, base):
    """base: float HxWx4 0..1 (straight alpha)."""
    pa = base[..., 3:4]
    ra = top_a[..., None]
    oa = ra + pa * (1 - ra)
    oc = (top_rgb * ra + base[..., :3] * pa * (1 - ra)) / np.maximum(oa, 1e-6)
    return np.concatenate([oc, oa], axis=2)


def load(png):
    return np.array(Image.open(png).convert('RGBA')).astype(float) / 255


def fix_strokes(psd, img, specs):
    for s in specs:
        lay = find(psd, s)
        ring, rgb = ring_for(lay)
        img = over_rgba(ring, rgb, img)
    return img


def trim_save(img, out, pad=0):
    u8 = (np.clip(img, 0, 1) * 255).round().astype('uint8')
    im = Image.fromarray(u8, 'RGBA')
    bb = im.getchannel('A').getbbox()
    assert bb, f'{out}: plate is fully transparent'
    x0, y0, x1, y1 = bb
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
    im.crop((x0, y0, x1, y1)).save(out, optimize=True)
    return {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}


def compose(plates):
    """plates: list of (array HxWx4) full canvas, bottom first."""
    acc = np.zeros((H, W, 4))
    for p in plates:
        acc = over_rgba(p[..., 3], p[..., :3], acc)
    return acc


def verify(flat_png, composed, masks=(), bg=60 / 255):
    r = load(flat_png)

    def ov(x):
        return x[..., :3] * x[..., 3:4] + bg * (1 - x[..., 3:4])

    d = np.abs(ov(composed) - ov(r)).max(axis=2) * 255
    m = np.ones((H, W), bool)
    for (x0, y0, x1, y1) in masks:
        m[y0:y1, x0:x1] = False
    return {'px>8': int(((d > 8) & m).sum()), 'px>24': int(((d > 24) & m).sum()), 'max': int((d * m).max()),
            'examined_opaque': int(((r[..., 3] > 0) & m).sum())}


def layer_path(l):
    parts = []
    while l is not None and getattr(l, 'name', None) is not None and l.kind != 'psdimage':
        parts.append(l.name)
        l = l.parent
    return '/'.join(reversed(parts))


def auto_stroke_specs(psd, kept_paths):
    """Shapes with an enabled stroke that are CLIPPING BASES (a clipped layer sits
    right above them) inside any kept path. Photopea erases those strokes."""
    out = []
    def under(l):
        p = layer_path(l)
        return any(p == k or p.startswith(k + '/') for k in kept_paths)
    for g in [psd] + [l for l in psd.descendants() if l.is_group()]:
        ls = list(g)
        for i, l in enumerate(ls):
            if l.kind != 'shape' or not under(l) or not l.visible:
                continue
            st = l.stroke
            if not (st and st.enabled):
                continue
            if i + 1 < len(ls) and ls[i + 1]._record.clipping:
                out.append(layer_path(l))
    return out
