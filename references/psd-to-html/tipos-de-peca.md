# Tipos de peça, área de interesse e layerização

> **Leia antes de interpretar uma arte**: antes de decidir os plates, antes de
> escrever a seção "O que é" da análise, e sempre que precisar classificar uma peça
> que chegou sem etiqueta. É o vocabulário que o resto dos documentos usa.

O tipo responde três perguntas que mudam a extração inteira:

1. **Ela divide o quadro com o vídeo, ou toma o quadro?**
2. **Ela entra e sai, ou fica?**
3. **O que embaixo dela não pode ser coberto?**

Errar o tipo produz uma peça correta no preview e errada no ar. Um fullscreen tratado
como lower third vira uma peça sem fundo que deixa a gameplay aparecer atrás do texto.
Um lower third tratado como fullscreen vira uma peça de 1920×1080 com um retângulo
opaco que tapa o jogo.

---

## Os quatro tipos que esta skill cobre

### L3 — lower third

A barra do terço inferior. **Identifica** quem ou o quê está no ar: nome do jogador,
handle da rede social, resultado de um palpite, hashtag da transmissão.

- **Divide o quadro.** O vídeo continua rodando atrás e ao redor; a peça ocupa uma
  faixa horizontal baixa e nada mais.
- **Entra e sai o tempo todo.** É a peça que mais recebe PLAY/OUT, e por isso a que
  mais depende de animação que possa ser re-disparada.
- **O texto é quase todo dinâmico.** O que é fixo é a moldura.

Nomes como `L3_Single` e `L3_Double` costumam indicar a variação que importa: a mesma
moldura com uma e com duas linhas de conteúdo. Isso é decisão de plate, não de CSS.

O que a extração precisa entregar está em `bundle-conventions.md`, seção "Lower
third": bbox do alfa, coordenada de canvas, largura útil medida (não a bbox do
exemplo), e o que precisa sair da plate porque muda de estado.

### FS — fullscreen

