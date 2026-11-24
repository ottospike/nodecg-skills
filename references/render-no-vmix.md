# O custo de render dentro do browser source

Leia quando a peça **anima aos trancos dentro do vMix** e lisa no navegador,
quando o relato for "a saída engasga", quando for pôr **vídeo de canvas cheio**
num gráfico, ou antes de sair espalhando `will-change` atrás de performance.

Isto é sobre o que acontece DENTRO da browser source. A ponte HTTP com o switcher
é outro assunto: `vmix.md`.

---

## A premissa que as receitas de CSS assumem e o vMix não cumpre

As receitas comuns de otimização são: anime só `transform`/`opacity`, force a
aceleração com `will-change: transform`, use `requestAnimationFrame`, use uma
lib leve como a GSAP. Aqui a segunda está errada e a primeira resolve menos do
que parece, porque todas assumem um Chrome desktop **com compositing por GPU**.

> **O browser source do vMix é CEF em off-screen rendering. Não há compositing
> por GPU.** A página é rasterizada para um bitmap em memória de SISTEMA e
> entregue ao vMix quadro a quadro, junto com a lista de retângulos sujos.

Então não existe "jogar na GPU". A conta que resta é uma só:

> **O que custa é a área repintada e recopiada por quadro.**

Por isso o custo continua alto mesmo com a peça parada no ar.

Isso não invalida `transform`/`opacity` — animar `left`/`width` continua sendo
pior, porque força layout além do repaint. Só recoloca a prioridade: **num
bundle de broadcast a peça já costuma animar transform, e o gargalo está na
área, não na propriedade.** Antes de otimizar a propriedade, meça a área.

---

## 🚨 A regra do recorte: todo vídeo de canvas cheio leva `clip-path`

É daqui que vem quase todo o ganho.

A arte de motion chega como **webm de 1920×1080 com a peça num canto** e todo o
resto em alfa zero. É o formato certo, porque a peça cai na coordenada que o
designer desenhou sem remedir nada. Mas o
Chromium **não sabe** que o resto é vazio. Um `<video>` de 1920×1080 tocando em
loop é uma camada de 1920×1080 que se declara suja a cada frame do vídeo: 2,07
milhões de pixels, 24 vezes por segundo, **com a peça parada no ar**.

Durante a saída fica pior: a região suja é a união da posição velha com a nova
(o quadro inteiro), e o fade ainda pede mistura de alfa por cima. Por isso o
sintoma aparece na saída e não na entrada: os custos são os mesmos, mas na saída
somam-se ao loop que já consumia orçamento com a peça no ar.

O conserto é declarar ao Chromium onde a arte realmente está:

```css
#arte { clip-path: inset(<topo>px <direita>px <base>px <esquerda>px); }
```

Um `inset()` sem raio vira clip retangular puro (não vira máscara, não custa
nada em pintura) e **limita a região suja da camada**. Num kit de 7 peças, a
área por quadro caiu entre **9× e 67×**.

### As quatro coisas que fazem isso dar errado

**1. As coordenadas são de CANVAS, não da caixa do elemento.** Todo `<video>`
assim é 1920×1080 deslocado pelo negativo da âncora acumulada, justamente para
cair em 0,0 do stage, então o sistema local do vídeo **já é** o canvas. A mesma
linha funciona em peça ancorada e em peça de canvas cheio.

**2. `overflow: hidden` não serve no lugar.** Peças ancoram o vídeo numa caixa do
tamanho da plate, e a arte em movimento vaza essa caixa de propósito (float,
pulso, balanço). `overflow` recorta pela caixa errada; `clip-path` recorta pela
caixa medida, que é maior.

**3. 🚨 A caixa sai da união do alfa sobre todos os frames do loop.** Não um
frame, e **não uma amostragem**. Amostragem a 3fps contra os 240 frames reais:

| arte | 3fps disse | a verdade | teria cortado |
|---|---|---|---|
| spray de vencedor | `x0 = 22` | **`x0 = 0`** (encosta na borda do quadro) | 18px |
| medalhão que pulsa | `y0 = 39` | **`y0 = 32`** | 3px do pulso |
| barra que flutua | `y0 = 843` | **`y0 = 839`** | 4px |

O extremo de um float dura poucos frames: amostrar 1 em 8 tende a cair sempre
fora dele. Sintoma: a arte some por 2 ou 3 quadros **uma vez a cada dez
segundos**, no ar, e o piscar não parece ligado à caixa de recorte. Meça `fps=24`, com limiar de alfa em 1/255 para não comer a
franja de antialiasing, e some **8px de folga** em cada lado (a folga também
absorve reexport do motion com a arte alguns pixels maior).

**4. O comentário do arquivo provavelmente está desatualizado.** A bbox anotada
no cabeçalho costuma ter sido medida num instante só e sair menor que a real.
Não derive a caixa do comentário: meça.

### O que o recorte NÃO resolve

O **decode**. O VP9 com alfa continua sendo decodificado em 1920×1080 mesmo com
95% de pixel vazio. Cortar os webm para a bbox no ffmpeg resolve isso e é o
maior ganho que sobra, mas custa reexportar arte e remendar âncoras: é decisão
de produção. Registre; não faça por conta.

---

## `will-change` só onde a caixa que anima já é pequena

`will-change: transform` no elemento que se move pode piorar o render. Exemplo:
lower third cujo elemento animado é o canvas inteiro (webm de quadro cheio, com
o texto viajando dentro dele). Inventário de camadas com a peça no ar:

```
sem will-change ..... 6 camadas,  8,1 Mpx, 1 de quadro cheio
com will-change ..... 7 camadas, 10,1 Mpx, 2 de quadro cheio
```

