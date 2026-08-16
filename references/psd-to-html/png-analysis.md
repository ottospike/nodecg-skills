# Análise de PNG — quando não existe PSD

Leia isto quando a arte chegar **só como imagem achatada**: um PNG/JPG exportado,
um print, um frame de referência. Não dá pra abrir camada nenhuma, e ainda assim
você precisa dizer quais são os plates, o que é dinâmico, e o que falta pedir.

Também vale **junto** com o PSD: o export do designer é a única fonte honesta de
cor e de rampa, porque nenhum renderizador intermediário passou por ele.

O produto é um markdown descritivo — o que a peça é, o que ela precisa, e o que
está faltando. Ele não substitui o `ASSETS.md`: vem antes dele, e vira ele quando
os plates existirem de verdade.

## O princípio

**Você separa, o script mede, você olha, e só então descreve.** Nenhuma dessas
quatro partes substitui as outras:

- medir antes de separar produz medida do fundo, não da peça;
- medir no olho produz número que não fecha — "começa mais ou menos em 160" vira
  3px de erro que aparece no ar;
- medir sem olhar produz uma lista de retângulos que não diz o que a peça faz;
- descrever sem medir produz um documento que parece bom e não serve pra montar.

## 0. Separar

Chega um monte de PNG numa pasta só. Antes de medir qualquer coisa, resolva duas
perguntas — as duas erram silenciosamente se você pular.

### Uma pasta por peça

Cada peça que entra e sai do ar sozinha vira **uma pasta**, com o nome da peça
(`picks_bans/`, `map_picks/`, `versus/`). O `ANALISE.md` mora dentro dela, ao lado
dos frames que o originaram. É a mesma regra de `graphics/assets/<peça>/` do bundle,
antecipada: quando os plates existirem, essa pasta vira aquela.

Um documento gigante cobrindo dez peças não é consultável na hora de montar a
oitava. Dez documentos ao lado dos seus frames, sim.

### Frames do mesmo grupo vão juntos

Vários arquivos podem ser **a mesma peça em momentos diferentes**. Reconheça pelo
que não muda:

| Sinal | O que indica |
|---|---|
| Mesmas coordenadas verticais em todos | mesma peça, estados diferentes |
| Mesma moldura, conteúdo interno diferente | mesma peça, dado diferente |
| Um é recorte ampliado do outro | mesma peça, detalhe guardado |
| Mesmo fundo, layout completamente outro | peças diferentes que compartilham plate |

Confirme medindo: rode o perfil de linhas nos dois e compare as faixas. Se
`862–1017` e `1024–1060` aparecem igual nos cinco frames, são cinco estados de uma
peça só — e vão para a mesma pasta.

**Ler a sequência é onde está o ouro.** Um frame mostra um layout; a sequência
mostra a *mecânica*. Numa barra de draft, um frame diz "tem um número na caixa"; os
cinco juntos dizem que o número é um cronômetro, que só um aparece por vez, que ele
vira retrato quando o pick fecha, e qual é a ordem do draft. Nada disso é
recuperável de um frame só, e tudo isso decide o formato do replicant.

Monte a tabela da sequência **primeiro**, antes de medir. Ela é o que transforma
uma lista de retângulos em especificação:

```markdown
| # | Arquivo | Lado A | Lado B | Quem está ativo |
|---|---|---|---|---|
| 1 | picks_bans.png  | ? ? ?          | ? ? **31** | B, slot 3 |
| 2 | picks_bans2.png | **04** ? ?     | ? ? NES    | A, slot 1 |
```

Ordene por evidência interna (o que já está preenchido), não pela data do arquivo
nem pelo sufixo numérico — os dois mentem com frequência.

## 0.5. Separar o BG do gráfico

**Frame de transmissão não é export.** Boa parte do que está no PNG não é a peça:

| Camada | Exemplos | O que fazer |
|---|---|---|
| **Vídeo** | câmera do jogador, gameplay, estúdio | descartar; não é plate |
| **Cromo do capture** | barra do YouTube, timeline, cursor do mouse, "prima Esc para sair" | descartar; nem existe na transmissão |
| **HUD nativo do software** | o placar que o próprio jogo desenha no modo espectador, nomes flutuantes, barras de vida | descartar — **e dizer que descartou** |
| **Overlay de broadcast** | o que o bundle vai desenhar | é isto que você está documentando |

