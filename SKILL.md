---
name: nodecg
description: Tudo sobre gráficos de broadcast em bundles NodeCG — estrutura e estado em replicants (nunca sendMessage), nomes DB_*/lt_*/fs_*, um arquivo por painel e por gráfico, animação com GSAP, ponte vMix/OBS na extension, gramática de controles do dashboard (PLAY/OUT, selo no ar, SETAR), fontes locais, dev mode, extração de plates de PSD via Photoshop MCP ou psd-tools, e reveal por spritesheet de matte de vídeo. Use SEMPRE que o assunto for bundle NodeCG, overlay de transmissão, lower third, fullscreen, painel de dashboard, replicant, package.json de bundle, animação de entrada/saída, ou fiação com vMix/OBS — mesmo quando o pedido parece pequeno ("adiciona um botão", "põe esse valor no ar", "faz a barra entrar deslizando"). Use também quando a arte de um gráfico vier de .psd/.psb ("extrai as plates desse PSD", "transforma esse mockup em HTML", "preciso dos PNGs desse design", "faz essa barra de progresso funcionar"), quando vier só como imagem achatada sem camadas ("analisa esse PNG", "o designer só mandou o print", "descreve o que tem nessa arte", "quais assets eu preciso disso aqui"), ou quando a transição for um matte de vídeo (.mov/.webm de tinta, pincel, dissolve) virando spritesheet. É agnóstica de temática: descreve o esqueleto do grafismo, não a marca de um programa.
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
| Animando entrada/saída, troca de conteúdo, stagger | `references/animacao-gsap.md` |
| Montando ou mexendo no layout de um painel | `references/dashboard-ui.md` |
| Decidindo como guardar um estado novo | `references/padroes-replicant.md` |
| Falando com o vMix, ou migrando de CasparCG | `references/vmix.md` |
| **A arte vem de um `.psd`/`.psb`** | `references/psd-to-html/README.md` (+ os docs ao lado e `scripts/*.jsx`) |
| **A arte veio só como PNG achatado**, sem camadas | `references/psd-to-html/png-analysis.md` (+ `scripts/analyze_png.py`) |
| **A transição é matte de vídeo** (tinta, pincel, dissolve) | `references/spritesheet-mask-reveal.md` |

Os dois últimos são subskills completas: têm seu próprio fluxo, e você segue o
documento inteiro em vez de só consultar. Entre neles pela primeira linha, que diz
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

O gráfico **nunca** declara `defaultValue`: `nodecg.Replicant("DB_X")` e pronto.
Quem define o formato é quem controla o estado; o gráfico só desenha o que vier, e
tem que aguentar `undefined` no primeiro change.

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

**Arquivos de gráfico** — snake_case, com prefixo por tipo de entrada:

- `lt_*` → lower third, entra/sai por animação própria (`lt_single.html`)
- `fs_*` → fullscreen (`fs_pergunta.html`, `fs_contador.html`)
- sem prefixo → peça que fica no ar por longos trechos (`bug.html`, `chat.html`)

O nome descreve **a peça**, não a posição dela no roteiro. Numeração de bloco muda
de ordem entre ensaio e programa; a peça continua sendo o que ela mostra.

**Painéis** — nome do bloco de operação, minúsculo: `quiz.html`, `lowerthirds.html`,
`valores.html`. Agrupe por *quando o operador mexe*, não por qual gráfico é.

**Assets** — uma pasta por peça em `graphics/assets/`, **com o nome do arquivo do
Photoshop, sem a extensão**:

```
LT_MetaLike.psd  →  graphics/assets/LT_MetaLike/
FS_Contador.psd  →  graphics/assets/FS_Contador/
```

Manter o nome do PSD é o que liga o asset de volta à origem sem ninguém precisar
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

Escreva campo a campo (`rep.value.visivel = true`) quando só um muda. Reescreva o
objeto inteiro quando o estado muda de *modo* — e nesse caso **carregue adiante os
campos que não mudaram**. (No contador, esquecer o `inicial` no PAUSE fazia o RESET
"resetar" pro tempo pausado.)

**`persistent: false`** para tudo que não pode acordar no ar depois de um restart:
cena de fullscreen, dev mode. **Persistente** (o default) para o que precisa
reentrar onde estava: o relógio.

**Nada de replicant tickado.** Relógio guarda um *prazo* (`fimEm`, epoch ms) e cada
tela calcula o restante sozinha. Escrever um replicant por segundo enche o socket,
faz o número pular com jitter, e para quando o painel fecha.