Ele criou uma superfície de composição de 1920×1080 que o CEF tem que manter e
recopiar em memória de sistema, e **desfez o ganho do `clip-path`**.

> Regra: **promova o que se move só se a caixa dele for pequena.**

Onde compensa: o elemento animado é a barra (970×194), ou é o próprio vídeo que
você acabou de recortar. Aí a promoção custa a caixa da arte e evita a promoção
e demoção a cada tween, que é onde o primeiro quadro da saída engasga.

Onde não compensa: qualquer elemento de 1920×1080. Aí deixe a GSAP promover
sozinha durante o tween (ela escreve `translate3d` enquanto anima e volta pra 2D
no fim) e não declare nada.

Ao reverter um `will-change`, **anote no arquivo que foi tentado e revertido**,
com os números. Sem isso ele volta na próxima otimização.

---

## A escala fracionária do `fit.js`

O `fit.js` escala o stage para a janela real. Numa browser source de 1920×1080 a
conta dá exatamente 1 e o transform é inofensivo. Mas a janela quase nunca é
redonda: barra de rolagem não escondida, browser source configurada em
1918 por descuido, device pixel ratio diferente de 1 — qualquer um produz escala
**fracionária**, tipo 0,9990.

Escala fracionária reamostra o stage inteiro (1920×1080) com filtragem bilinear
a cada quadro, sem GPU. Somada ao loop de vídeo de um `lt_`, a saída perde o
orçamento de quadro. O sintoma visual é quase invisível (a peça fica 0,1% menor e
levemente mole), por isso a lentidão não parece ligada à causa.

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

Isso costuma sobrar de uma versão anterior da peça: a arte foi dividida em
metades para entrarem de lados opostos, o gesto virou um slide único e a divisão
ficou. Medição:

```
com 2 decodificadores .... p95 de 34,1ms entre quadros PARADO no ar
com 1 decodificador ...... p95 de 17,8ms
```

34ms é metade da taxa de quadro, sem nada se mexendo na tela: suficiente para a
saída sair aos trancos. **Ao mexer numa peça com mais de um `<video>`, pergunte
se as cópias ainda se movem separado.** Se não se movem, é uma só.

---

## Como medir (e por que o teste óbvio mente)

Use Chromium headless **com `--disable-gpu`**: é o caminho de software, o mesmo do
CEF OSR. Medir com a GPU ligada mede outra máquina. Ver `padroes-replicant.md`
§10 para o básico de CDP.

**Medida estrutural (a confiável):** `LayerTree.enable` + o evento
`LayerTree.layerTreeDidChange` dão a lista de camadas compositadas com as
dimensões de cada uma. É determinístico, não depende da carga da máquina, e é
exatamente o que decide o tamanho do bitmap que o CEF copia. Uma camada de vídeo
listada como `1920x1080` é o defeito; listada como `590x205` é o conserto.

⚠️ Guarde a **última** árvore recebida, não a primeira: o evento dispara várias
vezes enquanto a peça monta e as primeiras emissões vêm sem `layers`. Trate
**zero camadas como falha, não como aprovação**: senão a peça passa como
"0 Mpx, ótimo".

**Medida de pacing (tem ruído):** intervalos entre `requestAnimationFrame`
durante entrada, ocioso no ar e saída; conte quadros acima de 24ms e de 40ms. Ela
só pega o patológico (numa máquina boa tudo fica em 17,8ms, e só o caso dos dois
decodificadores aparece). Serve para confirmar um engasgo, não para provar
ausência dele.

### O teste de screenshot A/B reprova por ruído

Não prove que o recorte não come arte comparando byte a byte o quadro com e sem
`clip-path`. O teste reprova por ruído: 33 a 91 pixels esparsos com delta ≤14,
porque o rasterizador de software dá resultados ligeiramente diferentes quando o
clip muda o ladrilhamento. Dado ao vivo (um número de polling) que muda entre as
duas capturas também acusa o clip. Teste que reprova por ruído deixa de ser
levado a sério e para de pegar o defeito real.

**Pergunte se o retângulo do clip contém a caixa que a arte ocupa.** Isso é determinístico e não tem ruído. Os
dois lados vêm de medição independente: a caixa da arte, da união do alfa sobre
todos os frames do webm (ffmpeg → rawvideo rgba); o retângulo do clip, lido do
`getComputedStyle` no browser (o que o Chromium de fato aplicou, não o que está
escrito no arquivo).

⚠️ Ao parsear o `clip-path` computado, expanda 1/2/3 valores: o Chromium
**colapsa** `inset()` quando os valores se repetem (a mesma armadilha 5 de
`animacao-gsap.md`).

### Provar que a peça ainda ANIMA depois de mexer

Recortar camada e trocar transição CSS por timeline mexe justamente no que não
pode quebrar. Amostre `transform`, `clipPath` e `opacity` do elemento que se
move a cada rAF por 350ms e conte os valores **distintos**: animação passa por
~20 estados, salto passa por 1. O trio cobre o kit inteiro sem configuração por
peça (uma peça que anima `clip-path` em vez de `transform` cai na mesma conta).

Teste as três:

| | como | esperado |
|---|---|---|
| replay | `test()` → `testOut()` → `test()` | anima nas **três** |
| trava de primeiro estado | `aplicar({visivel:true})` em página NOVA | **salta**, e fica visível |
| trava de on-air | `aplicar({visivel:true})` de novo | **salta** |

⚠️ Teste as travas pelo `aplicar()`, **não pelo `test()`**: o `test()` pula a
trava de propósito.

⚠️ Confira que a peça ficou **visível** depois da trava de primeiro estado: um
"não animou" que também não apareceu dá o mesmo número.
