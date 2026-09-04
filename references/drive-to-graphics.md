# Do Drive ao bundle: as demandas de gráfico de um projeto

> **Leia este documento inteiro quando o trabalho começar no Google Drive** — "quais
> gráficos esse projeto pede", "lista as demandas do Drive", "baixa os PSDs do
> projeto X", "monta a estrutura de pastas dos gráficos", ou qualquer pedido que
> comece na arte que o designer entregou e termine no bundle.
>
> É a subskill que vem **antes** do `psd-to-html/`. Ela descobre o que existe,
> traz pra máquina, dá nome e organiza; a extração em si é do outro documento. E
> termina com a peça pronta na pasta de assets servida do bundle (§2).

O designer trabalha no Drive, o bundle vive no disco, e ninguém mantém as duas
pontas na cabeça. Esta é a ponte: **inventariar → escolher → baixar → extrair →
revisar → promover**. Cada seta é uma parada, não um pipeline que roda sozinho.

O que justifica as paradas: um `.psd` de fullscreen passa de 300 MB, o Drive guarda
mais de uma geração da mesma pasta, e tudo que cair em `graphics/` é servido pelo
NodeCG na hora. Automatizar as seis etapas de ponta a ponta troca alguns minutos de
digitação por um gigabyte baixado à toa e uma pasta pela metade no ar.

---

## 1. Achar a pasta certa no Drive

A árvore **varia de projeto pra projeto**. Não assuma caminho: descubra e confirme.

O que foi observado no `LeagueTV Star League Edition`, como exemplo do formato — não
como regra:

```
<Projeto>/
└── 04. Broadcast/
    ├── Motion/          ← .mov/.mp4, fora do escopo desta subskill
    └── Still/
        ├── L3/          ← lower third
        ├── FS/          ← fullscreen
        ├── IG/          ← in-game
        ├── BUG/         ← bug
        ├── STING/       ← fora do escopo
        └── TV/          ← fora do escopo
```

Navegue de cima pra baixo listando filhos, mostre a árvore que achou e **confirme com
a pessoa antes de listar as peças**. Um projeto que numera as pastas diferente, ou que
chama a categoria de outro jeito, é o caso normal — não a exceção.

O que cada sigla quer dizer, e por que a classificação muda a extração, está em
`psd-to-html/tipos-de-peca.md`. Peça que chega sem etiqueta se classifica por lá antes
de entrar numa categoria.

`Motion` é irmã de `Still` e não contém PSD. `STING` e `TV` existem e estão fora:
sting costuma ser matte de vídeo (vá pra `spritesheet-mask-reveal.md`), e placa de
espera não passa por extração de plates.

### Liste sempre pelos filhos da pasta, nunca por busca global de nome

Esta é a armadilha que já está no Drive deste projeto: existem **duas gerações** de
`L3`, `FS` e `TV`, de datas diferentes, e as duas declaram o mesmo pai. Listar os
filhos de `Still` devolve só a geração viva; uma busca global por `mimeType = folder`
ou por nome devolve as duas, sem nada no resultado dizendo qual é qual.

```
drive_list_files  query: "'<ID_DA_PASTA>' in parents"     ✔ devolve a geração viva
drive_list_files  query: "name contains 'L3'"             ✘ devolve lixo junto
```

Uma peça extraída da geração velha passa por todas as verificações — o PSD abre, os
plates saem, o manifesto fecha — e só aparece como errada quando o operador põe no ar
uma arte que o designer já tinha substituído. Não há como detectar isso depois; a
proteção é só descer pela árvore.

### O que conta como uma demanda

Uma pasta-folha por peça, e dentro dela o par:

```
L3_MetaLike/
├── L3_MetaLike.psd      ← a arte em camadas
└── L3_MetaLike.png      ← o achatado
```

O `.png` é o **referência achatada** que o passo 1 do `psd-to-html/README.md` pede pra
ler antes de tocar no editor. Ele já vem pronto: não gere um do PSD sem antes checar
se o designer mandou.

