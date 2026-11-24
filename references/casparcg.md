# Ponte com o CasparCG

Leia quando o playout do programa for um **CasparCG Server** em vez do vMix — ou
junto dele (Caspar gerando key/fill para um switcher, ou saída NDI que o vMix
recebe). Cobre tudo que vai do bundle até o ar: mapa de camadas, a ponte AMCP na
extension, mídia e fontes, o gráfico HTML rodando dentro do Caspar, o contrato de
template CG (`play/stop/next/update/remove`), o estado real por OSC, os botões do
painel e como ensaiar direto no servidor.

**Base de versão: servidor 2.4 ou mais novo; conferido no fonte da 2.5.1**
(tag de 2026-09-16, CEF 142). Onde a 2.4 difere, está dito. A wiki oficial
(casparcg.com/docs) ainda descreve a 2.0/2.1 em boa parte — **na dúvida entre a
wiki e este documento, o fonte decidiu**.

**Medido num servidor 2.5.1 real em 2026-09-28** (RTX 3070, Windows 11, dois
canais 1080p5994), com os módulos desta skill: `VERSION`/`INFO`/`CLS`/`TLS`;
lote `BEGIN/COMMIT` (fundo + HTML); OSC chegando na 6250 e resumido (~1
publicação/s); `CG ADD` com `dadosCG()` de dado hostil (aspas, `\`, quebra de
linha, `$`, acento) chegando **idêntico** na página; `play()` enfileirado antes
do `CASPAR.ligar()` rodando depois; XML do Client; JSON cru com aspas
quebrando (`missing ) after argument list` no log — o bug é real); `CG PLAY`
numa camada de `PLAY [HTML]`; `CALL` e `CALL RELOAD`; `CG REMOVE` deixando a
camada ocupada; STING com parênteses; vinheta com `LOADBG EMPTY AUTO` se
limpando sozinha; `PRINT`. O que ainda é só leitura de fonte continua marcado
*(fonte)*.

**Neste projeto a saída é a JANELA.** O programa é consumido primariamente pelo
consumer `screen` — a janela do Caspar num monitor (ou num LED ligado como
monitor) —, com NDI como saída secundária. Não há Decklink na cadeia principal.
Isso muda como se confere alfa, o que acontece se alguém fechar a janela, e qual
`video-mode` usar: §12.

**A instalação do projeto é a 2.5.1**, em `…\[LEAGUETV] BRAWLSTARS\Caspar-2.5.1`
(config comentado, scanner com o nome corrigido, mídias trazidas da antiga). A
2.4.0 anterior ficou intacta em `…\Caspar`, com o config e os logs de um projeto
anterior — é de onde saíram as lições do §13. Se uma máquina ainda estiver na
2.4, isto é o que ela **não** tem e este documento cita:

| Recurso | Desde |
|---|---|
| áudio dentro do HTML | 2.5 |
| `.webm` com alfa (VP8/VP9) | 2.5 — na 2.4 use `.mov` (ProRes 4444 / QT Animation) |
| transições `FADECUT`, `CUTFADE`, `VFADE` | 2.5 |
| `SCALE_MODE` no PLAY | 2.5 |
| `X`/`Y`/`WIDTH`/`HEIGHT` no `ADD … SCREEN` | 2.5 |
| `<delay>` do `screen`/`system-audio` | 2.5.1 |
| Chromium | 117 na 2.4, 142 na 2.5 |

Todo o resto (`[HTML]`, CG, `CALL RELOAD`, lote `BEGIN/COMMIT`, `REQ`, `OSC
SUBSCRIBE`, `CLEAR_ON_404`, STING com parênteses) já existe na 2.4.0.

Arquivos que acompanham este documento:

| Arquivo | Vai para | O que é |
|---|---|---|
| `assets/caspar-amcp.js` | `extension/caspar-amcp.js` | cliente AMCP sem dependência: REQ/RES, lote, keepalive, reconexão, `q()` e `dadosCG()` |
| `assets/caspar-osc.js` | `extension/caspar-osc.js` | leitor OSC sem dependência: estado real por camada, resumido, sem tique |
| `assets/utils-caspar.js` | `graphics/utils/caspar.js` | contrato de template CG, **só** no modo B (§3) |
| `assets/fs-com-fundo-modelo.html` | `graphics/fs_<peça>.html` | fullscreen HTML ligado a um fundo em vídeo, por prazo (§15) |
| `scripts/caspar.js` | fica na skill | mandar AMCP e ver OSC do terminal (§11) |
| `scripts/caspar-janela.ps1` | fica na skill | fotografar as janelas do Caspar, mesmo cobertas (§11) |

---

## 1. O que muda em relação ao vMix

O vMix é um **switcher** com mesa: tem inputs, preview, programa, e o operador
corta na mão quando quer. O Caspar é um **servidor de playout sem mesa**: tem
canais (cada um é uma saída) e camadas empilhadas dentro de cada canal, e **só
faz o que um cliente manda por TCP**. Consequência: com Caspar, **a extension do
bundle É o switcher.** Tudo que no vMix a mesa fazia sozinha — cortar para uma
cena, voltar ao programa, rodar a vinheta — passa a ser comando que a extension
emite a partir de um replicant.

| vMix | CasparCG | Nota |
|---|---|---|
| input | **camada** de um canal (`1-20` = canal 1, camada 20) | camada maior fica por cima |
| browser source | `PLAY 1-20 [HTML] "<url do gráfico>"` | o mesmo HTML, o mesmo Chromium (CEF) |
| `PreviewInput` + `Stinger1` | `PLAY 1-10 <clipe> STING <máscara>` ou `MIX <quadros>` | a transição vai NO comando de play |
| volta ao PGM | `STOP`/`CLEAR` das camadas de fullscreen, ou `PLAY … EMPTY MIX n` | o "programa" é o que sobra embaixo |
| `OverlayInput1In/Out` | `PLAY`/`CLEAR` de uma camada alta | não há canal de overlay: toda camada é overlay |
| `Restart` + `Play` de mídia | `PLAY 1-10 <clipe>` | PLAY com clipe sempre começa do início |
| nome do input, letra por letra | nome do clipe **sem extensão**, relativo ao `media-path` | caixa **não** importa; subpasta com `/` |
| API HTTP porta 8088 | AMCP, **TCP 5250**, linha terminada em `\r\n` | resposta tem código (202 ok, 404 não achou…) |
| — (o painel só sabe o que pediu) | **OSC, UDP 6250**: o estado real de toda camada | selo "NO AR" pode ser honesto (§7) |

O que **não** muda: a peça continua sendo um HTML do bundle, o ar continua sendo
replicant (§1 do SKILL.md), a extension continua fina, e um Caspar fora do ar
continua não podendo derrubar nada.

---

## 2. O modelo de ar: um mapa de camadas

Antes de uma linha de código, decida o **mapa de camadas** do canal de programa e
escreva-o no `cfg`. Ele é o equivalente da lista de inputs do vMix, e é o que o
operador e quem opera o Caspar precisam combinar.

Numere de 10 em 10 — sobra espaço para enfiar uma camada no meio sem renumerar
tudo no dia do programa:

| Camada | O que mora | Quem põe no ar |
|---|---|---|
| 10 | fonte de programa: câmera/SDI (`DECKLINK`), `ndi://`, ou nada se o Caspar só gera key/fill | carregada no boot |
| 20 | **fundo de fullscreen**: o vídeo ou PNG de frame cheio da cena | a extension, com transição |
| 30 | **HTML do fullscreen** (o campo vivo por cima do fundo) | a extension, junto com a 20, no mesmo lote |
| 31–39 | HTML de fullscreen **ligado a fundo animado** (§15), um por cena, permanente | carregado no boot; entra e sai por prazo |
| 40 | peças de canto / in-game (HTML, sempre carregado) | carregada no boot; o ar é replicant |
| 50 | lower thirds (HTML, sempre carregado) | carregada no boot; o ar é replicant |
| 90 | stinger / vinheta de cobertura | a extension |

🚨 **Nenhuma camada sua em 9999.** É a camada que o CG usa quando o comando não
diz qual (`CG 1 ADD …` = `CG 1-9999 ADD …`). No projeto anterior os stingers
tocavam em `1-9999` — um `CG ADD` sem camada, de qualquer cliente, derrubaria o
stinger no meio da transição.

As famílias da skill mapeiam assim — **e a regra de quem anima não muda**:

- **`lt_*` e peças de canto** — a camada fica **sempre carregada** com o HTML;
  quem anima entrada e saída é o próprio HTML, pelo `visivel` do replicant. O
  Caspar nunca recebe PLAY/STOP por causa de uma barra entrando. É exatamente o
  modelo da browser source do vMix.
- **`fs_*`** — quem transiciona é o **Caspar**, não o HTML. A cena é o par
  fundo (camada 20) + campo vivo (camada 30), posto no ar com `MIX` ou `STING` e
  tirado com `CLEAR`/`MIX` para vazio. O HTML de fullscreen **não anima e não
  tem `visivel`**, como no vMix.
- **Vinheta/stinger** — um clipe numa camada alta que toca até o fim e se limpa
  sozinho (`LOADBG … EMPTY AUTO`, §5).

Canal = saída. Um segundo canal (`2`) serve para uma saída limpa (sem
gráficos), um multiview, ou key/fill separados. `route://1` copia o programa do
canal 1 para dentro de outro canal (§6).

---

## 3. Três jeitos de pôr um HTML do bundle no Caspar

| | Como carrega | Quem manda no ar | Quando |
|---|---|---|---|
| **A** | `PLAY 1-50 [HTML] "http://<nodecg>:9090/bundles/<b>/graphics/lt_x.html"` | **o replicant** (`visivel`), como no vMix | **padrão**. Toda peça do bundle |
| **B** | `CG 1-50 ADD 1 "http://…/lt_x.html?ar=cg" 1 <dados>` | **comando CG** (`CG PLAY/STOP`) | quando quem opera é o CasparCG Client, ou outro sistema que só fala CG |
| **C** | cópia do HTML dentro do `template-path` do Caspar, `CG 1-50 ADD 1 "pasta/lt_x" 1` | comando CG, **sem NodeCG** | entregar um pacote de templates para outra equipe, sem servidor |

**Use A.** É o único que mantém a regra que abre a skill: se o Caspar reiniciar a
camada, se alguém der `CALL RELOAD`, se o Chromium da camada cair, a peça volta,
relê o replicant e desenha **exatamente** o que estava — no ar ou fora dele. B e
C são o modelo de evento que a skill proíbe: um `CG PLAY` é uma mensagem que
passa, e uma página recarregada depois dele volta vazia.

O Chromium do Caspar roda com `disable-web-security` e sem throttling de fundo,
então o socket do NodeCG, os replicants e o `fetch` de manifesto funcionam na
camada exatamente como numa aba *(fonte)*. A única exigência é de rede: a URL
tem que ser alcançável **da máquina do Caspar** (ver `nodecgUrl` no §4).

B existe porque às vezes quem está na mesa não é o operador do bundle. Nesse
caso o gráfico carrega `utils/caspar.js` (§9), abre com `?ar=cg`, e o Caspar vira
dono do ar **daquela peça**. Conteúdo ainda pode vir do replicant — o CG só manda
entrar e sair. Nunca misture: **uma peça, um dono do ar.**

C só se justifica fora da operação normal. Uma peça copiada para o
`template-path` perde o replicant, os manifestos e o `utils/` servidos pelo
NodeCG — ela precisa ser autossuficiente, com todo asset por caminho relativo à
própria pasta (`file://`).

---

## 4. `cfg/<bundle>.json`

Como no vMix, nome que tem de bater com outro sistema **não fica no código**:

