# O que cada tipo de gráfico precisa da extração

Ponte entre `README.md` (como extrair de um PSD) e o SKILL.md do `nodecg` (como
construir a peça).

Leia a seção do tipo de peça **antes** de decidir os plates. Uma decisão errada aqui
não aparece no PNG; aparece quando o operador dispara um estado que não existe.

## Duas regras que valem pra toda peça

### A pasta é derivada do nome do PSD, dentro da categoria

Tudo minúsculo, cada palavra depois da primeira com inicial maiúscula, sigla
inclusive. `L3_MetaLike.psd` produz `<assets>/l3/l3_metaLike/`. Dentro dela vão os
plates e os guias:

```
<assets>/l3/l3_metaLike/
├── ASSETS.md          ← guia humano: referência, tabelas, scaffold CSS, armadilhas
├── assets.json        ← os mesmos números em JSON, fonte da verdade
├── *.png              ← runtime
└── _*.png / _*.json   ← não vai ao ar
```

A categoria é a sigla do tipo: `l3`, `fs`, `ig`, `bug` (definições em
`tipos-de-peca.md`).

O nome derivado liga o asset à origem: um PSD revisado indica qual pasta
reexportar, e a pasta indica qual arquivo pedir ao designer. Pasta antiga com outro
nome fica como está; a regra vale pra pasta nova.

O prefixo `_` separa runtime de régua: `_ref_text.png`, `_reference.png`,
`_proof_overlay_3x.png`, `_plates.json`. Sem ele, uma browser source pode apontar
pro flatten do mockup e tapar o vídeo inteiro.

### Tudo é posicionado no frame de 1920×1080

Vale também para lower third, meter e uma barra de 428×104. O stage do gráfico é
sempre o canvas de transmissão inteiro, e cada plate entra nele por `left`/`top` em
**coordenada de canvas** (a posição que ela ocupava no PSD).

Registre de cada plate o `x`/`y` **no canvas**, não um recorte centrado nem um offset
relativo a outra plate. Se o mockup desenha a mesma peça três vezes na folha (em 7%,
64% e 94%, por exemplo), ela tem **uma** posição real de ar: escolha a instância
canônica e registre a dela; as outras são amostras de valor.

Por quê: a browser source é sempre de frame cheio, duas peças precisam conviver no
quadro sem recalcular nada, e o `fit.js` escala o stage pela altura do canvas. Um
gráfico do tamanho da barra funciona no preview e quebra na composição.

Para outra resolução de saída, escale o stage inteiro; nunca mexa numa coordenada.

---

## Lower third

**Entrega:** plates recortadas no bbox do alfa, com **coordenada de canvas**
(`x`, `y` em 1920×1080), não centradas nem relativas. O HTML ancora por
`left/top` absolutos.

### Peça de dois lados: meça a simetria antes de exportar dois de tudo

Uma barra de confronto desenha tudo em duplicata (picks, bans, rótulos, tiras de
nome). Meça antes de exportar cada lado: se a arte for espelhada em torno do centro
do canvas, um arquivo serve os dois lados com `transform: scaleX(-1)`. Exemplo de
ordem de grandeza: 7 pares conferidos, todos exatos, e 73 camadas viram 10 plates em
vez de 17.

A conta, uma linha por par:

```
espelho_de(x, w) == 1920 - x - w
```

A medição também serve de:

- **Prova da extração.** Se um par não fecha, ou você pegou a camada errada, ou a
  arte tem uma assimetria real que precisa ser dita no `ASSETS.md`. Você descobre
  antes de exportar.
- **Critério de exceção.** Uma tira que sangra pra fora do canvas falha o teste,
  porque o corte em `x=0` e em `x=1920` deixa larguras diferentes (ex.: 527 e 528).
  Ela vira dois arquivos, com a razão escrita no manifesto. Só aceite exceção medida.

### Queime tudo que não muda, e só isso

Logo, zigue-zague, entalhe, rótulos fixos: dentro da plate. Menos elemento vivo,
menos bug de alinhamento, e a tipografia estática fica exatamente como desenhada.

O inverso é a armadilha: o que muda de estado **tem que sair da plate**. Exemplo: num
card de quiz com o badge A/B/C/D queimado na barra, não há como preencher o círculo
quando o participante marca a alternativa; as 8 barras precisam ser reexportadas como
"só a faixa colorida", com o badge redesenhado em CSS.

Antes de exportar, pergunte: **quais estados o operador dispara?** Marcação e
revelação costumam ser gatilhos separados (marca a escolha, segura o suspense,
revela), e cada um pode exigir que uma peça saia do plate.

### O mockup achatado não é overlay

