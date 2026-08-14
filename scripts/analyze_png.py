#!/usr/bin/env python3
"""Mede um PNG de gráfico e devolve os fatos que dão pra medir.

Existe porque descrever arte no olho produz números que não fecham: "a barra
começa mais ou menos em 160" vira 3px de erro que aparece no ar. O script não
interpreta o desenho — ele mede, recorta, e deixa a interpretação pra quem sabe o
que a peça faz.

    python analyze_png.py L3_MetaLike.png --out assets/LT_MetaLike

Escreve <out>/_analysis/report.json e um recorte PNG de cada bloco encontrado
(1x e 3x nearest). O passo seguinte é OLHAR os recortes — o report diz onde as
coisas estão, os recortes dizem o que elas são.

Requer: pillow, numpy, scipy.
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

# Blocos menores que isto são ruído de antialiasing, não elemento de desenho.
AREA_MIN = 120
# Fecha vãos até este raio pra juntar o que o olho lê como um bloco só (glifos de
# uma linha, barra + entalhe). Acima disso começa a colar peças vizinhas.
RAIO_FECHO = 9
# Tolerância por canal pra considerar um pixel "igual ao fundo" do mockup.
TOL_FUNDO = 10


def _hex(c):
    return "#%02X%02X%02X" % (int(c[0]), int(c[1]), int(c[2]))


def carregar(caminho):
    im = Image.open(caminho).convert("RGBA")
    a = np.asarray(im).astype(np.int16)
    return im, a[..., :3], a[..., 3]


def detectar_fundo(rgb, alpha):
    """Alfa de verdade, ou mockup achatado sobre uma cor chapada?

    A borda do canvas é a amostra honesta: num mockup ela é fundo puro, e num
    overlay ela é transparente.
    """
    if (alpha < 250).mean() > 0.01:
        return {"tipo": "alpha", "cobertura": round(float((alpha < 250).mean()), 4)}

    borda = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    cores, contagem = np.unique(borda.reshape(-1, 3), axis=0, return_counts=True)
    cor = cores[contagem.argmax()]
    parte = float(contagem.max()) / len(borda)

    dist = np.abs(rgb - cor).max(axis=2)
    return {
        "tipo": "chapado",
        "cor": _hex(cor),
        "rgb": [int(v) for v in cor],
        "borda_uniforme": round(parte, 4),
        "cobertura_canvas": round(float((dist <= TOL_FUNDO).mean()), 4),
    }


def mascara_frente(rgb, alpha, fundo):
    if fundo["tipo"] == "alpha":
        return alpha > 8
    return np.abs(rgb - np.array(fundo["rgb"])).max(axis=2) > TOL_FUNDO


def blocos(mask, r=RAIO_FECHO):
    """Componentes conexos depois de fechar vãos — os candidatos a plate."""
    yy, xx = np.mgrid[-r : r + 1, -r : r + 1]
    kernel = (yy**2 + xx**2) <= r * r

    fechada = ndimage.binary_closing(mask, structure=kernel)
    rot, n = ndimage.label(fechada)

    out = []
    for i, fatia in enumerate(ndimage.find_objects(rot), start=1):
        if fatia is None:
            continue
        sy, sx = fatia
        sub = (rot[fatia] == i) & mask[fatia]
        area = int(sub.sum())
        if area < AREA_MIN:
            continue
        out.append(
            {
                "x": int(sx.start),
                "y": int(sy.start),
                "w": int(sx.stop - sx.start),
                "h": int(sy.stop - sy.start),
                "area_tinta": area,
                "densidade": round(area / float((sx.stop - sx.start) * (sy.stop - sy.start)), 3),
                "_slice": fatia,
                "_mask": sub,
            }
        )
    out.sort(key=lambda b: (b["y"], b["x"]))
    return out


def paleta(rgb, mask, n=8):
    pix = rgb[mask]
    if not len(pix):
        return []
    # Quantiza grosso antes de contar: sem isso o antialiasing vira 4000 "cores".
    q = (pix // 12 * 12).astype(np.uint8)
    cores, contagem = np.unique(q.reshape(-1, 3), axis=0, return_counts=True)
    ordem = contagem.argsort()[::-1][:n]
    total = float(contagem.sum())
    return [
        {"hex": _hex(cores[i]), "cobertura": round(float(contagem[i]) / total, 4)}
        for i in ordem
    ]


def sondar_gradiente(rgb, sub, mask):
    """Rampa ou chapado? Amostra o NÚCLEO SATURADO, nunca a média.

    A média de todos os pixels inclui a borda antialiasada, que puxa a cor pro
    fundo e achata qualquer rampa num "quase chapado" — o erro que um designer
    identifica de relance.
    """
    pix = rgb[sub][mask]
    if len(pix) < 50:
        return None

    mx = pix.max(axis=1)
    mn = pix.min(axis=1)
    sat = mx - mn
    nucleo = sat >= max(30, int(np.percentile(sat, 75)))
    if nucleo.sum() < 30:
        nucleo = np.ones(len(pix), bool)

    ys, xs = np.nonzero(mask)
    ys, xs = ys[nucleo], xs[nucleo]
    cor = pix[nucleo]

    def rampa(eixo):
        lo, hi = eixo.min(), eixo.max()
        if hi - lo < 4:
            return None
        faixa = (hi - lo) * 0.15
        ini = cor[eixo <= lo + faixa].mean(axis=0)
        fim = cor[eixo >= hi - faixa].mean(axis=0)
        return ini, fim, float(np.abs(fim - ini).max())

    rx, ry = rampa(xs), rampa(ys)
    cands = [(d, eixo, a, b) for eixo, r in (("x", rx), ("y", ry)) if r for a, b, d in [r]]
    if not cands:
        return None

    delta, eixo, a, b = max(cands)
    return {
        "eixo": eixo,
        "delta_max_canal": round(delta, 1),
        "de": _hex(a),
        "para": _hex(b),
        # 90deg = esquerda→direita; 0deg = baixo→cima. É a convenção do CSS.
        "css_sugerido": "linear-gradient(%s, %s 0%%, %s 100%%)"
        % ("90deg" if eixo == "x" else "0deg", _hex(a), _hex(b)),
        "chapado": delta < 12,
    }


def classificar(b, mask_sub):
    """Palpite de tipo, pra orientar o olhar — não é veredito.

    Texto se lê pela assinatura: muitos componentes pequenos, alinhados numa
    faixa de altura parecida, com densidade de tinta baixa.
    """
    rot, n = ndimage.label(mask_sub)
    if n:
        alturas = [
            s[0].stop - s[0].start for s in ndimage.find_objects(rot) if s is not None
        ]
        alturas = [h for h in alturas if h > 3]
    else:
        alturas = []

    info = {"componentes": len(alturas)}
    if alturas:
        info["altura_mediana"] = round(float(np.median(alturas)), 1)

    if len(alturas) >= 4 and b["densidade"] < 0.5:
        med = float(np.median(alturas))
        # Alturas parecidas = uma linha de texto. Alturas muito diferentes num
        # bloco com muitos componentes costuma ser DUAS linhas de corpos
        # diferentes que o fecho soldou — reduza o --raio e rode de novo.
        if med and np.mean([abs(h - med) <= med * 0.45 for h in alturas]) > 0.6:
            return "texto", info

    if b["densidade"] > 0.9:
        prop = b["w"] / float(b["h"])
        info["proporcao"] = round(prop, 2)
        return ("barra" if prop > 2.5 else "bloco"), info

    return "grafismo", info


def recortar(im, b, destino, nome):
    cx = im.crop((b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]))
    cx.save(os.path.join(destino, nome + ".png"))
    cx.resize((b["w"] * 3, b["h"] * 3), Image.NEAREST).save(
        os.path.join(destino, nome + "_3x.png")
    )


def main():
    # O console do Windows abre em cp1252 e engasga em qualquer seta ou acento.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("--out", default=None, help="pasta da peça (default: ao lado do PNG)")
    ap.add_argument("--max-blocos", type=int, default=40)
    ap.add_argument(
        "--raio", type=int, default=RAIO_FECHO,
        help="raio de fecho em px (default %d). Menor separa linhas de texto que "
             "foram soldadas; maior junta arte fragmentada num plate só." % RAIO_FECHO,
    )
    args = ap.parse_args()

    im, rgb, alpha = carregar(args.png)
    h, w = alpha.shape

    base = args.out or os.path.dirname(os.path.abspath(args.png))
    destino = os.path.join(base, "_analysis")
    os.makedirs(destino, exist_ok=True)

    fundo = detectar_fundo(rgb, alpha)
    mask = mascara_frente(rgb, alpha, fundo)

    ys, xs = np.nonzero(mask)
    bbox = (
        {"x": int(xs.min()), "y": int(ys.min()),
         "w": int(xs.max() - xs.min() + 1), "h": int(ys.max() - ys.min() + 1)}
        if len(xs) else None
    )

    itens = []
    for i, b in enumerate(blocos(mask, args.raio)[: args.max_blocos]):
        sub, m = b.pop("_slice"), b.pop("_mask")
        tipo, extra = classificar(b, m)
        nome = "b%02d_%s" % (i, tipo)
        recortar(im, b, destino, nome)
        b.update(
            {
                "id": nome,
                "tipo_provavel": tipo,
                "recorte": "_analysis/%s.png" % nome,
                "cor_dominante": paleta(rgb[sub], m, n=1)[0]["hex"] if m.any() else None,
                "gradiente": sondar_gradiente(rgb, sub, m),
                **extra,
            }
        )
        itens.append(b)

    rel = {
        "arquivo": os.path.basename(args.png),
        "canvas": {"w": w, "h": h},
        "fundo": fundo,
        "bbox_conteudo": bbox,
        "paleta": paleta(rgb, mask),
        "blocos": itens,
    }

    with open(os.path.join(destino, "report.json"), "w", encoding="utf-8") as f:
        json.dump(rel, f, indent=2, ensure_ascii=False)

    print(json.dumps({k: v for k, v in rel.items() if k != "blocos"}, indent=2, ensure_ascii=False))
    print("\n%d blocos → %s" % (len(itens), destino))
    for b in itens:
        print(
            "  %-18s %4d,%4d  %4dx%-4d  %-9s %s%s"
            % (b["id"], b["x"], b["y"], b["w"], b["h"], b["tipo_provavel"],
               b["cor_dominante"] or "",
               "  rampa %s" % b["gradiente"]["eixo"] if b.get("gradiente") and not b["gradiente"]["chapado"] else "")
        )


if __name__ == "__main__":
    sys.exit(main())