```json
{
  "caspar": {
    "enabled": true,
    "host": "127.0.0.1",
    "port": 5250,
    "osc": 6250,
    "canal": 1,
    "canalTeste": 2,
    "_canalTeste": "Para onde os gráficos vão no MODO TESTE (§10). Esse canal só tem janela — nunca Decklink nem NDI que alguém esteja recebendo.",
    "nodecgUrl": "http://127.0.0.1:9090",
    "_nodecgUrl": "Como o CASPAR alcança o NodeCG. Máquinas diferentes = IP de LAN desta, nunca 127.0.0.1.",
    "camadas": { "fonte": 10, "fsFundo": 20, "fsHtml": 30, "canto": 40, "lt": 50, "vinheta": 90 },
    "permanentes": {
      "_leia": "Carregadas no boot e a cada reconexão. O ar delas é replicant — o Caspar só hospeda.",
      "40": "overlay_jogo.html",
      "50": "lt_single.html"
    },
    "cenas": {
      "_leia": "CHAVE = a cena do DB_FS (nunca muda). fundo = clipe sem extensão, relativo ao media-path. html = gráfico do bundle por cima (opcional).",
      "break":    { "fundo": "fs/break",    "html": "fs_break.html",    "entrada": "MIX 12" },
      "contador": { "fundo": "fs/contador", "html": "fs_contador.html", "entrada": "STING transicoes/tinta 18" },
      "vs":       { "fundo": "fs/vs_loop LOOP", "html": "fs_vs.html",   "entrada": "MIX 12" }
    },
    "saida": "MIX 12",
    "vinhetas": { "abertura": "vinhetas/abertura", "replay": "vinhetas/replay_in" }
  }
}
```

- **`enabled: false`** desliga só os comandos de ar: numa máquina sem Caspar o
  painel funciona inteiro e os comandos viram log (é o `ativo:false` do cliente).
- **`nodecgUrl` é a pegadinha nº 1.** O comando `PLAY [HTML]` é executado **pelo
  Caspar**, então `127.0.0.1` ali é a máquina do Caspar. Com NodeCG e Caspar em
  máquinas diferentes — ou NodeCG em Docker —, a camada abre em branco, o AMCP
  responde `202 PLAY OK` mesmo assim (o carregamento é assíncrono) e o erro só
  aparece no log do Caspar.
- **Duração de transição é em QUADROS do canal**, não em ms: `MIX 12` num canal
  1080p50 dura 240ms; num 1080i5994 (60 campos) dura 200ms. Se o canal mudar de
  formato, as transições mudam de duração junto.
- **`fundo` pode carregar parâmetros** (`LOOP`, `SEEK 25`) — o texto vai colado
  no PLAY. Um nome de clipe com espaço tem que ir entre aspas; prefira pastas e
  nomes sem espaço e evite o problema.

---

## 5. A extension: conectar, traduzir, reconciliar

```js
const { criarCaspar, q } = require("./caspar-amcp");

const CC = (nodecg.bundleConfig && nodecg.bundleConfig.caspar) || {};
const CANAL = CC.canal || 1;
const CAM = CC.camadas || {};
const CENAS = CC.cenas || {};
const base = (CC.nodecgUrl || "http://127.0.0.1:9090").replace(/\/$/, "");
const urlGrafico = (arq) => `${base}/bundles/${nodecg.bundleName}/graphics/${arq}`;

/* O canal NÃO é constante: no modo teste (§10) tudo vai para o canalTeste.
   Por isso todo comando monta o endereço por L(), na hora. */
const DB_CASPAR_MODO = nodecg.Replicant("DB_CASPAR_MODO", { defaultValue: { teste: false }, persistent: false });
const canalAlvo = () => (DB_CASPAR_MODO.value && DB_CASPAR_MODO.value.teste ? CC.canalTeste : CANAL);
const L = (camada, canal = canalAlvo()) => `${canal}-${camada}`;

const caspar = criarCaspar({
  host: CC.host, port: CC.port, ativo: CC.enabled !== false,
  log: nodecg.log, rotulo: "caspar",
});
```

### Traduzir: a cena vira UM lote

O painel grava `DB_FS.value = { cena: "break" }`, igual ao vMix. A extension
traduz — e manda **fundo e HTML no mesmo lote**, para os dois entrarem no mesmo
quadro. Em dois comandos soltos eles podem cair em quadros diferentes, e no ar
isso é um quadro de fundo sem o texto por cima.

```js
let primeiraCena = true;
DB_FS.on("change", (novo) => {
  if (primeiraCena) { primeiraCena = false; return; }   // o estado inicial não é ordem
  aplicarCena((novo && novo.cena) || null);
});

async function aplicarCena(cena) {
  if (!cena) {
    // OUT: fundo sai com a transição de saída; o HTML sai no mesmo quadro.
    return caspar.lote([
      `PLAY ${L(CAM.fsFundo)} EMPTY ${CC.saida || "MIX 12"}`,
      `PLAY ${L(CAM.fsHtml)} EMPTY ${CC.saida || "MIX 12"}`,
    ]);
  }
  const c = CENAS[cena];
  if (!c) {
    nodecg.log.error(`[caspar] cena "${cena}" não está em cfg.caspar.cenas — nada foi ao ar`);
    return;
  }
  const cmds = [`PLAY ${L(CAM.fsFundo)} ${c.fundo} ${c.entrada || ""}`.trim()];
  cmds.push(c.html
    ? `PLAY ${L(CAM.fsHtml)} [HTML] ${q(urlGrafico(c.html))} ${c.entrada || ""}`.trim()
    : `CLEAR ${L(CAM.fsHtml)}`);
  const r = await caspar.lote(cmds);
  if (!r.ok) nodecg.log.error(`[caspar] cena "${cena}" não entrou inteira (${r.msg})`);
}
```

Isso serve a cena simples: fundo e HTML entram juntos e o HTML não anima. **Se o
fundo é animado e o HTML tem de entrar num quadro dele e sair antes dele**
(tabela sobre `bg_tabela.mp4`), a cena é a composição ligada do **§15**.

Três detalhes do código acima que parecem opcionais e não são:

- **`PLAY … EMPTY MIX n` e não `CLEAR`** para sair. `CLEAR` é corte seco;
  `EMPTY` é o produtor de cor transparente, e o `MIX` dá a saída com transição.
- **`c.fundo` sem `q()`**: é nome de clipe mais parâmetros, e o nome não pode ter
  espaço (§4). A URL do HTML sempre vai por `q()` — uma URL crua com espaço ou
  `\` parte o token.
- **HTML de fullscreen recarrega a cada entrada** (cada PLAY cria um Chromium
  novo). Ele relê o replicant no boot, então o conteúdo está certo — mas o boot
  tem que ser rápido e **as plates têm que estar no cache** (o PLAY entra com
  transição de 12 quadros; uma peça que leva 400ms para desenhar entra vazia).
  Se isso pesar, mantenha o HTML do fullscreen **permanente** numa camada e mexa
  só na opacidade: `MIXER 1-30 OPACITY 1 12` / `MIXER 1-30 OPACITY 0 12`.

**Evite cena com dois comandos que dependem de tempo** (`setTimeout` entre um
PLAY e outro). No vMix, os 100ms entre `PreviewInput` e `Stinger` eram
necessários; no Caspar, o que precisa ser simultâneo vai em **lote**, e o que
precisa ser sequencial vai em **`LOADBG … AUTO`** (§5 de mídia), que o próprio
servidor encadeia no quadro certo.

### Reconciliar: o Caspar voltou, o bundle reconstrói

O cliente **não enfileira** comando com a conexão caída — um fullscreen pedido às
21:03:10 e executado às 21:03:40 é pior que nenhum. Em vez de fila, a extension
**reconstrói o estado** toda vez que a conexão sobe (boot do NodeCG, Caspar
reiniciado, cabo de rede que voltou):

```js
/* Camadas permanentes (modo A) num canal. Idempotente: recarregar uma camada
   que já estava lá só custa um reload, e a peça volta no estado do replicant.
   Recebe o canal porque o modo teste (§10) a chama com o canal de teste. */
async function carregarPermanentes(canal) {
  const perm = CC.permanentes || {};
  const cmds = Object.keys(perm)
    .filter((k) => /^\d+$/.test(k))
    .map((cam) => `PLAY ${L(cam, canal)} [HTML] ${q(urlGrafico(perm[cam]))}`);
  const r = await caspar.lote(cmds);
  if (!r.ok) nodecg.log.error(`[caspar] camadas permanentes não subiram inteiras no canal ${canal} (${r.msg})`);
}