As duas linhas do meio são as que custam caro. Cromo de player passa despercebido e
vira "elemento" num documento que alguém vai tentar montar. HUD nativo é pior: é
bonito, parece broadcast, e alguém gasta um dia reproduzindo algo que o jogo já
desenha — e que nunca vai alinhar, porque a fonte de verdade é outro processo.

Quando não der pra decidir, **escreva a dúvida como pergunta à produção**, não como
afirmação: *"a barra de placar tem o azul do kit e os escudos dos times, mas o jogo
também desenha uma barra nativa; confirmar de quem é antes de construir"*. Essa é
uma pergunta que muda o escopo da peça inteira.

Toda pasta ganha uma seção **Fundo (BG)** dizendo o que ignorar e onde começa o
gráfico (`tudo acima de y≈838 é câmera`). Sem ela, quem ler o documento vai medir o
fundo.

Repare também no caso inverso: às vezes **o fundo é o gráfico** — um fullscreen com
arte de ponta a ponta. Aí o plate é o frame inteiro, e a seção BG existe para dizer
isso, não para descartar nada.

### Fundo compartilhado entre peças

Se quatro fullscreens têm a mesma placa atrás, isso é **um plate reaproveitado**,
não quatro fundos. Diga isso uma vez no índice e referencie nos documentos: o
designer entrega um arquivo, você pede uma vez, e ninguém exporta a mesma imagem
quatro vezes com nomes diferentes.

## 1. Medir

```bash
python <skill>/scripts/analyze_png.py ARTE.png --out graphics/assets/<NomeDoPSD>
```

Escreve `_analysis/report.json` e um recorte 1x + 3x de cada bloco. O `_` no nome
da pasta é o que garante que nada dali vá ao ar por engano.

O que ele devolve, e como ler cada coisa:

| Campo | O que significa na prática |
|---|---|
| `fundo.tipo` | `alpha` = já é overlay. `chapado` = mockup colado sobre uma cor; o `cor` é o que precisa virar alfa |
| `fundo.cobertura_canvas` | quanto do quadro é fundo. Alto = peça pequena num canvas grande, o normal num LT |
| `bbox_conteudo` | onde a arte realmente está dentro do canvas |
| `paleta` | cores por cobertura, já quantizadas; é a matéria-prima dos tokens |
| `blocos[].x/y/w/h` | **coordenada de canvas** — é o que vai virar `left`/`top` |
| `blocos[].tipo_provavel` | palpite: `texto`, `barra`, `bloco`, `grafismo`. Orienta o olhar, não decide |
| `blocos[].componentes` | quantas ilhas de tinta há dentro; muitas e de altura parecida = linha de texto |
| `blocos[].gradiente` | rampa detectada no núcleo saturado, com o CSS sugerido, ou `chapado: true` |

### Ajustando o raio

O `--raio` (default 9) é quanto o script fecha vãos antes de agrupar. Ele é a
única perilla que importa:

- **blocos demais**, arte picada em pedaços que o olho lê como um só → aumente;
- **blocos de menos**, duas linhas de texto soldadas numa caixa só → diminua
  (`--raio 2`) e rode de novo.

Rodar duas vezes com raios diferentes e comparar é barato, e é assim que se
descobre a estrutura real: o que continua junto em raio baixo é uma unidade de
verdade.

### O que ele não faz

Seja honesto sobre isto no documento que você escrever:

- **A bbox é apertada na tinta.** O limiar corta a franja antialiasada mais fraca,
  então espere ±2px contra a medida real do plate. O corte definitivo sai da
  recuperação de alfa, não daqui.
- **Fundo opaco de frame cheio vira um blocão só.** Num fullscreen com arte de
  ponta a ponta, o maior bloco é o próprio fundo. Tudo bem: nesse caso o plate é o
  frame inteiro mesmo (ver `bundle-conventions.md`), e o que interessa no report é
  a paleta e os elementos que contrastam.
- **Texto sobre plate escuro** entrega o plate como bloco, não os glifos. Se você
  quer medir a caixa de tinta do texto, recorte a região antes e rode nela.
- **Ele não sabe o que a peça faz.** Estado, gatilho, o que é dinâmico: isso sai de
  olhar e de perguntar.
