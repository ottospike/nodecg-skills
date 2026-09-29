# O custo de render dentro do browser source

Leia quando a peça **anima aos trancos dentro do vMix** e lisa no navegador,
quando o relato for "a saída engasga", quando for pôr **vídeo de canvas cheio**
num gráfico, ou antes de sair espalhando `will-change` atrás de performance.

Isto é sobre o que acontece DENTRO da browser source. A ponte HTTP com o switcher
é outro assunto: `vmix.md`.

---

## A premissa que quase toda receita de CSS assume — e que o vMix não cumpre

Procure "otimizar animação CSS" e você acha sempre as mesmas quatro linhas:
anime só `transform`/`opacity`, force a aceleração com `will-change: transform`,
use `requestAnimationFrame`, use uma lib leve como a GSAP.

Três delas estão certas. A segunda está errada aqui, e a primeira resolve menos
do que parece — porque todas assumem um Chrome desktop **com compositing por
GPU**.

> **O browser source do vMix é CEF em off-screen rendering. Não há compositing
> por GPU.** A página é rasterizada para um bitmap em memória de SISTEMA e
> entregue ao vMix quadro a quadro, junto com a lista de retângulos sujos.

Então não existe "jogar na GPU": não há para onde jogar. A conta que resta é uma
só:

> **O que custa é a ÁREA repintada e recopiada por quadro.**

É o mesmo motivo pelo qual o fórum do vMix está cheio de "mesmo depois que o L3
congela e fica parado, a GPU continua no talo". Ninguém está animando nada e o
custo continua lá.

Isso não invalida `transform`/`opacity` — animar `left`/`width` continua sendo
pior, porque força layout além do repaint. Só recoloca a prioridade: **num
bundle de broadcast a peça já costuma animar transform, e o gargalo está na
ÁREA, não na propriedade.** Antes de otimizar a propriedade, meça a área.

---

## 🚨 A regra do recorte: todo vídeo de canvas cheio leva `clip-path`

É daqui que vem quase todo o ganho, e a causa é uma prática do próprio kit.

A arte de motion chega como **webm de 1920×1080 com a peça num canto** e todo o
resto em alfa zero — é o formato que faz a peça cair na coordenada que o
designer desenhou sem ninguém remedir nada, e por isso é o formato certo. Mas o
Chromium **não sabe** que o resto é vazio. Um `<video>` de 1920×1080 tocando em
loop é uma camada de 1920×1080 que se declara suja a cada frame do vídeo: 2,07
milhões de pixels, 24 vezes por segundo, **com a peça parada no ar**.

Durante a saída fica pior: a região suja é a união da posição velha com a nova —
o quadro inteiro — e o fade ainda pede mistura de alfa por cima. A saída disputa
o orçamento de quadro justamente no movimento que o espectador está olhando. É
por isso que o sintoma aparece na SAÍDA e não na entrada: são os mesmos custos,
mas na saída eles chegam depois de a peça já ter passado um tempo no ar com o
loop consumindo orçamento.

O conserto é declarar ao Chromium onde a arte realmente está:

```css
#arte { clip-path: inset(<topo>px <direita>px <base>px <esquerda>px); }
```

Um `inset()` sem raio vira clip retangular puro — não vira máscara, não custa
nada em pintura — e ele **bounds a região suja da camada**. Medido num kit real
de 7 peças, a área por quadro caiu entre **9× e 67×**.

### As quatro coisas que fazem isso dar errado

**1. As coordenadas são de CANVAS, não da caixa do elemento.** Todo `<video>`
assim é 1920×1080 deslocado pelo negativo da âncora acumulada, justamente para
cair em 0,0 do stage — então o sistema local do vídeo **já é** o canvas. É o que
faz a mesma linha funcionar em peça ancorada e em peça de canvas cheio.

**2. `overflow: hidden` NÃO serve no lugar.** Peças ancoram o vídeo numa caixa do
tamanho da PLATE, e a arte em movimento vaza essa caixa de propósito (float,
pulso, balanço). `overflow` recorta pela caixa errada; `clip-path` recorta pela
caixa MEDIDA, que é maior.

**3. 🚨 A caixa sai da união do alfa sobre TODOS os frames do loop.** Não um
frame, e **não uma amostragem**. Isto custou uma rodada inteira de teste para
aprender. Comparando uma amostragem a 3fps contra os 240 frames de verdade, num
kit real:

| arte | 3fps disse | a verdade | teria cortado |
|---|---|---|---|
| spray de vencedor | `x0 = 22` | **`x0 = 0`** (encosta na borda do quadro) | 18px |
| medalhão que pulsa | `y0 = 39` | **`y0 = 32`** | 3px do pulso |
| barra que flutua | `y0 = 843` | **`y0 = 839`** | 4px |

