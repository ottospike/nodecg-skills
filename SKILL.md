---
name: nodecg
description: >-
  Crie, estilize e anime gráficos de transmissão em HTML, CSS e GSAP para
  NodeCG e browser sources. Use para overlays, lower thirds, fullscreens,
  layout, tipografia, entradas, saídas, trocas de conteúdo, PLAY/OUT e
  áreas seguras. Cobre também dashboards, Replicants e manifesto de bundle.
  Inclui produção de assets a partir de kit de marca, análise de PNG achatado,
  conversão de PSD/PSB em plates e HTML via Photopea, Photoshop ou psd-tools,
  matte de vídeo para spritesheet, WebM com alfa em IN/HOLD/OUT e organização
  de demandas do Google Drive.
  Use também para saídas verticais no OBS, cues e loops de áudio, render no
  vMix, playout CasparCG (AMCP, OSC, camadas, templates, SDI/NDI, canal de
  teste e verificação com o MCP casparcg) e deploy
  do NodeCG em Docker/Coolify, incluindo a persistência de Replicants.
---

# Grafismo de broadcast com NodeCG e browser sources

## Fluxo de trabalho

1. **Componha o quadro.** Use uma área de trabalho transparente na resolução
   da saída. Posicione as peças de acordo com as áreas seguras e o enquadramento
   da câmera. Defina ordem de camadas e confira quais peças precisam conviver
   no mesmo quadro.
2. **Estruture e estilize a peça.** Use HTML para texto e dados. Separe a
   âncora de posição, a camada que se move e o conteúdo. Centralize cor,
   espaçamento, raio, sombra e tipografia em propriedades CSS quando houver
   mais de uma peça com a mesma linguagem visual. Defina até onde textos
   longos podem encolher, quebrar ou truncar. Confira esses limites com fontes
   carregadas e dados de comprimentos diferentes.
3. **Prepare a arte.** Use SVG para vetores e WebP ou PNG com alfa para imagens
   recortadas. Mantenha fundo, máscara e arte em camadas quando cada elemento
   precisar de movimento próprio. Sirva as dependências junto da peça e
   aguarde a decodificação ou o fallback antes de revelar uma imagem dinâmica.