Pasta-folha sem `.psd`, só com o PNG, é caso do `png-analysis.md` — não é erro, é
outro caminho. Registre no inventário como tal em vez de pular.

---

## 2. Nomes

Duas traduções mecânicas. Antes delas, uma pergunta que o bundle responde — não você.

### Qual é a pasta de assets do bundle

Chame-a de `<assets>/`. **O padrão é `graphics/assets/`**, e a razão está no manifesto: os
campos que um bundle declara em `package.json` → `nodecg` são

```
dashboardPanels · graphics · assetCategories · mount · soundCues · bundleDependencies
```

A arte de uma peça pertence aos gráficos, e `graphics/` é declarado. O painel lê o mesmo
arquivo pela URL `/bundles/<bundle>/graphics/assets/...` — não há restrição de acesso entre
os diretórios, então "o painel também usa" não é motivo pra tirar a arte de lá.

Duas coisas que parecem alternativa e não são:

**`shared/` não é pasta de asset.** Ela existe (o `sharedSourceRouter` serve
`/bundles/<bundle>/shared/*`), mas **não aparece no manifesto** — não dá pra ver pelo
`package.json` que ela está sendo servida. E o nome diz o escopo: *shared **source*** — um
módulo que o dashboard e o gráfico carregam, tipo um `assets.js` que resolve nome em URL.
Script compartilhado, sim; PNG de plate, não.

**`assetCategories` também não.** É o sistema de **upload pelo dashboard**: arquivo que o
operador sobe em tempo de operação, guardado na pasta `assets/` da instalação. Nada a ver
com arte versionada no repositório.

Se a arte precisar mesmo morar fora de `graphics/`, o caminho declarado é o `mount`:

```json
"nodecg": { "mount": [{ "directory": "assets", "endpoint": "assets" }] }
```

O `mountsRouter` publica o diretório em `/bundles/<bundle>/<endpoint>/*`, e fica visível no
`package.json` como todo o resto. Um bundle que já centralizou arte noutro lugar servido
continua onde está — **não migre nada no meio de uma extração**; só confirme antes de criar
pasta nova:

```
grep -rho "/bundles/<bundle>/[a-z]*/assets" graphics/ dashboard/ shared/ | sort | uniq -c
```

### As duas traduções

**A categoria vira a sigla do Drive, minúscula:**

| Drive | Bundle |
|---|---|
| `L3` | `<assets>/l3/` |
| `FS` | `<assets>/fs/` |
| `IG` | `<assets>/ig/` |
| `BUG` | `<assets>/bug/` |

**A peça vira prefixo minúsculo + camelCase, com sigla minusculizada:**

| PSD no Drive | Pasta no bundle |
|---|---|
| `L3_MetaLike.psd` | `l3_metaLike/` |
| `L3_ResultadoPalpite.psd` | `l3_resultadoPalpite/` |
| `FS_VS.psd` | `fs_vs/` |
| `FS_2CAM.psd` | `fs_2cam/` |
| `FS_70X30.psd` | `fs_70x30/` |
| `FS_CreditosEncerramento.psd` | `fs_creditosEncerramento/` |
| `IG_OverlayMain.psd` | `ig_overlayMain/` |
| `BUG_Replay.psd` | `bug_replay/` |

A regra é uma frase: **tudo minúsculo, e cada palavra depois da primeira ganha
maiúscula na inicial.** Sigla não é exceção — `VS` vira `vs`, `2CAM` vira `2cam`. A
tentação de preservar sigla parece inofensiva e não é: ela obriga a decidir caso a
caso o que é sigla (`CAM` é? `DECK` é?), e duas pessoas decidem diferente.

O nome do Drive **não é limpo** — há typo lá dentro (`TV_Defaut_Clean`, com o "l"
faltando). A tradução não conserta typo: se o nome de origem está errado, a pasta
nasce com o typo e o link com a origem se mantém. Corrigir de um lado só é o que
quebra o rastreamento.