O extremo de um float dura POUCOS frames: amostrar 1 em 8 tem grande chance de
cair sempre fora dele. E o defeito resultante é o pior tipo — a arte some por
2 ou 3 quadros **uma vez a cada dez segundos**, no ar, e ninguém liga o piscar à
caixa de recorte. Meça `fps=24`, com limiar de alfa em 1/255 para não comer a
franja de antialiasing, e some **8px de folga** em cada lado (a folga também
absorve reexport do motion com a arte alguns pixels maior).

**4. O comentário do arquivo provavelmente está desatualizado.** Em 5 de 7 peças
de um kit real, a bbox anotada no cabeçalho — medida na época do port, num
instante só — era MENOR que a real. Não derive a caixa do comentário: meça.

### O que o recorte NÃO resolve

O **decode**. O VP9 com alfa continua sendo decodificado em 1920×1080 mesmo com
95% de pixel vazio. Cortar os webm para a bbox no ffmpeg resolveria isso junto e
é o maior ganho que sobra — mas custa reexportar arte e remendar âncoras, então
é decisão de produção. Registre; não faça por conta.

---

## 🚨 `will-change` só onde a caixa que anima já é pequena

A receita diz "force a aceleração: `will-change: transform` no elemento que se
move". **Medido, num caso real, ele fez o oposto.**

A peça era um lower third cujo elemento animado É o canvas inteiro (webm de
quadro cheio, com o texto viajando junto dentro dele). Inventário de camadas com
a peça no ar:

```
sem will-change ..... 6 camadas,  8,1 Mpx, 1 de quadro cheio
com will-change ..... 7 camadas, 10,1 Mpx, 2 de quadro cheio
```

Ele criou uma superfície de composição de 1920×1080 que o CEF tem que manter e
recopiar em memória de sistema, e **desfez o ganho do `clip-path`**.

> A regra não é *"promova o que se move"*. É **"promova o que se move SE a caixa
> dele for pequena"**.

Onde compensa: o elemento animado é a barra (970×194), ou é o próprio vídeo que
você acabou de recortar. Aí a promoção custa a caixa da arte e evita a promoção
e demoção a cada tween — que é onde o primeiro quadro da saída engasga.

Onde não compensa: qualquer elemento de 1920×1080. Aí deixe a GSAP promover
sozinha durante o tween (ela escreve `translate3d` enquanto anima e volta pra 2D
no fim) e não declare nada.

E **escreva no arquivo que foi tentado e revertido**, com os números. Sem isso a
próxima pessoa lê a mesma receita na internet e põe de volta.

---

## A escala fracionária do `fit.js`

O `fit.js` escala o stage para a janela real. Numa browser source de 1920×1080 a
conta dá exatamente 1 e o transform é inofensivo. O problema é que a janela quase
nunca é redonda: barra de rolagem não escondida, browser source configurada em
1918 por descuido, device pixel ratio diferente de 1 — qualquer um produz escala
**fracionária**, tipo 0,9990.

E fracionária é cara de um jeito que não aparece olhando: o stage inteiro passa a
ser reamostrado com filtragem bilinear a cada quadro, os 1920×1080, sem GPU. Some
ao loop de vídeo de um `lt_` e a saída perde o orçamento de quadro. O sintoma
visual é quase invisível — a peça fica 0,1% menor e levemente mole — então
ninguém liga a lentidão à causa.

```js
/* 1/1080 é o limiar: abaixo disso a diferença vale MENOS que meio pixel na
   altura do canvas, ou seja escalar não muda um pixel na tela e só custa a
   reamostragem. */
var TOLERANCIA = 1 / 1080;
var escala = Math.min(innerWidth / 1920, innerHeight / 1080);
if (Math.abs(escala - 1) < TOLERANCIA) escala = 1;

/* E com escala 1 e deslocamento zero, `none` e não `scale(1)`: um transform
   identidade continua criando nó de transformação na árvore de propriedades. */
stage.style.transform = ehIdentidade ? "none" : "translate(" + dx + "px," + dy + "px) scale(" + escala + ")";
```

---

## Um decodificador de vídeo por peça

Dois `<video>` com o mesmo arquivo custam **dois decodificadores VP9 com alfa** e
abrem o risco de as duas cópias derivarem no tempo (e aí a costura entre elas
mostra frames diferentes).

Isso aparece por evolução, não por decisão: alguém divide a arte em metades para
elas entrarem de lados opostos, depois o gesto vira um slide único e as metades
passam a andar sempre juntas — e a divisão fica lá, escondendo uma costura que
não se abre mais.