caspar.on("conectou", async () => {
  // 1. As permanentes, no canal que estiver valendo (programa, ou teste).
  await carregarPermanentes(canalAlvo());

  // 2. Fullscreen NÃO volta sozinho. Se o Caspar caiu no meio de uma cena, a
  //    saída ficou preta ou congelada; recolocar a cena por conta própria é
  //    decisão do operador, não da extension. Zera e avisa — o painel mostra a
  //    verdade.
  if (DB_FS.value && DB_FS.value.cena) {
    nodecg.log.warn(`[caspar] reconectou com a cena "${DB_FS.value.cena}" pedida — zerada; o operador decide de novo`);
    DB_FS.value = { cena: null };
  }
});
```

Aqui aparece o que o modo A compra: as peças permanentes voltam **no estado
certo sem a extension saber qual era** — cada uma relê o seu replicant. Nenhuma
lista de "o que estava no ar" precisa existir.

🚨 **A reconciliação recarrega as camadas no boot do NodeCG também.** Se o
NodeCG reinicia no meio do programa com o Caspar no ar, as camadas permanentes
são recarregadas (um reload de Chromium) — com a trava de primeiro estado (§6
do SKILL.md), uma barra que estava no ar volta no ar sem re-animar, então no ar
isso é imperceptível *desde que a trava exista*. Para não tocar no que já está carregado, use a versão abaixo.

### Reconciliar SEM PISCAR: pergunte ao Caspar antes de mandar qualquer coisa

> Medido no bundle clash (2026-11-12). A produção pediu: "restart do NodeCG não
> pode derrubar nem piscar a arte". O `conectou` acima recarrega tudo, e cada
> reload de Chromium pisca. A versão de produção **lê o OSC primeiro** (§7) e
> só carrega o que falta.

- **Página permanente já carregada** (camada com produtor `html` e a URL dela):
  **não recarrega**. Ela reconecta sozinha ao NodeCG, recebe o mesmo estado (os
  replicants de ar persistem), e nada muda na tela.
- **Fundo da cena do `DB_FS` já tocando** (produtor `ffmpeg` com o clipe certo):
  a ponte **reassume** a cena (`cenaNoAr[canal] = cena`) sem comando nenhum. Um
  PLAY recomeçaria o loop.
- **Caspar não bate com o `DB_FS`**: realinha com `pedirCena(cena, { semSting: true })`.
  É reconciliação, não ordem do operador, então vai sem sting.
- **Caspar LIMPO** (nenhuma permanente no programa): é o caso do bloco acima.
  Carrega tudo e zera o fullscreen. Se for a **primeira conexão deste boot do
  NodeCG** (a máquina reiniciou), zera também todo `visivel` antes de carregar:
  o estado gravado é de antes da queda, e nada pode entrar no ar sozinho.
- **Sem OSC em 3 s**: não dá para saber o que está lá, então recarrega tudo.
  O OSC só começa a chegar **depois** do AMCP conectar. Quando chegar, espere
  mais ~800 ms para o resumo do OSC estabilizar, porque uma camada só aparece
  depois de vista por um tempo.
- Com modo teste (§10), faça isso **para cada canal** (`[CANAL, CANAL_TESTE]`)
  e mande o canal que não está vivo recomeçar sem cena. Ele alcança o estado
  quando virar o vivo.

```js
const temHtml = (camadas, canal, camada, arquivo) => {
  const c = camadas[`${canal}-${camada}`];
  return !!c && c.produtor === "html" && String(c.arquivo || "").includes(arquivo);
};
caspar.on("conectou", async () => {
  const boot = primeiraConexao; primeiraConexao = false;
  const camadas = await lerCaspar();                 // null se o OSC não vier em 3s
  const faltando = (canal) => PERMANENTES.filter((p) => !camadas || !temHtml(camadas, canal, p.camada, p.arquivo));
  const limpo = faltando(CANAL).length === PERMANENTES.length;
  if (limpo && boot) zerarVisiveis();
  for (const canal of CANAIS) { const f = faltando(canal); if (f.length) await caspar.lote(cmdsPermanentes(canal, f)); }
  // depois: reassumir a cena se o fundo bate, realinhar se não bate, zerar se limpo
});
```

`cmdsPermanentes` manda `MIXER <c-l> OPACITY 0` **antes** do `PLAY [HTML]` das
peças de fullscreen. A transformação é da camada e sobrevive à troca de
produtor, então o HTML já nasce invisível e a cena o revela com o fundo.


### Comandos avulsos que a extension costuma precisar

```js
caspar.enviar(`CALL ${L(50)} RELOAD`);                 // F5 numa camada HTML (2.4+)
caspar.enviar(`MIXER ${L(50)} OPACITY 0 12`);          // esconder sem descarregar
caspar.enviar(`CLEAR ${L(90)}`);                       // limpar uma camada
caspar.enviar(`CLEAR ${CANAL}`);                       // limpar o canal INTEIRO — emergência
caspar.enviar(`MIXER ${CANAL} MASTERVOLUME 0`);        // mudo geral
```

Duas coisas do protocolo, medidas no servidor real:

- **`PING` não aceita `REQ`**: `REQ x PING` volta `400 ERROR`. O keepalive do
  cliente manda `PING` cru, por fora do `enviar()` — não mande PING por ele.
- **`INFO <canal>` volta `201` com um XML de várias linhas** — mas as quebras são
  `\n`, e a resposta inteira termina num só `\r\n`. Para o cliente é UMA linha de
  dado; quebre por `\n` na hora de ler.

`enviar()` e `lote()` **nunca rejeitam**: devolvem `{ ok, codigo, msg, linhas }`
e já logam a falha. Códigos que aparecem: `202` feito; `201`/`200` feito com
dado; `404` clipe/template não achado; `403` parâmetro ilegal (ou CG numa camada
em transição); `400` comando não entendido; `501` erro interno (inclusive
`CLS` sem media-scanner); `0` desconectado/timeout (do cliente, não do Caspar).

---

## 6. Mídia e fontes

### Clipes

- **Nome sem extensão, relativo ao `media-path`, caixa indiferente, subpasta
  com `/`**: `PLAY 1-20 "fs/break"` acha `media/FS/Break.mov`. Extensão
  explícita e caminho absoluto também funcionam (2.4+).
- **Alfa:** `.mov` ProRes 4444 / QT Animation, e **`.webm` VP8/VP9 com alfa a
  partir da 2.5**. O Caspar espera alfa **premultiplicado** — um clipe exportado
  em straight alpha ganha franja escura na borda. Um par `nome` + `nome_A` (ou
  `nome_ALPHA`) na pasta vira fill + key automaticamente.
- **Parâmetros do PLAY:** `LOOP`, `SEEK <quadro>`, `IN`, `OUT`, `LENGTH`,
  `SCALE_MODE FIT|FILL|STRETCH|…` (2.5), `CLEAR_ON_404` (2.4+: se o arquivo não
  existe, a camada fica vazia em vez de manter o que tinha — use em toda camada
  que não pode ficar com a cena velha).
- **Tocar e limpar sozinho** (vinheta, stinger de replay):

  ```
  PLAY 1-90 vinhetas/replay_in
  LOADBG 1-90 EMPTY AUTO
  ```

  O `AUTO` promove o `EMPTY` quando o clipe acaba — o servidor limpa no quadro
  certo, sem `setTimeout` na extension. Mande os dois no mesmo `lote()`, **nessa
  ordem**: um `PLAY` com clipe depois do `LOADBG` substituiria o fundo
  preparado, e a vinheta ficaria parada no último quadro.
- **Clipe que para no último quadro:** sem `LOOP` e sem `AUTO`, o ffmpeg segura
  o último quadro no ar. É o que se quer num fundo de fullscreen que "entra e
  para"; é o que NÃO se quer numa vinheta.
- **Posição no clipe:** `CALL 1-20 SEEK 0`, `CALL 1-20 LOOP 1`,
  `CALL 1-20 SEEK END -50` (50 quadros do fim). `PAUSE`/`RESUME` para congelar.

### Transições

```
PLAY 1-20 fs/break MIX 12                       crossfade de 12 quadros
PLAY 1-20 fs/break PUSH 15 EASEINOUTSINE LEFT   empurra
PLAY 1-20 fs/break WIPE 10 FROMRIGHT
PLAY 1-20 fs/break STING (MASK=transicoes/tinta_mask OVERLAY=transicoes/tinta TRIGGER_POINT=18)
```

- Tipos: `CUT MIX PUSH SLIDE WIPE` e, na 2.5, `FADECUT CUTFADE VFADE`.
- **STING** é o stinger do vMix feito no servidor: `MASK` é um clipe P&B
  (branco = destino aparece), `OVERLAY` é o clipe de arte por cima (com alfa),
  `TRIGGER_POINT` é o quadro da máscara em que o corte acontece. A forma com
  parênteses é a da 2.4+; a posicional antiga é
  `STING <mascara> <trigger> <overlay>`.
- O matte de vídeo que a skill transforma em spritesheet
  (`spritesheet-mask-reveal.md`) serve direto como `MASK` de um STING — no Caspar
  você não precisa do spritesheet para uma transição de CENA; ele continua útil
  para revelar um elemento DENTRO de uma peça HTML.

### Listar mídia para o painel

`CLS` (clipes), `TLS` (templates), `CINF <nome>`, `THUMBNAIL RETRIEVE <nome>` não
são respondidos pelo servidor: ele repassa por HTTP ao **media-scanner**, um
processo separado (porta 8000) que o `casparcg_auto_restart.bat` sobe junto.
**Sem o scanner, esses comandos devolvem `501` — e o PLAY continua funcionando.**
Então nenhum painel pode depender de `CLS` para funcionar: ele enfeita um
`<select>`, com fallback para digitar o nome. Mesma regra do "painel sobe sem
rede" do SKILL.md.

A linha do `CLS` é `"FS/BREAK" MOVIE 6445960 20260413102935 268 1/25` (nome em
maiúscula, tipo, bytes, data, quadros, base de tempo). Publique a lista num
replicant **declarado na extension** (`DB_CASPAR_MIDIA`, `persistent: false`),
atualizada no `conectou` e num botão "recarregar lista" — não num intervalo.

### Fontes (entradas)

```
PLAY 1-10 DECKLINK DEVICE 1                     SDI/HDMI; formato detectado sozinho (2.3+)
PLAY 1-10 DECKLINK DEVICE 1 FORMAT 1080i5000    força o formato
PLAY 1-10 "ndi://MAQUINA/Saida vMix"            NDI (nome com espaço vai entre aspas)
PLAY 2-10 route://1                             o canal 1 inteiro dentro do canal 2
PLAY 2-10 route://1-50                          só a camada 50 do canal 1
PLAY 1-10 "srt://10.0.0.5:9000?mode=caller"     stream pelo ffmpeg
PLAY 1-5  #FF101010                             cor sólida, formato #AARRGGBB
PLAY 1-5  EMPTY                                 transparente
```

- **`route://` é obrigatório** no prefixo (a wiki diz que é opcional; o regex
  da 2.5.1 exige). Route só funciona entre canais de mesma cadência.
- **Cor é `#AARRGGBB`** — a página antiga da wiki diz BGR; está errada.
- `NDI LIST` lista as fontes NDI da rede.

### Saídas (config, ou em tempo de execução)

- **`<screen>` — a saída principal deste projeto.** Tudo sobre ela no §12.
- `<ndi><name>GC</name></ndi>` (ou `ADD 1 NDI NAME "GC"`) publica o canal como
  NDI **com alfa** — é como o vMix ou o OBS recebem o Caspar como uma fonte só.
- `<decklink>` com `<keyer>external</keyer>` = **fill e key** em duas saídas SDI
  para o switcher de outra mesa; `internal` = o próprio card keya sobre a
  entrada. **Não há placa instalada neste projeto**: o bloco fica comentado no
  config de referência (§12), pronto para descomentar quando for testar SDI.

---

## 7. Estado real: OSC → replicant → selo honesto

No vMix a skill proíbe selo "NO AR" em fullscreen porque o painel só sabe o que
pediu. **No Caspar dá para saber o que está no ar**, e então o selo pode existir —
desde que venha do servidor.

O Caspar manda, por UDP, a árvore de estado inteira **a cada quadro** para todo
cliente AMCP conectado (porta 6250 do IP do cliente). `assets/caspar-osc.js`
decodifica, agrega por camada e só chama de volta quando o **resumo** muda:

```js
const { ouvirOSC } = require("./caspar-osc");
const DB_CASPAR = nodecg.Replicant("DB_CASPAR", {
  defaultValue: { conectado: false, recebendo: false, camadas: {} },
  persistent: false,                      // estado de outro sistema: nunca persiste
});

caspar.on("conectou", () => { DB_CASPAR.value = { ...DB_CASPAR.value, conectado: true }; });
caspar.on("caiu",     () => { DB_CASPAR.value = { conectado: false, recebendo: false, camadas: {} }; });

ouvirOSC({
  porta: CC.osc || 6250,
  log: nodecg.log,
  aoMudar: (e) => { DB_CASPAR.value = { ...DB_CASPAR.value, recebendo: e.recebendo, camadas: e.camadas }; },
});
```

`DB_CASPAR.value.camadas["1-20"]` é `{ produtor, arquivo, pausado, loop, fimEm? }`
— `produtor` é `"ffmpeg"`, `"html"`, `"route"`, `"decklink"`, `"transition"`…;
`arquivo` é o nome do clipe (ou a URL, no HTML); `fimEm` é o **prazo** em epoch
ms em que o clipe acaba, que fica parado enquanto o clipe toca. Camada vazia
some do objeto.

Por que o módulo é do jeito que é:

- **Nada de replicant tickado.** A árvore chega 50×/s; o resumo muda poucas
  vezes por minuto. O tempo do clipe vira `fimEm` (§4 do SKILL.md: "relógio
  guarda prazo"), e o painel calcula o restante sozinho.
- **Camada limpa não manda "saí".** Ela simplesmente para de aparecer na árvore,
  então o módulo dá validade de 600ms a cada camada vista.
- **Os endereços da wiki estão obsoletos.** Desde a 2.2 o estado da camada fica
  sob `…/stage/layer/L/foreground/…` (`producer`, `file/path`, `file/name`,
  `file/time`, `paused`, `loop`, `frames_left`).
- 🚨 **Porta ocupada.** O CasparCG Client na mesma máquina também escuta a 6250
  e os dois não dividem a porta. O sintoma é `recebendo: false` com
  `conectado: true`. Saída: `OSC SUBSCRIBE 6251` pelo AMCP (2.4+; vale enquanto a
  conexão durar — mande no `conectou`) e `ouvirOSC({ porta: 6251 })`.

**O que o painel faz com isso:**

- **Selo NO AR de fullscreen** acende quando a camada `fsFundo` tem o `arquivo`
  da cena pedida — não quando o botão foi apertado. Pedido e confirmado são dois
  estados diferentes e o painel pode mostrar os dois: `PEDIDO` (o replicant
  mudou) e `NO AR` (o OSC confirmou). Se o `PEDIDO` não vira `NO AR` em um
  segundo, algo falhou — clipe inexistente, Caspar caído — e o operador vê.
- **Contador de vinheta**: `fimEm − agora`, desenhado localmente.
- **Luz de conexão**: `conectado` e `recebendo`. Um Caspar fora do ar tem que ser
  a primeira coisa que o operador vê, não a última.

Para a peça que se adapta ao que está atrás dela (um lower third que sobe quando
há vídeo no programa), o gráfico também pode ler `DB_CASPAR` — é replicant como
outro qualquer.

---

## 8. O gráfico dentro do Caspar: o que muda no render

### Compatibilidade — medida dentro do Caspar 2.5.1 (2026-09-28)

Uma página de teste rodando numa camada do servidor, GPU desligada (o padrão):

| O quê | Resultado |
|---|---|
| Chromium | **142** (na 2.4: 117) |
| GSAP 3.13 (o vendorizado do bundle) | carrega e anima |
| `requestAnimationFrame` parado | 59 fps (canal 59,94 → `ceil` = 60) |
| GSAP, 1 elemento cruzando a tela | 58,7 fps |
| GSAP, 300 elementos com stagger (tabela, bracket) | 57,7 fps |
| blur animado em quadro cheio (o pior caso em software) | 58,7 fps |
| CSS nesting, `:has`, container queries, `clip-path`, `mask-image`, `color-mix`, `text-wrap: balance`, `@property`, View Transitions | todos suportados |
| `backdrop-filter` | suportado (e caro em software — meça) |
| Web Animations API, `document.fonts`, `structuredClone`, `Object.groupBy`, `OffscreenCanvas` | sim |
| **WebGL / WebGL2** | **não** (GPU desligada). Liga com `<enable-gpu>true</enable-gpu>` |
| `<video>` **`.webm` VP9 com alfa** | toca |
| `<video>` **`.mp4` H.264** | **não toca**: `DEMUXER_ERROR_NO_SUPPORTED_STREAMS` |
| `<video>` AV1 | `canPlayType` = probably (não reproduzido) |

Tradução para o bundle: **tudo que a skill faz com GSAP, `clip-path`, stagger e
webm funciona igual ao vMix**. As exceções são duas:

- **H.264 dentro de HTML não existe no Caspar.** Uma peça que usa `<video
  src="x.mp4">` fica com o buraco do vídeo, sem erro visível. `.webm`, ou o
  vídeo numa camada do Caspar (§15).
- **Canvas WebGL** (Three.js, Pixi em modo WebGL, shaders) só com a GPU ligada.

O fps acima é o do `requestAnimationFrame` — prova que o JavaScript acompanhou,
não que o Caspar recebeu todo quadro pintado. Para peça pesada, confira no
`DIAG` do servidor (quadros atrasados) ou grave o canal.

É o mesmo CEF que o vMix usa, com diferenças que mudam decisões:

- **O tamanho da página é o do CANAL.** Canal 720p = página de 1280×720. O
  `.stage` de 1920×1080 com `fit.js` resolve (ele escala pela altura). Não mude
  coordenada para caber — ver §6 do SKILL.md.
- 🚨 **`width=` e `height=` na URL mudam o tamanho da página.** O servidor
  procura esses dois textos **em qualquer lugar da URL** e, achando os dois,
  redimensiona o navegador. Um gráfico com `?width=300&height=80` na query por
  outro motivo renderiza numa página de 300×80. Não use esses nomes de
  parâmetro.
- **Quadros por segundo = `ceil(fps do canal)`**, e em canal entrelaçado é a
  taxa de **campos**: 1080i50 renderiza a 50. O relógio do Chromium não é
  travado ao do canal; há um buffer de 4 quadros, e quadro atrasado repete o
  anterior. GSAP é por tempo, então a duração não muda; animação contada em
  quadros (`frame++` por rAF) muda.
- **GPU desligada por padrão** (`<html><enable-gpu>false</enable-gpu>`): tudo é
  rasterizado em software, **sem WebGL**. É o mesmo cenário do vMix, e tudo em
  `render-no-vmix.md` vale igual — o custo é a ÁREA repintada; vídeo de canvas
  cheio pede `clip-path`; `will-change` em elemento de quadro cheio piora.
  Ligar a GPU (`true`) habilita WebGL e textura compartilhada D3D11 no Windows;
  meça antes e depois com o mesmo método daquele documento.
- **Fundo transparente é obrigatório.** O Caspar composita o alfa da página; um
  `background` opaco no `body` vira key de tela cheia e cobre tudo abaixo.
  `mix-blend-mode` contra camadas de baixo **não funciona** — cada camada é
  renderizada sozinha e só depois misturada. Para blend entre camadas, use
  `MIXER 1-50 BLEND screen`.
- **Áudio no HTML só a partir da 2.5**, e não em formatos fracionários
  (29.97/59.94). Antes disso, som de gráfico vai como clipe numa camada.
  Autoplay de vídeo e áudio funciona sem gesto.
- **`console.*` da página vai para o log do Caspar** (`html[<url>] … Log:`). O
  `nodecg.log` continua indo para o NodeCG. No Caspar, o log do servidor é o
  console — ali aparece a `ReferenceError` de um `update()` que chegou cedo.
- **Erro de carregamento é mudo no AMCP.** `PLAY [HTML]` responde `202` antes de
  carregar; URL errada ou NodeCG fora do ar deixam a camada vazia e só o log
  diz. Por isso a verificação é visual (§11), nunca "respondeu 202".
- **Cache.** O Chromium do Caspar guarda cache em `cef-cache/`. Depois de editar
  o HTML, `CALL 1-50 RELOAD` é o F5 da camada. Se um arquivo parecer velho mesmo
  assim, versione a URL (`?v=2` — nunca `width=`).
- **Fontes:** `@font-face` do bundle, como sempre. O `font-path` e o `FLS` do
  Caspar não têm nada a ver com HTML.

---

## 9. Modo B: o contrato de template CG

Só quando a peça precisa responder a `CG PLAY/STOP/UPDATE` (§3). O que o servidor
faz, lido no fonte (`html_cg_proxy.cpp`):

| Comando | JS executado na página |
|---|---|
| `CG 1-50 ADD 1 "<url>" <0\|1> <dados>` | cria um Chromium **novo** na camada, já visível; depois do `load`: `update("<dados>")` — **sempre**, mesmo sem dado — e `play()` se o flag for 1 |
| `CG 1-50 PLAY 1` | `play()` |
| `CG 1-50 STOP 1` | `stop()` — e **nada mais**: a página continua rodando na camada |
| `CG 1-50 NEXT 1` | `next()` |
| `CG 1-50 UPDATE 1 <dados>` | `update("<dados>")` |
| `CG 1-50 INVOKE 1 "placar(2)"` | `placar(2)` — sem `)` no fim, o servidor acrescenta `()`; o retorno **não** volta |
| `CG 1-50 REMOVE 1` | `remove()` |
| `CG 1-50 CLEAR` | destrói o produtor da camada |
| `CALL 1-50 "<qualquer js>"` | executa o JS; também funciona em camada carregada por `PLAY [HTML]` |

Consequências, cada uma um bug esperando:

1. **A página aparece no ADD, não no PLAY.** O estado inicial da peça tem que ser
   FORA do quadro — a trava de primeiro estado da skill já garante isso.
2. **O número do "CG layer" (`1`) é ignorado no HTML.** Uma camada do Caspar, um
   template. Dois templates = duas camadas.
3. **`update`/`play` têm de existir no `load`.** O servidor enfileira as
   chamadas e dispara no fim do carregamento; se a função só for definida depois
   de um `await` (fontes, plates, replicant), a chamada estoura
   `ReferenceError` e **some**. É por isso que `utils/caspar.js` define as
   globais sincronamente no `<head>` e enfileira até a peça chamar
   `CASPAR.ligar()`.
4. **`CG STOP` não descarrega nada.** A página parada continua custando CPU. A
   extension manda `CLEAR` depois da saída, ou o próximo `CG ADD` na camada
   substitui.
5. **`remove()` nativo fecha o navegador, mas a camada continua ocupada** por um
   produtor morto. `utils/caspar.js` guarda o nativo, roda a saída e só então
   chama o nativo; a extension ainda manda `CLEAR`.
6. 🚨 **Dado de `update()` quebra com aspas, `\` e quebra de linha** (2.5.1: o
   servidor escapa só as aspas antes de montar `update("…")`, e o tokenizador
   AMCP já consumiu uma camada de `\`). Em teste contra a lógica do fonte,
   `{"nome":"Zé \"Ninja\""}` gerou `missing ) after argument list`, e um `\n`
   num texto gerou `Bad control character`. **Mande sempre por `dadosCG(obj)`**:
   ele embrulha o JSON em `{"u":"<encodeURIComponent>"}`, que passa intacto por
   todas as camadas de escape, e `utils/caspar.js` desembrulha.
7. **Dado inline tem que começar com `{` ou `<`.** Qualquer outra coisa (inclusive
   um array `[…]`) é tratada como **nome de dataset** em disco (`DATA STORE`).
8. **Não mande `CG` para uma camada no meio de uma transição.** O fonte indica
   `403` (durante um `MIX` o produtor da camada é `transition`), mas no servidor
   real um `CG PLAY` 300ms dentro de um `MIX 120` voltou **`202`** — então não
   conte com o erro para saber que não funcionou. Espere a transição acabar.

**Formatos que chegam em `update()`** — a peça não precisa saber qual,
`utils/caspar.js` normaliza para objeto:

- `""` — ADD sem dado;
- `{"u":"%7B…"}` — o envelope do `dadosCG()`;
- `{"f0":"…","f1":"…"}` — CasparCG Client com "Send as JSON" (todo valor é string);
- `<templateData><componentData id="f0"><data id="text" value="…"/></componentData>…` —
  **o padrão do CasparCG Client**, que manda XML se ninguém marcar o JSON.

Campos `f0`, `f1`… são o vocabulário do Client. Se a peça for operada por ele,
aceite os dois nomes (`d.nome || d.f0`) ou documente no cabeçalho que o operador
tem de renomear as chaves na rundown.

### Ligando a peça

```html
<head>
  …
  <script src="utils/caspar.js"></script>   <!-- SÍNCRONO, antes de tudo -->
</head>
```

```js
// no fim do boot da peça — depois de fontes e plates (o Promise.all do §6)
let ultimo = {};
DB_PECA.on("change", (state) => {
  ultimo = state || {};
  render(ultimo);
  if (CASPAR.arPeloCG) return;       // no modo B o ar é do Caspar; o replicant só dá conteúdo
  /* …as travas de primeiro estado e de on-air, como no modelo… */
});

CASPAR.ligar({
  update: (d) => render(Object.assign({}, ultimo, d)),
  play:   () => { if (!noArNaTela) { noArNaTela = true; primeiro = false; entrar(); } },
  stop:   () => { if (noArNaTela) { noArNaTela = false; return sair(); } },  // devolve a timeline: o remove() espera
  next:   () => proximoPasso(),
});
```

A trava de on-air vale para o CG também: um `CG PLAY` com a peça no ar não
re-anima.

### `CG ADD` com NodeCG por trás

O CG ADD aceita URL (`CG 1-50 ADD 1 "http://…/lt_x.html?ar=cg" 1 …`) — o
servidor escolhe o produtor HTML pela extensão, e existe um atalho para URL com
query. Assim a peça continua servida pelo NodeCG, com replicant e manifestos, e
só o ar vem do CG. É o modo B que se recomenda quando o B for inevitável.

**Descrever os campos para o scanner (opcional).** O media-scanner lê um bloco
`<script name="graphics-data-definition" type="application/json+gdd">` dentro do
HTML e expõe em `GET :8000/templates` — é o formato GDD, que alguns clientes usam
para montar o formulário da peça. Só vale para templates no `template-path`
(modo C).

---

## 10. O dashboard

A gramática é a do SKILL.md §8, sem exceção. O que o Caspar acrescenta:

- **Um bloco "Caspar" no topo do workspace de fullscreen**, só com o que o
  operador precisa numa olhada: luz de conexão (`conectado`/`recebendo` do
  `DB_CASPAR`), versão, e o botão de **emergência** `LIMPAR CANAL` (sempre
  clicável, com confirmação — ele derruba tudo, gráficos permanentes inclusive,
  e a reconciliação só os recarrega no próximo `conectou`).
- **Botão de cena** grava `DB_FS.value = { cena }`, como no vMix. O botão acende
  como **PEDIDO** pelo replicant e o selo vira **NO AR** pelo `DB_CASPAR` (§7).
- **Cena sem clipe no servidor**: com o `CLS` disponível, o painel cruza
  `cfg.caspar.cenas[x].fundo` com a lista e deixa o botão **desabilitado com
  `title`** ("fs/break não está no media-path do Caspar") — mesma regra do
  "controle sem asset". Sem o `CLS` (scanner fora), o botão fica habilitado:
  ausência de lista não é ausência de clipe.
- **Vinheta**: botão que grava um replicant de pedido (`DB_VINHETA = { seq, nome }`
  com `seq` incrementando — "estado com um campo a mais", §1 do SKILL.md); a
  extension manda `PLAY` + `LOADBG EMPTY AUTO`. O restante vem de `fimEm`.
- **RELOAD de camada** (`CALL 1-50 RELOAD`) é ferramenta de ensaio, não de
  programa: fica no workspace de dev, ou atrás de confirmação.
- **Nunca** um campo livre de comando AMCP no dashboard de operação. Um
  `CLEAR 1` digitado errado derruba o programa; comando livre é o
  `scripts/caspar.js`, no terminal de quem sabe o que está fazendo.

### Modo teste: PREVIEW no canal 2, sem tocar no ar

> **Revisto em 2026-10-04 (bundle clash, medido num 2.5.1 real).** A versão
> anterior desta seção *movia* as camadas (CLEAR no canal de onde saía +
> recarregar no destino). Isso tirava do ar o que estava no programa e zerava a
> cena. Na prática, a produção pediu o contrário: **apertar "teste" não pode
> resetar o ar.** O modelo abaixo é o que roda em produção.

Um switch no dashboard (`DB_CASPAR_MODO = { teste: bool }`, declarado na
**extension**, `persistent: false`, nasce em programa) decide **para qual canal
os comandos vão**. Canal 1 = programa, canal 2 = teste (só janela no monitor do
operador; nunca Decklink, nem NDI que alguém receba).

**As cinco regras do modelo:**

1. **Todos os gráficos ficam carregados nos DOIS canais o tempo todo.** A
   reconciliação (§5) carrega as permanentes em ch1 e ch2, cada página com
   `?caspar=<canal>` na URL.
2. **A troca não manda CLEAR, PLAY nem OUT para o canal que sai.** Ele congela
   exatamente como estava: o FS que está no ar continua no ar enquanto se ensaia.
3. **O estado é um só.** Os replicants `DB_*` são os mesmos para os dois
   canais, então o painel nunca perde o que está ativo.
4. **Congelamento por página** (`assets/canal.js`). Cada página do Caspar só
   repassa `change` de replicant quando o canal dela é o
   `DB_CASPAR.canalVivo`. Fora disso, guarda o último valor (pendente). Sem
   isso, ensaiar um LT no ch2 acenderia a mesma barra no ch1, porque o
   replicant é um só.
5. **Voltar ao programa DESCARTA o ensaio.** O ar não recebe um comando sequer.

**A sequência da troca** (na extension):

- **Entrar em teste:** tira um **retrato do programa** (cena do `DB_FS` +
  `visivel` de cada replicant de LT) e publica em `DB_CASPAR.pgm`. O painel
  mostra o retrato numa faixa amarela ("NO AR no PGM: FS x, LT y…"). Depois
  publica `canalVivo = 2`, o ch2 solta o que tinha pendente (passa a espelhar o
  ar) e recebe a cena atual **sem sting**.
- **Voltar:** publica `canalVivo = null` e **todas** as páginas congelam. Devolve
  o retrato aos replicants: `visivel` de cada LT e a cena do `DB_FS`. A cena vai
  com um flag `restaurandoFs` para o handler do `DB_FS` **não** reaplicar, porque
  o PLAY do fundo recomeçaria o loop no ar. Por fim publica `canalVivo = 1` com
  `descartar: true`, e o ch1 joga fora o que ficou pendente. Entre os passos,
  espere ~150 ms para cada publicação chegar às páginas.

```js
/* DB_CASPAR.canalVivo: null enquanto troca (todas congeladas). */
const publicar = (campos) => {
  DB_CASPAR.value = Object.assign({}, DB_CASPAR.value, campos, {
    canal: canalAlvo(), teste: emTeste(), canalVivo: trocando ? null : canalAlvo(),
  });
};

DB_CASPAR_MODO.on("change", async (novo, velho) => {
  if (!velho || !!(novo && novo.teste) === !!velho.teste || !CANAL_TESTE) return;
  if (emTeste()) {
    const cena = (DB_FS.value && DB_FS.value.cena) || null;
    retratoPgm = { cena, lt: REPS_AR.map((r) => !!(r.rep.value && r.rep.value.visivel)) };
    publicar({ descartar: false, pgm: { cena, ar: /* rótulos dos LT no ar */ [] } });
    if ((cenaNoAr[CANAL_TESTE] || null) !== cena) await pedirCena(cena, { canal: CANAL_TESTE, semSting: true });
  } else {
    trocando = true; publicar({}); await esperar(150);
    REPS_AR.forEach((r, i) => { /* devolve visivel do retrato, só se diferente */ });
    if (cenaAtual !== retratoPgm.cena) { restaurandoFs = retratoPgm.cena; DB_FS.value = { ...DB_FS.value, cena: retratoPgm.cena }; }
    await esperar(150);
    trocando = false; retratoPgm = null;
    publicar({ descartar: true, pgm: null });
  }
});
```

Estado que passa a ser **por canal** na extension: `cenaNoAr[canal]`,
`stingDesde[canal]`, e `pedirCena(nome, { canal })` fixa o canal **na hora do
pedido**. Um `await` no meio não pode mudar o destino de uma cena já pedida.

**A página** carrega `<script src="utils/canal.js">` **antes de qualquer script
que chame `nodecg.Replicant`** (antes de `medida.js` etc.). Ele embrulha
`nodecg.Replicant` e o `.on("change")`. Fora do Caspar (sem `?caspar=`, no
navegador, no vMix, no `?dev=1`) não faz nada. Com `?livre=1` também não: use
isso para um canal que não tem teste nem programa (ex.: um canal dedicado só às
telas de câmera, sempre vivo).

**Limites conhecidos:**
- Os **textos** editados no teste (nomes, palpites) continuam nos replicants
  depois da volta, porque só `visivel` e a cena são restaurados. O ch1 segue com
  o texto antigo até o próximo SET.
- Página que lê `.value` direto no boot, sem `on("change")`, escapa do
  congelamento. O efeito só aparece no canal que não está vivo.
- Use `persistent: false` em `DB_CASPAR_MODO`. Um restart nunca acorda em teste.

**No dashboard:**

- O switch fica no bloco Caspar (e/ou numa tecla fina no topo de todo painel,
  via `comum.js`). Desligado, cor de placa. Ligado, **amarelo**, nunca o verde
  de "no ar".
- Em teste, a faixa amarela mostra o retrato do PGM, e o bloco Caspar mostra
  `PGM (canal 1) · fundo: X · TESTE (canal 2) · fundo: Y`. O selo NO AR lê
  **sempre** o canal de programa (`CC.canal`), nunca o canal alvo. Os botões
  passam a refletir o ensaio e voltam ao estado do ar quando o teste desliga.
- Sem confirmação nos dois sentidos: a troca não destrói nada.
- O checklist de abertura do programa ganha uma linha: **saída em PROGRAMA**.

**Verificar** (com o MCP `casparcg`, canal 1 só leitura):

1. `caspar_status`: as permanentes devem estar em `[HTML]` nos dois canais.
   `caspar_pages` lista cada gráfico duas vezes (`?caspar=1` e `?caspar=2`).
2. Em `caspar_page_eval`/`caspar_page_sample`, o `url_contains` **tem que
   incluir o canal** (`lt_single.html?caspar=2`). Só `lt_single` pega qualquer
   uma das duas.
3. `nodecg.Replicant("DB_CASPAR").value.canalVivo` numa página devolve 1 em
   programa e 2 em teste.
4. **Nada resetou:** `caspar_print` do canal 1 antes e depois de ligar o teste
   deve dar o mesmo quadro.
5. **Nada vazou:** em teste, acenda um LT e rode `caspar_page_sample` em
   `?caspar=1`. Nada pode se mexer. Em `?caspar=2` a animação aparece.
6. **Descarte:** dê PLAY em algo no teste e desligue. `caspar_print` do ch1 tem
   que ficar idêntico ao de antes de entrar. O log diz
   `SAÍDA de PROGRAMA (ensaio descartado, ar intocado)`.

| Sintoma | Onde olhar |
|---|---|
| Troca limpou/recarregou camada | handler de `DB_CASPAR_MODO`: não pode haver CLEAR/PLAY de permanentes ali |
| LT do teste apareceu no programa | página sem `canal.js` antes do primeiro script, ou `canalVivo` fora do `publicar()` |
| Cena aplicada no canal errado | `pedirCena` sem `opcoes.canal`; `cenaNoAr`/`stingDesde` globais em vez de por canal |
| Fundo recomeçou o loop na volta | faltou o `restaurandoFs`: a cena restaurada é estado, não ordem |
| Painel sem selo em teste | o selo está lendo o canal alvo, não o de programa |


---

## 11. Testar direto no Caspar

### Pelo terminal

`scripts/caspar.js` usa os mesmos módulos da extension:

```bash
node scripts/caspar.js VERSION INFO                         # está vivo? quais canais?
node scripts/caspar.js 'PLAY 1-50 [HTML] "http://192.168.0.10:9090/bundles/b/graphics/lt_single.html"'
node scripts/caspar.js --osc                                # o que está em cada camada, ao vivo
node scripts/caspar.js 'CALL 1-50 RELOAD'                   # depois de editar o HTML
node scripts/caspar.js --lote 'PLAY 1-20 fs/break MIX 12' 'PLAY 1-30 [HTML] "http://…/fs_break.html" MIX 12'
node scripts/caspar.js --cg 1-50 'http://…/lt_single.html?ar=cg' '{"nome":"Zé \"Ninja\""}'
node scripts/caspar.js 'CLEAR 1-50'
```

Host e porta vão como primeiro argumento (`192.168.0.20` ou `caspar:5250`). O
servidor roda em qualquer Windows com GPU OpenGL 4.5, e como a saída deste
projeto já É a janela `screen`, o ensaio no desktop é o mesmo caminho do ar —
só muda o monitor.

### Com o MCP `casparcg` instalado, use-o primeiro

Existe um servidor MCP para isto: **`mcp-casparcg`** (repo `ottospike/mcp-casparcg`,
instalado em `~/.claude/mcp-casparcg`, registrado como `casparcg`). Tudo desta seção
vira ferramenta:

| Em vez de | Use |
|---|---|
| `node scripts/caspar.js …` | `caspar_command`, `caspar_batch`, `caspar_play`, `caspar_mixer`, `caspar_cg` |
| `--osc` | `caspar_status` (camadas + saídas de cada canal + aviso de canal sem saída) |
| `PRINT` + mover PNG + abrir | `caspar_print` — devolve a imagem e a % de cobertura de alfa |
| `caspar-janela.ps1` | `caspar_window` |
| script CDP avulso | `caspar_page_eval` e **`caspar_page_sample`** (quem animou, quadro a quadro) |
| montar NDI/janela extra na mão | `caspar_consumer` (várias NDI por canal, repor janela fechada) |
| escrever `casparcg.config` | `caspar_config` (gera e valida, inclusive resolução customizada) |

Ele **protege o canal 1** (só leitura) e bloqueia `KILL`/`CLEAR ALL` por padrão: ensaie
no canal de teste. Os scripts abaixo continuam valendo numa máquina sem o MCP.

### Olhar a saída — sem MCP nenhum

Não existe MCP que enxergue uma janela nativa (o Playwright só vê navegador),
e não precisa: três caminhos, do mais exato ao mais literal.

| Como | O que prova | Comando |
|---|---|---|
| **`PRINT <canal>`** | o quadro que o Caspar RENDERIZOU: 1920×1080, todas as camadas compostas, com alfa | `node scripts/caspar.js 'PRINT 2'` → PNG com data/hora no `media-path` |
| **`scripts/caspar-janela.ps1`** | o que a JANELA está mostrando: sobre preto, no tamanho da janela, depois do `stretch` | `powershell -File caspar-janela.ps1 -Saida <pasta> [-Filtro TESTE]` |
| **CDP na 9223** (abaixo) | uma camada HTML sozinha, com DOM e JS | `Page.captureScreenshot` no alvo da camada |

Os PNGs saem em arquivo e são lidos como imagem — é assim que se valida "o
asset apareceu, no lugar certo, com o texto certo" sem ninguém olhar o monitor.

Três coisas aprendidas fazendo:

- 🚨 **Foto de tela fotografa a TELA.** A primeira versão do script usava
  `CopyFromScreen` e trouxe o VS Code e um player de vídeo que estavam por cima
  das janelas do Caspar — uma verificação que "passa" com a imagem errada. O
  script usa `PrintWindow` com `PW_RENDERFULLCONTENT`, que pede o conteúdo à
  própria janela e funciona com ela coberta. Mesmo assim: **olhe a imagem** e
  confira o título que o script imprime.
- **O Chromium de cada camada é um subprocesso também chamado `casparcg.exe`.**
  "O primeiro casparcg" é quase sempre um sem janela; o script usa o processo
  que tem título de janela.
- **PNG de canal vazio é transparente**, e muito visualizador o mostra branco.
  Branco não é "o Caspar pintou branco": confira o alfa do pixel
  (`ffmpeg -i x.png -vf crop=1:1:960:540,format=rgba -f rawvideo - | od -tu1`).
- **`PRINT` escreve no `media-path`**, então o PNG aparece no `CLS` como mídia.
  Apague depois de conferir, ou o painel passa a oferecer print de ensaio como
  clipe.

Combine com o OSC: o `--osc` diz **o que** está em cada camada; o PNG diz **como
ficou**. Os dois juntos fecham "o painel mandou, o Caspar tocou, apareceu certo".

### Por dentro do Chromium do Caspar (CDP)

Ligue `<html><remote-debugging-port>9223</remote-debugging-port></html>` no
`casparcg.config` (reinicia o servidor) e cada camada HTML vira um alvo de
DevTools em `http://<caspar>:9223` — **o navegador que vai ao ar**, não uma aba
parecida. Todo o §10 de `padroes-replicant.md` vale ali: `Runtime.evaluate`
para ler o que a peça desenhou, `Page.captureScreenshot`, amostragem de
`getComputedStyle` por rAF para provar que animou, `LayerTree` para o custo de
render. Use uma porta diferente da do seu Chrome de teste.

🚨 Desligue no programa: a porta de debug dá controle total de JS em toda
camada para quem alcançar a máquina.

### Pelo CasparCG Client

O Client oficial é o jeito de testar o modo B como o operador de Caspar vai usar:
item de template, canal 1, camada 50, e os campos `f0`, `f1`… Teste **com e
sem** "Send as JSON" — o padrão é XML, e é o que vai chegar se ninguém mexer.

### O que conferir (além do checklist do SKILL.md)

- [ ] `PLAY [HTML]` da peça, e ela **aparece** no canal (screenshot ou `screen`),
      não só `202`
- [ ] PLAY → OUT → PLAY pelo painel com a camada carregada no Caspar: a segunda
      entrada anima igual à primeira
- [ ] `CALL 1-50 RELOAD` com a peça no ar: volta no ar, **sem re-animar**
- [ ] cena de fullscreen: fundo e HTML entram no mesmo quadro (grave o canal ou
      olhe o OSC: as duas camadas mudam no mesmo pacote)
- [ ] fechar o Caspar e abrir de novo: as permanentes voltam sozinhas e o
      `DB_FS` foi zerado com aviso no log
- [ ] canal 720p (ou 1080i): a peça escala e anima na mesma duração
- [ ] modo B: `CG ADD` com dado que tenha aspas, `\`, acento e quebra de linha
      chega igual (`--cg` do script)
- [ ] `recebendo: true` no `DB_CASPAR` — sem OSC, o selo NO AR nunca acende
- [ ] **janela de programa**: no monitor certo, sem borda, sem cursor, na frente
      de tudo; um lower third deslizando devagar não rasga nem engasga (§12.3)
- [ ] **alfa conferido numa janela `sbs-key`**, não na de programa (que é sobre
      preto)
- [ ] fim de ensaio: `--osc` mostra só as camadas do programa — nenhuma página
      de preview nem HTML órfão carregado

---

## 12. O servidor, e a JANELA como saída principal

Neste projeto o programa é **visto pela janela do Caspar** (consumer `screen`)
num monitor — é o que vai para a tela, não um preview. NDI sai junto, como
cópia com alfa para quem precisar. Isso tira o Caspar do papel de "gerador de
key/fill" e o põe no de **saída final**, e muda seis coisas.

### O que a janela é, e o que ela não é *(fonte: `screen_consumer.cpp`)*

1. **A janela não tem alfa.** Ela mostra o canal composto **sobre preto**. Um
   gráfico sozinho num canal aparece sobre preto no monitor — que é exatamente
   o que vai para a tela. Para **conferir o alfa** (a franja, a sombra, o
   `background` esquecido no `body`), use uma janela de conferência:
   `<sbs-key>true</sbs-key>` (fill e key lado a lado, janela com o dobro da
   largura) ou `<key-only>true</key-only>`. Na janela de programa, nunca.
2. 🚨 **Fechar a janela MATA a saída.** O `X` da janela encerra o consumer
   (`Closed → is_running_ = false`); o canal continua rodando e o NDI continua
   saindo, mas **a janela não volta sozinha** — só com
   `ADD 1 SCREEN 1` pelo AMCP ou reiniciando o servidor. Na janela de programa:
   `<borderless>true</borderless>` (não tem `X` para clicar) com posição e
   tamanho fixos. E na 2.5, canal sem consumer nenhum para de renderizar.
3. **A janela não é relógio.** O `screen` declara que não sincroniza o canal;
   sem Decklink, o canal anda no relógio do sistema, na cadência do
   `video-mode`. Monitor de 60 Hz com canal `1080p5994` repete ou pula um
   quadro a cada ~16,7 s; sem `vsync`, rasga (tearing) em movimento horizontal
   — lower third deslizando é o caso que mais aparece. **Se o destino final é
   só a tela, case o canal com o monitor: `1080p6000` + `<vsync>true</vsync>`.**
   Se o NDI alimenta uma produção em 59,94, mantenha `1080p5994` e aceite a
   repetição na janela. *(inferência do fonte; confirme olhando um deslize
   lento no monitor real antes de decidir)*
4. **`device` é o número do monitor no Windows** (1 = principal). Fullscreen
   exclusivo (`windowed false`) numa máquina de vários monitores costuma
   brigar com o foco; **`borderless` + `x`/`y`/`width`/`height`** cobrindo o
   monitor é mais previsível. Na 2.4 esses quatro só existem no config; na 2.5
   também no `ADD … SCREEN`.
5. **`interactive false` esconde o cursor.** Na 2.5.1 é só isso que ele faz — a
   janela não repassa mouse nem teclado para o HTML. O cursor parado em cima do
   LED no meio do programa é o clássico.
6. **Capturar a janela com outro software (window capture do OBS/vMix) perde o
   alfa e soma latência.** Se o Caspar precisa entrar em outro software, é NDI.

`stretch uniform` (o padrão é `fill`) mantém a proporção quando a janela de
monitoração é redimensionada; `always-on-top` segura a janela de programa na
frente de qualquer coisa que abra na máquina.

### O config de referência

Montado sobre o do projeto anterior (dois canais: programa e LED, cada um com
janela + NDI), com as correções que a análise dele pediu:

```xml
<configuration>
  <paths>
    <media-path>media/</media-path>
    <log-path>log/</log-path>
    <data-path>data/</data-path>
    <template-path>template/</template-path>
    <!-- NÃO aponte o template-path para bundles/<b>/graphics. Visto no projeto
         anterior: as peças abriam por file://, sem o NodeCG servindo — sem
         replicant, sem manifesto. Gráfico do bundle entra por URL (§3). -->
  </paths>
  <channels>
    <!-- CANAL 1 — PROGRAMA. A janela no monitor 2 é a saída final. -->
    <channel>
      <video-mode>1080p5994</video-mode>   <!-- UM video-mode por canal (o antigo repetia) -->
      <consumers>
        <screen>
          <device>2</device>
          <windowed>true</windowed>
          <borderless>true</borderless>     <!-- sem X para fechar a saída sem querer -->
          <x>1920</x><y>0</y><width>1920</width><height>1080</height>
          <always-on-top>true</always-on-top>
          <interactive>false</interactive>  <!-- sem cursor no ar -->
          <vsync>true</vsync>
        </screen>
        <ndi><name>GC</name></ndi>
        <system-audio />

        <!-- DECKLINK — SEM PLACA INSTALADA HOJE. Deixe comentado; descomente
             para testar SDI quando houver uma. Com o bloco ativo e SEM a placa,
             o consumer falha ao iniciar e o erro vai para o log — não
             descomente "por garantia".
             · device = número da placa no console do Caspar no boot (1..).
               Numa Quad 2 as portas SDI viram devices na ordem 1,5,2,6,3,7,4,8.
             · keyer external = fill numa saída e key na seguinte (configure a
               placa como dual-connector no Desktop Video Setup); internal = a
               placa keya sobre a própria entrada SDI (1 quadro de atraso).
             · Com Decklink ativa, ELA passa a ser o relógio do canal: o
               video-mode tem de ser um que a placa aceita (720p2398 e 576p2500,
               por exemplo, não). Isso muda o raciocínio do vsync do §12.3.
             · A 2.4 exige driver Desktop Video 11 ou mais novo.
        <decklink>
          <device>1</device>
          <keyer>external</keyer>
          <key-only>false</key-only>
          <embedded-audio>false</embedded-audio>
          <latency>normal</latency>
          <buffer-depth>3</buffer-depth>
        </decklink>
        -->
      </consumers>
    </channel>
    <!-- CANAL 2 — LED. Mesma ideia, outro monitor. -->
    <channel>
      <video-mode>1080p5994</video-mode>
      <consumers>
        <screen>
          <device>3</device>
          <windowed>true</windowed><borderless>true</borderless>
          <x>3840</x><y>0</y><width>1920</width><height>1080</height>
          <interactive>false</interactive>
        </screen>
        <ndi><name>GFX - LED</name></ndi>
      </consumers>
    </channel>
  </channels>
  <controllers>
    <tcp><port>5250</port><protocol>AMCP</protocol></tcp>
  </controllers>
  <amcp><media-server><host>localhost</host><port>8000</port></media-server></amcp>
  <html>
    <enable-gpu>false</enable-gpu>
    <remote-debugging-port>0</remote-debugging-port>   <!-- 9223 só no ensaio -->
  </html>
  <osc><default-port>6250</default-port></osc>
</configuration>
```

- As coordenadas `x`/`y` são do desktop virtual do Windows: com três monitores
  de 1920 lado a lado, o segundo começa em 1920 e o terceiro em 3840. Confira
  em Configurações de Vídeo antes de copiar — é por monitor, por máquina.
- **Uma janela de ensaio** para quem monta os gráficos: um `screen` a mais no
  canal 1, `windowed true`, **sem** `borderless`, `stretch uniform`, e
  `<sbs-key>true</sbs-key>` para ver fill e key juntos. Tire antes do programa —
  cada janela é mais um upload do quadro por GPU.
- **O `video-mode` define a página HTML e a duração de toda transição**, e com
  a janela como saída ele também decide se o monitor rasga (item 3 acima).
- `<producers><producer id="10">DECKLINK DEVICE 2</producer></producers>` dentro
  do `<channel>` (2.4+) carrega uma camada no boot do SERVIDOR — útil para a
  fonte de programa. Gráficos do bundle **não** vão aqui: eles dependem do
  NodeCG estar no ar, e quem sabe disso é a reconciliação da extension.
- Sem o **media-scanner** rodando, `CLS`/`TLS`/`CINF`/`THUMBNAIL` dão `501`. Ele
  lê o `casparcg.config` ao lado dele para achar as pastas.
- 🚨 **O `casparcg_auto_restart.bat` da instalação 2.4.0 de referência não sobe
  o scanner.** Ele só roda `scanner.exe` se existir `leveldown.node` na pasta —
  e essa versão traz o binário em `prebuilds\win32-x64\node.napi.node`, não
  `leveldown.node`. A pasta `_media\` (o banco do scanner) mostra que ele já
  rodou, provavelmente aberto à mão. Suba o `scanner.exe` separado, ou corrija a
  condição do `.bat`. *(lido nos arquivos; não executado)*
- 🚨 **E o da 2.5.1 também não** — por outro motivo. O `.bat` novo roda
  `scanner.exe`, mas o zip da release traz o scanner como
  `casparcg-scanner-v1.4.0-win32-x64.exe`. Copie com o nome `scanner.exe` (foi o
  que se fez na instalação deste projeto, e o `CLS` passou a responder).
- **Monitor de 144 Hz** (os desta máquina): 144 ÷ 59,94 não é inteiro, e a
  janela de programa trepida mesmo com `vsync`. No monitor da janela do ar,
  ponha **60 Hz** nas configurações de vídeo do Windows.
- O `.bat` reinicia o servidor quando ele sai com código 5 (`RESTART` pelo AMCP).
  Uma queda (crash) sai com outro código e **não** reinicia.
- O caminho do `media-path` aceita `/` no Windows. Não use `\` cru.

---

## 13. Armadilhas

1. **`nodecgUrl` com `127.0.0.1`** e Caspar em outra máquina (ou NodeCG em
   Docker): camada em branco, `202 OK`, erro só no log do Caspar.
2. **`width=`/`height=` na URL** redimensionam a página do gráfico.
3. **Transição em quadros**: trocar o formato do canal muda a duração de todas.
4. **Comando mandado com a conexão caída não é enviado depois.** De propósito
   (§5). Quem restaura é a reconciliação.
5. **Resposta fora de ordem entre canais.** Uma fila por canal no servidor; por
   isso o cliente casa por `REQ <id>`. Um cliente caseiro que casa por ordem de
   chegada entrega a resposta do comando errado.
6. **`\` dentro de aspas AMCP é escape**, e escape desconhecido some:
   `"C:\media\x"` chega como `C:mediax`. Tudo passa por `q()`.
7. **CG `update()` com aspas/`\`/quebra de linha quebra** (2.5.1) — `dadosCG()`.
8. **`CG STOP` não libera a camada**; `remove()` nativo também não. `CLEAR`.
9. **`update`/`play` definidos depois de um `await` se perdem.** `utils/caspar.js`
   no `<head>`.
10. **CasparCG Client manda XML por padrão**, com chaves `f0`, `f1`.
11. **CG numa camada em transição → `403`.**
12. **OSC na 6250 disputada com o CasparCG Client** → `OSC SUBSCRIBE` noutra porta.
13. **`CLS` sem scanner → `501`**; nenhum painel pode depender dele para subir.
14. **Wiki desatualizada**: `CG INFO`, `INFO TEMPLATE/SYSTEM/SERVER`, `HELP`,
    `MIXER MIPMAP`, `SET CHANNEL_LAYOUT` e a cor BGR **não existem** na 2.5.1.
    A lib `casparcg-connection` ainda expõe alguns desses métodos; eles falham.
15. **Canal sem consumer não renderiza** (2.5). Um canal "de trabalho" que só
    serve de origem para `route://` pode precisar de um consumer (um `screen`
    minimizado basta). Não confirmado — meça antes de depender.
