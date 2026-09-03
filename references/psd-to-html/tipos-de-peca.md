# Tipos de peça, área de interesse e layerização

> **Leia antes de interpretar uma arte** — antes de decidir os plates, antes de
> escrever a seção "O que é" da análise, e sempre que precisar classificar uma peça
> que chegou sem etiqueta. É o vocabulário que o resto dos documentos usa.

Nomear o tipo não é burocracia de pasta. O tipo responde três perguntas que mudam a
extração inteira, e errar nele produz uma peça que fica linda no preview e falha no ar:

1. **Ela divide o quadro com o vídeo, ou toma o quadro?**
2. **Ela entra e sai, ou fica?**
3. **O que embaixo dela não pode ser coberto?**

Um fullscreen tratado como lower third vira uma peça sem fundo que deixa a gameplay
aparecer atrás do texto. Um lower third tratado como fullscreen vira uma peça de
1920×1080 com um retângulo opaco que tapa o jogo.

---

## Os quatro tipos que esta skill cobre

### L3 — lower third

A barra do terço inferior. **Identifica** quem ou o quê está no ar: nome do jogador,
handle da rede social, resultado de um palpite, hashtag da transmissão.

- **Divide o quadro.** O vídeo continua rodando atrás e ao redor; a peça ocupa uma
  faixa horizontal baixa e nada mais.
- **Entra e sai o tempo todo.** É a peça que mais recebe PLAY/OUT numa transmissão,
  e por isso é a que mais sofre com animação que não pode ser re-disparada.
- **O texto é quase todo dinâmico.** O que é fixo é a moldura.

No Drive deste projeto: `L3_Single`, `L3_Double`, `L3_Text`, `L3_Hashtag`,
`L3_Social`, `L3_MetaLike`, `L3_Winner`, `L3_PalpiteCasters`, `L3_ResultadoPalpite`.
Os nomes já dizem a variação que importa pra extração — `Single` e `Double` são a
mesma moldura com uma e com duas linhas de conteúdo, e isso é decisão de plate, não
de CSS.

O que a extração precisa entregar está em `bundle-conventions.md`, seção "Lower
third": bbox do alfa, coordenada de canvas, largura útil medida (não a bbox do
exemplo), e o que precisa sair da plate porque muda de estado.

### FS — fullscreen

Toma o quadro inteiro. Ou **substitui** o vídeo, ou **emoldura** o vídeo dentro de si.

Essa bifurcação é a decisão mais cara do tipo, e ela vem antes de exportar qualquer
coisa (`bundle-conventions.md`, "Fullscreen — dois sabores"):

- **Autocontido** — a peça é a tela toda e não tem vídeo por baixo. `FS_Campeao`,
  `FS_EndCard`, `FS_Bracket`, `FS_CreditosEncerramento`, `FS_Formato`.
- **Moldura de câmera** — a arte é uma moldura com buracos por onde entra vídeo ao
  vivo, e o vídeo é composto pelo switcher, não pelo HTML. `FS_2CAM`, `FS_3CAM`,
  `FS_70X30`, `FS_Interview`, `FS_ReplayCamera`.

A diferença prática: no autocontido o fundo é arte e vai pra plate; na moldura, **o
buraco é o produto**. O que precisa ser medido com precisão é a geometria da janela
de vídeo, e o que não pode acontecer é a plate cobrir aquele retângulo com um cinza
de mockup.

`FS_VS` e `FS_VScomDECK` são o mesmo confronto em duas versões, o que costuma
significar plates compartilhadas e um estado a mais, não dois trabalhos separados.

### IG — in-game

Fica no ar **durante o jogo**, junto com a gameplay, e não sai a cada troca de
assunto. Placar, cronômetro, contador, medidor, marca d'água de patrocínio.

A distinção que importa não é o tamanho, é a permanência: um lower third é um evento,
um in-game é um **estado**. Isso muda tudo do lado do bundle:

- Anima **na entrada e na saída da sessão**, quase nunca no meio. O que muda no meio
  é o número, e número que troca com animação de entrada pisca a peça inteira.
- Precisa aguentar recarga da browser source no meio do programa sem voltar em
  branco. É a peça que mais depende de o estado estar em replicant e não em mensagem.
- **Convive com informação crítica do jogo por baixo** — veja "área de interesse".

Neste projeto: `IG_OverlayMain`. No bundle já existem `ig_torcidometro`,
`ig_totalview` e `ig_overlaymain`, com o nome plano da convenção antiga.

### BUG

O selo permanente de canto. Logo do canal, `AO VIVO`, `REPLAY`, marca do torneio.

**A diferença pro IG é o que a peça identifica**: o in-game informa sobre o *jogo*
(quem está ganhando, quanto falta), o bug identifica o *sinal* (que canal é este, o
que você está vendo é replay). É por isso que o bug quase nunca muda e o in-game muda
o tempo todo.

Neste projeto: `BUG_Replay`. Um selo de replay é, tipicamente, dois estados — no ar e
fora — e nenhum campo dinâmico. Se a extração devolver campo dinâmico num bug, quase
sempre o que se está olhando é um in-game classificado errado.

### Os dois que ficam de fora