Foi medido, e é o maior engasgo único que apareceu no kit:

```
com 2 decodificadores .... p95 de 34,1ms entre quadros PARADO no ar
com 1 decodificador ...... p95 de 17,8ms
```

34ms é metade da taxa de quadro, sem nada se mexendo na tela — suficiente para a
saída sair aos trancos. **Ao mexer numa peça com mais de um `<video>`, pergunte
se as cópias ainda se movem separado.** Se não se movem, é uma só.

---

## Como medir (e por que o teste óbvio mente)

Chromium headless **com `--disable-gpu`** — é o caminho de software, o mesmo do
CEF OSR. Medir com a GPU ligada mede outra máquina. Ver `padroes-replicant.md`
§10 para o básico de CDP.

**A medida estrutural, que é a boa:** `LayerTree.enable` + o evento
`LayerTree.layerTreeDidChange` dão a lista de camadas compositadas com as
dimensões de cada uma. É determinístico, não depende da carga da máquina, e é
exatamente o que decide o tamanho do bitmap que o CEF copia. Uma camada de vídeo
listada como `1920x1080` é o defeito; listada como `590x205` é o conserto.

⚠️ Guarde a **última** árvore recebida, não a primeira: o evento dispara várias
vezes enquanto a peça monta e as primeiras emissões vêm sem `layers`. E trate
**zero camadas como FALHA, não como aprovação** — foi assim que duas peças
passaram como "0 Mpx, ótimo" numa primeira rodada.

**A medida de pacing, que tem ruído:** intervalos entre `requestAnimationFrame`
durante entrada, ocioso no ar e saída; conte quadros acima de 24ms e de 40ms. Ela
só pega o patológico — numa máquina boa, tudo fica em 17,8ms e só o caso dos dois
decodificadores apareceu. Serve para confirmar um engasgo, não para provar
ausência dele.

### 🚨 O teste de screenshot A/B reprova por ruído

A ideia óbvia para provar que o recorte não come arte é capturar o quadro com e
sem o `clip-path` e comparar byte a byte. **Não funciona.** Numa tentativa real
reprovou 4 de 7 peças em 12 de 12 instantes, e quase tudo era ruído: 33 a 91
pixels esparsos com delta ≤14, do rasterizador de software dando resultados
ligeiramente diferentes quando o clip muda o ladrilhamento. Numa peça era pior
ainda — o número de um polling ao vivo mudava ENTRE as duas capturas, e o teste
acusava o clip por uma diferença que era dado.

Um teste que reprova por ruído é um teste em que ninguém acredita na terceira
vez — e aí ele para de pegar o defeito de verdade.

**A pergunta certa não é "os quadros são idênticos?", é "o retângulo do clip
CONTÉM a caixa que a arte ocupa?".** Isso é determinístico e não tem ruído. Os
dois lados vêm de medição independente: a caixa da arte, da união do alfa sobre
todos os frames do webm (ffmpeg → rawvideo rgba); o retângulo do clip, lido do
`getComputedStyle` no browser, ou seja o que o Chromium de fato aplicou e não o
que você escreveu no arquivo.

⚠️ Ao parsear o `clip-path` computado, expanda 1/2/3 valores: o Chromium
**colapsa** `inset()` quando os valores se repetem, a mesma armadilha de
serialização que o `animacao-gsap.md` documenta para clip-path animado.

### Provar que a peça ainda ANIMA depois de mexer

Recortar camada e trocar transição CSS por timeline mexe justamente no que não
pode quebrar. Amostre `transform`, `clipPath` e `opacity` do elemento que se
move a cada rAF por 350ms e conte os valores **distintos** — animação passa por
~20 estados, salto passa por 1. O trio cobre o kit inteiro sem configuração por
peça (uma peça que anima `clip-path` em vez de `transform` cai na mesma conta).

Três perguntas, e as três já foram bug real:

| | como | esperado |
|---|---|---|
| replay | `test()` → `testOut()` → `test()` | anima nas **três** |
| trava de primeiro estado | `aplicar({visivel:true})` em página NOVA | **salta**, e fica visível |
| trava de on-air | `aplicar({visivel:true})` de novo | **salta** |

⚠️ As travas têm que ser testadas pelo `aplicar()`, **não pelo `test()`** — o
`test()` pula a trava de propósito, que é justamente por que ele não serve para
testá-la.

⚠️ E confira que a peça ficou **visível** depois da trava de primeiro estado: um
"não animou" que também não apareceu dá o mesmo número e é o oposto do que se
quer.