- **Ele agrupa mal quando o fundo é vídeo.** Gameplay e câmera têm tinta em toda
  parte; o agrupador solda o overlay ao fundo e devolve um blocão. Nesse caso ele
  não serve — use as duas técnicas abaixo.

### Quando o fundo é vídeo: perfil e régua

Com fundo ocupado, duas técnicas manuais valem mais que o agrupador, e as duas são
dez linhas de numpy:

**Perfil de linha/coluna.** Escolha um predicado que só o gráfico satisfaz (quase
preto, quase branco, azul saturado) e conte em quantos por cento das linhas de uma
faixa ele vale. Uma borda de plate vira uma coluna com 90% de acerto; o vídeo não
chega perto. É assim que saem as coordenadas exatas:

```python
seg = arr[y0:y1, :]                      # faixa onde a peça vive
escuro = seg.max(axis=2) < 70            # predicado
colunas = escuro.mean(axis=0) > 0.85     # colunas escuras em quase toda a altura
# runs de True consecutivos = as bordas verticais dos plates
```

Rode o mesmo perfil **em dois frames diferentes da mesma peça**. As coordenadas que
repetem são estrutura; as que mudam são conteúdo. Isso separa moldura de dado sem
você precisar adivinhar.

**Recorte com régua.** Corte a região, amplie 3–4x com `NEAREST` e desenhe linhas de
grade a cada 50px **rotuladas com a coordenada de canvas**. Aí você lê a geometria
direto na imagem, em vez de estimar. É o que resolve os casos que o predicado não
pega — retrato colorido dentro de moldura, célula sobre célula, alinhamento
centrado vs. alinhado à borda.

As duas juntas chegam a ±3px sobre vídeo comprimido. Diga esse ±3px no documento.

### O canvas é o frame de transmissão, não o tamanho do arquivo

Frame de player quase nunca sai em 1920×1080 — sai em 1919×1079, ou 1918×1078, ou
recortado em 827×187. **Nada disso é o canvas da peça.** O canvas é sempre o frame
de transmissão do projeto: 1920×1080 (ou 1080×1920 no vertical). Um capture de
1919×1079 é um 1920×1080 com 1px perdido, não um formato novo.

Meça o arquivo, mas só para saber o quanto corrigir:

```bash
node -e "const b=require('fs').readFileSync('x.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"
```

Depois **normalize antes de escrever qualquer coordenada** e documente o canvas
como 1920×1080. Duas regras fazem a normalização:

- **Reancore pelo centro** (`960`, não `959.5`), nunca pela borda. A peça foi
  desenhada simétrica em torno do eixo do quadro; a simetria sobrevive ao capture,
  a borda não.
- **Derive o par espelhado da margem, não da medida.** Se a caixa da esquerda começa
  em 34, a da direita termina em `1920 − 34 = 1886`. Meça as duas assim mesmo — mas
  quando as duas medidas discordarem em 1–3px, a margem manda.

Escrever `Canvas: 1919×1079` num documento contamina tudo que vem depois: alguém
monta um `.stage` de 1919, o `fit.js` escala errado, e a peça fica 1px fora em toda
composição. Diga 1920×1080 e resolva a diferença você, uma vez.

**Mas não force simetria que a medição não sustenta.** Se depois de reancorar os
dois lados ainda discordam em ~10px, isso não é ruído de capture — ou a peça é
descentrada de propósito, ou seu predicado está pegando o fundo. Diga qual das duas
você não conseguiu distinguir e marque a medida como não-derivável. Inventar
número simétrico que parece bom é o pior resultado possível deste documento: ele
passa em revisão e falha no ar.

## 2. Olhar

Abra os recortes de `_analysis/` — os `_3x` existem pra isso. É aqui que se
responde o que a medição não alcança:

- o que é **decoração estática** e o que é **dado vivo**;
- quais **estados** a arte mostra (vazio/cheio, normal/aceso), e quais ela *não*
  mostra mas a operação vai exigir;
- o que está **queimado** na arte e não deveria estar, porque precisa mudar no ar;
- onde o texto de exemplo já está **encostando no limite** da caixa.

A pergunta que resolve a maioria dos casos: *um operador precisaria mudar isso no
meio do programa?* Se sim, é campo dinâmico e tem que sair do plate. Se não, queima.

