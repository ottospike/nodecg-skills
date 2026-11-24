# Produção de assets para grafismo ao vivo

Use quando a peça começa pelo guia de marca, por um kit do designer ou por uma
arte a produzir. Se a fonte é um PSD com camadas, siga a [extração de
plates](psd-to-html/README.md). Para um print achatado, use a [análise de
PNG](psd-to-html/png-analysis.md).

## Do kit à peça

1. Levante o formato da saída, o que a câmera precisa manter visível e os estados
   da peça. Cruze guia de marca, kit e amostras de motion. Em conflito entre uma
   referência visual e o guia, preserve o comportamento previsto pelo guia.
2. Faça uma seleção por peça com origem, formato, dimensões, transparência e uso
   de cada arquivo. Mantenha o material de referência fora da pasta servida e
   publique as variantes que entram no ar. Registre a origem em `ASSETS.md` ou
   no manifesto já adotado pelo bundle.
3. Use SVG para marcas e ícones vetoriais disponíveis, WOFF2 local para fontes e
   WebP ou PNG com alpha para arte raster. Mantenha texturas e retículas em
   camadas próprias quando precisarem de opacidade, recorte ou movimento
   independentes. Se o objeto 3D só aparece de frente e anima em camadas 2D, um
   sprite com alpha resolve o playout.
4. Se faltar uma ilustração original e houver um gerador de imagem disponível,
   use as referências autorizadas para orientar enquadramento, paleta e
   iluminação. Gere a camada visual com folga para recorte. Componha texto,
   logo e dados dinâmicos à parte no HTML.
5. Sirva fontes, arte e GSAP junto do gráfico. Para mídia conhecida, prepare a
   versão local na produção. Para uma imagem dinâmica, inicie a carga assim que
   o dado chegar e aguarde a decodificação antes da revelação. Preserve a
   imagem anterior durante a troca ou use uma plate de fallback após erro ou
   timeout. Confira esse caminho com cache frio.

Ao implementar HTML, CSS e interação, combine esta referência com as skills
`frontend` e `karpathy-guidelines` quando estiverem instaladas. O trabalho
começa pelo stack e pelas convenções do bundle e termina com uma verificação
da peça no playout.

## Motion como parte do kit

| Material | Caminho |
|---|---|
| Sprite ou placa que precisa acompanhar o tamanho do texto | [HTML e GSAP](animacao-gsap.md) |
| Matte orgânico entregue em vídeo | [Spritesheet de máscara](spritesheet-mask-reveal.md) |
| WebM com alfa e fases de entrada, hold e saída | [Trilha de vídeo IN/HOLD/OUT](motion-in-hold-out.md) com texto dinâmico no HTML |

- Faça uma galeria isolada com fundo quadriculado e controles para repetir cada
  preset. Aprove as entradas, trocas e saídas antes de distribuir os movimentos
  pelas peças. Aproveite o mesmo movimento-líder em componentes da mesma família.
  Honre `prefers-reduced-motion` para tremores e flutuação ociosa. Se houver uma
  opção de redução por URL no playout, confira que PLAY e OUT continuam funcionais.
- Um preset pode combinar um recorte de papel, uma sombra dura e uma curva de
  assentamento. Para uma embalagem que rasga, separe visualmente a tira do corpo
  com dois recortes do mesmo sprite e mova a tira antes de revelar o conteúdo.
  Use a [gramática de GSAP](animacao-gsap.md) para reset, interrupção e replay.
- Confira a borda do alpha sobre fundos claro e escuro, a leitura do texto no
  tamanho em que será visto e a ausência de cortes inesperados. Ensaie PLAY,
  troca de dado, OUT e novo PLAY no motor de playout.
