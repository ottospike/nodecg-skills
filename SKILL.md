---
name: nodecg
description: Tudo sobre gráficos de broadcast em bundles NodeCG — estrutura e estado em replicants (nunca sendMessage), nomes DB_*/lt_*/fs_*, um arquivo por painel e por gráfico, animação com GSAP, ponte vMix/OBS na extension, playout em CasparCG (AMCP, mapa de camadas, cena com MIX/STING, clipes e vinhetas, fontes SDI/NDI, gráfico do bundle numa camada HTML, template CG play/stop/update, estado real por OSC), performance de render dentro do browser source (animação que engasga no vMix, vídeo de canvas cheio, will-change), gramática de controles do dashboard (PLAY/OUT, selo no ar, SETAR), fontes locais, dev mode, deploy da instalação (Docker, Coolify, volume do banco de replicants), extração de plates de PSD via Photopea MCP (ou Photoshop MCP) ou psd-tools, e reveal por spritesheet de matte de vídeo. Use SEMPRE que o assunto for bundle NodeCG, overlay de transmissão, lower third, fullscreen, painel de dashboard, replicant, package.json de bundle, animação de entrada/saída, ou fiação com vMix/OBS/CasparCG — mesmo quando o pedido parece pequeno ("adiciona um botão", "põe esse valor no ar", "faz a barra entrar deslizando"). Use também quando a arte de um gráfico vier de .psd/.psb ("extrai as plates desse PSD", "transforma esse mockup em HTML", "preciso dos PNGs desse design", "faz essa barra de progresso funcionar"), quando vier só como imagem achatada sem camadas ("analisa esse PNG", "o designer só mandou o print", "descreve o que tem nessa arte", "quais assets eu preciso disso aqui"), quando for pôr a instalação no ar ("faz o deploy do NodeCG", "sobe isso num servidor", "dockeriza", "põe o painel numa URL"), quando o playout for CasparCG ("liga isso no Caspar", "põe o gráfico numa camada", "toca a vinheta no Caspar", "o template não responde ao CG PLAY", "manda o AMCP"), ou quando a transição for um matte de vídeo (.mov/.webm de tinta, pincel, dissolve) virando spritesheet. Use também quando o trabalho começar no Google Drive ("quais gráficos esse projeto pede", "lista as demandas do Drive", "baixa os PSDs do projeto", "monta a estrutura de pastas dos gráficos"), ou quando a dúvida for de vocabulário ("isso é um lower third ou um in-game?", "o que é área de interesse", "como decido o corte das plates"). É agnóstica de temática: descreve o esqueleto do grafismo, não a marca de um programa.
---

# Bundles NodeCG para broadcast

Este documento é um **builder de esqueleto**: ele diz como estruturar o grafismo de
um bundle NodeCG — onde o estado mora, como o arquivo se organiza, como a peça
entra e sai do ar, como o operador controla. Não é sobre um programa específico.
Cor, fonte, tipo de peça e nomenclatura de conteúdo vêm do projeto; o esqueleto é o
mesmo em todos.

Onde aparecem números concretos (uma largura útil, um limite de caracteres), eles
são **exemplo de como a restrição se manifesta**, não valor a copiar. O que copia é
o raciocínio: mediu, achou o limite, tratou.

O contexto que explica quase toda decisão aqui: **isso roda ao vivo**. Uma browser
source recarrega no meio do programa, o operador está apertando botão com o
programa no ar, e um bug não dá pra "corrigir e reimplantar". Toda regra abaixo
existe porque algum desses três já mordeu num projeto real.

Se o bundle em que você está divergir deste documento, o bundle manda — mas diga
isso em voz alta em vez de seguir calado.

## Mapa desta skill

O corpo abaixo são as convenções que valem pra todo trabalho no bundle. O resto
está em documentos que você **carrega sob demanda** — não leia tudo de uma vez.

| Quando | Leia |
|---|---|
| Começando um gráfico novo | `assets/grafico-modelo.html` |
| Começando um painel novo | `assets/painel-modelo.html` |
| **"Como essa ÁREA é construída?"** — a anatomia de runtime de um lower third, um fullscreen, um draft, um in-game, uma peça de canto, uma moldura de câmera: máquina de estados, gramática de movimento, arte em vídeo, medição de texto, contrato do `assets.json` | **`references/familias-de-peca.md`** |
| **"Mudei no painel e o gráfico não atualiza"** | §4 (Como escrever) e o checklist final |
| Animando entrada/saída, troca de conteúdo, stagger | `references/animacao-gsap.md` |
| **A peça anima aos trancos DENTRO do vMix** e lisa no navegador · vai pôr vídeo de canvas cheio num gráfico · pensou em `will-change` | `references/render-no-vmix.md` |
| Montando ou mexendo no layout de um painel | `references/dashboard-ui.md` |
| Decidindo como guardar um estado novo | `references/padroes-replicant.md` |
| **Precisa PROVAR que funciona** (desenha? anima? cabe? gravou?) | `references/padroes-replicant.md` §10, verificação por CDP |
| Falando com o vMix, ou portando bundle antigo do modelo CasparCG | `references/vmix.md` |
| **O playout é CasparCG** — camadas, AMCP, cena de fullscreen com `MIX`/`STING`, clipe/vinheta, fonte SDI/NDI, gráfico do bundle numa camada `[HTML]`, template CG (`play/stop/update`), selo NO AR pelo OSC, testar direto no servidor, **saída pela janela `screen`** (a saída principal deste projeto), `casparcg.config` de referência, **modo teste = preview no canal 2 que não toca no ar** (gráficos nos dois canais, página congelada por `canal.js`, ensaio descartado na volta), **reconciliação sem piscar** (lê o OSC antes de recarregar), **HTML ligado a fundo em vídeo** (tabela sobre `bg.mp4`, entrada/saída por prazo), compatibilidade do Chromium do Caspar (GSAP ok, H.264 em `<video>` não) | `references/casparcg.md` (+ `assets/caspar-*.js`, `assets/utils-caspar.js`, `assets/canal.js`, `scripts/caspar.js`) |
| **Pondo a instalação no ar** (Docker, Coolify, domínio, volumes) | `references/deploy.md` |
| **O trabalho começa no Google Drive** — quais gráficos o projeto pede, baixar os PSDs, montar a estrutura de pastas | `references/drive-to-graphics.md` |
| **"Isso é um lower third ou um in-game?"** — vocabulário dos tipos de peça, área de interesse, como se decide o corte das plates | `references/psd-to-html/tipos-de-peca.md` |
| **A arte vem de um `.psd`/`.psb`** | `references/psd-to-html/README.md` (+ os docs ao lado e `scripts/*.jsx`) |
| **A arte veio só como PNG achatado** ou como frame de transmissão, sem camadas — inclusive vários frames da mesma peça | `references/psd-to-html/png-analysis.md` (+ `scripts/analyze_png.py`) |
| **A transição é matte de vídeo** (tinta, pincel, dissolve) | `references/spritesheet-mask-reveal.md` |
| **A Motion mandou a peça como UM webm com entrada, hold e saída** e o texto tem que acompanhar a arte | `references/motion-in-hold-out.md` (+ `assets/motion/`, `scripts/motion-aplicar.mjs`) |

O do Drive e os dois últimos são subskills completas: têm seu próprio fluxo, e você
segue o documento inteiro em vez de só consultar. Entre neles pela primeira linha, que diz
quando o documento se aplica.

---

## 1. Estado, nunca evento

**Toda comunicação entre dashboard, graphics e extension é replicant. Inclusive
"põe no ar" e "tira do ar".** Um bundle bem estruturado tem zero
`sendMessage`/`listenFor` — isso é escolha, não esquecimento.

O motivo é operacional: mensagem é um evento que passa. Se a browser source
recarregar (ou o vMix reabrir o input, ou o operador der F5 no preview) depois que
a mensagem foi disparada, o gráfico volta em branco e **ninguém percebe até estar
no ar**. Com estado, ele relê o replicant no boot e volta exatamente como estava.

```js
// dashboard
DB_BUG.value.visivel = true;         // PLAY
DB_BUG.value.visivel = false;        // OUT

// graphics
DB_BUG.on("change", (s) => aplicar(!!s && s.visivel === true));
```

Bundles mais antigos costumam usar `sendMessage`/`listenFor` com pontes
`xPlayExt` na extension. **Não copie esse modelo para código novo** — ele é a razão
de gráficos voltarem em branco depois de um refresh. Ao mexer num bundle assim,
converta o trecho que você está tocando para replicant se der; se não der, registre
por quê.

Se você se pegar querendo `sendMessage`, o que você quer quase sempre é estado com
um campo a mais (um `seq` que incrementa, um `atual` que muda).

---

## 2. Onde o replicant é declarado

Padrão: **no painel do dashboard**, com `defaultValue`. Painel é arquivo de
cliente — editar e dar F5 basta. Declarar na extension obriga a reiniciar o
NodeCG, e reiniciar NodeCG no meio de um programa não é opção.

Vai pra extension só o que precisa de tempo de vida de servidor:

| Motivo | Exemplo |
|---|---|
| O servidor é quem publica o valor | `DB_DEVMODE` (vem do env/cfg) |
| Tem que sobreviver ao painel fechado e a restart | `DB_CONTADOR` (relógio regressivo) |
| A mudança dispara efeito colateral no servidor | `DB_FS` (extension traduz cena → comando vMix) |
| **Mais de um arquivo declara, e só alguns passam `defaultValue`** | `DB_TIMES`, `DB_PARTIDA` — ver a corrida abaixo |

O gráfico **nunca** declara `defaultValue`: `nodecg.Replicant("DB_X")` e pronto.
Quem define o formato é quem controla o estado; o gráfico só desenha o que vier, e
tem que aguentar `undefined` no primeiro change.

### 🚨 A corrida de declaração — e por que ela só quebra em instalação NOVA

**`defaultValue` só vale na CRIAÇÃO do replicant.** Quem declara primeiro define o
formato; quem declara depois apenas se conecta, e o `defaultValue` que passar é
**ignorado em silêncio**.