- **STING** — transição de vídeo (tinta, pincel, dissolve). Não passa por extração de
  plates; o caminho é `../spritesheet-mask-reveal.md`.
- **TV** — placa de espera, tela estática. Vai ao ar como imagem, sem peça HTML.

---

## Área de interesse

**A área de interesse não é da peça. É do que está embaixo dela.**

É o erro conceitual mais comum: olhar o PSD, ver que a arte "cabe" e concluir que
está resolvido. O PSD é uma folha em branco com a arte no meio; o ar é a arte
**sobre** uma partida, uma câmera, um rosto.

Três regiões que se governam sozinhas em qualquer transmissão:

- **A HUD do jogo.** Minimapa, vida, munição, timer, scoreboard nativo. Onde o jogo
  desenha informação, o overlay não entra. Não há como saber isso do PSD, só de um
  frame real da partida.
- **O rosto na câmera.** Numa entrevista ou numa cabine, a pessoa está enquadrada
  numa faixa previsível, e é a faixa onde o espectador está olhando.
- **Os cantos.** Onde bug e in-game se acumulam. Duas peças que se acham donas do
  mesmo canto só brigam quando as duas entram no ar juntas.

E as duas que vêm do destino, não do conteúdo:

- **Título e ação seguros.** Plataforma que recorta a borda (TV aberta, alguns
  players) come a margem externa. Texto encostado na borda do canvas é texto que
  alguém não vai ler.
- **A faixa da legenda automática.** YouTube e Twitch desenham legenda no terço
  inferior, exatamente onde o lower third mora.

**Como resolver na prática:** peça um frame real da transmissão e componha a arte por
cima antes de exportar. `scripts/analyze_png.py` mede o frame e devolve os blocos; a
prova de sobreposição vira `_proof_overlay.png` na pasta da peça. É régua, leva `_`, e
não vai ao ar.

Quando o frame real não existe, **registre isso como pendência** em vez de decidir por
conta. A seção "O que eu não consigo tirar daqui" do `png-analysis.md` existe pra isso.

---

## Layerização de plates

### Uma plate é uma unidade visual, não uma camada

É a regra que o `README.md` já enuncia e a que mais se perde na prática: um PSD com 45
camadas não vira 45 assets, vira umas 6 plates. Plate é o que o design trata como uma
coisa só: a barra do lower third, o card de resposta, o track do medidor.

O teste é comportamental, não visual: **se dois pedaços sempre entram, saem e se movem
juntos, são uma plate.** Se um deles pode mudar sozinho, são duas.

### O que decide o corte é o estado, não o desenho

Aqui mora a armadilha que já custou uma revisão inteira neste bundle, e ela está
registrada em `bundle-conventions.md`: o badge A/B/C/D estava queimado na barra do card
de quiz, e por isso não havia como preencher o círculo quando o participante marcasse a
alternativa. As oito barras tiveram que ser reexportadas.

A pergunta que evita isso, feita **antes** de exportar:

> Quais estados o operador dispara nessa peça, e o que muda visualmente em cada um?

Marcar e revelar costumam ser dois gatilhos, não um. Cada estado que muda um pedaço
obriga aquele pedaço a sair da plate.

### A ordem importa e vem do PSD

O índice 0 do `inspect_psd.jsx` é a camada **do topo**, e máscara de recorte sempre
recorta na camada imediatamente abaixo. Uma layerização que ignora a ordem produz
plate com bounds convincentes e arte errada — o modo de falha descrito no
`extendscript-gotchas.md`.

No HTML a ordem vira `z-index` na mesma sequência, com uma exceção: texto dinâmico
sobe pra cima de tudo, porque foi tirado das plates e é ele que precisa ser lido.

### Queime o que não muda, separe o que muda

| Vai pra dentro da plate | Sai da plate |
|---|---|
| logo, entalhe, moldura, textura | qualquer coisa que troque de cor por estado |
| rótulo fixo (`SEGUIDORES`, `VS`) | número, nome, handle, hashtag |
| ícone que nunca é substituído | foto/logo trocado em tempo real |
| sombra e brilho da própria arte | o fill de uma barra de progresso |

Tipografia estática dentro da plate é vantagem, não preguiça: sai exatamente como
desenhada, sem depender de a fonte carregar. Tipografia dinâmica reconstruída em CSS
precisa da fonte, do tamanho, da cor, do alinhamento e da caixa, e é por isso que a
extração registra tudo isso.

### Coordenada é sempre de canvas, e o fill é sempre local

Cada plate entra no stage de 1920×1080 pelo `left`/`top` que ela ocupava no PSD.
A exceção é a caixa de preenchimento de um medidor, que é registrada **relativa à
própria plate** — coordenada de canvas diz onde a barra fica, não onde o líquido anda
dentro dela. Os dois números têm nome e lugar próprios em `manifest-format.md`.

### Estado que o designer desenhou uma vez só

O mockup costuma mostrar um card aceso e o resto apagado, e você precisa das duas
versões de todos. Não peça PSD novo: `recolor` e `clip` no `export_plates.jsx`
sintetizam o estado que falta a partir das peças que existem. O passo a passo está no
`README.md`, em "Synthesizing states the designer only drew once".