**Pastas que já existem ficam como estão.** `ig_overlaymain`, `ig_torcidometro`,
`ig_totalview` e `led_jogo` nasceram planas e minúsculas, antes desta convenção, e
estão no ar. A regra vale pra pasta nova.

---

## 3. Inventário — a etapa que não baixa nada

O primeiro entregável é uma tabela, não uma pasta. Liste as peças das quatro
categorias e cruze com o que já existe no bundle:

| Categoria | Peça | Pasta no bundle | Tamanho do PSD | Estado |
|---|---|---|---|---|
| l3 | `l3_metaLike` | `<assets>/l3/l3_metaLike/` | 1,5 MB | **em dia** |
| fs | `fs_vs` | — | 313 MB | **nova** |
| bug | `bug_replay` | `<assets>/bug/bug_replay/` | 69 MB | **PSD revisado** |

Os três estados saem da comparação entre o `modifiedTime` que o Drive reporta e o
`driveModifiedTime` gravado no `assets.json` da pasta (§6):

- **nova** — não existe pasta no bundle
- **em dia** — existe, e o `modifiedTime` do Drive bate com o gravado
- **PSD revisado** — existe, mas o Drive tem data mais recente que a gravada

**Mostre o tamanho.** É o número que decide o que vale a pena baixar agora: o
`FS_VS.psd` sozinho tem 313 MB, e `refs/` neste bundle já guarda 502 MB de PSD. Um
"baixa tudo" nas 28 peças passa fácil do gigabyte.

Entregue a tabela e **pare**. A pessoa aponta o que vai rodar.

---

## 4. Baixar

Só o que foi apontado. Para cada peça escolhida, dois destinos diferentes:

```
refs/<Nome_Original>.psd              ← o PSD, com o nome do Drive intacto
<pasta de trabalho>/<cat>/<peça>/     ← §5 diz se é `<assets>/` ou `refs/_wip/`
└── _reference.png                    ← o achatado do designer
```

O PSD vai pra `refs/` porque é onde os PSDs deste bundle já moram e porque `refs/`
está no `.gitignore` — arte pesada não entra no repositório nem no deploy. Mantenha o
nome original do arquivo: é o que liga o PSD de volta à pasta do Drive quando chegar
uma revisão.

O achatado entra na pasta de trabalho já com o prefixo `_`, que é a marca de "não vai
ao ar" da convenção do bundle. Um PNG 1920×1080 sem alfa, com a arte colada sobre o
cinza do mockup, tapa o vídeo inteiro se alguém apontar uma browser source pra ele.

---

## 5. Onde a peça é construída

Duas situações, e o que as separa é se **já existe alguém lendo a peça**.

**Ninguém consome a peça ainda** — nenhum gráfico referencia a pasta, e ela não está em
`nodecg.graphics`. Construa direto em `<assets>/<cat>/<peça>/`. Não há o que ler pela
metade, e o staging só acrescentaria um movimento de arquivo no fim.

**A peça já está no ar** — existe gráfico lendo o `assets.json` dela, ou uma browser source
apontada pra ela no switcher. Construa em `refs/_wip/<cat>/<peça>/` e promova por movimento
(§8). O risco aqui não é a pasta incompleta: é **substituir por baixo** de algo que o vMix
já tem aberto. Em transmissão ao vivo não existe "eu ia arrumar depois".

O critério é verificável, não é julgamento:

```
grep -rl "<peça>" graphics/ dashboard/ package.json
```

Sem saída, é o primeiro caso.

De um jeito ou de outro, **a pasta tem a estrutura final desde o começo**:

```
<pasta de trabalho>/l3/l3_metaLike/
├── assets.json
├── ASSETS.md
├── *.png                 ← plates de runtime
└── _*.png / _*.json      ← referência e provas
```

Daí em diante o trabalho é o do `psd-to-html/README.md`, sem nenhuma diferença: ler o
achatado, medir com `analyze_png.py`, inspecionar o PSD, decidir os plates, exportar,
escrever o manifesto. Antes de decidir os plates, leia a seção do tipo de peça em
`bundle-conventions.md` — é ela que diz o que um lower third e um fullscreen precisam
que **não** seja queimado na plate.