Isso vira bug assim que um replicant é compartilhado. Num bundle real, dez
arquivos declaravam `DB_TIMES` e só três passavam `defaultValue` — os outros sete
(painéis e gráficos que só LEEM) declaravam pelado, como manda a regra acima. O
dashboard carrega todo painel como **iframe, em paralelo**: qual chega primeiro é
corrida. Com o painel leitor na frente do painel dono, o replicant nasce **sem
valor**, e `DB_TIMES.value` fica `undefined` para sempre.

O sintoma não aponta para cá: painel em branco, selects vazios nas peças que
dependem dele, e **nada no log**. O `pintar()` sai no `if (!v) return` e pronto.

**E some no laptop.** Lá o banco já tem o replicant gravado de uso anterior,
então o valor vem da persistência e a corrida não decide nada. O volume de
produção nasce vazio — é no primeiro deploy que quebra, que é a pior hora.

A saída é declarar na **extension**, que roda no boot do servidor antes de
existir cliente: a criação vira determinística e os dez declarantes viram
leitores. É o mesmo motivo pelo qual um `DB_FS` já declarado lá nunca sofreu
disso.

Regra prática: **se dois ou mais arquivos declaram o mesmo replicant e a peça não
funciona sem valor, ele pertence à extension** — mesmo não tendo efeito colateral
de servidor. Auditar é um `grep`:

```bash
grep -rn 'Replicant("DB_X"' dashboard/ graphics/ extension/
# se aparecer mais de um E nem todos com defaultValue, você tem a corrida
```

**Mexer no `package.json` exige restart completo do NodeCG.** Editar HTML de
dashboard ou de graphic só pede hard-refresh do navegador. Valide edição de
extension com `node --check <bundle>/extension/index.js` antes de reiniciar.

---

## 3. Nomes

**Replicants** — `DB_` + nome curto em MAIÚSCULA, sem acento: `DB_QUIZ`,
`DB_LTSINGLE`, `DB_VALOR_CHAT`. Um replicant por peça que entra e sai do ar
sozinha. Duas peças que precisam estar no ar ao mesmo tempo com conteúdos
diferentes são **dois replicants** (`DB_VALOR` e `DB_VALOR_CHAT`) — não um objeto
com dois campos.

**Duas peças nunca são um campo `modo`.** A tentação aparece quando elas
compartilham a arte: "é a mesma barra, só muda o miolo". Um `modo: "a" | "b"` num
gráfico só custa duas coisas caras. No ar, o PLAY de um modo acende junto tudo
que já estiver preenchido do outro — e num draft os dados chegam *antes* da peça
entrar, então isso é o caso normal, não a borda. Na operação, um arquivo é **um
input no vMix**: com um só, não existe cena de A e cena de B para cortar entre
elas. Se as duas entram e saem sozinhas, são dois arquivos e dois replicants,
mesmo que 80% do CSS se repita.

**Arquivos de gráfico** — snake_case, com prefixo por **tipo de entrada**. São
três famílias, e a diferença entre elas é *quem põe a peça no ar*:

- `lt_*` → **lower third**: entra e sai a cada informação, por animação própria,
  e o ar é um campo `visivel` do replicant (`lt_single.html`)
- `fs_*` → **fullscreen**: é uma cena do switcher. O vMix transiciona
  (`PreviewInput` + `Stinger`), o HTML **não anima e não tem `visivel`**
  (`fs_pergunta.html`, `fs_contador.html`)
- sem prefixo → **peça de canto**: fica no ar por trechos longos e se preenche
  (`bug.html`, `chat.html`, um overlay de partida)

O critério é **quem anima**, não quanto do quadro a peça ocupa. Uma peça que
cobre a metade de baixo do quadro e entra pela própria timeline é `lt_`, não
`fs_` — num bundle real uma delas ficou anos com o prefixo errado, e o custo é
que `fs_` PROMETE que quem transiciona é o vMix. Quem for ligar a peça procura
uma cena no switcher que não existe.

🚨 **E um prefixo pode mentir por herança.** Um rename pedido pela produção deixa
`lt_` num arquivo que é peça de canto. Quando prefixo e comportamento
divergirem, o **cabeçalho do arquivo manda** — e ele tem que dizer isso na
primeira tela, apontando onde está a gramática certa. Não renomeie sozinho: o
nome é a URL da browser source no vMix.

A anatomia completa de cada família — máquina de estados, curvas de animação,
como a arte em vídeo muda o arquivo, o que o painel de cada área faz — está em
`references/familias-de-peca.md`.

O nome descreve **a peça**, não a posição dela no roteiro. Numeração de bloco muda
de ordem entre ensaio e programa; a peça continua sendo o que ela mostra.

**Painéis** — nome do bloco de operação, minúsculo: `quiz.html`, `lowerthirds.html`,
`valores.html`. Agrupe por *quando o operador mexe*, não por qual gráfico é.

**Assets** — uma pasta por peça em `<assets>/<categoria>/`, derivada do nome
do arquivo do Photoshop: **tudo minúsculo, cada palavra depois da primeira com
inicial maiúscula**. Sigla não é exceção.

```
L3_MetaLike.psd    →  <assets>/l3/l3_metaLike/
FS_Contador.psd    →  <assets>/fs/fs_contador/
FS_VS.psd          →  <assets>/fs/fs_vs/
IG_OverlayMain.psd →  <assets>/ig/ig_overlayMain/
```

`<assets>/` é a **pasta de assets servida do bundle**, e o padrão é `graphics/assets/` —
`graphics` é campo declarado do manifesto, e a arte de uma peça pertence aos gráficos. O
painel lê pela mesma URL; não há restrição entre os diretórios.

Não confunda com as duas que parecem servir e não servem: **`shared/`** é *shared **source***
(um módulo que dashboard e gráfico carregam) e nem aparece no manifesto; **`assetCategories`**
é o sistema de upload pelo dashboard, em tempo de operação. Pra servir um diretório fora do
trio, o caminho declarado é `nodecg.mount`. Detalhe em `references/drive-to-graphics.md` §2.

A categoria é a sigla do tipo de peça, minúscula — `l3`, `fs`, `ig`, `bug`. O que
cada uma quer dizer está em `references/psd-to-html/tipos-de-peca.md`.

Derivar o nome do PSD é o que liga o asset de volta à origem sem ninguém precisar
lembrar: quem recebe um PSD revisado sabe na hora qual pasta reexportar, e quem
abre a pasta sabe qual arquivo pedir ao designer. Pastas antigas com outro nome
ficam como estão — a regra vale pra pasta nova.

Dentro dela, `ASSETS.md` e `assets.json` **junto** dos PNGs; guia longe do asset
vira guia desatualizado. Arquivo que não vai ao ar leva prefixo `_`
(`_ref_text.png`, `_proof_overlay_3x.png`, `_plates.json`) — assim o que é runtime
se distingue do que é régua de calibração.

Renomear um gráfico = trocar o arquivo, a entrada em `package.json` **e** a URL da
browser source no vMix. Apagar um gráfico = tirar também a entrada do
`package.json` e o markup/handler morto no dashboard.

---

## 4. Formato do valor

Sempre objeto, nunca escalar solto — dá pra crescer um campo sem migrar nada.
Campo de ar chama `visivel`:

```js
{ visivel: false, valor: 0 }              // DB_VALOR
{ visivel: false, nome: "", social: "" }  // DB_LTSINGLE
{ atual: null }                           // DB_SELECAO — seleção, não visibilidade
```

### Como escrever

Campo a campo (`rep.value.visivel = true`) só vale para campo de **primeiro
nível**. Para qualquer outra coisa, **reescreva o objeto carregando adiante os
campos que não mudaram**. Três regras, e as três custaram bug no ar:

**1. Escrita aninhada não notifica de forma confiável.** `rep.value.placar.a = 2`
depende do proxy profundo pegar a mutação, e quando ele não pega o gráfico
simplesmente não redesenha — sem erro, sem log. Reatribua:

```js
rep.value = { ...v, placar: { ...v.placar, a: 2 } };   // sempre notifica
```

**2. Um handler, UMA escrita.** Atribuir a um replicant no cliente é
**assíncrono**: `rep.value = x` propõe ao servidor e o valor local só muda quando
ele devolve. Duas escritas no mesmo handler leem o *mesmo valor velho*, e a
segunda apaga os campos da primeira.

```js
// ERRADO — a barra não entra no ar, mas o relógio começa a andar
rep.value = { ...rep.value, visivel: true };
irParaFase(0);      // relê (ainda visivel:false) e regrava por cima

// CERTO — funções de estado CALCULAM campos; o handler escreve uma vez
const v = rep.value;
rep.value = { ...v, visivel: true, ...camposDaFase(v, 0) };
```

O sintoma é traiçoeiro: parte do estado chega e parte não, então parece bug de
renderização. Se uma função auxiliar escreve replicant, chamá-la **é** uma
escrita — parta em `calcularX()` (puro) e `aplicarX()` (escreve).

**3. Carregue adiante o que não mudou.** No contador, esquecer o `inicial` no
PAUSE fazia o RESET "resetar" pro tempo pausado.

### Persistência: dado persiste, ar nunca persiste

**`defaultValue` só vale quando NÃO existe valor persistido.** Um
`visivel: false` no default de um replicant persistente **não protege nada**: se
o servidor cair com a peça no ar, ela volta no ar sozinha no boot.

Quando a mesma peça tem dado preparado (que precisa sobreviver) e ar (que não
pode), são **dois replicants**, divididos por *tempo de vida*:

```js
const DB_MAPPICKS    = nodecg.Replicant("DB_MAPPICKS",    { defaultValue: { mapas: [...] } });
const DB_MAPPICKS_AR = nodecg.Replicant("DB_MAPPICKS_AR", { defaultValue: { visivel: false }, persistent: false });
```

Um fullscreen reaparecendo sozinho por cima do programa é inaceitável. Para uma
barra de trecho longo, voltar acesa depois de uma queda pode ser o que a produção
quer — mas isso é **decisão explícita e comentada**, nunca acidente.