4. **Desenhe os estados visuais.** Defina como a peça aparece fora do ar,
   durante a entrada, em repouso, na troca de conteúdo e na saída. Escolha
   um gesto que combine com a forma da peça e direcione o olhar. Use a
   tabela da [seção de animação](#7-animação-com-gsap) para definir transições
   que funcionam também quando são interrompidas.
5. **Ensaie no quadro final.** Confira contraste sobre fundos claros e
   escuros, leitura no tamanho de exibição e transparência fora do ar.
   Teste PLAY → OUT → PLAY, troca rápida de conteúdo e recarga no ar.
   Na recarga, restaure a aparência correspondente ao estado atual.


## Mapa desta skill

Abra a referência correspondente ao trabalho.

| Quando | Leia |
|---|---|
| Gráfico ou painel novo | [Modelo de gráfico](assets/grafico-modelo.html) e [modelo de painel](assets/painel-modelo.html) |
| Tipos de peça, máquina de estados, texto e contrato de assets | [Famílias de peça](references/familias-de-peca.md) |
| Kit de marca, arte nova, formatos e galeria de motion | [Produção de assets](references/producao-assets.md) |
| PSD/PSB com camadas, plates e reconstrução HTML | [PSD para HTML](references/psd-to-html/README.md); lote com verificação por recomposição em `scripts/psd-plates/` |
| Print ou PNG achatado | [Análise de PNG](references/psd-to-html/png-analysis.md) |
| Vocabulário de peças e recorte de plates | [Tipos de peça](references/psd-to-html/tipos-de-peca.md) |
| Montar KV/fullscreen: pilha vídeo → foto → moldura → plate → texto, foto entre dois vídeos, enquadrar retrato pelo alfa, padronizar catálogo, pior caso de texto | [Montagem de KV](references/montagem-kv.md) |
| Entrada, saída e troca de conteúdo no HTML | [Animação com GSAP](references/animacao-gsap.md) |
| Matte orgânico de tinta, pincel ou dissolve | [Spritesheet de máscara](references/spritesheet-mask-reveal.md) |
| WebM com entrada, hold e saída, com texto sincronizado | [Motion IN/HOLD/OUT](references/motion-in-hold-out.md) |
| WebM/MOV com alfa: ffprobe que esconde o alfa, encode, conferir janela e loop, fps, scripts de ingestão | [Vídeo com alfa](references/video-alfa.md) |
| OBS vertical, áreas seguras, composição e foco | [Overlays verticais](references/obs-vertical.md) |
| Cortes, loops, cues e mix no OBS | [Áudio ao vivo](references/audio-ao-vivo.md) |
| Layout e componentes de painel | [Dashboard](references/dashboard-ui.md) |
| Modelagem de Replicants e verificação por CDP | [Padrões de Replicants](references/padroes-replicant.md) |
| O painel atualiza e o gráfico não acompanha | §4, Como escrever |
| Animação engasga no vMix ou usa vídeo de canvas cheio | [Render no vMix](references/render-no-vmix.md) |
| Controle de vMix ou migração de um bundle antigo do Caspar | [Ponte vMix](references/vmix.md) |
| CasparCG, AMCP, OSC, preview, reconciliação, camadas e templates CG | [Playout no CasparCG](references/casparcg.md) |
| Testar um gráfico no canal de teste do Caspar e verificar com o MCP `casparcg` | [Modo teste do Caspar](references/casparcg.md) §10 e §11 |
| Docker, Coolify, domínio e volumes | [Deploy](references/deploy.md) |
| Demandas ou arquivos do projeto no Google Drive | [Drive para gráficos](references/drive-to-graphics.md) |

---

## 1. Estado, nunca evento

Faça toda comunicação entre dashboard, graphics e extension por replicant,
inclusive PLAY e OUT. Um bundle novo não usa `sendMessage`/`listenFor`.

Mensagem é evento que passa. Se a browser source recarregar depois do disparo
(o vMix reabriu o input, o operador deu F5 no preview), o gráfico volta em
branco. Com estado, ele relê o replicant no boot e volta como estava.

```js
// dashboard
DB_BUG.value.visivel = true;         // PLAY
DB_BUG.value.visivel = false;        // OUT

// graphics
DB_BUG.on("change", (s) => aplicar(!!s && s.visivel === true));
```

Bundles antigos usam `sendMessage`/`listenFor` com pontes `xPlayExt` na
extension. Não copie esse modelo. Ao mexer num bundle assim, converta para
replicant o trecho que você está tocando; se não der, registre o motivo.

Quando parecer que você precisa de `sendMessage`, use estado com um campo a mais
(um `seq` que incrementa, um `atual` que muda).

---

## 2. Onde o replicant é declarado

Declare no painel do dashboard, com `defaultValue`. Painel é arquivo de cliente:
editar e dar F5 basta. Declarar na extension obriga a reiniciar o NodeCG, o que
não é opção no meio de um programa.

Declare na extension só o que precisa de tempo de vida de servidor:

| Motivo | Exemplo |
|---|---|
| O servidor publica o valor | `DB_DEVMODE` (vem do env/cfg) |
| Tem que sobreviver ao painel fechado e a restart | `DB_CONTADOR` (relógio regressivo) |
| A mudança dispara efeito colateral no servidor | `DB_FS` (extension traduz cena → comando vMix) |
| Mais de um arquivo declara, e só alguns passam `defaultValue` | `DB_TIMES`, `DB_PARTIDA` (ver a corrida abaixo) |

O gráfico nunca declara `defaultValue`: `nodecg.Replicant("DB_X")` e pronto.
Quem controla o estado define o formato; o gráfico desenha o que vier e aguenta
`undefined` no primeiro change.

### 🚨 A corrida de declaração (só quebra em instalação nova)

`defaultValue` só vale na criação do replicant. Quem declara primeiro define o
valor; quem declara depois apenas se conecta, e o `defaultValue` dele é ignorado
sem aviso.

Isso quebra quando o replicant é compartilhado. Exemplo: vários arquivos declaram
`DB_TIMES` e só alguns passam `defaultValue` (os leitores declaram sem, como manda
a regra acima). O dashboard carrega cada painel como iframe, em paralelo. Se um
painel leitor chega antes do painel dono, o replicant nasce sem valor e
`DB_TIMES.value` fica `undefined` para sempre.

- **Sintoma:** painel em branco, selects vazios nas peças que dependem dele, nada
  no log (o `pintar()` sai no `if (!v) return`).
- **Por que não aparece no laptop:** o banco local já tem o valor persistido, e a
  corrida não decide nada. O volume de produção nasce vazio, então quebra no
  primeiro deploy.

Regra: se dois ou mais arquivos declaram o mesmo replicant e a peça não funciona
sem valor, declare-o na extension, mesmo sem efeito colateral de servidor. A
extension roda no boot, antes de existir cliente: a criação fica determinística
e os outros declarantes viram leitores.

Verifique com `grep`:

```bash
grep -rn 'Replicant("DB_X"' dashboard/ graphics/ extension/
# mais de um resultado e nem todos com defaultValue = corrida
```

Mexer no `package.json` exige restart completo do NodeCG. Editar HTML de
dashboard ou de graphic só pede hard-refresh do navegador. Valide edição de
extension com `node --check <bundle>/extension/index.js` antes de reiniciar.

---

## 3. Nomes

**Replicants:** `DB_` + nome curto em maiúscula, sem acento: `DB_QUIZ`,
`DB_LTSINGLE`, `DB_VALOR_CHAT`. Um replicant por peça que entra e sai do ar
sozinha. Duas peças que ficam no ar ao mesmo tempo com conteúdos diferentes são
dois replicants (`DB_VALOR` e `DB_VALOR_CHAT`), não um objeto com dois campos.

**Duas peças nunca são um campo `modo`**, mesmo quando compartilham a arte. Um
`modo: "a" | "b"` num gráfico causa dois problemas:

- No ar, o PLAY de um modo acende junto o que já estiver preenchido do outro.
  Num draft os dados chegam antes de a peça entrar, então esse é o caso normal.
- Na operação, um arquivo é um input no vMix. Com um só, não existe cena de A e
  cena de B para cortar entre elas.

Se as duas entram e saem sozinhas, faça dois arquivos e dois replicants, mesmo
que 80% do CSS se repita.

**Arquivos de gráfico:** snake_case, com prefixo pelo tipo de entrada. O prefixo
diz quem põe a peça no ar:

- `lt_*` → **lower third**: entra e sai a cada informação, por animação própria;
  o ar é um campo `visivel` do replicant (`lt_single.html`).
- `fs_*` → **fullscreen**: é uma cena do switcher. O vMix transiciona
  (`PreviewInput` + `Stinger`); o HTML não anima e não tem `visivel`
  (`fs_pergunta.html`, `fs_contador.html`).
- sem prefixo → **peça de canto**: fica no ar por trechos longos e se preenche
  (`bug.html`, `chat.html`, um overlay de partida).

O critério é quem anima, não quanto do quadro a peça ocupa. Uma peça que cobre a
metade de baixo do quadro e entra pela própria timeline é `lt_`, não `fs_`. O
prefixo `fs_` promete que o vMix transiciona; com o prefixo errado, quem for
ligar a peça procura uma cena no switcher que não existe.

Um prefixo pode estar errado por herança (um rename deixou `lt_` numa peça de
canto). Quando prefixo e comportamento divergirem, o cabeçalho do arquivo manda:
ele diz isso na primeira tela e aponta a gramática certa. Não renomeie por conta
própria: o nome é a URL da browser source no vMix.

A anatomia de cada família (máquina de estados, curvas de animação, arte em
vídeo, o que o painel de cada área faz) está em `references/familias-de-peca.md`.

O nome descreve a peça, não a posição dela no roteiro. A numeração de bloco muda
entre ensaio e programa.

**Painéis:** nome do bloco de operação, minúsculo: `quiz.html`,
`lowerthirds.html`, `valores.html`. Agrupe por quando o operador mexe, não por
qual gráfico é.

**Assets:** uma pasta por peça em `<assets>/<categoria>/`, derivada do nome do
arquivo do Photoshop: tudo minúsculo, cada palavra depois da primeira com inicial
maiúscula. Sigla não é exceção.

```
L3_MetaLike.psd    →  <assets>/l3/l3_metaLike/
FS_Contador.psd    →  <assets>/fs/fs_contador/
FS_VS.psd          →  <assets>/fs/fs_vs/
IG_OverlayMain.psd →  <assets>/ig/ig_overlayMain/
```

`<assets>/` é a pasta de assets servida do bundle; o padrão é `graphics/assets/`.
`graphics` é campo declarado do manifesto e a arte de uma peça pertence aos
gráficos. O painel lê pela mesma URL; não há restrição entre os diretórios.

Não confunda com duas pastas que parecem servir e não servem:

- `shared/` é código compartilhado (um módulo que dashboard e gráfico carregam) e
  nem aparece no manifesto.
- `assetCategories` é o upload pelo dashboard, em tempo de operação.

Para servir um diretório fora desse trio, use `nodecg.mount`. Detalhe em
`references/drive-to-graphics.md` §2.

A categoria é a sigla do tipo de peça, minúscula: `l3`, `fs`, `ig`, `bug`. O
significado de cada uma está em `references/psd-to-html/tipos-de-peca.md`.

Derivar o nome do PSD liga o asset à origem: quem recebe um PSD revisado sabe
qual pasta reexportar, e quem abre a pasta sabe qual arquivo pedir. Pastas
antigas com outro nome ficam como estão; a regra vale para pasta nova.

Dentro da pasta, `ASSETS.md` e `assets.json` ficam junto dos PNGs. Arquivo que
não vai ao ar leva prefixo `_` (`_ref_text.png`, `_proof_overlay_3x.png`,
`_plates.json`), para separar runtime de régua de calibração.

Renomear um gráfico = trocar o arquivo, a entrada em `package.json` e a URL da
browser source no vMix. Apagar um gráfico = tirar também a entrada do
`package.json` e o markup/handler morto no dashboard.

---

## 4. Formato do valor

Use sempre objeto, nunca escalar solto: assim dá para acrescentar um campo sem
migrar nada. O campo de ar chama `visivel`:

```js
{ visivel: false, valor: 0 }              // DB_VALOR
{ visivel: false, nome: "", social: "" }  // DB_LTSINGLE
{ atual: null }                           // DB_SELECAO — seleção, não visibilidade
```

### Como escrever

Escrita campo a campo (`rep.value.visivel = true`) só vale para campo de primeiro
nível. Para o resto, reescreva o objeto carregando adiante os campos que não
mudaram. Três regras:

**1. Não escreva aninhado.** `rep.value.placar.a = 2` depende de o proxy profundo
pegar a mutação. Quando ele não pega, o gráfico não redesenha, sem erro nem log.
Reatribua:

```js
rep.value = { ...v, placar: { ...v.placar, a: 2 } };   // sempre notifica
```

**2. Um handler, uma escrita.** No cliente, `rep.value = x` é assíncrono: propõe
ao servidor, e o valor local só muda quando ele devolve. Duas escritas no mesmo
handler leem o mesmo valor velho, e a segunda apaga os campos da primeira.

```js
// ERRADO — a barra não entra no ar, mas o relógio começa a andar
rep.value = { ...rep.value, visivel: true };
irParaFase(0);      // relê (ainda visivel:false) e regrava por cima

// CERTO — funções de estado CALCULAM campos; o handler escreve uma vez
const v = rep.value;
rep.value = { ...v, visivel: true, ...camposDaFase(v, 0) };
```

Sintoma: parte do estado chega e parte não, o que parece bug de renderização.
Se uma função auxiliar escreve replicant, chamá-la é uma escrita. Separe em
`calcularX()` (puro) e `aplicarX()` (escreve).

**3. Carregue adiante o que não mudou.** Exemplo: num contador, esquecer o
`inicial` no PAUSE faz o RESET voltar para o tempo pausado.

### Persistência: dado persiste, ar nunca persiste

`defaultValue` só vale quando não existe valor persistido. Um `visivel: false` no
default de um replicant persistente não protege nada: se o servidor cair com a
peça no ar, ela volta no ar sozinha no boot.

Quando a peça tem dado preparado (que precisa sobreviver) e ar (que não pode),
use dois replicants, divididos por tempo de vida:

```js
const DB_MAPPICKS    = nodecg.Replicant("DB_MAPPICKS",    { defaultValue: { mapas: [...] } });
const DB_MAPPICKS_AR = nodecg.Replicant("DB_MAPPICKS_AR", { defaultValue: { visivel: false }, persistent: false });
```

Um fullscreen nunca pode reaparecer sozinho. Para uma barra de trecho longo,
voltar acesa depois de uma queda pode ser desejado, mas só como decisão
explícita e comentada.

**Não faça replicant tickado.** O relógio guarda um prazo (`fimEm`, epoch ms) e
cada tela calcula o restante. Escrever um replicant por segundo enche o socket,
faz o número pular com jitter e para quando o painel fecha.

**Mudou o formato do valor: apague o persistido com o servidor parado.** O valor
velho vence o `defaultValue` novo, e o campo novo nasce `undefined` sem erro. Com
o NodeCG rodando, ele tem o replicant em memória e regrava a forma antiga no
shutdown. Ordem: parar → `DELETE FROM replicant WHERE namespace=… AND name=…` →
subir.

Os padrões resolvidos, com código (liga/desliga, valor preparado + SETAR, fábrica
para blocos irmãos, relógio, seleção exclusiva, efeito colateral no servidor, dev
mode, migração de formato, verificação por CDP), estão em
`references/padroes-replicant.md`.

---

## 5. Um arquivo por painel, um por gráfico

O HTML, o CSS e o JS da peça ficam no mesmo `.html`. Abrir um arquivo mostra a
peça inteira, e menos arquivos são menos requisições para falhar no boot da
browser source.

O que pode sair do arquivo:

| Sai | Por quê |
|---|---|
| `dashboard/<bundle>.css` | design system dos painéis — trocar uma cor muda o dashboard todo |
| `dashboard/comum.js` | helper usado por 2+ painéis (ex.: `marcarAr`) |
| `dashboard/pessoas.js`, `perguntas.js` | **conteúdo**, editado antes do programa por quem não é dev |
| `graphics/utils/*.js` | utilitário usado por 2+ gráficos — ver abaixo |
| `graphics/utils/fontes.css` | `@font-face` num lugar só |
| `graphics/vendor/gsap.min.js` | biblioteca, versionada junto (ver §7) |

### `utils/` e `shared/` são coisas diferentes

A regra é por quem lê:

| Pasta | Quem lê | Como é referenciada |
|---|---|---|
| `<bundle>/shared/` | dashboard **e** graphics | `/bundles/<b>/shared/x` — absoluta, é rota nativa do NodeCG |
| `<bundle>/graphics/utils/` | **só** os gráficos | `utils/x` — relativa |

Tema, paleta e catálogo de asset servem aos dois lados: vão em `shared/`.
Utilitário de runtime de peça é só dos gráficos: vai em `utils/`. Não crie
`shared/` dentro de `graphics/`: parece a rota nativa e não é.

### O que mora em `utils/`

Estes quatro aparecem em todo bundle de transmissão. Cada um evita um defeito
que só aparece no ar:

| Arquivo | Resolve | O defeito que ele evita |
|---|---|---|
| `fit.js` | escala o `.stage` pro tamanho da saída | peça montada no tamanho da barra, que não cai onde o designer desenhou |
| `devmode.js` | régua e diagnóstico com `?dev=1` | conferir geometria no olho |
| `medida.js` | auto-fit de texto | as armadilhas de medição do §6 — a caixa, o inteiro, a fonte não carregada, o `check()` que mente, a escala do stage |
| `imagem.js` | imagem dinâmica | entrar no ar com buraco, e a requisição anterior sobrescrever a nova |

**Quando promover:** o utilitário nasce dentro da peça e só sobe para `utils/`
quando a segunda peça precisa dele. A segunda peça revela o que varia; subir
antes dá assinatura errada.

**O que não sobe:** geometria e timeline. São daquela arte e ficam inline no
`.html`, mesmo quando 80% do CSS se repete entre duas peças.

**Um utilitário de `utils/` roda em toda peça ao mesmo tempo**: um bug nele
derruba o programa inteiro. Por isso ele nunca rejeita promessa nem lança
exceção: degrada, loga e deixa a peça desenhar. Os comentários dele registram a
medição que justificou cada decisão, para ninguém "simplificar" um laço que
parece estranho.

Regra de bolso: CSS de painel nunca é inline no painel (o design system existe
para isso); CSS de gráfico é sempre inline no gráfico (a geometria é daquela
arte).

Se o mesmo comportamento aparece duas vezes no mesmo arquivo com ids diferentes,
faça uma fábrica e chame duas vezes.

---

## 6. Anatomia do gráfico

Use o [modelo de gráfico](assets/grafico-modelo.html) e confira as invariantes do canvas e do fluxo de estado.

1. `body { background: transparent }` e `.stage` no frame inteiro de transmissão
   (`1920×1080`, ou `1080×1920` no vertical), `overflow: hidden`, com cada plate
   ancorada por `left`/`top` absolutos em coordenada de canvas vinda do PSD.

   Isso vale também para o lower third. Uma barra de 421×106 no canto inferior
   esquerdo fica num stage de 1920×1080, em `left: 157px; top: 805px`. Não monte
   o gráfico do tamanho da barra: a browser source é sempre de frame cheio, a
   coordenada de canvas põe a peça onde o designer desenhou e deixa duas peças
   conviverem no quadro sem recálculo. O `fit.js` assume isso: ele escala o
   stage pela altura do canvas.

   Para outra resolução de saída, escale o stage inteiro
   (`transform: scale(...)`); nunca mexa numa coordenada.
2. **Trava de primeiro estado**: a animação só existe depois do primeiro `change`.
   Sem isso, um refresh da browser source com a peça no ar faz ela re-entrar
   deslizando, no ar.
3. **Trava de on-air**: anime só na transição. PLAY com a peça já no ar não
   re-anima.
4. `utils/fit.js` e `utils/devmode.js`, nessa ordem, por último no body.
5. `window.test(...)` no fim do script, para ensaiar a peça no navegador sem o
   painel. É o que torna a peça verificável por render headless.
6. `<link rel="stylesheet" href="utils/fontes.css" />` no head (arquivo em `graphics/utils/fontes.css`).
7. **Uma fonte de dados ausente nunca derruba a outra.** Quando a peça combina
   dois replicants (o dado e o ar, o draft e o confronto), `combinar()` desenha
   com o que tiver:

   ```js
   function combinar() {
     var d = draftAtual   || {};   // NUNCA `if (!draftAtual) return;`
     var p = partidaAtual || {};
     aplicarDados({ ...d, placar: p.placar || { a: 0, b: 0 } });
   }
   ```

   Não use `return` cedo. Cada replicant é declarado no painel dele, e painéis
   ficam em workspaces diferentes: basta uma aba fechada para uma fonte ficar
   `undefined`, e o guard derruba junto o que a outra trouxe. O sintoma aparece
   longe da causa: "o placar não atualiza" quando o painel de draft está fechado.

   **No painel, cuide também do replicant parcial.** `if (!v) return;` cobre o
   valor ausente, mas deixa passar o objeto que perdeu um campo. A primeira linha
   com `v.a.sigla` lança, o `pintar()` morre ali e nada abaixo é desenhado. Num
   painel de vários blocos, os outros blocos congelam com o conteúdo anterior e
   os botões param de refletir o ar, sem mensagem na tela.

   Desestruture com default:

   ```js
   const v = REP.value;
   if (!v) return;
   const a = v.a || {}, b = v.b || {}, placar = v.placar || { a: 0, b: 0 };
   ```

   Causa típica: uma escrita que lê `.value` antes de o replicant sincronizar.
   Handle recém-criado tem `.value === undefined`, e
   `Object.assign({}, undefined, { x: 1 })` é `{x: 1}`: o resto do estado some
   sem erro. Espere o primeiro `change` antes de escrever a partir do valor atual.

### O `x/y/w/h` da plate não é o tamanho do arquivo

Antes de ancorar uma plate, confira o tamanho do PNG. As duas convenções de
export pedem CSS oposto:

| Export | O `x/y/w/h` do manifesto é | Como ancorar |
|---|---|---|
| **recortado** (o PNG tem o tamanho da arte) | a geometria do arquivo | `left/top/width/height` direto |
| **frame cheio** (o PNG é 1920×1080) | o bbox da arte **dentro** do arquivo | `left:0; top:0; width:1920px; height:1080px` |

Ancorar um PNG de frame cheio no bbox espreme o canvas inteiro naquela caixa (um
bloco de placar pode virar uma tira de 4px). O sintoma parece export errado, não
geometria.

As convenções se misturam quando o export muda de caminho no meio do projeto. Por
isso o manifesto declara a convenção da pasta e o tamanho real de cada arquivo.

### Imagem: preload antes do ar, e fallback sempre

Não use `<img>` cru nem `background-image` direto no CSS para conteúdo. Se a
imagem ainda não decodificou, a barra entra com o slot vazio e a foto aparece de
estalo um instante depois, no ar.

As duas famílias de imagem têm políticas opostas:

| | arte versionada no bundle (plates) | URL que o operador digita (foto, escudo) |
|---|---|---|
| pode faltar? | **não** — se faltou é bug | **sim**, e é normal |
| na falha | `nodecg.log.error` alto: a peça vai ao ar sem arte | placeholder silencioso, sem susto |
| quando carregar | no **boot**, antes do primeiro `change` | a cada troca de conteúdo |

**Use `decode()`, não `onload`.** Ele promete que a imagem está decodificada e
pronta para pintar, e rejeita quando o arquivo não existe (`EncodingError`), o
que já é o caminho de erro:

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

Mantenha o token `__req`. Quando o operador troca de conteúdo duas vezes em
segundos, a imagem anterior, mais lenta, chega depois e sobrescreve a nova. O
sintoma é a peça mostrando a pessoa errada, sem erro em lugar nenhum.

**A entrada espera a imagem:** anime só depois que as imagens do conteúdo
resolverem.

```js
async function aplicar(estado) {
  render(estado);                                   // texto entra na hora
  await Promise.all(estado.fotos.map((u, i) => pintarImagem(slots[i], u, PLACEHOLDER)));
  if (querVisivel && !noAr) entrar();               // só agora anima
}
```

As plates seguem a mesma regra, no boot: pré-carregue todas antes de assinar o
replicant, junto com as faces (§9). Plate que falha é erro alto, porque é arte
versionada:

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

Com tudo em cache, o `background-image` do CSS pinta no primeiro quadro e a peça
nunca aparece incompleta.

### Quando a arte é vídeo em loop

Se a arte vier como webm com alfa em vez de PNG, use a mesma convenção das
plates: canvas cheio 1920×1080, com a peça já no lugar. O elemento vai em 0,0.

Três coisas mudam:

- **A entrada espera o vídeo estar rodando.** Espere `canplaythrough` no boot
  (não `loadeddata`, que só garante o primeiro frame) e o `play()` antes de
  animar. Sem isso a peça entra com o frame 0 congelado e o loop só começa depois
  que ela para, o que no ar parece engasgo.
- **Fora do ar, pause.** Várias peças decodificando VP9 com alfa a 1920×1080 ao
  mesmo tempo gastam CPU da máquina de transmissão sem nada na tela. Pause no fim
  da saída; pausar no começo congela a arte à vista.
- **Recorte o elemento com `clip-path` pela caixa medida da arte.** É o maior
  ganho de performance disponível; sem ele a peça repinta o quadro inteiro 24×/s
  parada no ar. Calcule a caixa pela união do alfa em todos os frames do loop,
  nunca por amostragem: a arte flutua e a amostragem perde o extremo. Ver
  `references/render-no-vmix.md`.

Em geral o webm substitui uma das plates e o resto continua PNG (peça híbrida).
Como medir antes de portar, o que a troca perde (animação por camada, campo vivo
que virou queimado) e as quatro armadilhas do `<video>` estão em
`references/familias-de-peca.md` §8.

### Auto-fit de texto

Texto dentro de plate de largura fixa precisa de auto-fit: reduza o corpo até
caber, com piso. Se estourar o piso, `nodecg.log.warn` e deixe passar: cortar um
nome no meio é pior que passar 2px da arte.

A medição tem armadilhas que passam em teste. Use esta tabela:

| Medindo com | O que acontece |
|---|---|
| `getBoundingClientRect().width` | devolve a **caixa**. Com largura fixa é sempre o mesmo número: o laço nunca reduz e o texto vaza em silêncio |
| `scrollWidth` contra uma constante subpixel | é `max(conteúdo, caixa)` **arredondado pra inteiro**: numa caixa de 327,2 devolve 328 até vazio → "sempre estourando", e o laço corre até o piso. A peça fica **sempre no menor corpo** |
| `scrollWidth > clientWidth` | **correto** (inteiro contra inteiro), e é o que usar quando não precisa de fração |
| **`Range` sobre texto com `text-transform`** | mede o **texto-fonte**, antes da transformação. Ver o bloco abaixo |
| `document.fonts.ready` antes de medir | resolve **na hora** quando o texto está vazio — que é como um gráfico nasce (o estado vem do replicant depois). Mede na fallback, escolhe corpo grande, a face real entra e vaza |
| `document.fonts.check(face)` | devolve **`true` pra fonte que não existe**: a pergunta dele é "dá pra renderizar?", e a fallback sempre dá |

### 🚨 `Range` + `text-transform: uppercase` mede até 18% a menos

`Range.selectNodeContents()` + `getClientRects()` mede os glifos do conteúdo do
nó de texto, não os pintados. Se a caixa-alta vem do CSS e o DOM está em caixa
mista, ele mede a string minúscula, mais estreita. Exemplo medido (nome de time
em caixa mista, Akira Expanded):

```
nome de 14 caracteres a 53,69px, caixa de 657px
  Range.getClientRects() ....... 538,5px    ← o que o Range mede
  canvas.measureText(UPPER) .... 654,2px    ← o que o Chrome pinta
  scrollWidth .................. concorda com o canvas
```

O erro (115px) é sempre para baixo: o texto que deveria reprovar passa. Num
auditor de layout isso não gera falso alarme, gera falso silêncio.

Duas saídas:

- medir com `canvas.measureText`, aplicando a transformação você mesmo
  (`cs.textTransform === "uppercase" ? txt.toUpperCase() : txt`, com `c.font`
  montado de `fontStyle/fontWeight/fontSize/fontFamily`);
- ou gravar o texto já em caixa alta no JS (`el.textContent =
  nome.toUpperCase()`) e deixar o `text-transform` como redundância. Aí DOM e
  pintado coincidem e o `Range` volta a ser confiável.

A maioria das peças já usa a segunda, então a armadilha só aparece onde o CSS
sobe a caixa sozinho. Antes de confiar num `Range`, confirme que o DOM está na
caixa final: `grep` de `text-transform` cruzado com `toUpperCase()` separa os
dois casos.

O que funciona:

- `Range` sobre os filhos (`selectNodeContents`) para medir com fração, desde que
  o DOM esteja na caixa final; senão, canvas.
- `status === "loaded"` da FontFace em `document.fonts` para saber se a face
  existe de verdade.
- `rel=preload as=font crossorigin` no `<head>` para encurtar a janela.
- Refit reagendado por promessa, não por evento: `loadingdone` dispara antes do
  conteúdo chegar e não há segunda chance.

**Teste a carga fria; é ela que vai ao ar.** Um teste que espera
`document.fonts.ready` antes de escrever o texto mede sempre com a fonte certa e
sempre passa. Render headless com `--virtual-time-budget` não serve para isso:
ele gasta o orçamento em tempo virtual enquanto o fetch real está em voo e acusa
falha com o código correto.

### A caixa do PSD pode ser maior que o vão real

O auto-fit mede contra a caixa que recebeu. Se essa caixa passa por baixo de
outra plate, ele conclui que cabe e o texto vai ao ar coberto, sem erro, sem log
e com a tela de dev dizendo que está tudo certo.

Exemplo: a caixa do nome veio do placeholder do PSD (`TEAM NAME`, 224px), curto
demais para chegar à borda. No render, a placa ia de x=700 a 1220, mas os slots
vizinhos ocupavam 596..746 e 1174..1324 e pintavam por cima dela; o vão livre
era 746..1174. Cada caixa de 224px entrava 14px sob um slot, e um nome longo
perdia a última letra atrás da arte vizinha.

**Derive o vão do que está pintado, não do placeholder:**

1. Meça o bbox das plates vizinhas na altura da linha de texto.
2. Use a menor distância até o primeiro obstáculo.
3. Documente o número no código, por exemplo
   `nomeA = 2 × (790 − 461,29) = 657,42 (aperta a estrela)`.

Para auditar, pergunte "o que está pintado embaixo das pontas do texto?", não "o
texto passou da caixa CSS?". Use `document.elementsFromPoint` nas extremidades:
se só houver stage e body, o texto está no vazio; se houver uma plate que vem
depois na ordem de pilha, ele está coberto.

### Palavra única não quebra; não use `overflow-wrap: anywhere`

Nome com espaço quebra em duas linhas sozinho. Palavra única não tem onde
quebrar, então só o corpo cede, e os dois lados da mesma placa acabam com corpos
muito diferentes (exemplo: 19,4px contra 28,9px), o que parece quebrado.

Não resolva com `overflow-wrap: anywhere`. O auto-fit começa no corpo máximo e
aceita a primeira medida que cabe; com quebra em qualquer ponto, uma palavra como
`CAMPEOES` parte em `CAMPE/OES` já no corpo cheio, passa no teste e sai errada no
ar.

Use a maiúscula interna como ponto de quebra: insira `U+200B` (zero-width space)
em `[a-z0-9][A-Z]`, e o navegador só quebra ali quando precisa:

```js
function comQuebras(nome) {
  return String(nome == null ? "" : nome)
    .replace(/([a-z0-9])([A-Z])/g, "$1​$2")
    .toUpperCase();   // DEPOIS: toUpperCase() destrói a caixa que marca o ponto
}
```

Suba a caixa depois da inserção, senão a informação se perde. Tire o `U+200B` de
qualquer string mostrada na tela de dev ou comparada com `===`.

### Cubra a franja da moldura, não só o miolo

Ao encaixar uma imagem num frame recortado, o miolo branco puro não é o limite:
há uma franja de antialiasing de 1px que o teste de cor não pega. Exemplo medido
num slot de 150×150: miolo branco em 4..145, franja em x=3 (195,195,195) e x=146
(120,120,120).

- Encaixar em `4/142` deixa a franja da esquerda exposta: um fio claro vertical em
  cada slot.
- Cobrir só um lado (`3` + 143) resolve metade.
- Correto: 3..146 nos quatro lados (`left/top: 3`, `144×144`). Perde-se 1px de
  meia-tinta da curva; o contorno mantém os píxeis chapados.

Meça a franja em vez de confiar no limiar: `>245` acha o miolo, `>200` já pega
parte da franja, e a diferença entre os dois é o fio que aparece no ar.

Implementação de referência: `graphics/utils/medida.js`.

---

## 7. Animação com GSAP

Escolha o movimento a partir da geometria. Um slide preserva a forma da peça.
Uma máscara revela a arte sem deformar o texto. Uma gaveta mantém a borda
ancorada enquanto o corpo se move sob recorte. Defina a origem dos movimentos
na borda ou no elemento de onde a peça parece sair.

| Fase | Comportamento |
|---|---|
| Entrada | Prepare texto e arte na posição final de layout. Posicione os elementos animados no estado inicial, revele a camada principal e dê sequência aos detalhes. |
| Repouso | Mantenha o texto e os dados legíveis. Efeitos contínuos ficam em camadas decorativas e respeitam a configuração de movimento reduzido. |
| Troca | Preserve a caixa e a âncora. Faça a substituição quando a máscara estiver fechada ou quando a nova imagem estiver decodificada. |
| Saída | Comece a partir do quadro visível, inclusive durante a entrada. Termine com a peça transparente e pare os loops decorativos. |
| Reentrada | Cancele a timeline anterior e seus callbacks. Restaure o estado inicial antes de tocar uma nova entrada completa. |

Use `transform` e `opacity` para deslocamentos e fades. Use a geometria
de layout para posicionar e dimensionar a peça, e aplique máscaras à menor
camada que precisa do recorte. Confira recortes e efeitos no motor de
exibição quando ocuparem uma parte grande do quadro.

**Use GSAP como ferramenta de animação padrão.** Transição CSS resolve um slide
de dois estados e pode ficar onde já existe. Timeline, `stagger`, `clip-path`
animado ou troca de conteúdo no meio do movimento vão de GSAP; em CSS isso vira
uma pilha de `setTimeout` que dessincroniza.

**Vendorize local, nunca CDN:** `graphics/vendor/gsap.min.js`, carregado antes
do script da peça. A máquina de transmissão pode estar sem internet, e com o CDN
fora do ar o gráfico entra sem animação ou nem aparece.

```html
<script src="vendor/gsap.min.js"></script>
```

Forma canônica de uma peça animada:

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

Armadilhas:

- **Replay-safety.** Se a saída não rodou (browser source recarregada, OUT que
  nunca chegou), a segunda entrada começa do estado final e não anima. No topo da
  timeline de entrada, faça `gsap.set(...)` de cada filho animado de volta ao
  início; não confie na saída ter limpado.
- **Flash no boot.** O container nasce `opacity: 0`; a entrada faz
  `gsap.set(opacity:1)` antes de revelar, e a saída termina em
  `onComplete: () => gsap.set(el, {opacity: 0})`.
- **Troca de conteúdo no meio do movimento** (barn-door, flip): troque só o
  `.textContent` dos spans num layout fixo, não o `innerHTML` do bloco. Recriar
  um `<img>` a cada tique pisca no ar.
- **Animação lenta demais parece quebrada.** Exemplo: um rolo de créditos de 60s
  que começa atrás da borda mascarada leva ~13s até o primeiro texto aparecer
  inteiro, e o relato é "dei play e não apareceu nada". Antes de depurar, calcule
  a velocidade (px/s) e quanto tempo o primeiro elemento leva para cruzar a
  máscara. Se a peça só aparece depois de 10s, o problema é a duração.

Os padrões prontos (wipe diagonal, reveal vertical com stagger, barn-door, flip,
pushup) estão em `references/animacao-gsap.md`.

Para transição com matte orgânico de vídeo (tinta, pincel, dissolve), não use
`clip-path` nem gradiente: veja `references/spritesheet-mask-reveal.md`.

### Lisa no navegador e com trancos no vMix

Se a animação engasga só no vMix, em especial na saída, não procure defeito na
timeline. O browser source do vMix é CEF em off-screen rendering, sem
compositing por GPU: a página é rasterizada para um bitmap em memória de
sistema, e o custo é a área repintada por quadro, não a propriedade animada.

Duas consequências:

- **Vídeo de canvas cheio precisa de `clip-path`.** Um `<video>` de 1920×1080 em
  loop marca o quadro inteiro como sujo a cada frame (2,07 Mpx, 24×/s, com a peça
  parada). Recortar pela caixa medida da arte reduz isso entre 9× e 67×.
- **`will-change` num elemento de 1920×1080 piora** (+1 camada de quadro cheio,
  e desfaz o ganho do recorte). Promova o que se move só se a caixa dele for
  pequena.

Números e método de medição em `references/render-no-vmix.md`.

---

## 8. Gramática dos controles do dashboard

Vocabulário completo de classes em `references/dashboard-ui.md`; template em
`assets/painel-modelo.html`.

Todo bloco tem o mesmo layout, para o operador aprender um bloco e operar todos:

```
.sechd        título à esquerda + selo .onair à direita
.campo        rótulo + input/select + SETAR   (opcional)
.barra        PLAY | OUT
.status       uma linha, só quando diz algo que os botões não dizem
.sechd.sep    começa o próximo bloco
```

Regras:

- **Digitar não vai ao ar.** Use campo + `SETAR` explícito, com `SETAR`
  desabilitado enquanto o campo bate com o que está no ar. O operador prepara o
  próximo valor com o atual no ar.
- **Botão desabilitado é informação.** PLAY apagado = já está no ar. OUT apagado
  = não há nada no ar.
- **Não repita o que já está dito.** Se o botão aceso já responde "o que está no
  ar?", não escreva `.status` embaixo.
- **O selo só diz o que o painel sabe.** Se quem manda no ar é o vMix, "NO AR"
  seria falso. Use: sem selo, ou um selo **PEDIDO** quando o painel disparou a
  cena. Não invente um terceiro estado. Com CasparCG o painel pode saber: o OSC
  diz o que cada camada toca, e PEDIDO e NO AR viram dois selos válidos
  (`references/casparcg.md` §7).
- **Uma cena, um botão.** Se a mesma cena aparece numa grade e num painel
  próprio, o operador aperta a errada. Tire da grade o que ganhou painel, com a
  lista num arquivo compartilhado. Se uma cena precisa de dois efeitos (trocar no
  switcher e rodar a peça), o botão faz os dois.
- **Nunca sobrescreva campo em foco nem campo com trabalho não salvo.** Foco
  sozinho não basta: o operador tira o foco ao clicar em qualquer lugar. Ver
  *As armadilhas do formulário que sincroniza*, abaixo.
- **Duas alturas, escolhidas pelo vizinho:** `--h-ctl` para o que divide linha
  com um input, `--h-tecla` para tecla isolada. Alargar um botão baixo não o
  torna alvo.
- Controle sem asset correspondente fica desabilitado com `title`, não oculto:
  `<button disabled title="Sem asset no vMix">`. Ocultar esconde a lacuna.
- A saída de emergência fica sempre clicável (o RESET do contador).
- **Conteúdo que não muda durante o programa mora no gráfico**, não num campo: a
  hashtag do canal, a lista de créditos, a duração de um rolo. Campo editável ao
  vivo para algo que ninguém muda ao vivo só cria chance de erro.

**Resolva imagem por nome, não por URL.** O painel pede o nome (do time, do
caster, do jogador) e um manifesto por pasta resolve o arquivo:

- **Sem arquivo declarado no manifesto, o resolvedor devolve `null`.** Não derive
  `slug + ".png"`: toda entrada pareceria ter imagem, e a peça tomaria 404 no ar.
  Com `null` dá para cadastrar alguém antes de a arte chegar, e o painel avisa
  qual falta (`⚠ sem foto <NOME>`, não "1 sem foto").
- **Manifesto ausente não derruba os outros.** Cada fetch tem `.catch`; sem isso
  uma pasta vazia rejeita o `Promise.all` e o painel perde selects que não têm
  relação com aquela pasta.
- **Não ponha fallback dentro do resolvedor.** Um resolvedor que, sem o campo
  pedido, cai no campo principal (`foto` → `png`) nunca devolve `null`, e o
  `!BS.fotoX(...)` do painel fica sempre falso: o aviso "⚠ sem foto" nunca
  dispara. O mesmo fallback ainda põe um escudo quadrado esticado no slot de uma
  figura de corpo inteiro. Campo secundário tem resolvedor próprio, sem fallback;
  a peça escolhe o degrau seguinte explicitamente.

### O resolvedor diz a verdade; a peça decide o que desenhar

Não devolva o genérico (silhueta, placeholder, "sem foto") do resolvedor. É o
mesmo defeito acima: todo nome parece ter arte, o painel não avisa, e a falta só
aparece como silhueta no ar.

Divisão:

- O resolvedor responde "existe arte desta pessoa?" e devolve `null` quando não.
- A peça responde "o que desenho quando não existe?", passando o genérico como
  `fallback` do pintor de imagem. Um slot sem nick não leva silhueta (ela
  inventaria um jogador); um slot com nick e sem foto leva.

O genérico entra no manifesto como chave de topo (fora de `itens`), resolvido por
função separada, nunca indexado pelo nome.

**Linha criada depois de um `await` precisa reaplicar o estado.** O `change` do
replicant chega antes de o DOM existir: o handler não acha o que preencher e nada
tenta de novo. Quem monta linha dentro de um `.then` chama o repaint no fim;
senão o painel mostra branco e o SETAR grava o branco por cima do que está no ar.

### As armadilhas do formulário que sincroniza

Todo painel de "preparar valor" tem o mesmo miolo: `lerForm()` lê a tela,
`doEstado()` lê o replicant, `difere()` compara, e `pintar()` sincroniza o form
quando o operador não está mexendo. Nenhuma das armadilhas abaixo aparece na
leitura do código nem no `node --check`; só com o dashboard aberto e dado
guardado no replicant.

**1. `!difere()` não significa "o operador não mexeu".** Este guard está errado:

```js
if (!emFoco() && !difere()) { /* popula o form */ }   // ERRADO
```

Na primeira pintura o replicant é `undefined`, o form vazio bate com o estado
vazio, e ele popula vazio. Quando o valor real chega, `difere()` vira `true` e o
form nunca mais carrega. O painel mostra tudo em branco com dado guardado atrás,
diz "pendente", e o SETAR apaga o que estava lá.

Separe "o operador está digitando" de "o form ainda não carregou" com uma flag,
marcada no `input` e limpa no SETAR:

```js
let tocado = false;
el.addEventListener("input", () => { tocado = true; pintar(); });
// ...
if (!emFoco() && !tocado) { /* popula */ }
```

Isso também faz os botões "Puxar do…", que escrevem o replicant direto, aparecerem
no form.

**2. `JSON.stringify` depende da ordem das chaves.** `lerForm()` monta o objeto
na ordem da tela; `doEstado()`, na ordem do replicant. Conteúdo idêntico, string
diferente, `difere()` sempre `true`: o "pendente" nunca sai e o SETAR nunca
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

**3. Sincronize o form antes de calcular botão e status.** `difere()` lê o DOM.
Se o estado do SETAR for calculado no topo do `pintar()`, ele lê o form velho
(vazio na primeira pintura) e nasce habilitado sobre dado que já está no ar. Um
clique ali regrava o que o painel nem mostrou.

**4. Quem preenche o form no lugar do operador também liga `tocado`.** Um botão
"Limpar" que zera os campos e chama `pintar()` sem marcar a flag cai no ramo de
sincronização e desfaz o que acabou de fazer. O guard de foco não ajuda: o clique
leva o foco para o botão, então `emFoco()` é `false`.

```js
limparBt.addEventListener("click", () => {
  campos().forEach((el) => (el.value = ""));
  tocado = true;                 // ← sem isto, o pintar() abaixo repovoa tudo
  pintar();
});
```

Sintomas: "o botão não faz nada" e "apaguei e o SETAR não retira". Vale para todo
preenchimento programático: "Limpar", "Puxar de…", autocompletar, importar
roteiro.

**Como verificar as quatro:** abra o painel com o replicant já preenchido e
confira que o form carregou, que o "pendente" some e que o SETAR está
desabilitado.

- Use `?standalone=true`. A URL solta do painel não tem `nodecg`: o painel morre
  no primeiro `Replicant()` com HTTP 200 e CSS aplicado, o que engana. A rota
  standalone sobe com a API e permite dirigir o painel por CDP
  (`references/padroes-replicant.md` §10).
- Reproduza o gesto inteiro, foco incluído. `.click()` por script não move o foco
  como o mouse; por isso a armadilha 4 passa num teste automatizado que parece
  correto.

No `package.json`, registre o painel com `width` em colunas e explique a escolha
num campo `_width` ao lado, para ninguém desfazer sem saber:

```json
{ "name": "valores", "title": "Valores", "file": "valores.html",
  "_width": "3 e não 4: são duas linhas de campo + PLAY/OUT; a 3 ele fecha como quarta coluna.",
  "width": 3, "headerColor": "#0F0F23" }   // cor de fundo da arte do projeto
```

Todo gráfico também entra em `nodecg.graphics` com `width`/`height` iguais ao
tamanho da arte.

**Numere os workspaces.** O NodeCG ordena as abas alfabeticamente; `1. FULLSCREEN`,
`2. LOWERTHIRDS`, `3. INGAME/DRAFT` as põem na ordem de uso do programa. Dois
painéis que se alimentam um do outro (o draft que lê o time escolhido no
confronto) ficam na mesma aba: trocar de aba no meio de um draft causa erro de
operação.

O workspace `main` não pode ser renomeado. A única forma de não ver essa aba é
nenhum painel ficar sem `workspace`; deixe-a vazia de propósito e comente isso.

---

## 9. Fontes

Um `graphics/utils/fontes.css`, linkado por todo gráfico. Arquivos em
`graphics/fonts/<Familia>/`.

**Cada corte é uma face real com o peso declarado; nunca simule.**
`font-weight: 600` carrega o arquivo SemiBold, não engorda o Medium;
`font-style: italic` casa com a face oblíqua declarada, sem sintetizar slant sobre
glifos já oblíquos. Peso e itálico sintéticos mudam a largura dos glifos e o
layout deixa de bater com o mockup.

Use `font-display: block`, não `swap`. Os arquivos são locais e carregam em
milissegundos; `block` esconde o texto nesse intervalo, enquanto `swap` mostra a
fallback e troca depois, um flash de tipografia errada no ar.

Armadilhas de arquivo:

- **Fonte instalada no SO não existe para a browser source.** Copie o `.otf` para
  dentro do bundle e declare em `@font-face`: a máquina que vai ao ar não é a sua.
- **Nome de arquivo com espaço não carrega pela URL do NodeCG.** Renomeie para
  `SemEspaco.otf` e ajuste o `src`.

---

## 10. Extension e a ponte vMix

Mantenha a extension fina. Ela faz três coisas: publica o dev mode, declara os
replicants que precisam de vida de servidor e traduz cena → comando HTTP para o
switcher. O resto fica nos painéis.

Ao escutar `change` para disparar efeito colateral, ignore a primeira emissão:
ela é o estado inicial, não uma ordem do operador.

```js
let primeira = true;
DB_FS.on("change", (novo) => {
  if (primeira) { primeira = false; return; }
  // ...
});
```

Modelo de ar: **o switcher transiciona o fullscreen, não o HTML.** Cada cena é um
input montado no vMix (o PNG de frame cheio e, por cima, a browser source
transparente só com o campo que muda), e a troca é `PreviewInput` + `Stinger`.
Nenhum HTML anima entrada de fullscreen. Lower third é o oposto: a browser source
fica sempre carregada e o HTML anima entrada e saída.

Integração externa nunca derruba a extension: sempre `try/catch` + `nodecg.log`,
e um flag `enabled` para o painel funcionar inteiro numa máquina sem o software.
Nomes que precisam bater letra por letra com outro sistema (inputs do vMix, com
acento e espaço) vão em `cfg/<bundle>.json`, não no código.

Detalhes da ponte (helpers HTTP, `Restart`+`Play` para mídia, canais de overlay,
migração CasparCG→vMix) em `references/vmix.md`.

**Com CasparCG no lugar do vMix, a extension faz o papel do switcher.** O Caspar
só executa o que um cliente manda por TCP (AMCP, porta 5250). O modelo de ar não
muda (o painel grava replicant, a extension traduz), mas a tradução vira um mapa
de camadas, a cena entra num lote atômico (fundo + HTML no mesmo quadro), e o
estado real volta por OSC, o que permite um selo NO AR correto em fullscreen.
Cliente AMCP e leitor OSC prontos em `references/casparcg.md`.

### O bundle só lê APIs de terceiros

Quando o dado vem de um serviço que não é deste bundle (servidor de stats,
placar, API de torneio):

> **Leia. Nunca configure.** Se o bundle só funciona depois de gravar algo no
> outro sistema, a rota está errada.

Essas APIs costumam ter dois tipos de rota, parecidos:

| Rota | O que faz | Serve? |
|---|---|---|
| `GET /stats?channels=a,b` | responde sobre o que **você passou na chamada** | **sim** |
| `GET /chat/<plat>/<canal>` | stream do que **você pediu no path** | **sim** |
| `GET /api/stats` | responde sobre o que **o painel de lá tem ligado** | não |
| `POST /api/channels` | **edita** o painel de lá | nunca |

A rota que aceita os alvos na própria chamada é a de consumidor. A que não aceita
serve ao painel dela.

O painel do outro sistema costuma alimentar outros overlays no ar. Ligar um canal
lá muda o número do overlay dos outros, e o seu bundle passa a depender de um
estado que qualquer um pode mudar. Se alguém desliga o canal, a sua peça zera no
meio do programa, sem log.

Faça assim:

1. Guarde a lista de alvos como estado do bundle: um replicant na extension,
   editado num painel do próprio dashboard.
2. Mande essa lista em cada chamada. O bundle sobe em qualquer instalação sem
   preparo do outro lado.
3. Antes da primeira linha de integração, leia a documentação inteira da API
   (`/docs.json`, `/openapi.json`, a página de docs) e liste as rotas de leitura
   sob demanda. A rota errada não dá erro; dá um bundle que só funciona na sua
   máquina.
4. Se gravou algo num serviço de terceiro para testar, desfaça e confira o estado
   final contra o anterior. Informe o que mudou e o que não deu para restaurar.

---

## 11. Como comentar

Comente bastante; é convenção destes bundles. Cada arquivo abre com um cabeçalho
dizendo o que a peça é e o que não é. No código, comente o porquê, em especial
onde o código parece errado:

- por que o número é esse (de onde veio a medida, qual restrição da arte)
- qual alternativa foi tentada e por que foi descartada
- o que quebra se alguém "simplificar" aquilo
- onde mais está o mesmo número ("o mesmo teto está em `fs_contador.html` — se
  mudar aqui, mude lá")

Escreva em português, na voz do resto do bundle: direta, sem adjetivo sobrando,
explicando o efeito no ar.

---

## 12. A tela de dev

Todo gráfico carrega um `<div id="dev">` que só aparece com `?dev=1` (o
`devmode.js` põe a classe `.dev` no stage). Nunca vai ao ar, então pode ser
detalhado.

Ao vivo não há console: a peça está numa browser source dentro do vMix, e o
operador só consegue relatar "não atualizou". A tela de dev transforma isso em
diagnóstico numa olhada.

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

Regras:

- **Mostre o que foi desenhado, não o que chegou no estado.** `placar: 2-0` lido
  do `textContent` que a peça escreveu responde "o painel mandou e a peça
  pintou?". Ecoar o replicant só prova que o socket funciona.
- **Uma linha por pergunta que se faz ao vivo:** `no ar`, quem está no relógio,
  quantos segundos faltam, quantos assets faltaram. Tire campo que nunca
  respondeu nada.
- **Liste por nome os assets que faltaram.** É o defeito mais comum e o mais
  invisível: sem isso, um retrato ausente é só um buraco no layout.
- **Atualize junto com o desenho:** `pintarDiag()` no fim de `aplicarDados()` e
  de cada transição de ar. Tela de dev desatualizada engana.
- **Ao remover um estado, remova a linha dele** (ou troque por outra que importe
  mais). Um campo órfão fica mostrando um valor congelado.

No painel, o `.status` de um bloco é a tela de dev do operador, com a regra
inversa: só escreva o que os botões não dizem.

---

## Subir o NodeCG: `start` e `dev`

Dois scripts; a diferença é o dev mode:

```json
"start": "node index.js",
"dev":   "node --watch-path=bundles/<bundle>/extension --watch-path=cfg dev.cjs",
"dev:sem-watch": "node dev.cjs"
```

`dev.cjs` é um launcher de duas linhas: `process.env.NODECG_DEV = "1"` e depois
`require("./index.js")`. Não use `NODECG_DEV=1 node index.js` no script: é
sintaxe de shell POSIX, e no `cmd.exe` não define a variável, então o NodeCG sobe
com o dev mode desligado sem avisar. O launcher em Node funciona no cmd, no
PowerShell e no bash, sem `cross-env`.

**Não use nodemon** se o caminho tiver `[colchetes]`. O chokidar trata `[...]`
como classe de caracteres de glob, o padrão não casa com nada, e o nodemon
anuncia `watching path(s): bundles\*\extension` e nunca reinicia (no mesmo teste:
0 restarts com nodemon, 3 com `--watch-path`). O `--watch-path` usa `fs.watch`,
sem glob.

**Observe só o que exige restart de servidor:** `extension/` e `cfg/`.
`dashboard/` e `graphics/` ficam de fora (ver §2: HTML só pede hard-refresh). Um
watch que reinicia o servidor a cada ajuste de CSS derruba todas as browser
sources abertas e pode tirar um gráfico do ar durante um ensaio. Bundle novo =
mais um `--watch-path`; o flag não aceita glob, e apontar para `bundles` inteiro
incluiria a pasta de assets.

**`ENOENT ... access 'graphics/<peça>.html'` durante uma edição é ruído.** O
`bundle-manager` do NodeCG tem watcher próprio (independente do `--watch-path`):
ao ver mudança, espera um instante e re-parseia o bundle, fazendo `accessSync` em
cada gráfico do `package.json`. Se isso cair no milissegundo em que o editor
substitui o arquivo, o `access` falha:

```
warn: [bundle-manager] Unable to handle the bundle "<bundle>" change:
Error: ENOENT: no such file or directory, access '...\graphics\draft.html'
    at Timeout._onTimeout (...bootstrap.js:2446:9)
```

- O `Timeout._onTimeout` no stack identifica o caso: é o debounce do watcher, não
  um require do seu código.
- Confira que o arquivo existe e fecha (`</html>`).
- Aquele reload foi descartado e o servidor seguiu com a versão anterior em
  memória. Reinicie para valer o que você escreveu.

### O que o dev mode liga

`DB_DEVMODE` é booleano puro, publicado pela extension, `persistent: false` (se
persistisse, a primeira peça a entrar no ar depois de um restart entraria com a
régua por cima). O `utils/devmode.js` liga três coisas:

1. **Fundo `#3C3C3C`** no body. Transparente no navegador é indistinguível de "a
   peça não carregou". Com o cinza dá para ver a silhueta, conferir o alfa das
   plates e notar o que desenha fora do lugar. Cinza médio: sobre branco o
   contorno preto some, sobre preto somem as sombras. Guarde o fundo original e
   devolva ao desligar; fundo cinza esquecido no ar cobre o programa.
2. **Classe `.dev` no `.stage`**, o gancho para cada peça mostrar o próprio
   diagnóstico (`.stage.dev #dev { display: block }`): texto medido, corpo após
   auto-fit, se estourou o piso, qual imagem não resolveu.
3. **Régua:** contorno do canvas, linha de centro em `x=960` e grade de 120px.

Para ensaiar uma peça isolada sem NodeCG rodando, `?dev=1` na URL do gráfico
vence tudo.

### E em produção

`start` e `dev` sobem a instalação na máquina de quem edita. Para pôr a mesma
instalação num servidor (imagem Docker, volume para o banco de replicants,
domínio, login), veja `references/deploy.md`.

## Ambiente Windows

Se o caminho do projeto tiver `[colchetes]`, o PowerShell e o chokidar o tratam
como glob. Use o Bash tool, `cmd /c mklink /J` para junções, `node -e` para
leituras e `Test-Path -LiteralPath`; evite `New-Item -Path` com caminho entre
colchetes.

**Nunca crie junção dentro de `bundles/`.** O NodeCG trata toda pasta ali como
bundle e exige `package.json`; qualquer outra coisa derruba o servidor no boot com
`ENOENT: ...\<pasta>\package.json`. Pastas com ponto (`.claude`) ele pula. Junção
de notas ou docs vai na raiz do projeto, fora de `nodecg/`. Para remover junção
sem apagar o alvo: `cmd /c rmdir` ou `[System.IO.Directory]::Delete($p, $false)`.
`Remove-Item -Recurse` do PS 5.1 pode seguir o link e apagar o conteúdo real.

**Asset fora dos três diretórios servidos não existe por HTTP.** O NodeCG serve só
`dashboard/`, `graphics/` e `shared/` de um bundle; uma pasta `assets/` na raiz do
bundle dá 404 na browser source. Para não duplicar arquivo, crie a junção
`shared/assets` → `../assets`. Funciona porque o `isChildPath` do NodeCG compara
string no caminho não resolvido e o `res.sendFile` segue o link no filesystem. A
junção não sobrevive a copiar/zipar o bundle: recrie na máquina nova.

Dimensão real de um PNG sem abrir nada:

```bash
node -e "const b=require('fs').readFileSync('x.png');console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))"
```

---

## Checklists

**Gráfico novo**
- [ ] nome com prefixo certo (`lt_` / `fs_` / cru) e registrado em `nodecg.graphics`
- [ ] `background: transparent`, sem elemento de debug visível
- [ ] `.stage` na resolução de referência da saída (por exemplo, 1920×1080 ou 1080×1920), com plates nas coordenadas do canvas
- [ ] `utils/fontes.css` linkado; pesos reais, sem síntese
- [ ] replicant lido sem `defaultValue`, tolerando `undefined`
- [ ] trava de primeiro estado e trava de on-air
- [ ] combina duas fontes de dados? nenhuma derruba a outra por `return` cedo
- [ ] GSAP vendorizado local; timeline de entrada reseta o estado inicial dos filhos
- [ ] a peça anima em GSAP, não numa `transition` CSS: transição é simétrica, então
      a peça sai com ease-out (freando ao ir embora), e o fim da saída tem de ser
      adivinhado num `setTimeout` paralelo
- [ ] se a arte é vídeo de canvas cheio: `clip-path` pela caixa medida, senão a
      peça repinta 1920×1080 a 24fps parada no ar (`references/render-no-vmix.md`)
- [ ] `fit.js` + `devmode.js` no fim do body
- [ ] `window.test()` funcionando
- [ ] tela de dev mostra o que foi desenhado, sem campo órfão de estado removido
- [ ] imagem com fallback; auto-fit onde o texto pode estourar, com piso e `log.warn`
- [ ] geometria conferida contra `assets/<peça>/assets.json`
- [ ] restart do NodeCG (mexeu no package.json) e URL da browser source apontada

**Painel novo**
- [ ] registrado em `dashboardPanels` com `width` + `_width` explicando
- [ ] linka o CSS do dashboard; zero CSS próprio
- [ ] blocos em `.sechd` / `.campo` / `.barra` / `.status`
- [ ] PLAY/OUT desabilitados conforme o ar; SETAR desabilitado quando limpo
- [ ] abriu o dashboard com o replicant já preenchido: o form carregou, o
      "pendente" sumiu e o SETAR está desabilitado (armadilhas do §8)
- [ ] o painel sobe sem rede: montar linhas e assinar replicant fora de qualquer promise
- [ ] toda promise de asset tem `.catch` com `nodecg.log.error`
- [ ] Replicants têm `defaultValue` no painel dono ou na extension, conforme a regra de inicialização da §2
- [ ] uma escrita de replicant por handler (função auxiliar que escreve conta como escrita)
- [ ] nada de escrita aninhada (`rep.value.a.b = x`); reatribui o objeto
- [ ] dado preparado persiste, ar não persiste (dois replicants se a peça tem os dois)
- [ ] não sobrescreve campo em foco, e quem mexe no form liga `tocado`
- [ ] `.status` só onde acrescenta
- [ ] nenhuma cena tem dois botões
- [ ] imagem resolvida por nome, e a ausência declarada (nunca derivada do slug)

**Estilo e animação**

- [ ] A peça foi conferida com o quadro, o fundo e a escala de exibição reais.
- [ ] Textos curtos e longos passam pelos limites de quebra, redução e truncamento previstos.
- [ ] Uma troca durante a animação mantém a âncora e a última informação válida até a substituição.
- [ ] OUT durante a entrada e PLAY durante a saída deixam a peça no estado visual pedido.
- [ ] Fora do ar, a peça fica transparente e seus loops decorativos param.

**Antes de dizer que está pronto**
- [ ] o repo está limpo: screenshot, dump, venv e script de conferência foram para
      o scratchpad, não para dentro do bundle. Ferramenta que grava por caminho
      relativo (o screenshot do Playwright, por exemplo) escreve no cwd: passe
      caminho absoluto do scratchpad e confira com `git status` /
      `find . -newermt` antes de encerrar. Um `.playwright-mcp/` dentro de
      `bundles/` é pasta sem `package.json` e derruba o NodeCG no próximo boot
- [ ] recarreguei a browser source com a peça no ar e ela voltou igual, sem re-animar
- [ ] pus no ar, tirei e pus de novo: a segunda entrada animou igual à primeira
- [ ] reiniciei o NodeCG e nada se declarou no ar sozinho
- [ ] abri o gráfico com só um dos painéis carregado: ele ainda desenha o que tem
- [ ] `node --check` na extension, se mexi nela
- [ ] os comentários explicam os números e as decisões descartadas
- [ ] só uma instância do NodeCG está no ar (senão medi a antiga)
- [ ] o que é visual eu vi: screenshot ou leitura de DOM por CDP, não só HTTP 200
- [ ] mexi em performance de render? medi com `--disable-gpu` (o caminho do CEF do
      vMix) e comparei o inventário de camadas antes/depois; com a GPU ligada a
      medida seria de outra máquina

**O painel sobe sem rede.** Montar as linhas e assinar os replicants nunca fica
dentro de `BS.carregar().then(...)`: nada disso precisa de manifest. Só o que se
alimenta do asset (um `<datalist>`, um `<select>` de mapa) espera, com `.catch`
obrigatório:

```js
montarLinhas();
DB_X.on("change", pintar);
pintar();                                  // ← o painel já está vivo aqui

BS.carregar()
  .then(encherDatalist)                    // só o enfeite espera a rede
  .catch((e) => nodecg.log.error("Manifests não carregaram:", e));
```

Com tudo dentro do `.then`, qualquer falha no carregamento mata o painel inteiro
sem aviso: as linhas não aparecem, `pintar` nunca é assinado, e o operador vê
badges vazios e botões que não respondem. Um `.then()` sem `.catch()` engole a
rejeição, então nem o console mostra. Degradar é aceitável (digitar o nome à
mão); falhar em silêncio, não.

**Quando "não atualiza"**, verifique nesta ordem, da causa mais comum à mais rara:

1. O handler faz duas escritas e a segunda apagou a primeira? (parte do estado
   chega, parte não; parece bug de renderização)
2. É escrita aninhada (`rep.value.a.b = x`)? Reatribua o objeto.
3. O gráfico tem `return` cedo por uma fonte ausente que nem é a que mudou?
4. O evento é `change` num `<input type="number">`? Ele só dispara no blur.
5. A linha do painel foi criada depois de um `await`, e o `change` chegou antes
   dela existir? O handler não achou o que preencher e nada tentou de novo.
6. Algum código mexeu no form sem ligar `tocado`, e o repaint seguinte desfez?
7. O formato do valor mudou e o persistido velho venceu o `defaultValue`?
8. O `bundle-manager` engoliu o reload com um `ENOENT` e o servidor está com a
   versão antiga em memória?

Depois da 3ª hipótese, pare de adivinhar e prove cada elo separado por CDP:
semeie o replicant, leia o que o painel gravou, leia o que o gráfico desenhou. O
elo que falhar é o bug. Ver `references/padroes-replicant.md` §10; atenção ao
`?standalone=true` do painel e ao fato de `const` de topo não virar propriedade
de `window`. Reproduza o gesto inteiro, foco incluído (ver §8, *Como verificar as
quatro*).

**🚨 Verificação vazia passa: conte o que você examinou.** Um auditor que procura
defeito e devolve lista vazia pode estar dizendo "está tudo certo" ou "não havia
nada para olhar", e as duas são indistinguíveis. Uma peça que não desenhou
devolve `[]` e passa como aprovada. Todo teste desse tipo reporta quantos
elementos entraram na conta, e `examinados: 0` é falha. O mesmo vale para o
`grep` que não acha nada e para o `filter()` que devolve vazio.

**`window.test()` é sobrescrito pelo `change` do replicant.** O valor pintado
pelo console vive até o replicant sincronizar; aí a peça redesenha com o estado
real (vazio, se ninguém preencheu) e apaga o ensaio. Sintoma: todos os campos em
branco na medição, sem erro. Duas saídas:

- medir na mesma sequência, sem ceder o event loop entre o `test()` e a leitura;
- ou escrever no replicant em vez de usar `test()`, que é o caminho de produção e
  não tem essa janela.

Se escrever no replicant e a peça não reagir, confira o nome:
`nodecg.Replicant("NOME_ERRADO")` cria um replicant novo, aceita a escrita e não
avisa nada.

**Duas instâncias do NodeCG dão medida falsa.** Subir a segunda sem parar a
primeira dá `EADDRINUSE`, e você continua medindo o servidor velho. Confirme que
só há uma antes de acreditar em qualquer resultado.