16. **`mix-blend-mode` não enxerga as camadas de baixo.** `MIXER BLEND`.
17. **Alfa straight num clipe** vira franja escura: o Caspar espera
    premultiplicado.
18. **Fechar a janela de programa derruba a saída** até um `ADD 1 SCREEN`.
    `borderless` na janela de programa (§12).
19. **Janela não mostra alfa.** Conferir transparência pela janela de programa
    é impossível — janela de conferência com `sbs-key`.
20. **`KILL` pode travar o desligamento** (medido na 2.5.1, com HTML e clipes
    carregados): responde `202`, fecha a porta 5250, e o processo fica parado em
    `video_channel[1] Uninitializing` sem sair. Com o `.bat`, isso é uma saída
    que nunca acontece. `CLEAR` nos canais antes ajuda pouco; o que resolve é
    encerrar a árvore de processos (`taskkill /PID <pid> /T /F`). Nunca no
    meio do programa.

21. **Lote com um comando só executa, mas nunca responde.** `BEGIN` + 1 comando
    + `COMMIT` fica sem resposta e o cliente espera para sempre. Mande o caso de
    um comando sem `BEGIN/COMMIT`.
22. **Saída recém-adicionada leva ~1 s para aparecer no `INFO`.** Conferir logo
    depois do `ADD` diz "sem saída" e engana.