**Nada de replicant tickado.** Relógio guarda um *prazo* (`fimEm`, epoch ms) e cada
tela calcula o restante sozinha. Escrever um replicant por segundo enche o socket,
faz o número pular com jitter, e para quando o painel fecha.

**Mudou o FORMATO do valor, apague o persistido — com o servidor PARADO.** O valor
velho vence o `defaultValue` novo, e o campo que você acabou de acrescentar nasce
`undefined` sem erro nenhum. Com o NodeCG no ar ele tem o replicant em memória e
regrava a forma antiga no shutdown: você apaga, reinicia, e está tudo como antes.
Ordem: parar → `DELETE FROM replicant WHERE namespace=… AND name=…` → subir.

Os padrões já resolvidos (liga/desliga, valor preparado + SETAR, fábrica pra blocos
irmãos, relógio, seleção exclusiva, efeito colateral no servidor, dev mode,
migração de formato, verificação por CDP) estão com código em
`references/padroes-replicant.md`.

---

## 5. Um arquivo por painel, um por gráfico

O HTML, o CSS e o JS da peça moram no mesmo `.html`. Abrir um arquivo é ver a peça
inteira; e menos arquivo é menos requisição pra falhar no boot da browser source.

O que legitimamente sai do arquivo:

| Sai | Por quê |
|---|---|
| `dashboard/<bundle>.css` | design system dos painéis — trocar uma cor muda o dashboard todo |
| `dashboard/comum.js` | helper usado por 2+ painéis (ex.: `marcarAr`) |
| `dashboard/pessoas.js`, `perguntas.js` | **conteúdo**, editado antes do programa por quem não é dev |
| `graphics/utils/*.js` | utilitário usado por 2+ gráficos — ver abaixo |
| `graphics/utils/fontes.css` | `@font-face` num lugar só |
| `graphics/vendor/gsap.min.js` | biblioteca, versionada junto (ver §7) |

### `utils/` e `shared/` são coisas diferentes

Confundir os dois é fácil e o nome não ajuda, então a regra é por QUEM LÊ:

| Pasta | Quem lê | Como é referenciada |
|---|---|---|
| `<bundle>/shared/` | dashboard **e** graphics | `/bundles/<b>/shared/x` — absoluta, é rota nativa do NodeCG |
| `<bundle>/graphics/utils/` | **só** os gráficos | `utils/x` — relativa |

Tema, paleta e catálogo de asset são dos dois lados: vão em `shared/`. Utilitário
de runtime de peça é só dos gráficos: vai em `utils/`. Um `shared/` dentro de
`graphics/` é ambíguo — parece a rota nativa e não é.

### O que mora em `utils/`

Estes quatro reaparecem em todo bundle de transmissão, e cada um existe porque a
forma ingênua tem um defeito que **só aparece no ar**:

| Arquivo | Resolve | O defeito que ele evita |
|---|---|---|
| `fit.js` | escala o `.stage` pro tamanho da saída | peça montada no tamanho da barra, que não cai onde o designer desenhou |
| `devmode.js` | régua e diagnóstico com `?dev=1` | conferir geometria no olho |
| `medida.js` | auto-fit de texto | as **cinco** armadilhas de medição do §6 — a caixa, o inteiro, a fonte não carregada, o `check()` que mente, a escala do stage |
| `imagem.js` | imagem dinâmica | entrar no ar com buraco, e a requisição anterior sobrescrever a nova |

**Quando promover.** Utilitário nasce **dentro da peça** e só sobe pra `utils/`
quando a **segunda** peça precisa dele. Subir na primeira é abstrair sem caso de
uso, e a assinatura sai errada — a segunda peça é que revela o que varia.

**O que NÃO sobe:** geometria e timeline. Elas são daquela arte e de mais nenhuma,
e ficam inline no `.html` mesmo quando 80% do CSS se repete entre duas peças.

🚨 **Um utilitário de `utils/` é código de AR.** Ele roda em toda peça ao mesmo
tempo: um bug ali não derruba uma, derruba o programa. Por isso ele nunca rejeita
promessa nem estoura exceção — degrada, loga e deixa a peça desenhar. E os
comentários dele registram a MEDIÇÃO que justificou cada decisão, porque a próxima
pessoa vai olhar aquele laço estranho e querer "simplificar".

Regra de bolso: **CSS de painel nunca é inline no painel** (o design system existe
pra isso); **CSS de gráfico é sempre inline no gráfico** (a geometria é daquela arte
e de mais nenhuma).

Se o mesmo comportamento aparece duas vezes no mesmo arquivo com ids diferentes,
faça uma fábrica e chame duas vezes — não duplique.

---

## 6. Anatomia do gráfico

Template completo em `assets/grafico-modelo.html`. As seis invariantes:

1. `body { background: transparent }` e `.stage` no **frame inteiro de transmissão**
   — `1920×1080` (ou `1080×1920` no vertical), `overflow: hidden` — com cada plate
   ancorada por `left`/`top` absolutos em **coordenada de canvas** vinda do PSD.

   **Isso vale igual pro lower third.** Uma barra de 421×106 no canto inferior
   esquerdo continua morando num stage de 1920×1080, posicionada em
   `left: 157px; top: 805px`. Não monte o gráfico do tamanho da barra: a browser
   source é sempre de frame cheio, é a coordenada de canvas que faz a peça cair no
   mesmo lugar que o designer desenhou, e é o que permite duas peças conviverem no
   quadro sem recalcular nada. O `fit.js` também assume isso — ele escala o stage
   pela altura do canvas.

   Para outra resolução de saída, escale o stage inteiro
   (`transform: scale(...)`), nunca mexa numa coordenada.
2. **Trava de primeiro estado**: a animação só existe depois do primeiro `change`.
   Sem isso, um refresh da browser source com a peça no ar faz ela re-entrar
   deslizando, no ar.
3. **Trava de on-air**: só anima na *transição*. PLAY com a peça já no ar não
   re-anima.
4. `utils/fit.js` e `utils/devmode.js`, nessa ordem, **por último** no body.
5. `window.test(...)` no fim do script — ensaiar a peça no navegador sem depender
   do painel. É o que torna a peça verificável por render headless.
6. `<link rel="stylesheet" href="shared/fontes.css" />` no head.
7. **Uma fonte ausente nunca derruba a outra.** Quando a peça combina dois
   replicants (o dado e o ar, o draft e o confronto), `combinar()` desenha com o
   que tiver:

   ```js
   function combinar() {
     var d = draftAtual   || {};   // NUNCA `if (!draftAtual) return;`
     var p = partidaAtual || {};
     aplicarDados({ ...d, placar: p.placar || { a: 0, b: 0 } });
   }
   ```

   O `return` cedo parece defensivo e é o oposto: como cada replicant é declarado
   no painel dele, e painéis moram em **workspaces diferentes**, basta o operador
   estar com uma aba aberta e a outra não para uma fonte ficar `undefined` — e aí
   o guard derruba junto tudo que a outra fonte trouxe. O sintoma aparece longe da
   causa: "o placar não atualiza" quando o problema é o painel de draft fechado.

   **E o mesmo vale no painel, com uma variante pior: o replicant PARCIAL.** Um
   guard `if (!v) return;` cobre o valor ausente, mas deixa passar o objeto que
   existe e perdeu um campo — e aí a primeira linha que faz `v.a.sigla` estoura, o
   `pintar()` morre ali, e **nada abaixo é desenhado**. Num painel de vários
   blocos isso derruba os outros blocos inteiros: o painel congela com o conteúdo
   anterior, os botões param de refletir o ar, e nada na tela diz o que houve.

   Desestruture com default em vez de confiar na forma:

   ```js
   const v = REP.value;
   if (!v) return;
   const a = v.a || {}, b = v.b || {}, placar = v.placar || { a: 0, b: 0 };
   ```

   Não é hipotético: basta uma escrita que leia `.value` **antes de o replicant
   sincronizar** para reduzir o objeto a um campo só. Handle recém-criado tem
   `.value === undefined`, e `Object.assign({}, undefined, { x: 1 })` é `{x: 1}` —
   o resto do estado evapora sem erro nenhum. Espere o primeiro `change` antes de
   escrever a partir do valor atual.

### 🚨 O `x/y/w/h` da plate não é o tamanho do arquivo

Antes de ancorar qualquer plate, **confira o tamanho do PNG**. Existem duas
convenções de export e elas pedem CSS oposto:

| Export | O `x/y/w/h` do manifesto é | Como ancorar |
|---|---|---|
| **recortado** (o PNG tem o tamanho da arte) | a geometria do arquivo | `left/top/width/height` direto |
| **frame cheio** (o PNG é 1920×1080) | o bbox da arte **dentro** do arquivo | `left:0; top:0; width:1920px; height:1080px` |

Ancorar um PNG de frame cheio no bbox **espreme o canvas inteiro naquela caixa** —
num caso real o bloco de placar virou uma tira de 4px, e o sintoma não parece
geometria: parece que a plate exportou errado.

A divergência aparece sozinha quando o export muda de caminho no meio do projeto
(um recorta, outro salva o documento inteiro). Por isso o manifesto tem que
declarar a convenção da pasta **e** o tamanho real de cada arquivo, e não deixar
isso para quem for escrever o gráfico descobrir renderizando.

### Imagem: PRELOAD antes do ar, e fallback sempre

**Nunca um `<img>` cru, e nunca `background-image` direto no CSS para conteúdo.**
Uma peça não pode entrar no ar com buraco: se a imagem ainda não decodificou, a
barra desliza com o slot vazio e a foto **aparece de estalo** um instante depois,
no ar. É o mesmo erro do auto-fit medir antes da fonte carregar — a peça anda
antes de o material estar pronto.

**Duas famílias de imagem, e as políticas são opostas:**

