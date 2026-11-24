# Peça com ENTRADA, HOLD e SAÍDA num webm só (texto HTML preso ao vídeo)

Use este arquivo quando a Motion manda **cada peça como um arquivo só**
(ex.: 10 s, VP9 com alfa, 1920×1080, 24 fps) com entrada, hold e saída
embutidos, e o texto continua vivo em HTML (playout no Caspar 2.5.1).

Regra que vale sempre: **texto e dado ficam em HTML.** Texto queimado no vídeo
não muda com o dado.

```
0 ──── inFim ─── loopA ═══════ loopB ─── outIni ──── fim
  ENTRADA        (hold)                    SAÍDA      vazio
                 └── repete ──┘
```

## Escolhendo a técnica

| O gráfico faz | Técnica |
|---|---|
| Revelação orgânica (tinta, pincel) de arte que não muda de forma | spritesheet de máscara (`spritesheet-mask-reveal.md`) |
| Morfismo geométrico (placa cresce, vira pílula, desliza, quica) | GSAP no HTML: a forma pode depender da largura do texto |
| Morfismo vetorial complexo, sem efeitos de AE | Lottie |
| Glow, partículas, distorção, blur: qualquer efeito de AE | **vídeo IN/HOLD/OUT com alfa + texto HTML por cima (este arquivo)** |

Dá para misturar. O ponto difícil é **o texto acompanhar uma forma que se
move**: se o tamanho final depende do texto, a forma vai em GSAP/SVG, não em
vídeo.

## Não peça marcadores: MEÇA o vídeo

Em vez de esperar a Motion anotar os frames de corte, um script mede o próprio
webm e grava `<arte>.trilha.json` ao lado da cópia do bundle
(`scripts/motion-aplicar.mjs`, config `assets/motion/pecas-exemplo.json`):

- **Caixa de alfa por quadro** (`cropdetect` no alfa, limiar 2/255), do quadro
  inteiro (`full`) e de cada **faixa** declarada (retângulos de canvas
  `[x0,y0,x1,y1]`). É a trilha que o texto segue.
- **inFim:** primeiro quadro que fica em repouso por 4 quadros seguidos.
- **outIni:** a saída começa depois da **última sequência calma** (≥ 8
  quadros) da diferença entre quadros vizinhos, menos 3 de margem. A caixa não
  serve para isso: há hold que oscila 3 px e saída que **assenta** uns 4
  quadros antes de encolher.
- **Loop:** o par de quadros mais parecido dentro de uma janela de distância.
  Escolha a janela em volta do período do brilho (ex.: 96 a 144 quadros para
  um brilho de 120).
- **Quietos:** quadros do hold de onde dá para pular para a saída sem cortar o
  brilho no meio. O OUT espera um deles, com teto (~1,4 s).
- **refIn / refOut:** a caixa no inFim e no outIni. A entrada mapeia contra a
  primeira e a saída contra a segunda, para o texto não saltar nas emendas.
- **recorte:** união do alfa em **todos** os quadros + 8 px, aplicada como
  `clip-path` do `<video>`. Inclui o crescimento da saída, que passa da caixa
  do hold. É o maior ganho de performance disponível (`render-no-vmix.md`).
- **Keyframes:** o webm da Motion costuma ter keyframe só em 0 e no meio.
  Buscar o quadro do loop obriga o decoder a refazer dezenas de quadros VP9 num
  tique, e isso engasga no ar. **Reencode a cópia do bundle** (crf 18, alfa)
  com keyframe exatamente em inFim, loopA e outIni, e **confira** com ffprobe.
- **Saída `reversa`**: se a peça não tem saída no vídeo, ou a produção quer a
  entrada de trás para frente, o script monta a saída invertendo a entrada no
  mesmo webm.

**fps:** o script lê o fps de cada arquivo (ffprobe) e escreve as regras em
quadros a 24 fps, escaladas por `Q(n) = n·fps/24`. Um export a 24 num canal de
59,94 roda em cadência 2-3 e parece "low fps". Peça o fps do canal quando der.
A **saída reversa** é a entrada de trás para frente, com uma fusão de ~6 quadros
até a pose de repouso, para não ter salto na emenda hold → saída.

Fluxo: `--medir` (só imprime inFim/loop/outIni/quietos para conferir) → rodar
de verdade (os arquivos anteriores vão para `_removidos/<data>/`) → `--trilha`
quando só uma faixa mudou (os segmentos não podem ter mudado, porque os
keyframes são os da última reencodagem).

## Runtime: `assets/motion/motion.js` (+ `video.js`)

- **Um relógio só, o do VÍDEO** (`requestVideoFrameCallback`). O texto é movido
  quadro a quadro pela trilha, então texto e arte não se desencontram nem com
  o Caspar engasgando.
- **Grupos de texto de FRAME CHEIO** (`position:absolute; inset:0`), porque o
  transform usa origem 0 0 em coordenada de canvas. Modos:
  - **caixa** (padrão, faixa `full`): mapeia a caixa de referência na caixa do
    quadro (escala por eixo + deslocamento). Serve para pop,
    crescer/encolher e toda saída.
  - **borda** (`x1`/`x2`/`y1`/`y2`): só desloca, seguindo uma borda da faixa.
    É a barra que desliza de trás de um emote: o texto anda com a ponta. Use
    junto uma `.janela` estática (`clip-path`) cortando onde o emote começa,
    para o texto "nascer de trás" dele.
  - Faixa sem arte no quadro = grupo invisível naquele quadro.
- API: `MOTION.criar({ video, src, trilha, grupos, saidaHtml })` →
  `pronto`, `entrar()`, `sair()` (espera um quieto e resolve no fim),
  `pular(visivel)` (estado sem animação, para reload com a peça no ar).
  `saidaHtml` só é usado quando o vídeo não tem saída (`outIni` nulo).
- Casos que precisam ser testados: OUT no meio da entrada (termina a entrada,
  espera um quieto ou o teto, sai), PLAY no meio da saída (recomeça do 0) e
  reload com a peça no ar (cai direto no hold).
- As armadilhas do `<video>` (muted forçado, `canplaythrough` com teto, pausar
  fora do ar só no fim da saída) estão no cabeçalho de `video.js` e em
  `familias-de-peca.md` §8.

## O que pedir para a Motion

- Arte **sem texto variável**.
- VP9 com alfa (`yuva420p`). Se o hold tiver brilho periódico, faça o período
  caber inteiro no hold.
- Frame rate: o que o canal aceita. Um export a 29,97 num canal 59,94 funciona,
  mas cada frame dura dois quadros.
- Se a arte mudar de **lugar** numa entrega nova, revise as faixas e as
  `.janela` das páginas.
- Confira cada entrega quadro a quadro. Um track matte perdido no export
  aparece como retângulo branco chapado atravessando a arte em alguns quadros;
  o defeito está no arquivo da Motion, não no HTML.