O designer costuma entregar um PNG 1920×1080 **sem alfa**, com a arte colada sobre um
cinza `#7C7C7C`. Numa browser source ele tapa o vídeo. Para virar plate:

1. o cinza vira alfa 0;
2. o antialiasing das bordas chanfradas vira alfa parcial: use o máximo local da
   distância ao fundo como referência de opacidade cheia;
3. descontamine a cor: `F = B + (C − B) / a`. Sem isso sobra franja cinza de 1px
   em volta da arte;
4. corte no bbox do alfa e registre a origem.

Relacionado: **Color Overlay do Photoshop só pinta pixel 100% opaco.** A borda
antialiasada mantém a cor original da camada e vira franja de outra cor. Corrija
pegando o alfa daquela camada e preenchendo-o à mão com a cor certa.

### Largura útil, não bbox do exemplo

Duas medidas distintas:

- **`box`**: o span onde o texto pode correr. Vira `width` no CSS.
- **`measured`**: o contorno dos glifos do texto de exemplo do PSD. Serve pra
  conferir o render; **não** é o espaço disponível.

Point text não define span: o Photoshop só reporta a bbox do placeholder. Derive o
span da geometria da plate: largura total menos o offset do texto menos o respiro da
borda chanfrada. Diga no `ASSETS.md` que é derivado, não medido.

Registre a folga: se a barra tem 241px úteis e o nome de exemplo (8 caracteres) ocupa
239, o gráfico precisa de auto-fit, e esse número define o piso.

### Plate com borda inclinada

Para paralelogramo, registre a forma, não só o retângulo:

```json
"plateShape": { "topInset": 12.69, "slope": -0.1815 }
```

`slope` em px por linha. Com isso o HTML calcula a borda útil **na altura de cada
linha de texto**: rótulo e valor de um mesmo plate têm limites diferentes porque
estão em alturas diferentes. Sem isso, texto ancorado à direita vaza pela esquerda
inclinada e fica solto sobre o vídeo.

### Deixe uma régua

Recorte da export do designer a região do texto (`_ref_text.png`) e uma versão 3×
nearest-neighbour. Confira contra ela fonte, corpo, tracking e baseline, e use-a pra
decidir cor: ela vem do arquivo do designer, não de um render intermediário.

---

## Fullscreen: dois sabores, e a escolha muda a entrega

Decida isto antes de exportar qualquer coisa.

### 1. FS que entra pelo switcher (o caso normal)

A peça é um **input no vMix**. A transição é `PreviewInput` + `Stinger`; nenhum
HTML anima entrada de fullscreen.

Entrega:

- **um PNG de frame cheio, 1920×1080, opaco**, com tudo queimado: fundo, padrão,
  logos, rótulo, selos fixos. Não recorte em plates; recorte não ajuda a montar um
  input no switcher.
- uma variante `_no_label` se a chamada escrita pode mudar no ar (o mesmo fundo
  servindo "COMEÇA EM", "VOLTAMOS EM" etc.).
- a browser source que vai **por cima**: transparente, contém só o campo vivo
  (o contador).
- `_reference.png`: flatten integral com o valor de exemplo queimado. Não vai ao
  ar; é a régua de calibração.

**Tire marcador de designer do plate e registre que tirou.** Exemplo: um retângulo
16:9 com contorno colorido sangrando fora do canvas é slot de câmera ou sobra de
artboard, não arte. Ele sai do `bg.png`, fica só no `_reference.png`, e o
`ASSETS.md` pergunta se era pra ser área de vídeo.

### 2. FS montado em HTML

Quando o fullscreen tem dados demais para ser um input estático (ex.: card de quiz),
use plates recortadas + estados, como no lower third.

### Número grande: ancore pela baseline

Registre a **baseline**, não o topo. `top` posiciona o topo da line box, e a conta
depende da métrica da fonte:

```
altura do conteúdo = (typoAscender + |typoDescender|) / unitsPerEm
com line-height: 1 → baseline a partir do topo = 0.850 × S   (exemplo: 950/-250/1000)
top = baseline − 0.850 × S
```

O `font-size` sai da altura medida do glifo dividida pela `capHeight`
(`319 / 0.698 = 457`). Registre no guia se a fonte tem `USE_TYPO_METRICS`: é o que
torna a conta determinística no Chrome.

### As duas armadilhas do dígito grande

- **Proporcional vs. tabular.** Fontes de display têm larguras muito diferentes por
  dígito, então o bloco re-centraliza a cada segundo e "respira". `tnum` estabiliza,
  mas pode alargar o bloco ~15% e deixa de ser o desenho aprovado. Padrão: **igual ao
  PSD**; ofereça o tabular como opção explícita e diga o custo.