| | arte versionada no bundle (plates) | URL que o operador digita (foto, escudo) |
|---|---|---|
| pode faltar? | **não** — se faltou é bug | **sim**, e é normal |
| na falha | `nodecg.log.error` alto: a peça vai ao ar sem arte | placeholder silencioso, sem susto |
| quando carregar | no **boot**, antes do primeiro `change` | a cada troca de conteúdo |

**Use `decode()`, não `onload`.** Uma API só resolve as duas coisas — ela promete
que a imagem está **decodificada e pronta para pintar**, e **rejeita** quando o
arquivo não existe (medido: `EncodingError`), o que já é o caminho de erro:

```js
/* Devolve true se pintou, false se caiu no fallback. Nunca estoura: uma imagem
   ruim não pode derrubar o handler e congelar a peça no ar. */
async function pintarImagem(el, url, fallback) {
  el.__req = (el.__req || 0) + 1;          // token da requisição
  const meu = el.__req;
  if (!url) { el.style.backgroundImage = fallback ? `url("${fallback}")` : "none"; return false; }
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    if (meu !== el.__req) return false;    // chegou tarde: outra já venceu
    el.style.backgroundImage = `url("${url}")`;
    return true;
  } catch (e) {
    if (meu !== el.__req) return false;
    el.style.backgroundImage = fallback ? `url("${fallback}")` : "none";
    return false;
  }
}
```

🚨 **A trava de corrida (`__req`) não é zelo.** Ao vivo o operador troca de
convidado duas vezes em segundos; sem o token, a imagem ANTERIOR — que demorou
mais para baixar — chega depois e **sobrescreve a nova**. O sintoma é a peça
mostrando a pessoa errada, e não há erro em lugar nenhum.

**E o ar espera a imagem:** a entrada só roda depois que as imagens do conteúdo
resolveram. Como já existe uma promessa por imagem, é um `Promise.all`:

```js
async function aplicar(estado) {
  render(estado);                                   // texto entra na hora
  await Promise.all(estado.fotos.map((u, i) => pintarImagem(slots[i], u, PLACEHOLDER)));
  if (querVisivel && !noAr) entrar();               // só agora anima
}
```

As **plates** seguem a mesma regra, mas no boot: pré-carregue todas antes de
assinar o replicant, junto com as faces (§9). Uma plate que falha é erro alto —
ela é arte versionada, e se sumiu alguém quebrou o bundle:

```js
/* Só baixa e decodifica; não pinta nada. Nunca rejeita — uma plate faltando
   tem que virar log, não exceção que impede a peça de subir. */
function precarregar(urls) {
  return Promise.all(urls.map(async (u) => {
    const img = new Image();
    img.src = u;
    try { await img.decode(); return true; }
    catch (e) { nodecg.log.error(`[arte] plate não carregou: ${u} — a peça vai ao ar sem ela`); return false; }
  }));
}

Promise.all([MEDIDA.pronta(FACES), precarregar(PLATES)]).then(iniciar);
```

Depois disso o navegador já tem tudo em cache, então o `background-image` do CSS
pinta no primeiro quadro — que é o ponto: **a peça nunca aparece incompleta.**

### Quando a arte é VÍDEO em loop

O motion às vezes entrega a arte da peça como webm com alfa, em vez de PNG. A
convenção é a mesma das plates — **canvas cheio 1920×1080**, com a peça já no
lugar que o designer desenhou —, e ela é certa: o elemento vai em 0,0 e ninguém
remede coordenada.

Três coisas mudam, e as três já custaram ar:

- **A entrada espera o vídeo estar RODANDO.** Sem isso a peça desliza para
  dentro do quadro com o frame 0 congelado e o loop só começa depois que ela
  parou — no ar lê como engasgo. Espere `canplaythrough` no boot (não
  `loadeddata`, que promete só o primeiro frame) e o `play()` antes de animar.
- **Fora do ar, pause.** Sete peças decodificando VP9 com alfa a 1920×1080 ao
  mesmo tempo gastam CPU da máquina de transmissão sem nada aparecer na tela.
  Pause só no FIM da saída — pausar no começo congela a arte à vista.
- 🚨 **Recorte o elemento com `clip-path` pela caixa MEDIDA da arte.** É o maior
  ganho de performance disponível num bundle assim, e sem ele a peça repinta o
  quadro inteiro 24×/s parada no ar. A caixa sai da união do alfa sobre **todos
  os frames** do loop, nunca de uma amostragem — a arte flutua, e amostragem
  esparsa cai fora do extremo. `references/render-no-vmix.md`.

Um webm raramente cobre a peça INTEIRA: o normal é ele substituir **uma** das
plates e o resto continuar PNG (peça híbrida). Como medir isso antes de portar,
o que a troca faz PERDER (animação por camada, campo vivo que virou queimado), e
as quatro armadilhas do `<video>` estão em `references/familias-de-peca.md` §8.

Texto dentro de plate de largura fixa **precisa de auto-fit**: reduza o corpo
até caber, com piso — e quando estourar o piso, `nodecg.log.warn` e deixa passar.
Cortar o nome de alguém no meio é pior que passar 2px da arte.

**Mas a medição é uma armadilha de cinco camadas, e as cinco passam em teste.**
Não improvise aqui:

| Medindo com | O que acontece |
|---|---|
| `getBoundingClientRect().width` | devolve a **caixa**. Com largura fixa é sempre o mesmo número: o laço nunca reduz e o texto vaza em silêncio |
| `scrollWidth` contra uma constante subpixel | é `max(conteúdo, caixa)` **arredondado pra inteiro**: numa caixa de 327,2 devolve 328 até vazio → "sempre estourando", e o laço corre até o piso. A peça fica **sempre no menor corpo** e ninguém desconfia |
| `scrollWidth > clientWidth` | **correto** (inteiro contra inteiro), e é o que usar quando não precisa de fração |
| **`Range` sobre texto com `text-transform`** | mede o **texto-fonte**, antes da transformação. Ver o bloco abaixo — é o pior dos cinco |
| `document.fonts.ready` antes de medir | resolve **na hora** quando o texto está vazio — que é como um gráfico nasce (o estado vem do replicant depois). Mede na fallback, escolhe corpo grande, a face real entra e vaza |
| `document.fonts.check(face)` | devolve **`true` pra fonte que não existe**: a pergunta dele é "dá pra renderizar?", e a fallback sempre dá. Passa exatamente no caso que deveria pegar |

### 🚨 `Range` + `text-transform: uppercase` = medida 18% menor, e sempre pra baixo

`Range.selectNodeContents()` + `getClientRects()` mede os glifos do **conteúdo do
nó de texto**, não os que o navegador pinta. Quando a caixa-alta vem do CSS e o
DOM está em caixa mista, ele mede a string minúscula — que é bem mais estreita.
Medido num nome de time, Akira Expanded:

```
"Ninguém Segura" a 53,69px, caixa de 657px
  Range.getClientRects() ....... 538,5px    ← o que eu media
  canvas.measureText(UPPER) .... 654,2px    ← o que o Chrome pinta
  scrollWidth .................. concorda com o canvas
```

115px de erro, e **sempre para baixo** — o lado perigoso: faz passar no teste
exatamente o texto que deveria reprovar. Num auditor de layout isso não dá falso
alarme, dá **falso silêncio**.

Duas saídas, e as duas valem:

- **medir com `canvas.measureText`, aplicando a transformação você mesmo**
  (`cs.textTransform === "uppercase" ? txt.toUpperCase() : txt`, com
  `c.font` montado de `fontStyle/fontWeight/fontSize/fontFamily`);
- **ou fazer o JS gravar o texto já em caixa alta** (`el.textContent =
  nome.toUpperCase()`) e deixar o `text-transform` como redundância. Aí o DOM e
  o pintado coincidem e o `Range` volta a ser confiável.

A segunda é a que os bundles já fazem na maioria das peças, e é por isso que a
armadilha fica escondida: ela só aparece nas peças onde o CSS sobe a caixa
sozinho. **Antes de confiar num `Range`, pergunte se o DOM já está na caixa
final.** `grep` de `text-transform` cruzado com `toUpperCase()` separa as duas
famílias em segundos.

O que funciona: **`Range` sobre os filhos** (`selectNodeContents`) pra medir o
conteúdo com fração — **desde que o DOM já esteja na caixa final**, senão use
canvas; **`status === "loaded"` da FontFace** em `document.fonts` pra
saber se a face existe de verdade; **`rel=preload as=font crossorigin`** no
`<head>` pra encurtar a janela; e o refit reagendado por **promessa**, não por
evento — `loadingdone` dispara antes do conteúdo chegar e não há segunda chance.

⚠️ **Carga fria é o caso difícil e é o que vai ao ar.** Um teste que espera
`document.fonts.ready` antes de escrever o texto mede sempre com a fonte certa e
sempre passa. E **render headless com `--virtual-time-budget` não serve** pra
testar isso: ele queima o orçamento de espera em tempo virtual enquanto o fetch
real está em voo, e acusa falha com o código correto.

### A caixa do PSD pode ser MAIOR que o vão que a peça tem de verdade

O auto-fit mede contra a caixa que você deu a ele. Se essa caixa passa **por
baixo de outra plate**, ele conclui que cabe e não avisa nada — e o texto vai ao
ar **coberto**, não vazado. Não há erro, não há log, e a tela de dev diz que
está tudo certo.

Aconteceu assim: a caixa do nome veio do placeholder do PSD (`TEAM NAME`, 224px
de largura), que é curto e nunca chegou perto da borda. Medindo o render, a
placa ia de x=700 a 1220, mas os slots de ban ocupavam 596..746 e 1174..1324 e
**pintavam por cima dela** — o amarelo livre era 746..1174. As duas caixas de
224px enfiavam 14px cada uma sob um ban. Um nome longo parava no corpo que
"cabia" nos 224 e perdia a última letra atrás da arte vizinha.

**Derive o vão do que está PINTADO, não do placeholder.** Na prática: meça o
bbox das plates vizinhas na altura da linha de texto e use a menor distância até
o primeiro obstáculo. Um bundle que faz isso direito documenta o número assim —
`nomeA = 2 × (790 − 461,29) = 657,42 (aperta a estrela)`.