Os padrões já resolvidos (liga/desliga, valor preparado + SETAR, fábrica pra blocos
irmãos, relógio, seleção exclusiva, efeito colateral no servidor, dev mode) estão
com código em `references/padroes-replicant.md`.

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
| `graphics/shared/*.js` | driver compartilhado por 2+ gráficos |
| `graphics/shared/fontes.css` | `@font-face` num lugar só |
| `graphics/vendor/gsap.min.js` | biblioteca, versionada junto (ver §7) |

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
4. `shared/fit.js` e `shared/devmode.js`, nessa ordem, **por último** no body.
5. `window.test(...)` no fim do script — ensaiar a peça no navegador sem depender
   do painel. É o que torna a peça verificável por render headless.
6. `<link rel="stylesheet" href="shared/fontes.css" />` no head.

**Nunca um `<img>` cru no ar.** Toda imagem que pode faltar (foto de jogador, logo
de time) carrega com fallback:

```js
function loadBgWithFallback(el, primary, fallback) {
  const i = new Image();
  i.onload  = () => (el.style.backgroundImage = `url(${primary})`);
  i.onerror = () => (el.style.backgroundImage = `url(${fallback})`);
  i.src = primary;
}
```

Texto dentro de plate de largura fixa **precisa de auto-fit**: meça
`getBoundingClientRect().width`, reduza de 1px em 1px até caber, com piso — e
quando estourar o piso, `nodecg.log.warn` e deixa passar. Cortar o nome de alguém
no meio é pior que passar 2px da arte. Reajuste em `document.fonts.ready`: medir
com a fonte de fallback dá tamanho errado.

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

Os padrões fechados (wipe diagonal, reveal vertical com stagger, barn-door, flip,
pushup) estão em `references/animacao-gsap.md`.

Quando a transição for um matte orgânico de vídeo (tinta, pincel, dissolve), não
tente `clip-path` nem gradiente — vá pra `references/spritesheet-mask-reveal.md`.

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
- **Selo NO AR só quando o painel realmente sabe.** Se quem manda no ar é o vMix, o
  selo mentiria — ele refletiria o que o painel pediu. Nesse caso, sem selo.
- **Nunca sobrescreva campo em foco**: `if (document.activeElement !== campoEl)`.
- **Uma altura só** para input, select e botão de linha (`--h-ctl`).
- Controle sem asset correspondente fica **desabilitado com `title`**, não apagado:
  `<button disabled title="Sem asset no vMix">`. Sumir esconde a lacuna.
- Saída de emergência fica sempre clicável (o RESET do contador).

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

---

## 9. Fontes

Um `graphics/shared/fontes.css`, linkado por todo gráfico. Arquivos em
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

## Ambiente Windows

O caminho deste projeto tem `[colchetes]`, que o PowerShell e o chokidar tratam
como glob. Use o Bash tool, `cmd /c mklink /J` para junções, `node -e` para leituras
e `Test-Path -LiteralPath`; evite `New-Item -Path` com caminho entre colchetes.

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
- [ ] GSAP vendorizado local; timeline de entrada reseta o estado inicial dos filhos
- [ ] `fit.js` + `devmode.js` no fim do body
- [ ] `window.test()` funcionando
- [ ] imagem com fallback; auto-fit onde o texto pode estourar, com piso e `log.warn`
- [ ] geometria conferida contra `assets/<peça>/assets.json`
- [ ] restart do NodeCG (mexeu no package.json) e URL da browser source apontada

**Painel novo**
- [ ] registrado em `dashboardPanels` com `width` + `_width` explicando
- [ ] linka o CSS do dashboard; zero CSS próprio
- [ ] blocos em `.sechd` / `.campo` / `.barra` / `.status`
- [ ] PLAY/OUT desabilitados conforme o ar; SETAR desabilitado quando limpo
- [ ] replicants declarados aqui com `defaultValue` (não na extension)
- [ ] não sobrescreve campo em foco
- [ ] `.status` só onde acrescenta

**Antes de dizer que está pronto**
- [ ] recarreguei a browser source com a peça no ar e ela voltou igual, sem re-animar
- [ ] pus no ar, tirei e pus de novo — a segunda entrada animou igual à primeira
- [ ] reiniciei o NodeCG e nada se declarou no ar sozinho
- [ ] `node --check` na extension, se mexi nela
- [ ] os comentários explicam os números e as decisões descartadas