## 3. Descrever

Um `ANALISE.md` **por pasta de peça**, mais um `README.md` na raiz que serve de
índice. Estrutura do documento de peça:

```markdown
# <NomeDaPeça> — análise da arte

**Origem:** ARTE.png (sem PSD) · **Canvas:** 1920×1080
**Tipo:** lower third / fullscreen / overlay persistente

## O que é
Uma frase sobre a peça e onde ela vive no quadro. Depois: quantos estados tem, o
que é fixo, o que muda, e o que o operador dispara.

## Fundo (BG) — o que descartar      ← sem isto, alguém vai medir o vídeo
O que está atrás, onde começa o gráfico, e o que é cromo de capture.

## A sequência — o que os N frames provam    ← só quando há múltiplos steps
| # | arquivo | estado do lado A | do lado B | quem está ativo |
Seguido das mecânicas que a leitura conjunta revelou.

## Geometria medida
| faixa / caixa | coordenada | o que é |
Com o ± declarado.

## Campos dinâmicos
| id | tipo | plate | caixa (local) | fonte / cor | limite |

## Paleta
| token | hex | onde |

## Como replicar                      ← quantos gráficos, qual replicant, qual formato
O esboço do valor do replicant, e as 2–4 decisões que a arte impõe.

## O que eu não consigo tirar daqui   ← a seção que faz este documento valer
```

O `README.md` da raiz carrega o que é comum e não cabe em peça nenhuma: a tabela de
grupos, as limitações que valem para todos os frames (canvas, compressão, BG), o
sistema visual em uma olhada, e os pedidos que servem ao kit inteiro. **Pedido que
vale para várias peças mora no índice**, não repetido em cada documento.

**Essa última seção é o ponto.** Sem camadas, algumas coisas são impossíveis de
recuperar e é desonesto fingir que não. Liste o que precisa vir do designer ou de
uma decisão:

| Não dá pra extrair | O que pedir |
|---|---|
| Arte que está **atrás** de outra | o PSD, ou o plate isolado |
| Nome e corte exato da fonte | o PSD, ou o nome da família + peso |
| Estados que a arte não desenhou | o PSD (dá pra sintetizar), ou os PNGs dos estados |
| Texto sobre fundo texturizado, limpo | o plate sem o texto |
| A rampa exata sob antialiasing forte | confirmação dos stops |
| O que acontece **no tempo** (cronômetro zerando, pick fechando, vencedor) | à produção: o roteiro, ou um frame do momento |
| De quem é o elemento (jogo? switcher? bundle?) | à produção — muda o escopo da peça |
| O que a peça faz fora do caso mostrado (5 analistas em vez de 4, 16 times em vez de 8) | à produção: o formato varia? |

Escreva isso como pedido, não como desculpa: *"pra fazer o estado aceso preciso do
PSD ou de um PNG da barra em laranja"* resolve; *"não foi possível determinar"*
não.

E **enderece cada pedido a quem sabe responder**. Designer resolve arte: plate
isolado, fonte, rampa, estado não desenhado. Produção resolve comportamento: ordem
do draft, o que acontece no fim do cronômetro, se o elemento é do jogo, se o formato
do torneio muda. Misturar os dois numa lista só garante que metade não é respondida.

## 4. Cortar, se for seguir sem PSD

Dá pra produzir plates utilizáveis só da imagem, e às vezes é o caminho certo. O
procedimento está em `bundle-conventions.md` (seção do lower third): fundo chapado
vira alfa, o antialiasing vira alfa parcial, a cor é descontaminada
(`F = B + (C − B) / a`), e o corte sai no bbox do alfa.

O que isso **não** recupera: qualquer pixel que estava coberto por outra camada.
Se o texto está por cima do plate, o plate sem texto não existe na imagem — e é
exatamente o item que vai pra seção "o que eu não consigo tirar daqui".

## 5. Conferir

O mesmo teste de sempre: renderize sua reconstrução no tamanho da arte e sobreponha
o PNG original em `mix-blend-mode: difference`, com `opacity: 1`. Alinhado = preto.
Com `opacity: 0.5` o teste não serve pra nada — branco sobre branco dá 0 e
remistura com o fundo.