E quando for auditar, a pergunta certa não é "o texto passou da caixa CSS?", é
**"o que está pintado embaixo das pontas da tinta?"**. `document.elementsFromPoint`
nas extremidades responde: se só houver stage e body, o texto está no vazio; se
houver uma plate que vem DEPOIS na ordem de pilha, ele está coberto.

### Palavra única não quebra — e `overflow-wrap: anywhere` estraga o auto-fit

Nome com espaço cai em duas linhas sozinho. Palavra única não tem onde quebrar,
então só o corpo cede: num caso real `QuieroQueQue` desceu a 19,4px ao lado de
`OCX DIVISION` em 28,9 — os dois lados da mesma placa com corpos diferentes, que
é o que lê como quebrado.

⚠️ **Não resolva com `overflow-wrap: anywhere`.** O auto-fit começa no corpo
máximo e aceita a primeira medida que couber; com quebra em qualquer ponto,
`GORDITOS` parte como `GORDI/TOS` já no corpo cheio, **passa no teste** e sai
errado no ar.

A grafia costuma dizer onde quebrar: a **maiúscula interna**. Insira
`U+200B` (zero-width space) em `[a-z0-9][A-Z]` e o navegador usa a oportunidade
só quando precisa:

```js
function comQuebras(nome) {
  return String(nome == null ? "" : nome)
    .replace(/([a-z0-9])([A-Z])/g, "$1​$2")
    .toUpperCase();   // DEPOIS: toUpperCase() destrói a caixa que marca o ponto
}
```

A ordem importa — subir a caixa antes apaga a informação que você ia usar. E
lembre de tirar o `U+200B` de qualquer string que você mostre na tela de dev ou
compare com `===`.

### Cobrir a franja da moldura, não só o miolo

Ao encaixar uma imagem dentro de um frame recortado, o miolo "branco puro" **não
é** o limite: existe uma franja de antialiasing de 1px que o teste de cor não
pega. Medido num slot de 150×150 — miolo branco em 4..145, com franja em x=3
(195,195,195) e x=146 (120,120,120).

Encaixar em `4/142` deixa a franja clara da esquerda exposta: no ar é um fio
claro vertical em cada slot, em todos ao mesmo tempo. Cobrir só um lado (`3` +
143) resolve metade. O certo é **3..146 nos quatro lados** (`left/top: 3`,
`144×144`), aceitando 1px a menos de antialiasing na moldura — o contorno mantém
os píxeis chapados, e o que se perde é a meia-tinta da curva.

Meça a franja, não confie no limiar: `>245` acha o miolo, `>200` já pega parte
da franja, e a diferença entre os dois é exatamente o fio que aparece no ar.

Implementação de referência: `graphics/utils/medida.js` no bundle da LEAGUETV.

---

## 7. Animação com GSAP

**GSAP é a ferramenta de animação padrão.** Transição CSS resolve um slide de dois
estados e está ok onde já existe; qualquer coisa com timeline, `stagger`,
`clip-path` animado ou troca de conteúdo no meio do movimento vai de GSAP — fazer
isso na mão em CSS vira uma pilha de `setTimeout` que dessincroniza no ar.

**Vendorize local**, nunca CDN: `graphics/vendor/gsap.min.js`, carregado antes do
script da peça. Máquina de transmissão pode estar sem internet, e um CDN fora do ar
põe o gráfico no ar sem animação — ou sem aparecer.

```html
<script src="vendor/gsap.min.js"></script>
```

A forma canônica de uma peça animada:

```js
const tlIn = () => {
  const tl = gsap.timeline();
  // SEMPRE resetar o estado inicial no topo da entrada — ver armadilha abaixo
  tl.set(el, { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)", opacity: 1 });
  tl.to(el, { clipPath: "polygon(0% 0%, 200% 0%, 0% 200%)", duration: 0.5, ease: "power2.out" });
  tl.to(cards, { clipPath: "inset(0 0 0% 0)", duration: 0.4, stagger: 0.1 }, 0.1);
  return tl;
};
```

Três armadilhas que já custaram debug:

- **Replay-safety.** Se a saída não roda (browser source recarregada, OUT que nunca
  chegou), a segunda entrada começa do estado final e não anima. Por isso a timeline
  de entrada `gsap.set(...)` cada filho animado de volta ao início, no topo — não
  confie na saída ter limpado.
- **Flash no boot.** Container nasce `opacity: 0`; a entrada faz `gsap.set(opacity:1)`
  antes de revelar, e a saída termina em `onComplete: () => gsap.set(el, {opacity: 0})`.
- **Troca de conteúdo no meio do movimento** (barn-door, flip): troque só o
  `.textContent` dos spans num layout fixo, não o `innerHTML` do bloco — recriar
  um `<img>` a cada tique pisca no ar.
- **Devagar demais é indistinguível de quebrado.** Um rolo de créditos de 60s começa
  atrás da borda mascarada e leva ~13s até o primeiro texto aparecer inteiro — e o
  relato que chega é "dei play e não apareceu nada". Antes de debugar, calcule a
  velocidade (px/s) e quanto tempo o primeiro elemento leva pra cruzar a máscara.
  Se a peça só se prova depois de 10s, o problema é a duração, não o código.

Os padrões fechados (wipe diagonal, reveal vertical com stagger, barn-door, flip,
pushup) estão em `references/animacao-gsap.md`.

Quando a transição for um matte orgânico de vídeo (tinta, pincel, dissolve), não
tente `clip-path` nem gradiente — vá pra `references/spritesheet-mask-reveal.md`.

### 🚨 Lisa no navegador e aos trancos no vMix é outro problema

Se o relato for "a animação engasga depois que eu inputei no vMix" — em especial
**na saída** —, pare de procurar defeito na timeline. O browser source do vMix é
CEF em **off-screen rendering: não há compositing por GPU**. A página é
rasterizada para um bitmap em memória de sistema, e o que custa é a **ÁREA
repintada por quadro**, não a propriedade animada.

As duas consequências que mordem quase sempre:

- **Vídeo de canvas cheio quer `clip-path`.** Um `<video>` de 1920×1080 em loop
  se declara sujo inteiro a cada frame — 2,07 Mpx, 24×/s, **com a peça parada no
  ar**. Recortar pela caixa medida da arte corta isso entre 9× e 67×.
- **`will-change` num elemento de 1920×1080 PIORA** (medido: +1 camada de quadro
  cheio, e desfaz o ganho do recorte). A regra é "promova o que se move **se a
  caixa dele for pequena**".

Tudo com número, e como medir sem acreditar no teste errado, em
`references/render-no-vmix.md`.

---

## 8. Gramática dos controles do dashboard

Vocabulário completo de classes em `references/dashboard-ui.md`; template em
`assets/painel-modelo.html`.

O layout de um bloco é sempre o mesmo, e é isso que deixa o dashboard coeso — o
operador aprende um bloco e sabe operar todos:

```
.sechd        título à esquerda + selo .onair à direita
.campo        rótulo + input/select + SETAR   (opcional)
.barra        PLAY | OUT
.status       uma linha, só quando diz algo que os botões não dizem
.sechd.sep    começa o próximo bloco
```

Regras que valem mais que o layout:

- **Digitar não vai ao ar.** Campo + `SETAR` explícito, e `SETAR` desabilitado
  enquanto o campo bate com o que está no ar. O operador precisa poder preparar o
  próximo valor com o atual no ar.
- **Botão desabilitado é informação.** PLAY apagado = já está no ar. OUT apagado =
  não tem nada no ar. Isso responde mais rápido que qualquer texto.
- **Não repita o que já está dito.** Se o botão aceso já responde "o que está no
  ar?", não escreva `.status` embaixo.
- **Selo só diz o que o painel sabe.** Se quem manda no ar é o vMix, "NO AR"
  mentiria. Duas saídas honestas: sem selo, ou um selo rotulado **PEDIDO** quando o
  painel de fato disparou a cena. Não invente um terceiro estado. (Com
  **CasparCG** o painel PODE saber: o OSC diz o que cada camada está tocando, e
  aí PEDIDO e NO AR viram dois selos honestos — `references/casparcg.md` §7.)
- **Uma cena, um botão.** Se a mesma cena aparece numa grade E num painel próprio, o
  operador vai apertar a errada — e a errada costuma ser a que faz menos. Tire da
  grade o que ganhou painel, com a lista num arquivo compartilhado. Se uma cena
  precisa de dois efeitos (trocar no switcher e rodar a peça), o botão faz os dois.
- **Nunca sobrescreva campo em foco** — e nem campo com trabalho não salvo. Foco
  sozinho não basta: o operador tira o foco a hora que clica em qualquer lugar. As
  quatro armadilhas do guard estão logo abaixo, em *As armadilhas do formulário que
  sincroniza*.
- **Duas alturas, escolhidas pelo vizinho**: `--h-ctl` para o que divide linha com um
  input, `--h-tecla` para tecla isolada. Alargar um botão baixo não o torna alvo.
- Controle sem asset correspondente fica **desabilitado com `title`**, não apagado:
  `<button disabled title="Sem asset no vMix">`. Sumir esconde a lacuna.
- Saída de emergência fica sempre clicável (o RESET do contador).
- **Conteúdo que muda uma vez por temporada mora no gráfico**, não num campo: a
  hashtag do canal, a lista de créditos, a duração de um rolo. Campo editável ao vivo
  para algo que ninguém muda ao vivo é superfície de erro sem contrapartida.

**Imagem se resolve por NOME, não por URL.** Painel não pede caminho de arquivo:
pede o nome (do time, do caster, do jogador) e um manifesto por pasta resolve. Duas
regras que fazem isso funcionar:

- **Sem arquivo declarado no manifesto, o resolvedor devolve `null`.** Não derive
  `slug + ".png"`: derivar faz TODA entrada parecer que tem imagem, e a peça toma 404
  no ar. Devolvendo `null` dá pra cadastrar alguém antes de a arte chegar, e o painel
  avisa qual falta (`⚠ sem foto LOUD`, não "1 sem foto").