---

## 6. Gravar a origem no manifesto

O `assets.json` ganha um bloco com a procedência. Sem ele o inventário da próxima vez
não consegue dizer se o PSD mudou:

```json
"origem": {
  "driveFileId": "17J-PkUnKT2KAN0dh8ga7Ix8jNvONCdf8",
  "driveModifiedTime": "2026-08-31T22:17:22.000Z",
  "psdOriginal": "L3_MetaLike.psd",
  "categoria": "l3"
}
```

O `driveFileId` é do **`.psd`**, não da pasta — é o arquivo que a revisão substitui. O
`driveModifiedTime` é o que o Drive reportou **no momento do download**, copiado do
retorno, não a hora em que você rodou. Gravar a hora local faz toda peça parecer
revisada na consulta seguinte.

---

## 7. Revisar antes de pôr em uso

É aqui que a peça passa a valer pro NodeCG — construída direto em `<assets>/` ou promovida
do `_wip`. Antes de dizer que está pronta:

- [ ] os PNGs foram **abertos e olhados**, não só conferidos pelos bounds do retorno
- [ ] nenhum plate carrega o cinza do mockup nem texto de placeholder
- [ ] plates que dividem linha ou coluna reportam o mesmo `x`/`y` no manifesto
- [ ] as coordenadas são de canvas 1920×1080, não recorte centrado
- [ ] o que muda de estado **saiu** da plate (badge, faixa colorida, marcação)
- [ ] `assets.json` e `ASSETS.md` existem, concordam entre si e trazem o bloco `origem`
- [ ] tudo que não vai ao ar tem prefixo `_`
- [ ] não sobrou um segundo arquivo de layout competindo com o manifesto

Só o que não vai ao ar pode ficar impreciso. O resto vai pro ar exatamente como está.

---

## 8. Promover — só quando houve `_wip`

Peça construída direto em `<assets>/` (o primeiro caso da §5) já está no lugar: a §7 é a
última etapa dela.

Quando houve pasta de trabalho, **mover, não copiar** — duas cópias divergem na primeira
revisão:

```
refs/_wip/l3/l3_metaLike/   →   <assets>/l3/l3_metaLike/
```

O `refs/_wip/` fica vazio ao fim de cada peça. Pasta de trabalho que sobrevive vira,
em uma semana, a pasta que alguém edita achando que é a boa.

Promover **não** liga a peça no ar: ela ainda precisa do HTML do gráfico, da entrada
em `package.json` e do controle no dashboard. Isso é o corpo do `SKILL.md` e o
`assets/grafico-modelo.html`. O que a promoção entrega é a matéria-prima medida.

---

## Armadilhas medidas

**A geração velha no Drive não se anuncia.** Já descrita na §1, e é a única aqui que
produz arte errada no ar sem nenhum sintoma antes. Desça pela árvore.

**Tamanho não aparece na listagem de pasta.** O `size` vem por arquivo. Se o
inventário não pedir, você descobre os 313 MB durante o download.

**`refs/` está no `.gitignore` deste bundle.** É o que se quer pro PSD e pro `_wip/`,
e é a razão de o material de trabalho não poluir o repositório. Mas quer dizer também
que **nada em `refs/` sobrevive a um clone novo** — quem for retomar a peça em outra
máquina baixa do Drive de novo. O que precisa sobreviver é o que foi promovido.

**O PNG do designer não é overlay.** Ele vem sem alfa, sobre o cinza do mockup. Só
entra no bundle com prefixo `_`, e nunca como plate.

**Peça que o mockup desenha três vezes tem uma posição de ar.** Uma barra desenhada em
7%, 64% e 94% na folha são amostras de valor, não três posições. Escolha a instância
canônica e registre a coordenada dela — a régua está em `bundle-conventions.md`.