23. **`PRINT` de canal vazio é transparente,** não preto nem branco. Confira a
    cobertura de alfa (o `caspar_print` do MCP informa) antes de concluir que a
    peça "não desenhou".
24. **Duas páginas iguais em canais diferentes** (modo teste, §10): em DevTools
    (`caspar_page_eval`, `caspar_page_sample`), filtre pela URL **com o canal**
    (`lt_x.html?caspar=2`). Só o nome do arquivo pega qualquer uma das duas.

### O que os logs do projeto anterior mostraram

A instalação de referência guarda os logs de três dias de programa (2024 e
2025, ~1,3 milhão de linhas). Cada item abaixo apareceu lá, com contagem:

- **Um Chromium novo por disparo.** ~16 mil `PLAY … [HTML]` e ~12 mil `CLEAR`:
  cada entrada de peça recarregava a página. Junto, ~2,3 mil avisos
  `Assertion Failed: destroyer->size() < 8` — produtores sendo destruídos mais
  rápido do que o servidor consegue fechar (fechar um Chromium é lento). É o
  argumento de performance do modo A: camada permanente, ar no replicant.
- **Páginas órfãs.** Dezenas de milhares de `Unhandled socket connection error:
  xhr poll error` — camadas HTML que continuaram carregadas depois que o NodeCG
  saiu do ar, tentando reconectar para sempre. E páginas de `?isPreview=1`
  carregadas no canal 2: cada uma é um Chromium inteiro renderizando.
  `INFO`/OSC no fim do ensaio diz o que ficou carregado; `CLEAR` no que não é
  do programa.