- **Kerning.** A largura de tinta é menor que a soma dos avanços porque a fonte tem
  pares de kerning. O browser aplica por padrão; **não compense com
  `letter-spacing`**.

---

## Barras de progresso e meters

Entregue três coisas: o **track** vazio, o **fill** na extensão cheia, e o **cap**
se a ponta é decorada. Registre o `fillBox` em **coordenadas locais da plate**
(`fillBox.x = fillLayer.x − trackPlate.x`): é isso que faz `width: 47%` cair no
lugar certo dentro do track. Coordenada de canvas só diz onde o plate vai.

**O gradiente do fill é ancorado à camada, não ao track.** Ele comprime junto com a
barra: a 8px de largura a rampa inteira vive dentro de 8px, e a cor sob qualquer
ponto muda enquanto o meter enche, o que num medidor ao vivo parece bug. Registre as
duas opções e deixe a escolha explícita:

```css
background-size: 100% 100%;      /* fiel ao PSD — a rampa espreme */
background-size: 428px 100%;     /* rampa fixada no track inteiro */
background-position: left center;
```

**Ponta decorada não é máscara.** Se o entalhe tem tamanho fixo, use `clip-path:
polygon()` com todo x em `calc(100% − Npx)`; o perfil fica idêntico em qualquer
largura. Confirme comparando duas instâncias do mockup de larguras diferentes (ex.:
35px e 384px devem ter o mesmo recorte pixel a pixel). Um vértice em `y = h − 1` em
vez de `y = h` deixa fresta de 1px visível no ar.

**Não derive o track dos valores de amostra.** O mockup desenha a barra em 2–3
valores colocados a olho; eles não dividem numa mesma largura de track. Use a
geometria.

---

## O que a extração tem que registrar de tipografia

| Registre | Porque |
|---|---|
| Família + corte PostScript + **peso CSS correspondente** | `Inter-Medium` → `font-weight: 500`. Omitir o peso entrega a Regular. |
| Se cada corte existe como face real no `shared/fontes.css` | pedir 600 numa família que só tem Medium engorda o glifo e o layout deixa de bater |
| Tamanho **derivado** (`FontSize × escala do transform`), conferido com os advance widths | o número que o PSD reporta não é o corpo renderizado |
| Baseline + a conta do `top` + se tem `USE_TYPO_METRICS` | é o que torna a posição reprodutível |
| ALL CAPS | a camada é minúscula e renderiza maiúscula: precisa de `text-transform: uppercase` |
| Se existe face oblíqua **real** | com face real, declare-a como a itálica do peso e use `font-style: italic` (casa a face). Sem face real, o Photoshop falseou a inclinação: use `skewX()` ou síntese, e diga qual, porque as duas coisas se parecem e só uma está certa em cada caso. |

Nunca leia cor de efeito (Gradient/Color Overlay) de um render de plate. Leia do
descritor e confira contra o flatten do designer. Renderizador de terceiro erra
Gradient Overlay de forma plausível: uma rampa quase chapada no lugar da rampa cheia.
Amostre o **núcleo saturado** da forma, nunca a média de todos os pixels: a borda
antialiasada puxa a média pro fundo e achata a rampa.

---

## Verificação

Bounds no retorno de um script não provam nada: uma máscara de recorte que soltou
reporta números confiantes e errados. Leia o PNG de volta **como imagem**.

Para a peça montada:

1. renderize em Chrome headless no tamanho da arte;
2. meça a caixa de tinta e compare com a do PSD (a baseline tem que bater exata);
3. sobreponha o `_reference.png` em `mix-blend-mode: difference`. Alinhado = tela
   preta.

> 🚨 A `opacity` do overlay tem que ser **1**. Com `0.5`, branco sobre branco dá 0 e o
> resultado remistura com o fundo: fica cinza médio mesmo perfeitamente alinhado, e o
> teste não detecta nada.

Exponha isso como parâmetro de URL no próprio gráfico (`?ref=1`), junto com os
outros de ensaio, para que qualquer um refaça a conferência.

Quando vários plates dividem linha ou coluna, confira que `x`/`y` batem no
manifesto. Dois cards na mesma linha têm que reportar o mesmo `y`; se não batem, um
dos specs pegou uma camada vizinha.

---

## Entregando pro gráfico

`assets.json` é a fonte da verdade. O HTML lê e monta o DOM, ou copia os números com
comentário citando a origem. Nunca use números sem procedência.

Registre o acoplamento inverso quando existir: se a plate **repete** dados que vivem
no código (ex.: uma escada de prêmio rasterizada na arte), o `ASSETS.md` avisa que
mudar o código obriga a reexportar a plate.