- **Manifesto ausente não pode derrubar os outros.** Cada fetch com `.catch`; sem
  isso uma pasta vazia rejeita o `Promise.all` e o painel perde selects que não têm
  nada a ver com aquela pasta.
- 🚨 **Fallback dentro do resolvedor CEGA o painel.** Um resolvedor genérico que,
  não achando o campo pedido, cai no campo principal (`foto` → `png`) nunca
  devolve `null` — e aí o `!BS.fotoX(...)` do painel é **sempre falso**. O aviso
  "⚠ sem foto" vira decoração: ele não dispara nem quando a arte de fato não
  existe. Num bundle real isso ficou dois meses assim, e o mesmo fallback ainda
  punha um escudo quadrado esticado no slot de uma figura de corpo inteiro.
  Campo secundário quer **resolvedor próprio, sem fallback**; quem escolhe o
  degrau seguinte é a peça, explicitamente.

### O resolvedor diz a verdade; a PEÇA decide o que desenhar

Quando existir um genérico (silhueta, placeholder, "sem foto"), a tentação é
devolvê-lo do resolvedor. **Não faça** — é o mesmo defeito acima com outra
roupa: todo nome passa a parecer que tem arte, o painel cala, e a única forma de
descobrir que faltava é ver a silhueta no ar.

Divisão que funciona: o resolvedor responde *"existe arte desta pessoa?"* e
devolve `null` quando não; a peça responde *"o que eu desenho quando não
existe?"*, passando o genérico como `fallback` do pintor de imagem. Só a peça tem
contexto para a segunda pergunta — um slot **sem nick nenhum** não leva
silhueta, senão ela inventa um jogador que não existe, enquanto um slot **com
nick e sem foto** leva.

O genérico entra no manifesto como chave de topo (fora de `itens`), resolvido por
uma função separada — nunca indexado pelo nome, para ninguém achá-lo procurando
uma pessoa.

**Linha criada depois de um `await` precisa reaplicar o estado.** O `change` do
replicant chega ANTES de o DOM existir: o handler não acha o que preencher e nada
tenta de novo. Quem monta linha dentro de um `.then` chama o repaint no fim — senão
o painel mostra branco e o SETAR grava o branco por cima do que está no ar.

### As armadilhas do formulário que sincroniza

Todo painel de "preparar valor" tem o mesmo miolo: `lerForm()` lê a tela,
`doEstado()` lê o replicant, `difere()` compara, e `pintar()` sincroniza o form
quando o operador não está mexendo. As armadilhas abaixo apareceram em bundle
real, e **nenhuma delas aparece na leitura do código nem no
`node --check`** — só com o dashboard aberto e dado guardado no replicant.

**1. `!difere()` não é "o operador não mexeu".** O guard óbvio está errado:

```js
if (!emFoco() && !difere()) { /* popula o form */ }   // ERRADO
```

Na primeira pintura o replicant é `undefined`, o form vazio bate com o estado
vazio, e ele popula vazio. Quando o valor real chega, `difere()` vira `true` e o
form **nunca mais carrega**. O painel mostra tudo em branco com dado guardado
atrás, diz "pendente", e **o SETAR apaga o que estava lá**.

O guard confunde "o operador está digitando" com "o form ainda não carregou".
Separe com uma flag explícita, marcada no `input` e limpa no SETAR:

```js
let tocado = false;
el.addEventListener("input", () => { tocado = true; pintar(); });
// ...
if (!emFoco() && !tocado) { /* popula */ }
```

Isso conserta junto a outra metade do mesmo bug: os botões **"Puxar do…"**
escrevem o replicant direto, e com o guard antigo o form não mostrava o que
tinha sido puxado.

**2. `JSON.stringify` é sensível à ordem das chaves.** `lerForm()` monta o objeto
na ordem em que os campos aparecem na tela; `doEstado()` monta na ordem em que o
replicant guarda. Conteúdo idêntico, string diferente, `difere()`
**permanentemente `true`**.

O sintoma é traiçoeiro porque quebra justamente os **dois sinais que dizem ao
operador o que já está no ar**: o "pendente" nunca sai e o SETAR nunca
desabilita. Compare com as chaves ordenadas:

```js
function estavel(v) {
  if (Array.isArray(v)) return v.map(estavel);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = estavel(v[k]);
    return o;
  }
  return v;
}
const difere = () => JSON.stringify(estavel(lerForm())) !== JSON.stringify(estavel(doEstado()));
```

**3. Sincronize o form ANTES de calcular botão e status.** `difere()` lê o DOM.
Se o estado do SETAR for calculado no topo do `pintar()`, ele lê o form velho —
ainda vazio na primeira pintura — e **nasce habilitado sobre dado que já está no
ar**. Um clique distraído ali regrava o que o painel nem chegou a mostrar.

**4. Quem mexe no form no lugar do operador liga `tocado` também.** Um botão
"Limpar" que zera os campos e chama `pintar()` sem marcar a flag cai no próprio
ramo de sincronização e **desfaz o que acabou de fazer**. E o guard de foco não
salva: clique de mouse leva o foco pro botão, então `emFoco()` é `false`
justamente ali.

```js
limparBt.addEventListener("click", () => {
  campos().forEach((el) => (el.value = ""));
  tocado = true;                 // ← sem isto, o pintar() abaixo repovoa tudo
  pintar();
});
```

O sintoma chega como duas reclamações que parecem de outra coisa: "o botão não
faz nada" e "apaguei e o SETAR não retira". Vale pra qualquer preenchimento
programático — "Limpar", "Puxar de…", autocompletar, importar roteiro.

Como pegar as quatro: abra o painel com o replicant **já preenchido** e confira
que o form carregou, que o "pendente" some, e que o SETAR está desabilitado.

A URL solta do painel não serve — o `nodecg` não existe nela e o painel morre no
primeiro `Replicant()`, com HTTP 200 e o CSS aplicado, o que engana. Use
**`?standalone=true`**, a rota de painel que sobe com a API; ela também é o que
permite dirigir o painel por CDP (ver `references/padroes-replicant.md` §10).

⚠️ E **reproduza o gesto inteiro, foco incluído.** Um teste que dispara `.click()`
por script não move o foco como o mouse move — é exatamente por isso que a
armadilha 4 passa por um teste automatizado que parece correto.

No `package.json`, registre o painel com `width` em colunas e **explique a escolha
num campo `_width`** ao lado — a largura foi decidida olhando o conteúdo real, e sem
a nota o próximo a mexer desfaz sem saber:

```json
{ "name": "valores", "title": "Valores", "file": "valores.html",
  "_width": "3 e não 4: são duas linhas de campo + PLAY/OUT; a 3 ele fecha como quarta coluna.",
  "width": 3, "headerColor": "#0F0F23" }   // cor de fundo da arte do projeto
```

Todo gráfico também entra em `nodecg.graphics` com `width`/`height` iguais ao
tamanho da arte.

**Workspaces se numeram.** O NodeCG ordena as abas **alfabeticamente**, então
`1. FULLSCREEN`, `2. LOWERTHIRDS`, `3. INGAME/DRAFT` põem as abas na ordem de uso do
programa; sem o número elas saem em ordem de dicionário. Dois painéis que se
alimentam um do outro (o draft que lê o time escolhido no confronto) ficam na MESMA
aba — trocar de aba no meio de um draft é onde o operador erra.

O workspace `main` **não pode ser renomeado**. A única forma de não ver essa aba é
nenhum painel ficar sem `workspace`; deixe-a vazia de propósito e comente isso.

---

## 9. Fontes

Um `graphics/utils/fontes.css`, linkado por todo gráfico. Arquivos em
`graphics/fonts/<Familia>/`.

**Cada corte é uma face de verdade com seu peso declarado** — nunca simule.
`font-weight: 600` tem que carregar o arquivo SemiBold, não engordar o Medium;
`font-style: italic` tem que casar com a face oblíqua declarada, não sintetizar
slant sobre glifos já oblíquos. Peso e itálico sintéticos mudam a largura dos
glifos e o layout deixa de bater com o mockup.

`font-display: block`, não `swap`. Os arquivos são locais e carregam em
milissegundos; `block` esconde o texto nesse intervalo, enquanto `swap` mostraria o
fallback e trocaria depois — um flash de tipografia errada, no ar, é pior que um
quadro sem texto.

Duas armadilhas de arquivo:

- **A fonte instalada no SO não existe pro browser source.** Copie o `.otf` pra
  dentro do bundle e `@font-face` — a máquina que joga no ar não é a sua.
- **Nome de arquivo com espaço não carrega pela URL do NodeCG.** Renomeie para
  `SemEspaco.otf` e ajuste o `src`.

---

## 10. Extension e a ponte vMix

Extension fina de propósito. Num bundle bem dividido ela faz três coisas: publica o
dev mode, declara os poucos replicants que precisam de vida de servidor, e traduz
cena → comando HTTP pro switcher. Todo o resto está nos painéis.

Ao escutar `change` para disparar efeito colateral, **ignore a primeira emissão** —
ela é o estado inicial, não uma ordem do operador:

```js
let primeira = true;
DB_FS.on("change", (novo) => {
  if (primeira) { primeira = false; return; }
  // ...
});
```

O modelo de ar: **quem transiciona fullscreen é o switcher, não o HTML.** Cada cena
é um input montado no vMix (o PNG de frame cheio, e por cima a browser source
transparente só com o campo que muda), e a troca é `PreviewInput` + `Stinger`.
Nenhum HTML anima entrada de fullscreen. Lower third é o oposto: a browser source
fica sempre carregada e o próprio HTML anima entrada e saída.

Integração externa nunca pode derrubar a extension: sempre `try/catch` +
`nodecg.log`, e um flag `enabled` pra o painel continuar funcionando inteiro numa
máquina sem o software. Nomes que precisam bater letra por letra com outro sistema
(inputs do vMix, com acento e espaço) vão pra `cfg/<bundle>.json`, não pro código.