- **`update("")` quebrando template.** `REEL.html` estourou
  `Unexpected end of JSON input` 73 vezes: `CG ADD` sem dado chama
  `update("")`, e a peça fazia `JSON.parse` direto. É o item 6 do §9, visto no
  ar. `utils/caspar.js` trata `""`.
- **Template literal que não interpolou.** 260 comandos chegaram ao servidor
  como `CG 1-… ADD 1 "…" 1 ${injectObj}` — aspas simples no lugar de crase no
  código que montava o comando. O Caspar tratou `${injectObj}` como nome de
  dataset e a peça entrou vazia, com `202`. Monte comando com `q()`/`dadosCG()`,
  nunca concatenando à mão.
- **Página que não sabia viver sem o dado.** `TypeError: Cannot read properties
  of undefined/null` às centenas em `draft.html` e
  `waitingScreen_players.html` — o replicant parcial do §6 do SKILL.md, agora
  dentro do Caspar, onde ninguém vê o console. O log do Caspar é o console.
- **Stinger em `1-9999`**, a camada padrão do CG (§2).

---

## 14. Migrando uma instalação vMix → Caspar

O bundle quase não muda — é isso que o modelo de estado compra:

1. `cfg.vmix` → `cfg.caspar` (§4): cada `inputs[cena]` vira `cenas[cena]` com
   `fundo` (o clipe que era o input) e `html` (a browser source que ficava por
   cima).
2. Na extension, `previewThenStinger(input)` → `aplicarCena(cena)` (§5). O
   `DB_FS`, a guarda de primeira emissão e o `persistent: false` ficam.
3. Browser sources de lower third e peças de canto → `permanentes`.
4. Nada muda nos gráficos (modo A). Nada muda nos painéis, exceto o selo, que
   agora **pode** existir (§7).
5. O delay de 100ms entre preview e stinger **sai** — no Caspar a transição vai
   no próprio PLAY.

As duas pontes podem coexistir (`enabled` em cada uma) enquanto a produção
decide; uma cena com as duas ligadas vai para os dois sistemas ao mesmo tempo,
então só uma fica `enabled` no dia do programa.

Na direção contrária (bundle antigo feito para o Caspar com
`sendMessage`/`xPlay`/`xOut` → vMix), o roteiro está em `vmix.md`.

---

## 15. Composição: fundo em vídeo + HTML, ligados na entrada e na saída

O caso: `fs_tabela.html` (a tabela, com dado vivo) por cima de
`bg_tabela.mp4`/`.mov` (o fundo animado do motion). A tabela tem de entrar **num
quadro certo do fundo** (quando a moldura do vídeo abriu) e sair **antes** de o
fundo ir embora. Tudo abaixo foi montado e medido no servidor 2.5.1 real, com
`PRINT` em cada fase.

### A divisão de trabalho

| Quem | Faz |
|---|---|
| **Caspar, camada 20** | o fundo: entrada → loop → saída, no relógio do próprio servidor |
| **Caspar, camada 31** | `fs_tabela.html`, **permanente**, transparente até a cena dela |
| **Extension** | toca o fundo e publica os **prazos** em `DB_FS_AR` |
| **Gráfico** | agenda a própria timeline GSAP por esses prazos |

O HTML fica **permanente** de propósito. Carregado na hora do PLAY, a entrada da
tabela dependeria do tempo de carga da página, e ela cairia "quando der" em vez
de cair no quadro 40. Custa a memória de um Chromium por fullscreen desse tipo
(§8); para as cenas que não têm vídeo ligado, carregar na hora continua valendo.

### O fundo: um clipe com marcas, ou três clipes

O motion entrega de um de dois jeitos, e os dois funcionam (medido):

**Um clipe com marcas** (`bg_tabela.mp4`: entrada 0–120, loop 120–240, saída
240–360):

```
entrar: PLAY 1-20 fs/bg_tabela SEEK 0 IN 120 OUT 240 LOOP
sair:   CALL 1-20 LOOP 0  +  CALL 1-20 SEEK 240  +  CALL 1-20 OUT 360  +  LOADBG 1-20 EMPTY AUTO
```

`IN`/`OUT` com `LOOP` fazem o clipe tocar do 0 e ficar girando entre 120 e 240
(medido: 2,0 s ↔ 4,0 s a 59,94). Na saída, o **`SEEK 240` é o que torna a
saída previsível**. Sem ele, o clipe só chega na saída quando termina a volta
em que está: um atraso de 0 até um ciclo inteiro, dependendo de quando o
operador apertou. Com ele, a saída começa já e dura sempre `fim − loopOut`
quadros. O custo é um corte seco do ponto do loop para o quadro 240: peça ao
motion que o quadro 240 case com o começo do loop.

**Três clipes** (`bg_tabela_in`, `bg_tabela_loop`, `bg_tabela_out`):

```
entrar: PLAY 1-20 fs/bg_tabela_in  +  LOADBG 1-20 fs/bg_tabela_loop LOOP AUTO
sair:   PLAY 1-20 fs/bg_tabela_out  +  LOADBG 1-20 EMPTY AUTO
```

O `AUTO` troca para o loop **no quadro em que a entrada acaba** (medido: 1,63 s,
exatamente os 98 quadros do clipe), e troca para vazio no fim da saída. É o
servidor que encadeia, sem timer na extension. A saída também corta do ponto do
loop; um `MIX 4` no `PLAY … out` esconde o corte.

Com canal alfa, o fundo é `.mov` ProRes 4444 (medido: `yuva444p12le` toca com
alfa) ou `.webm` VP9. Um fundo de tela cheia, sem alfa, pode ser `.mp4` H.264
— **na camada de vídeo do Caspar**. Dentro do HTML, não (ver compatibilidade).

### Os prazos: `DB_FS_AR`

O painel continua gravando só `DB_FS = { cena }`. A extension traduz em ar,
**com horário**:

```js
// extension — declarado aqui, persistent:false (ar nunca persiste, §4 do SKILL.md)
const DB_FS_AR = nodecg.Replicant("DB_FS_AR", {
  defaultValue: { cena: null, htmlEntraEm: null, htmlSaiEm: null },
  persistent: false,
});
const QUADRO_MS = 1000 / (CC.fps || 59.94);   // o fps do CANAL; as marcas vêm em quadros do motion
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function fundoEntra(f, cam) {
  return f.clipe
    ? [`PLAY ${cam} ${f.clipe} SEEK 0 IN ${f.loopIn} OUT ${f.loopOut} LOOP`]
    : [`PLAY ${cam} ${f.entrada}`, `LOADBG ${cam} ${f.loop} LOOP AUTO`];
}
function fundoSai(f, cam) {
  return f.clipe
    ? [`CALL ${cam} LOOP 0`, `CALL ${cam} SEEK ${f.loopOut}`, `CALL ${cam} OUT ${f.fim}`, `LOADBG ${cam} EMPTY AUTO`]
    : [`PLAY ${cam} ${f.saida} ${f.corteSaida || ""}`.trim(), `LOADBG ${cam} EMPTY AUTO`];
}
const quadrosDeSaida = (f) => (f.clipe ? f.fim - f.loopOut : f.saidaQuadros);

async function entrarCena(nome) {
  const c = CENAS[nome];
  const r = await caspar.lote(fundoEntra(c.fundo, L(CAM.fsFundo)));
  if (!r.ok) {
    nodecg.log.error(`[caspar] fundo da cena "${nome}" não entrou (${r.msg}) — a tabela fica fora`);
    return;
  }
  // A resposta volta em ~ms: Date.now() aqui É o quadro 0 do fundo, para
  // efeito de animação. O prazo absorve o atraso do replicant até a página.
  const t0 = Date.now();
  DB_FS_AR.value = { cena: nome, htmlEntraEm: Math.round(t0 + (c.htmlEntra || 0) * QUADRO_MS), htmlSaiEm: null };
}

async function sairCena() {
  const ar = DB_FS_AR.value;
  if (!ar || !ar.cena) return;
  const c = CENAS[ar.cena];
  const saiEm = Date.now();
  DB_FS_AR.value = { ...ar, htmlSaiEm: saiEm };               // 1. a tabela começa a sair JÁ
  await esperar((c.fundoSaiDepois || 0) * QUADRO_MS);          // 2. o fundo espera ela sair
  if (DB_FS_AR.value.htmlSaiEm !== saiEm) return;              //    outro pedido chegou no meio
  await caspar.lote(fundoSai(c.fundo, L(CAM.fsFundo)));
  await esperar(quadrosDeSaida(c.fundo) * QUADRO_MS + 100);    // 3. fundo terminou (AUTO limpou)
  if (DB_FS_AR.value.htmlSaiEm === saiEm) DB_FS_AR.value = { cena: null, htmlEntraEm: null, htmlSaiEm: null };
}

let primeiraCena = true;
DB_FS.on("change", async (novo) => {
  if (primeiraCena) { primeiraCena = false; return; }
  const alvo = (novo && novo.cena) || null;
  const atual = DB_FS_AR.value && DB_FS_AR.value.cena;
  if (alvo === atual) return;
  if (atual) await sairCena();          // troca direta = sai a atual, entra a nova
  if (alvo) await entrarCena(alvo);
});
```

E a cena no `cfg`, com as marcas **em quadros do vídeo** — é a língua do motion,
e é o que ele escreve no briefing:

```json
"tabela": {
  "fundo": { "clipe": "fs/bg_tabela", "loopIn": 120, "loopOut": 240, "fim": 360 },
  "_fundo3": { "entrada": "fs/bg_tabela_in", "loop": "fs/bg_tabela_loop", "saida": "fs/bg_tabela_out", "saidaQuadros": 45, "corteSaida": "MIX 4" },
  "html": "fs_tabela.html",
  "camadaHtml": 31,
  "htmlEntra": 40,
  "fundoSaiDepois": 24
}
```

- `htmlEntra`: o quadro do fundo em que a tabela começa a entrar.
- `fundoSaiDepois`: quantos quadros a tabela tem para sair antes de o fundo
  começar a ir embora. Tem de ser ≥ a duração da `tlSaida` do gráfico.
- `camadaHtml` entra na lista de `permanentes` (§4): o HTML sobe no boot e na
  reconciliação, e no modo teste (§10) fica carregado nos dois canais.
- Confira as marcas contra o `CINF` do clipe na conexão (quantidade de quadros)
  e logue divergência. Um vídeo reexportado com 10 quadros a mais desliga tudo
  em silêncio.

### O gráfico: agendar por prazo

O modelo completo está em **`assets/fs-com-fundo-modelo.html`**. O miolo:

```js
function rodarEm(epoch, fabrica) {
  const atraso = epoch - Date.now();
  const iniciar = (pular) => { tl && tl.kill(); tl = fabrica(); tl.play(Math.min(pular, tl.duration())); };
  if (atraso > 0) timer = setTimeout(() => iniciar(0), atraso);   // no prazo: espera e roda do começo
  else iniciar(-atraso / 1000);                                     // passou: roda do ponto em que estaria
}
DB_FS_AR.on("change", (s) => {
  clearTimeout(timer);
  if (!s || s.cena !== MINHA_CENA || !s.htmlEntraEm) return esconder();
  s.htmlSaiEm ? rodarEm(s.htmlSaiEm, tlSaida) : rodarEm(s.htmlEntraEm, tlEntrada);
});
```

Medido no servidor real, com a página na camada 2-31 e o fundo na 2-20:

| Fase | Resultado |
|---|---|
| entrada no quadro 40 do fundo (667 ms) | disparou **1 ms** depois do prazo |
| `CALL RELOAD` com a tabela no ar | a página voltou e **pulou 4,2 s de timeline**: apareceu parada, sem re-animar |
| saída | disparou **0 ms** do prazo; o fundo saiu 24 quadros depois e o canal ficou vazio (`PRINT` com alfa 0) |

O prazo absoluto é o que faz os três casos funcionarem com o mesmo código. É a
regra "relógio guarda prazo" do §4 do SKILL.md, aplicada à animação: a peça não
reage "quando a mensagem chegou", ela anima **no horário em que devia**. Se
chegou atrasada, ela pula a diferença.

Precisão: o Chromium do Caspar não é travado ao relógio do canal (§8), então
conte com ±1 quadro entre a tabela e o vídeo. Para amarrar um elemento ao
quadro exato do vídeo (um texto que precisa acompanhar um objeto do vídeo), a
saída é o vídeo **dentro** do HTML: veja a alternativa abaixo.

### A alternativa: o vídeo dentro do HTML

`<video>` na própria página, com a timeline GSAP amarrada ao `currentTime`.
Sincronia perfeita e uma camada só — mas:

- **só `.webm` (VP9/VP8) ou AV1.** O Chromium do Caspar **não toca H.264**
  (medido: `DEMUXER_ERROR_NO_SUPPORTED_STREAMS` com um `.mp4`), nem ProRes;
- o vídeo é decodificado pelo Chromium, em software, e soma ao custo de render
  da página (`render-no-vmix.md` vale igual aqui);
- o `.webm` com alfa do bundle tocou (1920×1080) com o `requestAnimationFrame`
  a 59 fps — mas meça a peça real antes de adotar.

Use quando a sincronia de quadro importa mais que o custo. Para "tabela sobre
fundo animado", as duas camadas bastam.

### Checklist da composição

- [ ] marcas do cfg batem com o `CINF` (quadros) do clipe entregue
- [ ] `PRINT` antes do `htmlEntra`: só fundo; depois: fundo + tabela no lugar
- [ ] `CALL <camada> RELOAD` com a cena no ar: a tabela volta **parada**
- [ ] saída pedida no meio do loop começa já (`SEEK` ou clipe de saída), não no
      fim da volta
- [ ] `fundoSaiDepois` ≥ a duração da `tlSaida`: a tabela nunca fica sobre fundo
      nenhum
- [ ] fim da saída: `PRINT` transparente, `DB_FS_AR.cena === null`
- [ ] trocar de cena direto (tabela → bracket) sai uma e entra a outra, sem as
      duas tabelas juntas

---

## 16. Um port real: o bundle brawlstars (2026-09-28)

O primeiro bundle portado com este documento. Serve de referência, porque tudo
aqui rodou no Caspar 2.5.1 pelo dashboard de verdade (botões clicados, `PRINT`
de cada cena). Código em `bundles/brawlstars/extension/caspar.js`, config em
`cfg/brawlstars.json` → `caspar`.

**Bandas decididas pela produção** (substituem o mapa de 10 em 10 do §2 neste
projeto):

| Banda | O quê |
|---|---|
| 1–100 | fundos de fullscreen: webm **sempre em LOOP** (10 = fundo, 20 = fundo extra) |
| 1000+ | HTML do bundle, todo **permanente**: FS em 1000–1006 (opacidade 0 até a cena), draft em 1050, LT em 1100–1108 (opacos) |
| 9999 | stinger (e é a camada padrão do CG — ninguém manda CG sem camada) |

**O comando de cena é calculado só do ALVO.** Todo PLAY de cena manda o lote
inteiro: fundo da cena em LOOP (ou `EMPTY`), fundo extra (ou `EMPTY`), e
`MIXER OPACITY` 1 no HTML da cena e 0 em **todos** os outros HTML de fullscreen
— tudo com a mesma duração (`MIX 12` e opacidade em 12 quadros). Consequências
medidas:
- trocar de cena direto (Chave → Chave + pontos → Formato 1) é crossfade, sem
  sobra da anterior;
- o OUT funciona sem a extension saber o que está no Caspar (restart do NodeCG,
  alguém mexeu pelo Client) — não existe "de onde vim" para errar.

**Painéis: quase nada muda.** Todo PLAY/OUT de fullscreen já gravava `DB_FS`, e
o lower third já era `visivel`. Só trocou a FONTE da lista de cenas: um
`mapaCenas()` no `comum.js` lê `cfg.caspar.cenas` quando o Caspar está ligado e
`cfg.vmix.inputs` quando não. Mais o bloco "Caspar" no Fullscreen (conexão e
fundo lido do OSC) e a **tecla de modo teste no topo de todo painel** — toggle
de um clique, sem confirmação, amarela quando ligada (§10).

**Custo medido** com os 15 gráficos permanentes, 2 canais 1080p59,94, 2 janelas
e NDI, nada em cena e 2 lower thirds no ar (Ryzen de 16 threads + RTX 3070):

| Processo | CPU | RAM |
|---|---|---|
| Caspar (mixer dos 2 canais + janelas + NDI) | ~1,3 núcleo | 2,8 GB |
| 11 páginas paradas | 0% | ~100 MB cada |
| 4 páginas com vídeo/animação rodando | ~65% somadas | ~200 MB cada |
| total | ~2 núcleos | 5,2 GB |

Página parada é barata em CPU; o que custa é **vídeo tocando em página
invisível**. Um fullscreen com webm interno (o `fs_vs` toca as placas em
webm) segue decodificando com opacidade 0. A correção é a peça pausar o próprio
vídeo quando `DB_FS.cena` não é a dela — a mesma regra "fora do ar, pause" do
SKILL.md, com o ar lido do `DB_FS`.

**Duas peças que leem o MESMO ar não podem ficar carregadas juntas.** `draft.html` e `draft_escudos.html` são variantes (uma com ban global, outra com escudo) e as duas escutam `DB_DRAFT_AR`. No vMix só uma era input; no Caspar, com as duas permanentes, o PLAY do draft desenharia as duas barras uma sobre a outra. O cfg carrega UMA (`arProprio`), e trocar de variante é trocar o arquivo ali. Antes de pôr uma peça em `permanentes`, confira com `grep Replicant(` se outra já escuta o mesmo ar.

**Três coisas que o port pegou e o documento não previa:**
- **Os cabeçalhos das peças mentiam sobre o fundo.** Diziam "o fundo é o
  `bg.png`, still no vMix"; os commits posteriores já tinham trocado para webm
  animado. Na dúvida entre cabeçalho e histórico, o `git log` da peça decide —
  e o cabeçalho é atualizado no mesmo commit do port.
- **Nome de clipe com espaço existe** (`FS_VS BG`). O código põe aspas em todo
  nome de clipe (`q()`); não conte com o motion entregar sem espaço.
- **Fundos a 24 fps num canal 59,94.** O Caspar converte a cadência; o
  movimento do fundo fica com o passo do 24. Se incomodar, o motion exporta a
  59,94.

**Verificação de dashboard por Playwright:** o MCP grava tudo em
`bundles/.playwright-mcp` e só aceita caminho de arquivo dentro de `bundles/`.
Pasta sem `package.json` em `bundles/` derruba o NodeCG no boot seguinte — mova
o que precisar para o scratchpad e **apague a pasta** antes de encerrar.