Toma o quadro inteiro. Ou **substitui** o vídeo, ou **emoldura** o vídeo dentro de si.
Decida qual antes de exportar qualquer coisa (`bundle-conventions.md`, "Fullscreen:
dois sabores"):

- **Autocontido**: a peça é a tela toda e não tem vídeo por baixo (campeão, end card,
  bracket, créditos, formato do torneio).
- **Moldura de câmera**: a arte é uma moldura com buracos por onde entra vídeo ao
  vivo, e o vídeo é composto pelo switcher, não pelo HTML (2 ou 3 câmeras, split
  70×30, entrevista, replay com câmera).

No autocontido o fundo é arte e vai pra plate. Na moldura, **o buraco é o produto**:
meça com precisão a geometria da janela de vídeo, e garanta que a plate não cubra
esse retângulo com o cinza do mockup.

Duas versões do mesmo confronto (ex.: `FS_VS` e uma variante com deck) costumam
significar plates compartilhadas e um estado a mais, não dois trabalhos separados.

### IG — in-game

Fica no ar **durante o jogo**, junto com a gameplay, e não sai a cada troca de
assunto. Placar, cronômetro, contador, medidor, marca d'água de patrocínio.

A distinção é a permanência, não o tamanho: um lower third é um evento, um in-game é
um **estado**. Consequências no bundle:

- Anima **na entrada e na saída da sessão**, quase nunca no meio. O que muda no meio
  é o número; número que troca com animação de entrada pisca a peça inteira.
- Precisa aguentar recarga da browser source no meio do programa sem voltar em
  branco: o estado tem que estar em replicant, não em mensagem.
- **Convive com informação crítica do jogo por baixo**; veja "Área de interesse".

### BUG

O selo permanente de canto. Logo do canal, `AO VIVO`, `REPLAY`, marca do torneio.

**A diferença pro IG é o que a peça identifica**: o in-game informa sobre o *jogo*
(quem está ganhando, quanto falta), o bug identifica o *sinal* (que canal é este, o
que você está vendo é replay). Por isso o bug quase nunca muda e o in-game muda o
tempo todo.

Um selo de replay tem, tipicamente, dois estados (no ar e fora) e nenhum campo
dinâmico. Se a extração devolver campo dinâmico num bug, provavelmente é um in-game
classificado errado.

### Os dois que ficam de fora

- **STING**: transição de vídeo (tinta, pincel, dissolve). Não passa por extração de
  plates; o caminho é `../spritesheet-mask-reveal.md`.
- **TV**: placa de espera, tela estática. Vai ao ar como imagem, sem peça HTML.

---

## Área de interesse

**A área de interesse não é da peça. É do que está embaixo dela.**

Não conclua que está resolvido porque a arte "cabe" no PSD. O PSD é uma folha em
branco com a arte no meio; no ar a arte fica **sobre** uma partida, uma câmera, um
rosto.

Três regiões a proteger em qualquer transmissão:

- **A HUD do jogo.** Minimapa, vida, munição, timer, scoreboard nativo. Onde o jogo
  desenha informação, o overlay não entra. Isso só se sabe por um frame real da
  partida, não pelo PSD.
- **O rosto na câmera.** Numa entrevista ou numa cabine, a pessoa está enquadrada
  numa faixa previsível, e é pra lá que o espectador olha.
- **Os cantos.** Onde bug e in-game se acumulam. Duas peças que ocupam o mesmo canto
  conflitam quando entram no ar juntas.

E duas que vêm do destino, não do conteúdo:

- **Título e ação seguros.** Plataforma que recorta a borda (TV aberta, alguns
  players) come a margem externa. Não encoste texto na borda do canvas.
- **A faixa da legenda automática.** YouTube e Twitch desenham legenda no terço
  inferior, exatamente onde o lower third mora.

**Como resolver:** peça um frame real da transmissão e componha a arte por cima antes
de exportar. `scripts/analyze_png.py` mede o frame e devolve os blocos; a prova de
sobreposição vira `_proof_overlay.png` na pasta da peça (régua, leva `_`, não vai ao
ar).

Sem frame real, **registre isso como pendência** em vez de decidir por conta, na
seção "O que eu não consigo tirar daqui" do `png-analysis.md`.

---

## Layerização de plates

### Uma plate é uma unidade visual, não uma camada

Regra do `README.md`: um PSD com 45 camadas não vira 45 assets, vira umas 6 plates.
Plate é o que o design trata como uma coisa só: a barra do lower third, o card de
resposta, o track do medidor.

O teste é comportamental: **se dois pedaços sempre entram, saem e se movem juntos,
são uma plate.** Se um deles pode mudar sozinho, são duas.

### O que decide o corte é o estado, não o desenho

Antes de exportar, pergunte:

> Quais estados o operador dispara nessa peça, e o que muda visualmente em cada um?

Marcar e revelar costumam ser dois gatilhos, não um. Cada estado que muda um pedaço
obriga aquele pedaço a sair da plate. Exemplo (badge queimado num card de quiz) em
`bundle-conventions.md`, "Queime tudo que não muda, e só isso".

### A ordem importa e vem do PSD

O índice 0 do `inspect_psd.jsx` é a camada **do topo**, e máscara de recorte sempre
recorta na camada imediatamente abaixo. Ignorar a ordem produz plate com bounds
convincentes e arte errada (modo de falha descrito no `extendscript-gotchas.md`).

No HTML a ordem vira `z-index` na mesma sequência, com uma exceção: texto dinâmico
sobe pra cima de tudo, porque foi tirado das plates e precisa ser lido.

### Queime o que não muda, separe o que muda

| Vai pra dentro da plate | Sai da plate |
|---|---|
| logo, entalhe, moldura, textura | qualquer coisa que troque de cor por estado |
| rótulo fixo (`SEGUIDORES`, `VS`) | número, nome, handle, hashtag |
| ícone que nunca é substituído | foto/logo trocado em tempo real |
| sombra e brilho da própria arte | o fill de uma barra de progresso |

Tipografia estática dentro da plate sai exatamente como desenhada, sem depender de a
fonte carregar. Tipografia dinâmica reconstruída em CSS precisa da fonte, do tamanho,
da cor, do alinhamento e da caixa; por isso a extração registra tudo isso.

### Coordenada é sempre de canvas, e o fill é sempre local

Cada plate entra no stage de 1920×1080 pelo `left`/`top` que ela ocupava no PSD.
A exceção é a caixa de preenchimento de um medidor, registrada **relativa à própria
plate**: coordenada de canvas diz onde a barra fica, não onde o líquido anda dentro
dela. Os dois números têm nome e lugar próprios em `manifest-format.md`.

### Estado que o designer desenhou uma vez só

O mockup costuma mostrar um card aceso e o resto apagado, e você precisa das duas
versões de todos. Não peça PSD novo: `recolor` e `clip` no `export_plates.jsx`
sintetizam o estado que falta a partir das peças que existem. Passo a passo no
`README.md`, em "Synthesizing states the designer only drew once".