Detalhes da ponte — helpers HTTP, `Restart`+`Play` para mídia, canais de overlay,
migração CasparCG→vMix — em `references/vmix.md`.

**Com CasparCG no lugar do vMix, a extension vira o switcher.** O Caspar não tem
mesa: só faz o que um cliente manda por TCP (AMCP, porta 5250). O modelo de ar
não muda — o painel grava replicant, a extension traduz —, mas a tradução passa
a ser um mapa de camadas, a cena entra num lote atômico (fundo + HTML no mesmo
quadro), e o estado real volta por OSC, o que finalmente permite um selo NO AR
honesto em fullscreen. Tudo, com cliente AMCP e leitor OSC prontos, em
`references/casparcg.md`.

### O bundle é hóspede na API dos outros

Quando o dado vem de um serviço que **não é deste bundle** (um servidor de stats,
um placar, uma API de torneio), a regra é uma só:

> **Leia. Nunca configure.** Se para o bundle funcionar você precisou gravar
> alguma coisa no outro sistema, você escolheu a rota errada.

Quase toda API desse tipo tem os dois tipos de rota, e elas se parecem:

| Rota | O que faz | Serve? |
|---|---|---|
| `GET /stats?channels=a,b` | responde sobre o que **você passou na chamada** | **sim** |
| `GET /chat/<plat>/<canal>` | stream do que **você pediu no path** | **sim** |
| `GET /api/stats` | responde sobre o que **o painel de lá tem ligado** | não |
| `POST /api/channels` | **edita** o painel de lá | nunca |

A rota que aceita os alvos na própria chamada é a rota de consumidor. A que não
aceita está te dizendo que ela serve ao painel dela, não a você.

Por que isso é regra e não preferência: aquele painel é de outra pessoa e
costuma alimentar outros overlays que já estão no ar. Ligar um canal lá para o
seu gráfico somar muda o número **do overlay dos outros** — e o seu bundle passa
a depender de um estado que qualquer um pode mudar sem saber que você existe. O
custo aparece na pior hora: alguém desliga um canal no painel e a sua peça zera
no meio do programa, sem log e sem causa aparente.

Então a lista de alvos é **estado do bundle** — um replicant na extension,
editado num painel do próprio dashboard — e cada chamada carrega essa lista.
Assim o bundle sobe sozinho, em qualquer instalação, sem preparo do outro lado.

Antes de escrever a primeira linha de integração, **leia a documentação da API
inteira** (`/docs.json`, `/openapi.json`, a página de docs) e liste as rotas de
leitura on-demand. Escolher a rota errada não dá erro — dá um bundle que só
funciona na sua máquina.

E ao mexer num serviço de terceiro para testar: se você gravou alguma coisa,
**desfaça e confira o estado final** contra o que era antes. Diga o que mudou e o
que não deu para restaurar.

---

## 11. Como comentar

Estes bundles comentam muito, e isso é convenção, não estilo pessoal. Cada arquivo
abre com um cabeçalho dizendo o que a peça é e o que **não** é. Ao longo do código,
comente o **porquê** — em especial onde o código parece errado:

- por que o número é esse (de onde veio a medida, qual restrição da arte)
- qual alternativa foi tentada e por que foi descartada
- o que quebra se alguém "simplificar" aquilo
- onde mais está o mesmo número ("o mesmo teto está em `fs_contador.html` — se
  mudar aqui, mude lá")

Escreva em português, na mesma voz do resto do bundle: direta, sem adjetivo
sobrando, explicando o efeito no ar.

---

## 12. A tela de dev

Todo gráfico carrega um `<div id="dev">` que só aparece com `?dev=1` (o
`devmode.js` põe a classe `.dev` no stage). **Nunca no ar** — e é justamente por
isso que ele pode ser prolixo.

Ele existe porque ao vivo você não tem console: a peça está numa browser source
dentro do vMix, e "não atualizou" é tudo que o operador consegue relatar. A tela
de dev transforma isso em diagnóstico numa olhada.

```js
var diag = { noAr: false, placar: "—", primeiro: "—", picks: 0, faltando: [] };

function pintarDiag() {
  var st = document.querySelector(".stage");
  if (!st || !st.classList.contains("dev")) return;   // sai cedo: custo zero no ar
  devEl.textContent =
    "no ar: " + diag.noAr +
    "\nplacar: " + diag.placar +
    "\npicks fechados: " + diag.picks + "/6" +
    "\nsem imagem: " + (diag.faltando.length ? diag.faltando.join(", ") : "—");
}
```

O que faz a diferença entre um dump inútil e uma ferramenta:

- **Mostre o que foi DESENHADO, não o que chegou no estado.** `placar: 2-0` lido
  do `textContent` que a peça acabou de escrever responde "o painel mandou e a
  peça pintou?" — que é a pergunta real. Ecoar o replicant só prova que o socket
  funciona.
- **Uma linha por pergunta que você já fez ao vivo.** `no ar`, quem está no
  relógio, quantos segundos faltam, quantos assets faltaram. Se um campo nunca
  respondeu nada, tire.
- **Assets que faltaram, por nome.** É o defeito mais comum e o mais invisível:
  sem isso, um retrato ausente é só um buraco no layout.
- **Atualize junto com o desenho.** `pintarDiag()` no fim de `aplicarDados()` e
  de cada transição de ar. Painel de dev que mente é pior que não ter.
- **Um campo órfão é dívida.** Quando removi o modo `global` da barra, `diag.modo`
  ficou mostrando um valor congelado. Ao apagar um estado, apague a linha dele —
  ou troque por outra que hoje importa mais.

Vale o mesmo para o painel: o `.status` de um bloco é a tela de dev do operador,
e a regra é a inversa — **só escreva o que os botões não dizem**.

---

## Subir o NodeCG: `start` e `dev`

Dois scripts, e a diferença entre eles é o dev mode:

```json
"start": "node index.js",
"dev":   "node --watch-path=bundles/<bundle>/extension --watch-path=cfg dev.cjs",
"dev:sem-watch": "node dev.cjs"
```

`dev.cjs` é um launcher de duas linhas — `process.env.NODECG_DEV = "1"` e depois
`require("./index.js")`. Existe como **arquivo** e não como `NODECG_DEV=1 node
index.js` no script porque essa sintaxe é de shell POSIX: no `cmd.exe` ela não
define variável nenhuma e o NodeCG sobe com o dev mode desligado **sem avisar**.
Um launcher em Node funciona igual no cmd, no PowerShell e no bash, sem
`cross-env`.

**Não use nodemon.** Foi testado num projeto com `[colchetes]` no caminho e
falha em silêncio: o chokidar trata `[...]` como classe de caracteres de glob, o
padrão casa com nada, e o nodemon anuncia `watching path(s): bundles\*\extension`
e nunca reinicia. Medido: **0 restarts com nodemon, 3 com `--watch-path`**, no
mesmo teste. O `--watch-path` usa `fs.watch`, sem glob, então colchete é só um
caractere.

**Observe só o que exige restart de servidor** — `extension/` e `cfg/`.
`dashboard/` e `graphics/` ficam de fora de propósito: editar HTML de painel ou
de gráfico só pede hard-refresh do navegador. Um watch que reinicia o servidor a
cada tweak de CSS derruba todas as browser sources abertas — fica mais lento, e é
um jeito ótimo de tirar um gráfico do ar sem querer durante um ensaio. Bundle
novo = mais um `--watch-path`; o flag não aceita glob, e apontar para `bundles`
inteiro arrastaria a pasta de assets junto.

**`ENOENT ... access 'graphics/<peça>.html'` durante uma edição é ruído, não
defeito.** O `bundle-manager` do NodeCG tem watcher próprio (independente do
`--watch-path`) e, ao ver mudança, espera um instante e re-parseia o bundle
inteiro, fazendo `accessSync` em cada gráfico do `package.json`. Se o timer dele
cair no milissegundo em que o editor está substituindo o arquivo, o `access`
falha:

```
warn: [bundle-manager] Unable to handle the bundle "brawlstars" change:
Error: ENOENT: no such file or directory, access '...\graphics\draft.html'
    at Timeout._onTimeout (...bootstrap.js:2446:9)
```

Antes de investigar, confira que o arquivo existe e fecha (`</html>`) — quase
sempre existe. O efeito real é que **aquele reload foi descartado e o servidor
seguiu com a versão anterior em memória**, então o que você acabou de escrever
pode não estar valendo. Restart resolve. O `Timeout._onTimeout` no stack é a
assinatura: é o debounce do watcher, não um require do seu código.

### O que o dev mode liga

`DB_DEVMODE` é **booleano puro**, publicado pela extension, `persistent: false`
(se persistisse, a primeira peça a entrar no ar depois de um restart entraria com
a régua por cima). O `utils/devmode.js` reage ligando três coisas:

1. **Fundo `#3C3C3C`** no body. Browser source é transparente, e transparente no
   navegador é indistinguível de "a peça não carregou" — os dois são branco. Com
   o cinza dá pra ver a silhueta real, conferir o alfa das plates e notar na hora
   se algo desenha fora do lugar. Cinza **médio**: sobre branco o contorno preto
   some, sobre preto somem as sombras. Guarde o fundo original e devolva ao
   desligar — fundo cinza esquecido no ar cobre o programa.
2. **Classe `.dev` no `.stage`**, que é o gancho para cada peça mostrar o próprio
   diagnóstico (`.stage.dev #dev { display: block }`). O que conferir é da peça:
   texto medido, tamanho de fonte após auto-fit, se estourou o piso, qual imagem
   não resolveu.
3. **Régua**: contorno do canvas, linha de centro em `x=960` e grade de 120px.

Para ensaiar uma peça isolada sem NodeCG rodando, `?dev=1` na URL do gráfico
vence tudo.

### E em produção

`start` e `dev` sobem a instalação **na máquina de quem está editando**. Pôr a mesma
instalação num servidor — imagem Docker, volume pro banco de replicants, domínio,
login — é outro assunto, com armadilhas próprias: `references/deploy.md`.

## Ambiente Windows

O caminho deste projeto tem `[colchetes]`, que o PowerShell e o chokidar tratam
como glob. Use o Bash tool, `cmd /c mklink /J` para junções, `node -e` para leituras
e `Test-Path -LiteralPath`; evite `New-Item -Path` com caminho entre colchetes.

**Junção nunca dentro de `bundles/`.** O NodeCG trata toda pasta ali como bundle
e exige `package.json`; qualquer outra coisa derruba o servidor no boot com
`ENOENT: ...\<pasta>\package.json`. Pastas com ponto (`.claude`) ele pula. Se
precisar de uma junção de notas ou docs, ela vai na raiz do projeto, fora de
`nodecg/`. Para remover junção sem apagar o alvo: `cmd /c rmdir` ou
`[System.IO.Directory]::Delete($p, $false)` — `Remove-Item -Recurse` do PS 5.1
pode seguir o link e apagar o conteúdo real.

**Asset fora dos três diretórios servidos não existe por HTTP.** O NodeCG serve
só `dashboard/`, `graphics/` e `shared/` de um bundle. Uma pasta `assets/` na raiz
do bundle dá 404 na browser source. Ponte que funciona sem duplicar arquivo:
junção `shared/assets` → `../assets`. Ela passa porque o `isChildPath` do NodeCG
compara **string** no caminho não-resolvido e o `res.sendFile` segue o link no
filesystem. A junção **não sobrevive** a copiar/zipar o bundle — recrie na
máquina nova.

Dimensão real de um PNG sem abrir nada:

```bash
node -e "const b=require('fs').readFileSync('x.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"
```

---

## Checklists

**Gráfico novo**
- [ ] nome com prefixo certo (`lt_` / `fs_` / cru) e registrado em `nodecg.graphics`
- [ ] `background: transparent`, sem elemento de debug visível
- [ ] `.stage` no frame inteiro (1920×1080), plates por coordenada de canvas — inclusive se for LT
- [ ] `shared/fontes.css` linkado; pesos reais, sem síntese
- [ ] replicant lido sem `defaultValue`, tolerando `undefined`
- [ ] trava de primeiro estado e trava de on-air
- [ ] combina duas fontes? nenhuma delas derruba a outra por `return` cedo
- [ ] GSAP vendorizado local; timeline de entrada reseta o estado inicial dos filhos
- [ ] a peça anima em GSAP, e não numa `transition` CSS — transição é simétrica por
      natureza, então ela faz a peça SAIR com ease-out (freando ao ir embora), e
      obriga a adivinhar o fim da saída num `setTimeout` paralelo
- [ ] se a arte é vídeo de canvas cheio: `clip-path` pela caixa medida, senão a
      peça repinta 1920×1080 a 24fps parada no ar (`references/render-no-vmix.md`)
- [ ] `fit.js` + `devmode.js` no fim do body
- [ ] `window.test()` funcionando
- [ ] tela de dev mostra o que foi DESENHADO, sem campo órfão de estado removido
- [ ] imagem com fallback; auto-fit onde o texto pode estourar, com piso e `log.warn`
- [ ] geometria conferida contra `assets/<peça>/assets.json`
- [ ] restart do NodeCG (mexeu no package.json) e URL da browser source apontada

**Painel novo**
- [ ] registrado em `dashboardPanels` com `width` + `_width` explicando
- [ ] linka o CSS do dashboard; zero CSS próprio
- [ ] blocos em `.sechd` / `.campo` / `.barra` / `.status`
- [ ] PLAY/OUT desabilitados conforme o ar; SETAR desabilitado quando limpo
- [ ] **abriu o dashboard com o replicant JÁ preenchido**: o form carregou, o
      "pendente" sumiu e o SETAR está desabilitado (as três armadilhas do §8)
- [ ] **o painel sobe sem rede**: montar linhas e assinar replicant fora de qualquer promise
- [ ] toda promise de asset tem `.catch` com `nodecg.log.error`
- [ ] replicants declarados aqui com `defaultValue` (não na extension)
- [ ] **uma escrita de replicant por handler** — função auxiliar que escreve conta como escrita
- [ ] nada de escrita aninhada (`rep.value.a.b = x`); reatribui o objeto
- [ ] dado preparado persiste, ar não persiste (dois replicants se a peça tem os dois)
- [ ] não sobrescreve campo em foco, e quem mexe no form liga `tocado`
- [ ] `.status` só onde acrescenta
- [ ] nenhuma cena tem dois botões
- [ ] imagem resolvida por nome, e a ausência declarada (nunca derivada do slug)

**Antes de dizer que está pronto**
- [ ] **o repo está limpo**: screenshot, dump, venv e script de conferência foram
      para o scratchpad, não para dentro do bundle. Ferramenta que grava por
      caminho relativo (o screenshot do Playwright, por exemplo) escreve no cwd —
      passe caminho absoluto do scratchpad, e confira com `git status` /
      `find . -newermt` antes de encerrar. Um `.playwright-mcp/` esquecido dentro
      de `bundles/` é pasta sem `package.json`: derruba o NodeCG no próximo boot
- [ ] recarreguei a browser source com a peça no ar e ela voltou igual, sem re-animar
- [ ] pus no ar, tirei e pus de novo — a segunda entrada animou igual à primeira
- [ ] reiniciei o NodeCG e nada se declarou no ar sozinho
- [ ] abri o gráfico com **só um** dos painéis carregado — ele ainda desenha o que tem
- [ ] `node --check` na extension, se mexi nela
- [ ] os comentários explicam os números e as decisões descartadas
- [ ] só UMA instância do NodeCG está no ar (senão eu medi a antiga)
- [ ] o que é visual eu **vi** — screenshot ou leitura de DOM por CDP, não só HTTP 200
- [ ] mexi em performance de render? medi com `--disable-gpu` (o caminho do CEF do
      vMix) e comparei o INVENTÁRIO DE CAMADAS antes/depois — com a GPU ligada eu
      teria medido outra máquina

**O painel sobe sem rede.** Montar as linhas e assinar os replicants **nunca**
mora dentro de `BS.carregar().then(...)` — nada disso precisa de manifest. Só o
que se alimenta do asset (um `<datalist>`, um `<select>` de mapa) espera, e com
`.catch` obrigatório:

```js
montarLinhas();
DB_X.on("change", pintar);
pintar();                                  // ← o painel já está vivo aqui

BS.carregar()
  .then(encherDatalist)                    // só o enfeite espera a rede
  .catch((e) => nodecg.log.error("Manifests não carregaram:", e));
```

Com tudo lá dentro, qualquer tropeço no carregamento mata o painel INTEIRO em
silêncio — as linhas nem aparecem, `pintar` nunca é assinado, e o operador vê
badges vazios e botões que não respondem. Um `.then()` sem `.catch()` engole a
rejeição, então nem no console aparece. Degradar é aceitável (digitar o nome à
mão); morrer sem avisar, não.

**Quando "não atualiza"** — a ordem que economiza tempo, das causas mais comuns
para as mais raras. Todas já aconteceram:

1. O handler faz **duas escritas** e a segunda apagou a primeira? (parte do
   estado chega, parte não — o sintoma parece de renderização)
2. É **escrita aninhada** (`rep.value.a.b = x`)? Reatribua o objeto.
3. O gráfico tem `return` cedo por uma **fonte ausente** que nem é a que mudou?
4. O evento é `change` num `<input type="number">`? Ele só dispara no blur.
5. A linha do painel foi **criada depois de um `await`**, e o `change` chegou antes
   dela existir? O handler não achou o que preencher e nada tentou de novo.
6. Algum código mexeu no form sem ligar `tocado`, e o repaint seguinte **desfez**?
7. O FORMATO do valor mudou e o **persistido velho** venceu o `defaultValue`?
8. O `bundle-manager` engoliu o reload com um `ENOENT` e o servidor está com a
   versão antiga em memória?

Depois da 3ª, pare de adivinhar e **prove cada elo separado** por CDP: semeie o
replicant, leia o que o painel gravou, leia o que o gráfico desenhou. O elo que
sobrar é o bug — e costuma não ser o que você suspeitava. (`references/padroes-replicant.md` §10;
atenção ao `?standalone=true` do painel e ao fato de `const` de topo não virar
propriedade de `window`.)

**Cuidado com a sua própria verificação.** Um teste que dispara `.click()` por
script não move o foco como o mouse move — e o bug de `tocado` acima passa
despercebido justamente por isso. Reproduza o gesto inteiro, foco incluído.

**🚨 Verificação vazia PASSA. Conte o que você examinou.** Um auditor que varre a
página procurando defeito e devolve lista vazia diz duas coisas ao mesmo tempo —
"está tudo certo" e "não havia nada para olhar" — e elas são indistinguíveis.
Numa varredura real, uma peça que não desenhou devolveu `[]` e passou como
aprovada. Todo teste desse tipo tem que reportar **quantos elementos entraram na
conta**, e um `examinados: 0` é falha, não sucesso. O mesmo vale para o `grep`
que não acha nada e para o `filter()` que devolve vazio.

**`window.test()` é sobrescrito pelo `change` do replicant.** Ensaiar pelo
console funciona, mas o valor que você acabou de pintar vive até o replicant
sincronizar — e aí a peça redesenha com o estado real (vazio, se ninguém
preencheu) e some com o seu ensaio. O sintoma é medir e achar todos os campos em
branco, sem erro nenhum. Duas saídas: **medir na mesma sequência**, sem ceder o
event loop entre o `test()` e a leitura, ou **escrever no replicant** em vez do
`test()` — que é o caminho de produção e não tem essa janela. Se escrever no
replicant e a peça não reagir, confira que o nome é o mesmo que ela escuta: um
`nodecg.Replicant("NOME_ERRADO")` cria um replicant novo, aceita a escrita e não
avisa nada.

**Duas instâncias do NodeCG mentem.** Subir a segunda sem parar a primeira dá
`EADDRINUSE`, e o que você continua medindo é o servidor VELHO. Confirme que só há
uma antes de acreditar em qualquer resultado.
