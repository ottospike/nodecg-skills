# scripts/psd — extração de plates de PSDs (Photopea + psd-tools)

Ferramenta de PREPARO (não roda no ar). O porquê de cada passo está em `references/psd-to-html/photopea-mcp.md`
(seção "Plates em lote com psd-tools"); resumo:

- `textspec.py <psd>` — tipografia real de cada camada de texto (corpo = FontSize × escala,
  baseline, alinhamento, tracking, caixa, efeitos ativos como Stroke).
- `plates.py` — biblioteca: `auto_stroke_specs` (formas com stroke que são base de recorte —
  o Photopea apaga esse stroke), `fix_strokes` (refaz o anel pelo caminho vetorial),
  `trim_save`, `compose`, `verify` (contra o achatado do designer, com máscaras).
- `finish.py <spec.json>` — pega os exports de frame cheio do Photopea (`pp/*.png`), conserta
  strokes, recorta, grava na pasta de assets e confere. Formato do spec no topo do arquivo.
- `cmpshot.py <shot> <flat> <out>` — compara um screenshot do gráfico (fundo 60,60,60) com o
  achatado do designer.

Exports do Photopea (o loop é: script de visibilidade → script "ping" → export do frame
inteiro) vão para uma pasta temporária, nunca para dentro do bundle.

Requer: `pip install psd-tools aggdraw scipy pillow numpy fonttools`.
