# Famílias de peça — como cada área é construída, animada e ligada ao estado

Este documento é a **anatomia de runtime** de um kit de broadcast: o que muda de
uma área para outra (lower third, fullscreen, draft, in-game, câmera), e o que
não muda nunca. É o complemento de `psd-to-html/tipos-de-peca.md` — aquele
documento classifica a ARTE que chega do designer; este diz como o HTML daquela
arte se comporta no ar.

Os números concretos aqui são **exemplo de como a restrição se manifesta**, e
saíram de um kit real (LEAGUETV Brawl Stars: 30 gráficos, 15 painéis). O que
copia é o raciocínio, não o valor.

> A pergunta que este documento responde antes de qualquer outra:
> **quem põe esta peça no ar?** A resposta decide família, decide se existe
> timeline, decide se o replicant tem campo `visivel`, e decide metade do
> arquivo.

---

## 0. Decidindo a família em três perguntas

| | Quem transiciona | Anima no HTML? | Campo `visivel`? | Prefixo |
|---|---|---|---|---|
| Entra e sai **a cada informação** | o próprio HTML, por replicant | sim, GSAP | **sim** | `lt_` |
| É uma **cena do switcher** | o vMix (`PreviewInput` + `Stinger`) | não | **não** | `fs_` |
| Fica no ar por **trechos longos** e se preenche | o HTML, mas uma vez só | entrada/saída da peça inteira | sim | **sem prefixo** |

🚨 **O critério é QUEM ANIMA, não quanto do quadro a peça ocupa.** Uma barra que
cobre a faixa de baixo inteira, sobre a câmera do estúdio, e que entra pela
própria timeline é `lt_`. Chamá-la de `fs_` promete uma cena no switcher que não
existe, e quem for ligar a peça procura um input que ninguém montou.

🚨 **E o prefixo pode mentir por herança.** Num bundle real o `lt_metaLike.html`
tem prefixo `lt_` e **não é** lower third: é peça de canto, da terceira família.
O nome veio de um rename pedido pela produção. Quando o prefixo e o
comportamento divergirem, o **cabeçalho do arquivo manda** — e ele tem que dizer
isso em voz alta, na primeira tela:

```
⚠️ O `lt_` do nome NÃO põe este arquivo na família dos lower thirds. Lower third
aqui é peça que entra e sai a cada informação; esta fica no canto por trechos
longos, que é a terceira família. Quem for procurar a gramática de animação
desta peça, procure lá, não nos `lt_` de verdade.
```

### A quarta família que não é família: peça dirigida por utilitário

Quando **quatro ou mais peças são o mesmo mecanismo com números diferentes**
(as molduras de 2, 3, 4 e 5 câmeras), o runtime sobe para `utils/` e cada
`.html` fica sendo só a GEOMETRIA daquela arte. Ver §8.

---

## 1. O esqueleto que TODA peça tem

Independente da família. Se falta um destes, é bug esperando a hora.

```html
<body>
  <div class="stage bs-ar">        <!-- 1920×1080, plates por coordenada de canvas -->
    <div id="peca">…</div>
    <div id="dev"></div>           <!-- só com .dev no stage -->
  </div>

  <script src="vendor/gsap.min.js"></script>   <!-- só se anima -->
  <script src="utils/medida.js"></script>      <!-- se tem texto de largura livre -->
  <script src="utils/video.js"></script>       <!-- se a arte é webm -->
  <script src="utils/imagem.js"></script>      <!-- se tem imagem que pode faltar -->
  <script src="/bundles/<b>/shared/assets.js"></script>  <!-- se resolve imagem por nome -->
  <script> … a peça … </script>

  <script src="utils/fit.js"></script>         <!-- SEMPRE, e por último -->
  <script src="utils/devmode.js"></script>     <!-- SEMPRE, depois do fit -->
</body>
```

### A ordem do boot, e por que ela é um `Promise.all`

**Nada de assinar replicant antes de a peça poder desenhar direito.** Toda peça
do kit tem a mesma forma:

```js
Promise.all([
  MEDIDA.pronta(FACES),            // a face real, antes de qualquer medição
  VIDEO.preparar(arteEl, ARTE),    // o webm com buffer, antes de qualquer play
  BS.carregar(),                   // os manifestos de imagem por nome
]).then(function (r) {
  diag.arte = r[1] ? "pronta" : "FALHOU — sem arte";
  render(null);                    // desenha o estado vazio
  iniciar();                       // SÓ AGORA assina o replicant
});
```

Três coisas que fazem isso funcionar, e as três custaram ar:

- **Nenhuma das promessas rejeita.** Fonte atrasada cai na rede de segurança
  (`MEDIDA.aoCarregarFontes`), vídeo que falhou vira log. A peça assina o
  replicant de qualquer jeito — sem arte, mas obedecendo ao painel. Travar a
  entrada porque o webm falhou troca "barra sem fundo" por "nada no ar", que é
  estritamente pior.
- **O que é POLLING de dado fica FORA do `Promise.all`.** Num arquivo que
  consome um gateway externo, o `LIVESTATS.assinar()` mora solto, acima: pendurá-lo
  ali faria um webm lento atrasar a primeira contagem — e um webm que falhasse
  levaria junto os números de uma segunda peça que nem vídeo tem.
- **`render(null)` antes de `iniciar()`.** A peça tem que ter um quadro válido
  desenhado antes do primeiro `change`. Num relógio, `00:00` lê como "ninguém
  armou"; quatro células vazias leem como peça quebrada.

### A rede de segurança de fonte, sempre

```js
MEDIDA.aoCarregarFontes(function () {
  if (ultimoEstado) render(ultimoEstado);
});
```

Sem isto, a corretude do corpo depende de a ordem de carga acertar — e uma
browser source recarrega no meio do programa, com a rede em qualquer estado.

### O `<link rel="preload">` de fonte não é otimização

É correção de ar, e vale para **toda peça com texto medido**. O `@font-face`
costuma morar num `shared/fontes.css` alcançado por um `@import` de dentro do
tema: o browser só descobre que a face existe depois de buscar e parsear DUAS
folhas. Até lá o texto pinta na fallback, que tem outra métrica — o auto-fit
escolhe um corpo grande, a face real entra depois e vaza a moldura.

```html
<link rel="preload" href="…/AkiraExpanded-SuperBold.otf" as="font" type="font/otf" crossorigin />
```

`crossorigin` é **obrigatório** em preload de fonte mesmo na mesma origem — sem
ele o browser busca o arquivo DE NOVO.

Peça que **não desenha texto** não leva preload, e tirar é obrigação: preload de
uma face que ninguém usa é só banda gasta. O mesmo vale para a classe de tokens
do tema — se nenhum elemento da peça consome `--contorno`/`--sombra`, o
`.bs-ar` sai do `.stage`.

### `window.test()` / `testOut()`, no fim do script

Ensaiar a peça sem depender do painel, e é o que a torna verificável por render
headless. Duas regras que separam um `test()` útil de um enfeite:

- **Passe pelo caminho do AR de verdade.** `test()` chama `entrar()`, não monta
  o estado final na mão — é o que faz o ensaio exercitar a espera do `play()` do
  vídeo e o reset da timeline.
- **Devolva o que foi PEDIDO, não o `diag`.** Com a peça já no ar a troca é
  animada e o render acontece DEPOIS do `return`; devolver o diag mostraria o
  nome anterior.

E o comentário do bloco diz o que conferir:

```
Confira o replay: test() → testOut() → test() tem de RE-ANIMAR.
Confira o LOOP: deixe no ar mais de 10s — a arte volta ao início sem piscar.
```

---

## 2. LOWER THIRDS (`lt_`)

**A definição:** entra, informa, sai. Entre uma informação e outra o conteúdo
troca. A browser source fica **sempre carregada** no vMix; o ar é o replicant.

### O replicant

```js
{ visivel: false, nome: "", social: "" }       // um convidado
{ visivel: false, a: {nome,social}, b: {…} }   // dois convidados
{ visivel: false }                             // peça sem campo vivo
```

**Declarado no painel com `defaultValue` e `persistent: false`** — ar nunca
persiste. Mas ver a corrida de declaração da §2 da SKILL: quando o gráfico
também declara (e ele declara pelado), a browser source do vMix reconecta antes
do dashboard em todo restart e cria o replicant SEM valor. O PLAY então faz
`Object.assign({}, undefined, {visivel:true})` e a barra entra no ar **sem nome
e sem social**. Num bundle real a saída foi mover a declaração para a extension.

### A máquina de estados — quatro ramos, nesta ordem

```js
function aplicar(estado) {
  ultimoEstado = estado;
  var querVisivel = !!estado && estado.visivel === true;
  var k = chave(estado);            // hash só do CONTEÚDO
  diag.noAr = querVisivel;

  // 1. TRAVA DE PRIMEIRO ESTADO — o primeiro change é o que JÁ existia
  if (primeiro) {
    primeiro = false;
    render(estado); noAr = querVisivel; conteudoNoAr = k;
    pular(querVisivel);             // sem animação
    return;
  }

  // 2. TRAVA DE ON-AIR — só anima na TRANSIÇÃO
  if (querVisivel !== noAr) {
    noAr = querVisivel; conteudoNoAr = k; render(estado);
    if (querVisivel) entrar(); else sair();
    return;
  }

  // 3. SETAR com a peça no ar — sai, troca fora de vista, volta
  if (k !== conteudoNoAr) {
    conteudoNoAr = k;
    if (noAr) {
      var t = sair();
      t.eventCallback("onComplete", function () {
        if (!noAr) { gsap.set(el, {opacity: 0}); VIDEO.parar(arteEl); return; }
        gsap.set(el, { opacity: 0 });
        render(estado);
        entrar();
      });
    } else {
      render(estado);               // 4. fora do ar: troca seca
    }
  }
}
```

Cada ramo existe por um bug de transmissão:

1. **Primeiro estado** — um refresh da browser source com a peça no ar fazia ela
   re-entrar deslizando, no ar.
2. **On-air** — PLAY com a peça já no ar re-animava.
3. **Troca no ar** — trocar o texto no lugar faz o nome pular de largura por
   causa do auto-fit; lê como glitch. Num anúncio de vencedor, lê como erro de
   operação.
4. Fora do ar não há o que esconder.

🚨 **O `eventCallback("onComplete", …)` SUBSTITUI o callback do `sair()`**, e é o
que se quer: do ponto de vista do operador a peça **não saiu do ar**, então o
vídeo NÃO pode pausar e rebobinar ali — a arte daria um salto visível no meio da
troca.

🚨 **E o ramo 3 precisa da trava de OUT no `onComplete`.** Um OUT pode chegar
durante a troca; sem ela a peça volta ao ar sozinha depois de mandada sair.

### A chave de conteúdo é só CONTEÚDO

```js
function chave(s) {
  return JSON.stringify([(s && s.nome) || "", (s && s.social) || ""]);
}
```

Não inclua `visivel` (o ramo 2 já cuida) e **não inclua campo que é FUNÇÃO de
outro** — a foto resolvida do nome, o escudo resolvido do time. Hashear os dois
conta a mesma mudança duas vezes e faz a peça sair e voltar à toa.

Numa peça de dois modos, a chave inclui o MODO e **só o conjunto dele**: assim
trocar de modo conta como troca de conteúdo (sai/volta), e escrever no conjunto
que não está no ar não mexe em nada.

### A gramática de movimento do kit

Um kit coeso tem **um par de curvas** e todo mundo usa. Estes são os do kit de
referência:

| | duração | ease | observação |
|---|---|---|---|
| entrada (slide) | 0,55s | `expo.out` | |
| entrada (fade) | 0,28s | `power1.out` | **em paralelo, na posição 0** |
| saída (slide) | 0,40s | `power2.in` | acelera embora |
| saída (fade) | 0,40s | `power1.in` | acompanha o slide INTEIRO |

🚨 **O fade de entrada é CURTO de propósito.** O `expo.out` é muito
front-loaded: um fade da duração toda deixa a peça translúcida depois de ela já
ter parado de andar, o que lê como peça **travando** em vez de entrando.
Terminando antes, a opacidade some do caminho e quem fecha o movimento é o
slide. Na saída é o contrário — some enquanto sai, em vez de sair e só então
sumir.

Variações legítimas, e cada uma tem motivo:

- **`back.out(1.4)` em 0,5s** numa faixa institucional centrada que sobe do
  rodapé: o repique combina com o gesto. Aí o fade importa mais — o `back.out`
  passa do ponto e volta, e um fade longo faria a faixa ainda estar clareando
  durante o repique.
- **Sem fade nenhum**, em peça de canto ALTO sobre gameplay: um fade ali lê como
  falha de sinal em vez de peça entrando. As de rodapé entram com fade porque
  sobem de dentro da borda.
- **`clip-path` que abre do centro**, em bloco centrado e horizontal (ver §2.6).

### O `FORA` e o estado de repouso

O deslocamento de repouso mora **no CSS** (é a trava anti-flash do boot) e o
`FORA` do script **tem que bater com ele**:

```css
#lt { transform: translateX(calc(-1 * (var(--lt-x) + var(--lt-w)))); opacity: 0; }
```
```js
var FORA = -626;   /* −(60 + 566): a aresta direita da plate na borda esquerda.
                      Se mexer num, mexa no outro. */
```

Peça de canvas cheio (arte em webm) não ancora mais pelo x/y — o `FORA` continua
sendo derivado da BBOX da arte, não chutado: `−612` porque a bbox de alfa termina
em x=602.

### As quatro funções de ar, sempre com os mesmos nomes

```js
function entrar()            // anima pra dentro; ESPERA o vídeo estar rodando
function sair()              // anima pra fora; pausa o vídeo no onComplete
function pular(visivel)      // põe no estado final SEM animar (primeiro estado)
function aplicar(estado)     // a máquina acima
```

**Uma timeline por vez.** `if (tl) tl.kill()` no topo das três — sem isso um
PLAY/OUT rápido empilha timelines nas mesmas propriedades e a peça trava no meio
do movimento, no ar.

**Replay-safety.** A entrada `gsap.set(...)` o estado inicial de cada filho
animado, no topo. Não confie na saída ter limpado: se a saída nunca rodou
(browser source recarregada, OUT que nunca chegou), a segunda entrada começa do
estado final e não anima.

🚨 **O reset roda ANTES da espera do vídeo, e é `gsap.set` solto, não `tl.set`.**
A peça tem que ir para fora do quadro no MESMO quadro em que o PLAY chegou; se
esperasse, ela piscaria já no lugar final antes de voltar e animar.

```js
function entrar() {
  if (tl) tl.kill();
  gsap.set(ltEl, { opacity: 0, x: FORA });     // ← no mesmo quadro do PLAY

  return VIDEO.tocar(arteEl).then(function () {
    if (!noAr) return null;                    // o OUT chegou durante o play()
    if (tl) tl.kill();
    tl = gsap.timeline();
    tl.to(ltEl, { x: 0, duration: 0.55, ease: "expo.out" });
    tl.to(ltEl, { opacity: 1, duration: 0.28, ease: "power1.out" }, 0);
    return tl;
  });
}
```

### Quem se move é o PAI

🚨 Num lower third com plates E texto, o slide vai no **container**, não nas
plates. Já foi ao ar o contrário: as plates deslizavam e os quatro campos de
texto — que são IRMÃOS delas dentro do container — ficavam parados no meio do
quadro, soltos, até a arte chegar embaixo deles. Só aparece DURANTE o movimento;
no quadro final tudo está no lugar, que é por que passou despercebido.

### Peça com duas metades: não divida o vídeo

Uma peça simétrica pode pedir barn-door (as duas metades entrando das
laterais). Custo medido de fazer isso com **dois `<video>` do mesmo arquivo**:
p95 de **34ms entre quadros contra 17,8ms** de todas as outras peças — metade da
taxa de quadro, parada no ar, e a animação de saída sai aos trancos no vMix.
Some a isso o `sincronizar()` por quadro que a deriva entre decodificadores
obriga.

A saída foi **um vídeo só + slide vertical**: as metades andam juntas, a costura
nunca se abre, e não há deriva a tratar.

---

## 3. FULLSCREENS (`fs_`)

**A definição:** cada cena é um **input montado no vMix** — o PNG (ou webm) de
frame cheio, e por cima a browser source transparente só com o que muda. A troca
é `PreviewInput` + `Stinger`, na extension.

### O que muda em relação ao `lt_`

| | `lt_` | `fs_` |
|---|---|---|
| GSAP | sim | **não** |
| trava de primeiro estado | sim | **não** |
| trava de on-air | sim | **não** |
| campo `visivel` no replicant | sim | **não** |
| container | `opacity: 0` de nascença | `opacity: 1` **para sempre** |

```css
/* Container da peça. `opacity: 1` para SEMPRE e sem campo `visivel`: numa peça
   fs_* o ar não é assunto deste arquivo. Um tween de opacidade aqui brigaria
   com o Stinger do vMix. */
#peca { position: absolute; inset: 0; opacity: 1; }
```

As duas travas **existem para proteger uma animação de entrada**, e esta peça
não tem nenhuma: um refresh da browser source com a peça no ar aqui é
inofensivo — ela redesenha o mesmo quadro estático.

### 🚨 O que o HTML desenha e o que vai como input — a regra do `opaco`

A regra curta: **plate de frame cheio e OPACA é input do vMix; o HTML não a
desenha.** No manifesto isso é uma chave:

```json
{ "id": "bg", "arquivo": {"w":1920,"h":1080}, "opaco": true, "opacoPct": 100 }
```

Desenhar o `bg` aqui poria uma segunda cópia do mesmo quadro para manter
alinhada pixel a pixel, e mais uma passada de composição por quadro, sem ganho.

🚨 **Mas a ORDEM DE PILHA pode obrigar o HTML a desenhar quase tudo.** Num card
de versus real, o PSD empilha assim (0 = topo):

```
0     Confronto  →  plate_a, plate_b, vs  (e os 4 textos)
1     logo
2     player_a          ← CONTEÚDO TROCÁVEL por confronto
3     player_b          ← CONTEÚDO TROCÁVEL por confronto
4,5,6 bg                ← input do vMix
```

As fotos são CAMPO, então têm que ser desenhadas no HTML. E **tudo que está
ACIMA delas na pilha tem que vir junto**: se o logo estivesse queimado no input,
a foto desenhada por cima passaria na frente dele. Resultado: o input é
`[bg.png]` e mais nada; a browser source entra com fotos + logo + placas +
estrela + texto.

É também por isso que uma arte animada de placas **não pode ser uma camada de
vídeo no switcher**: ela cobriria a browser source inteira e enterraria o texto.
Como ELEMENTO da peça, o empilhamento é seu — fotos → logo → vídeo → texto — e
os três degraus caem no lugar sem custo.

### 🚨 O `x/y/w/h` do manifesto não é o tamanho do arquivo

Vale em todo o kit, mas morde mais aqui, porque **pastas diferentes foram
exportadas de jeitos diferentes**:

| Export | o `x/y/w/h` é | como ancorar |
|---|---|---|
| **recortado** (o PNG tem o tamanho da arte) | a geometria do arquivo | `left/top/width/height` direto |
| **frame cheio** (o PNG é 1920×1080) | o bbox da arte DENTRO do arquivo | `left:0; top:0; 1920×1080` |

Ancorar um PNG de frame cheio no bbox **espreme o canvas inteiro naquela caixa**.
Num caso real o bloco de placar virou uma tira de 4px, e o sintoma não parece
geometria: parece plate exportada errada. **Confira o tamanho do PNG antes de
ancorar qualquer plate**, e declare a convenção no manifesto.

Plate de frame cheio em segunda instância: o mesmo PNG num div do TAMANHO DA
ARTE, na posição de destino, com `background-position` NEGATIVO da posição de
origem.

### As duas exceções da família

**1. Peça que ROLA.** Um crédito de encerramento tem GSAP, campo `visivel` e
timeline — porque o **rolo é a peça**: o vMix corta pra cena, mas quem faz os
créditos subirem é o HTML, e isso precisa de play, pausa e de saber quando
terminou. O replicant carrega `{visivel, rodando, seq}`.

- `seq` é o que faz um **PLAY com a peça já no ar RECOMEÇAR do topo** — sem ele
  `visivel: true` já sendo true não é mudança nenhuma e o segundo PLAY não faz
  nada, que é justamente o que o operador aperta quando o rolo terminou.
- **Devagar demais é indistinguível de quebrado.** Um rolo a 30px/s com a
  janela começando na borda de baixo leva ~2,5s só pra atravessar o fade de
  entrada e ~11s até o primeiro item estar inteiro em quadro. O relato que chega
  é "dei play e não apareceu nada". A régua é ~0,72s por linha de nome passando
  (medida: 60px/s contra um leading de 43,3px). **Calcule px/s antes de
  debugar.**
- **Painel que acompanha animação longa precisa tiquetear.** O diagnóstico só
  repintava em mudança de estado e dizia `progresso: 0%` com a peça a 27%. Um
  `setInterval(pintarDiag, 250)` enquanto roda resolve, e ele só custa em dev
  (o `pintarDiag` sai cedo sem a classe).
- O percurso: o rolo começa com o topo na BASE da janela e termina com a base do
  rolo no TOPO dela — `y: ALTURA_JANELA → −alturaConteudo()`, `ease: "none"`.
- `scrollHeight` e não `getBoundingClientRect().height` para medir o conteúdo:
  o `fit.js` escala o stage por transform, e o rect viria escalado — a duração
  mudaria com o tamanho da janela de preview e o ensaio mentiria sobre o ar.

**2. Peça de TEXTO SÓ.** As molduras de câmera não desenham fundo, moldura nem
barra: a arte entra por baixo, num input próprio, e a browser source é a camada
transparente por cima. Consequência prática que precisa estar no cabeçalho:

```
Se você abrir este arquivo e vir só duas palavras flutuando num quadro vazio,
está CERTO. Para conferir o encaixe, componha contra `_reference.png`.
```

---

## 4. DRAFT / PICKS & BANS

**A definição:** não entra e sai a cada pick. Fica no ar do começo ao fim do
draft e **se preenche progressivamente**. Não é um fullscreen que troca — é um
estado que evolui. Anima UMA vez na entrada e UMA na saída.

### Um gráfico, um replicant — e por que às vezes dois arquivos

Os blocos compartilham a mesma barra: separá-los obrigaria a alinhar duas
browser sources no ar. Mas **duas peças que entram e saem sozinhas são dois
arquivos**, mesmo com 80% do CSS repetido:

- O ban global virou peça própria porque, sendo um `modo` do draft, o PLAY dele
  punha no ar tudo que já estivesse digitado nos bans de set — e eles JÁ estão
  digitados nessa altura. E sendo um input só no vMix, não dava pra montar cena
  de global ban e cena de draft e cortar entre elas.
- Uma variante da MESMA barra (escudo no lugar do ban global) também é arquivo
  próprio: o torneio que não usa ban global aponta a browser source para lá e
  não toca em operação nenhuma. ⚠️ As duas desenham na MESMA coordenada —
  **nomeie os inputs do vMix de forma que ninguém abra o errado no meio do
  draft**, e registre isso no `package.json`.

### Reveal: digitar não é pôr no ar

```js
function revelado(s, id) {
  return ordemPlana(s.primeiro || "a").indexOf(id) < (s.revelados || 0);
}
```

O operador adianta a digitação; só o **REVELAR** incrementa `revelados` e põe o
pick na tela. ⚠️ **O painel tem o MESMO guard.** Se um dos dois mudar sozinho, o
painel e o ar discordam sobre o que está na tela — e quem opera acredita no
painel. Comente a duplicação nos dois lados.

### O espelho mora na GEOMETRIA, não na ordem

```js
var SLOT_X   = { a: [8, 161, 315], b: [1762, 1609, 1455] };
var ORDEM_SLOT = { a: [1, 2, 3], b: [1, 2, 3] };   // IGUAIS, e não é redundância
```

O `b: [3,2,1]` que já esteve ali era **espelho aplicado duas vezes**: o `x` já
põe o b1 na borda direita, então índice 1 já significa "o mais externo" nos dois
lados. Com o inverso, numa fase de dois picks o lado A acendia os dois da borda
e o lado B acendia os dois do meio.

E a simetria vira **asserção executável**:

```js
window.checarSimetria = function () {
  /* para uma plate de largura w em x, o lado B fica em 1920 − x − w */
};
```

Um checador desses pegou o próprio bug de si mesmo na primeira execução.

### O fade por slot, e o guard que impede a barra de piscar

Um pick aparecendo seco lê como glitch: o espectador não vê o momento da
escolha, vê a imagem já lá. Mas `aplicar()` roda a cada `change` — e num draft
chegam muitos (relógio, fase, reveal, placar).

```js
function pintarComFade(el, url, rotulo, brawlerNome) {
  var alvo = url || "";
  if (el.__url === alvo) return Promise.resolve(true);   // 🚨 só anima quando MUDA
  el.__url = alvo;
  …
  return fundoComFallback(el, url, rotulo).then(function (ok) {
    el.style.backgroundColor = cor;                      // 🚨 a cor SÓ com o retrato
    gsap.fromTo(el, {opacity: 0}, {opacity: 1, duration: 0.35, ease: "power2.out"});
    return ok;
  });
}
```

- Sem o `__url`, cada tique do relógio reanimaria os seis retratos.
- A cor de fundo **dentro do `.then`**: fora dele ela pintava no quadro seguinte
  enquanto o `decode()` ainda estava em voo — um retângulo colorido acendendo
  sozinho e o boneco chegando depois. Não aparece na sua máquina (cache quente);
  aparece numa browser source recém-aberta.
- **Saída não faz fade-out**: o slot volta na hora para o "?". Sumir devagar
  pareceria a peça travando.
- E a saída da peça inteira tem que **esquecer** o que foi pintado
  (`el.__url = undefined`), senão a peça que volta com os MESMOS picks acha que
  nada mudou e os bonecos reaparecem secos.

### O relógio do draft — e a inversão de regra

O padrão do kit é **guardar o PRAZO** (`fimEm`, epoch ms) e cada tela calcular
sozinha. Está certo quando todo mundo é a mesma máquina, e é o que faz uma
browser source que recarrega no meio de um pick voltar com o número CERTO.

🚨 **Com o dashboard em OUTRO PC, o padrão falha.** O prazo é carimbado pelo
relógio de quem clicou e lido pelo relógio de quem desenha; dois Windows fora de
domínio divergem sozinhos. Medido, com o gráfico recebendo um `fimEm` deslocado:

```
desvio            o que ia ao ar
0                 08   (certo)
+30s adiantado    00 VERMELHO, travado
+5min adiantado   00 VERMELHO, travado
−60s atrasado     68   (conta de um número errado)
```

Passando da duração de um pick, o `Math.max(0, …)` satura em zero, o tick vê
`seg === 0` e PARA DE PEDIR FRAME — o relógio não está lento, **ele nunca
arranca**.

Duas saídas, nesta ordem de preferência:

1. **`shared/relogio.js`** — cada tela mede o offset contra o servidor por
   round-trip (5 amostras, fica com a de menor RTT) e passa a usar
   `RELOGIO.agora()` no lugar de `Date.now()`. Barato, e mantém o prazo
   absoluto. **Duas fontes**: a rota `/hora` da extension e, quando ela dá 404,
   o cabeçalho `Date` de qualquer resposta HTTP (resolução de 1s truncada para
   baixo → some 500ms para tirar o viés).
2. **O servidor conta e publica o número pronto** — quando a degradação
   silenciosa da opção 1 não é aceitável. Uma tela que falha ao sincronizar cai
   em silêncio para o relógio local e o bug volta, no meio do programa. ⚠️ Isso
   **contraria** a regra "nada de replicant tickado" e o registro do porquê tem
   que ficar no código, com o custo medido (uma escrita por segundo enquanto um
   pick conta, ~210 num draft inteiro; o `tick` roda a 250ms mas só ESCREVE
   quando o inteiro muda).

🚨 **O replicant do relógio é PRÓPRIO, e não é organização.** Se o servidor
escrevesse no mesmo replicant que o painel escreve, as duas escritas partiriam da
mesma revisão e o NodeCG rejeitaria uma em silêncio (`Mismatched revision
number`). O servidor LÊ o ar e escreve só no dele. Contrato: o painel incrementa
um `cronoSeq` a cada turno novo e diz em `cronoAtivo` se há alguém contando —
nenhum dos dois é hora.

E a guarda que faz o contador não recomeçar sozinho:

```js
if (seq === jaFeito) return;   // sem isto, QUALQUER escrita no AR reinicia os 35s
```

---

## 5. IN-GAME (`ig_`)

**A definição:** overlay que vive sobre o gameplay a partida inteira e se
preenche. Sem prefixo de família de ar próprio — é a mesma terceira família da
§6, com um vocabulário de arte diferente.

### Fade, nunca deslize

```css
#peca { position: absolute; inset: 0; opacity: 0; }
.stage.animado #peca { transition: opacity .4s ease; }   /* ligada DEPOIS do 1º estado */
#peca.on { opacity: 1; }
```

A peça mora nas **quatro bordas do quadro ao mesmo tempo**, então não existe "um
lado de onde ela entra". E o conteúdo troca com a peça no ar (um ban entra, o
placar vira) — quem anima a cada troca pisca a peça toda, que é o oposto do que
uma peça de estado deve fazer.

A classe `.animado` no stage é a trava de primeiro estado da versão CSS: sem
ela, um refresh da browser source com a peça no ar faz ela reaparecer com fade,
no ar, no meio da partida.

### ALWAYS ON = o replicant tem que nascer certo

```js
nodecg.Replicant("DB_OVERLAY_JOGO", {
  defaultValue: { visivel: true, placar: null },
  persistent: false,
});
```

🚨 Isto na **extension**, e por um bug real: morando só no painel, num restart do
NodeCG a browser source reconecta em segundos — bem antes de alguém abrir o
dashboard — e cria o replicant SEM valor. Sem `visivel: true` a peça fica em
`opacity: 0`, com nomes, série e placar todos certos por baixo, e nenhum erro no
console. E como ela é `persistent: false`, nem o banco gravado salva: quebra em
TODO restart, não só em instalação nova.

### O que a peça NÃO desenha é decisão documentada

```
· O CRONÔMETRO. O vão de 177px no topo central (x 871..1047) é deliberado: é
  onde a pílula do relógio do JOGO aparece (medida em `_frame_jogo.png`, 161px,
  com folga dos dois lados). Não encoste nada nesse vão.
· O BAN GLOBAL e os PICKS. São do draft; aqui só os bans de set.
```

E a pendência que se liga numa linha:

```css
:root {
  /* O placar NATIVO do jogo tem pixel de y=0 pra baixo e esta peça começa em
     y=23: sobra uma tira de placar do JOGO por cima do de BROADCAST. O default
     é 0 porque 0 é o que o PSD manda. PARA LIGAR: troque por 23px. */
  --sobe-blocos: 0px;
}
#topo { top: calc(0px - var(--sobe-blocos)); }
```

🚨 É UMA propriedade num contêiner só, e não 14 `top` corrigidos à mão — o
deslocamento tem que arrastar todo campo vivo do topo junto.

### Simetria parcial: meça antes de assumir

```
⚠ ESTA PEÇA NÃO É SIMÉTRICA EM 960, e não adianta forçar:
  · a barra de série (pips) É espelho exato — medido;
  · a placa do nome e a caixa do placar NÃO são: as duas inclinam para o MESMO
    lado nos dois blocos. São translações, não espelhos.
```

Onde **é** espelho exato, use `transform: scaleX(-1)` e não um segundo conjunto
de números: um `left` copiado à mão diverge na primeira revisão da arte.
⚠️ Mas o `scaleX` espelha só o horizontal — se o vertical dos dois lados
divergir em 1px, isso precisa de regra própria.

### Quando NÃO virar plate

Uma barra de série de Bo3/Bo5 dá **2 formatos × (2 ou 3) posições × 2 estados ×
2 lados = 20 variantes**. E a cor de cada pip é exatamente um PAPEL (cor do time
/ branco). Isso é CSS, e os PNGs ficam como **régua de conferência**.

🚨 **Não use o token de cor do JOGO numa arte de BROADCAST.** Eles existem e
resolvem para outra coisa: montar os pips com o token do tema pinta a cor errada
com cara de certa. Cor de arte que ainda não tem token fica como custom property
local, com um comentário dizendo que a decisão vale para o kit inteiro.

---

## 6. PEÇA DE CANTO (sem prefixo — a terceira família)

**A definição:** fica no canto por trechos longos, tem PLAY/OUT próprio, e não
entra e sai por bloco de informação. `bug.html`, `chat.html`, o medidor de meta,
o contador de views.

### Dois pedaços no mesmo arquivo, dois replicants

Juntar duas peças num arquivo é decisão de **operação**: uma browser source a
menos no vMix e UM polling em vez de dois.

🚨 **Mas o ar continua em DOIS replicants.** A regra da §3 da SKILL diz que duas
peças que precisam estar no ar ao mesmo tempo com conteúdos diferentes são dois
replicants — e aqui não é hipótese: a audiência às vezes precisa estar no ar SEM
a barra de meta. Achatar os dois `visivel` num objeto faria o PLAY de uma mexer
no ar da outra.

Consequências no código, e nenhuma é opcional:

- **Trava de primeiro estado e trava de on-air PRÓPRIAS** por peça. Um par de
  flags compartilhado faria o primeiro `change` de uma cancelar a animação da
  outra.
- **Timeline própria** por peça, com sufixo no nome. Elas nunca compartilham
  timeline, senão o OUT de uma mata a entrada da outra no meio.
- `else if` e não dois `if` soltos no `aplicar`: no primeiro change com a peça
  no ar os dois ramos rodavam, e com timeline animada o primeiro ramo animaria
  **no refresh** — que é o que a trava de primeiro estado existe para impedir.
- **Cantos opostos de propósito.** Duas peças que se acham donas do mesmo canto
  só brigam quando as duas entram no ar — e aí é ao vivo.

### Consumir dado externo: o bundle é hóspede

```
LEIA. NUNCA CONFIGURE.
```

A rota que aceita os alvos **na própria chamada** é a de consumidor
(`GET /stats?channels=a,b&provider=youtube`). A que responde sobre "o que o
painel DELES tem ligado" serve ao painel deles, não a você — e ligar um canal lá
muda o número do overlay de outra pessoa.

Um único módulo fala com o gateway, e quem desenha **se inscreve**. Se cada peça
fizesse polling próprio, a mesma live seria consultada duas vezes a cada 5s e os
dois gráficos poderiam mostrar valores de instantes diferentes — no ar isso lê
como bug de um deles.

O que esse módulo tem que fazer, e cada item veio de um defeito:

| | por quê |
|---|---|
| `Promise.allSettled`, não `all` | uma plataforma fora do ar não pode zerar a outra |
| último número BOM **por plataforma** | uma falha de rede de 5s não significa que a live perdeu os likes; zerar faria a barra despencar e voltar |
| trava de request em voo | com 3 canais sequenciais o ciclo custa ~4,5s contra um piso de 5s, e os requests se empilham |
| intervalo derivado da lista | o gateway consulta uma das plataformas em série, ~1,5s por canal |
| assinante que estoura não para os outros | derrubar o contador porque a barra tem bug tira duas peças do ar em vez de uma |
| um campo `temYoutube` explícito | sem a plataforma que tem likes, a meta não é 0, é **indisponível** — e as duas coisas desenham diferente |
| **dois formatadores** | a contagem NÃO abrevia: com 1.234.567 de 1.236.000 os dois lados viram "1,2 mi" e o número que existe pra mostrar diferença passa a esconder. A placa apertada abrevia |

E a lista de alvos é **estado do bundle** — replicant na extension, editado num
painel próprio —, com liga/desliga **separado** da lista: inferir "está ativo" de
"a lista tem canal" obrigaria o operador a APAGAR os canais pra desligar e
redigitar no programa seguinte.

---

## 7. CÂMERAS — quando o runtime sobe para `utils/`

Quatro peças (2, 3, 4 e 5 câmeras) com o MESMO mecanismo e só os números
diferentes. A regra de promoção do bundle é "sobe quando a SEGUNDA peça precisa";
aqui são quatro, conhecidas, escritas no mesmo dia.

```js
CAMS.montar({
  peca: "fs_4cam",
  corpo: 34.653, piso: 22, vao: 429,
  slots: [{ cx: 266.0, baseline: 871.62 }, …],
});
```

O que fica no `.html` é **a geometria daquela arte**, que é dela e de mais
nenhuma. O que sobe: criação dos elementos, auto-fit, reancoragem por baseline,
tela de dev e `window.test()`.

**Um replicant só para as quatro.** A peça de N câmeras desenha os N PRIMEIROS
nomes da lista — é o que faz trocar de 3cam para 4cam no switcher não exigir
tocar em painel nenhum.

### Dois modelos convivendo, e o aviso de operação

Existe também um **modelo SOLO** (uma peça por pessoa, que traz a própria barra e
é posicionada na mão no switcher). Ele lê o MESMO replicant, e a indireção que
faz isso funcionar é uma linha:

```js
/* Qual posição do replicant cada elemento lê. Nas peças de moldura o elemento i
   lê o caster i; nas SOLO existe um elemento só, e ele lê o caster que o arquivo
   escolheu — `cam3.html` desenha `casters[2]`. Sem esta indireção o solo leria
   sempre o caster 1. */
var idx = slots.map(function (s, i) { return s.i == null ? i : s.i; });
```

⚠️ **Nove inputs fazendo a mesma coisa de dois jeitos.** Isso vai no
`package.json`, em voz alta: *nomeie os inputs do vMix de forma que ninguém abra
o errado no meio do programa.*

---

## 8. A gramática da ARTE: plate, vídeo, ou híbrida

O motion às vezes entrega a arte como **webm com alfa** (VP9, `alpha_mode=1`),
canvas cheio 1920×1080, loop de 10s a 24fps — em vez de PNG. Nem sempre ele
entrega a peça INTEIRA.

| A peça é | quando | como ancorar |
|---|---|---|
| **plate** | tudo é PNG | por coordenada de canvas, do manifesto |
| **vídeo** | um webm cobre a arte toda | elemento em 0,0, 1920×1080, `object-fit: fill` |
| **híbrida** | o webm cobre UMA das plates | o vídeo entra no lugar daquela plate; as outras continuam PNG |

🚨 **Antes de portar, MEÇA a bbox de alfa do webm contra as plates declaradas.**
Um handoff real deu o webm errado para a peça errada, e outro classificou como
"divergência de layout" o que era simplesmente **o vídeo ser UMA das plates da
composição**. Três verificações independentes resolvem: quais plates só aquele
arquivo usa; quais elementos aparecem no frame extraído; se a união das
coordenadas bate com a bbox do vídeo.

### `object-fit: fill`, nunca `cover`

O arquivo tem exatamente o tamanho do stage; `cover` reamostraria por
arredondamento e borraria o contorno preto e a franja de alfa.

### Sem `src` no HTML

Quem atribui é o `VIDEO.preparar()`, que também força `muted`/`loop`/
`playsinline`. Deixar o `src` no markup faz o Chrome começar a carregar antes de
o utilitário poder assinar os eventos, e a peça perde o `canplaythrough` no caso
de cache.

### As quatro armadilhas do `<video>` (e o que o utilitário faz)

1. **Vídeo não-mudo nunca toca.** Sem `muted` a peça vai ao ar CONGELADA no
   frame 0, sem erro visível — parece um PNG. Forçado no código, não confiado ao
   atributo: atributo é fácil de alguém remover "porque não tem áudio mesmo".
2. **`loadeddata` não basta** — promete só o primeiro frame. O evento certo é
   `canplaythrough`.
3. **Mas `canplaythrough` pode nunca disparar** (cache, ou rede ruim). Duas
   saídas além dele: `readyState >= 4` conferido na hora, e um teto de tempo
   (4s é folgado para arquivo local). Passar do teto é `warn`, não `error`.
4. **`play()` rejeita.** `NotAllowedError` e `AbortError` são ROTINA (PLAY/OUT
   rápido) e nenhuma pode derrubar o handler.

### 🚨 A regra do recorte — `clip-path` em todo `<video>` de canvas cheio

O browser source do vMix é CEF em **off-screen rendering: não há compositing por
GPU**. A página é rasterizada para um bitmap em memória de sistema, e o que custa
é a **ÁREA repintada por quadro**.

Um `<video>` de 1920×1080 em loop é uma camada que se declara **suja inteira a
cada frame** — 2,07 Mpx, 24×/s, **com a peça parada no ar**. É o relato do fórum
do vMix: "mesmo depois que o L3 congela e fica lá, a GPU continua no talo".

```css
#arte { clip-path: inset(<topo>px <dir>px <base>px <esq>px); }
```

Um `inset()` sem raio é clip retangular puro (não vira máscara, não custa em
pintura) e ele **bounds a região suja da camada**. Ganho medido no mesmo kit:

| peça | área/quadro | ganho |
|---|---|---|
| medalhão de 155×164 num canvas cheio | 2,07 → 0,031 Mpx | **67×** |
| faixa institucional | 2,07 → 0,10 Mpx | 21× |
| barra de convidado | 2,07 → 0,12 Mpx | 17× |
| placa de vencedor | 2,07 → 0,15 Mpx | 13× |
| placa dupla (um vídeo só) | 2,07 → 0,22 Mpx | 9× |

Três coisas que fazem isso dar errado se forem ignoradas:

- **As coordenadas são de CANVAS.** Todo `<video>` do kit é 1920×1080 deslocado
  pelo negativo da âncora ACUMULADA, justamente para cair em 0,0 do stage —
  então o sistema local dele JÁ É o canvas. É o que permite a mesma linha
  funcionar em peça ancorada e em peça de canvas cheio.
- 🚨 **A caixa sai da UNIÃO da bbox de alfa sobre TODOS os frames do loop.** Não
  é um frame, e **não é amostragem**. Comparado contra os 240 frames de verdade,
  uma medição a 3fps errou assim:

  ```
  peça A ... 3fps disse x0 = 22.  A verdade é x0 = 0 (o spray encosta na borda).
                                  A caixa do 3fps decepava 18px de arte.
  peça B ... 3fps disse y0 = 39.  A verdade é 32. Cortava 3px no pico do pulso.
  peça C ... 3fps disse y0 = 843. A verdade é 839.
  ```

  O extremo de um float dura POUCOS frames: amostrar 1 em 8 tem grande chance de
  cair sempre fora dele. O defeito resultante é o pior tipo — a arte some por 2
  ou 3 quadros **uma vez a cada dez segundos**, e ninguém liga o fio piscando à
  caixa de recorte. Meça `fps=24`, limiar de alfa em 1/255, e some **8px de
  folga** em cada lado (a folga absorve reexport do motion com a arte alguns
  pixels maior, que acontece toda temporada).
- **`overflow: hidden` NÃO serve no lugar.** Várias peças ancoram o vídeo numa
  caixa do tamanho da PLATE, e a arte em movimento vaza essa caixa **pelos
  quatro lados** de propósito (medido: 14px em x0, 17px em y0, 13px em y1 numa
  peça cuja "±2px" o cabeçalho afirmava). `overflow` recortaria pela caixa
  errada; o `clip-path` recorta pela caixa MEDIDA, que é maior.

⚠️ O que o recorte **não** resolve: o DECODE. O VP9 com alfa continua sendo
decodificado em 1920×1080 mesmo com 95% de pixel vazio. Cortar os webm para a
bbox no ffmpeg é o próximo degrau, e custa reexportar a arte e remendar as
âncoras.

### 🚨 `will-change` num elemento de canvas cheio PIORA

Medido pelo LayerTree, uma peça no ar:

```
sem will-change ..... 6 camadas,  8,1 Mpx, 1 de quadro cheio
com will-change ..... 7 camadas, 10,1 Mpx, 2 de quadro cheio
```

Ele **desfez o ganho do `clip-path`** e ainda somou uma camada. A regra não é
"promova o que se move", é **"promova o que se move SE a caixa dele for
pequena"** — num container de 970×194 ou num vídeo já recortado, compensa
(evita a promoção e demoção a cada tween, que é onde o primeiro quadro da saída
engasga).

E o mesmo raciocínio no `fit.js`: com escala exatamente 1 e deslocamento zero, o
transform sai **`none`** em vez de `scale(1)` — um transform identidade continua
criando nó de transformação na árvore de propriedades do Chromium. E escala
FRACIONÁRIA (0,9990, de uma browser source em 1918 ou de um DPR ≠ 1) reamostra
o stage inteiro com filtragem bilinear a cada quadro. Tolerância de `1/1080` —
o ponto em que a diferença vale menos que meio pixel na altura do canvas.

### Fora do ar, PAUSE — mas só no FIM da saída

Sete peças decodificando VP9 com alfa a 1920×1080 ao mesmo tempo gastam CPU da
máquina de transmissão sem nada aparecer na tela. O `VIDEO.parar()` pausa e
rebobina; como o arquivo já está em buffer, o `tocar()` da próxima entrada volta
a rodar no mesmo quadro.

🚨 **Pausar no INÍCIO da saída congela a arte à vista**, com a peça ainda
cruzando o quadro. E numa peça **sem fade** (canto alto), ela fica visível
durante o deslize inteiro — então o pause só pode ser no fim de verdade do
movimento.

E a volta: `pular(true)` também tem que chamar `tocar()`. Um refresh da browser
source com a peça no ar precisa voltar com o **loop rodando** — senão ela
reaparece correta e CONGELADA, e ninguém percebe até alguém reparar que o motion
parou.

### Quando a arte vira vídeo, o que se PERDE

Registre no arquivo, porque não volta sozinho:

- **Animação por camada.** Um sticker que batia por cima como adesivo
  (`scale: 0.5→1`, rotação −14°, `back.out(1.8)`) morre quando ele vira a mesma
  imagem do resto dentro do webm. Recuperar exige o motion entregar aquela
  camada num arquivo à parte — sobrepor o PNG ao vídeo que já a contém faria a
  arte crescer de dentro de si mesma.
- **Campo vivo que virou queimado.** Uma hashtag desenhada como texto e que
  chega queimada no webm: manter o texto por cima poria a hashtag DUAS VEZES no
  ar. O custo, que precisa estar escrito: **trocar a hashtag entre temporadas
  passou a ser pedido de vídeo novo ao motion**, não uma linha no CSS. Apague o
  código e **mantenha o bloco de comentário** dizendo isso.
- **Simetria entre modos.** Se o motion entregou o webm de um modo e não do
  outro, o modo A tem fundo em movimento e o modo B tem fundo parado — e a troca
  acontece com a peça no ar, uma logo depois da outra. Não é escolha de
  implementação: é o material que existe. Registre o que falta e o que o port
  vai custar quando chegar.
- **Texto que não acompanha o float.** A arte oscila ±2px (ou 32px) no loop; o
  texto é HTML estático e fica parado. Custo aceito e validado em produção —
  acompanhar exigiria a curva quadro a quadro, que o vídeo não expõe em runtime.

---

## 9. Texto: as medidas, e as cinco que mentem

Tudo em `utils/medida.js`. O que vale saber por família:

| família | o que se mede | tipo de auto-fit |
|---|---|---|
| `lt_` de nome | largura contra um vão do PSD (subpixel) | `MEDIDA.ajustar` (Range) |
| `lt_` de parágrafo | **ALTURA** da caixa | `scrollHeight > clientHeight` próprio |
| `fs_` de nome | igual ao `lt_`, com reancoragem por baseline | `MEDIDA.ajustar` |
| draft / grade | `scrollWidth > clientWidth` (inteiro contra inteiro) | laço local |
| relógio / dígito | **nenhum** | célula de largura fixa |

### Ancoragem por BASELINE, não por caixa

O PSD ancora point text pela linha de base. Centralizar numa caixa de altura
fixa é mais curto e está ERRADO de um jeito que só aparece no nome longo: quando
o auto-fit reduz o corpo, texto centralizado **sobe**, e a linha de base passa a
dançar de um lado da tela para o outro — o time A com nome curto e o B com nome
longo ficam em alturas diferentes, lado a lado, na mesma peça.

```js
el.style.top = MEDIDA.topoParaBaseline(BASE, r.tam, familia, peso, 1) + "px";
```

**DEPOIS do `ajustar`**: é o corpo final que define o offset. E `align-items:
flex-start`, nunca `center` — centrado, a linha se recentra dentro da altura
fixa a cada encolhida e a baseline anda junto (no piso isso já jogou um nome
8,9px abaixo da âncora).

O fator sai das **tabelas da própria face**, não de nota de manifesto:

```
AkiraExpanded-SuperBold.otf
  upem 2048 · hhea 1722/−427 · USE_TYPO_METRICS DESLIGADO
  usWinAscent/Descent 1722/427 — IDÊNTICOS ao hhea, então os dois caminhos que
  o Chrome pode escolher dão o mesmo número
  baseline = (1 − (1722+427)/2048)/2 + 1722/2048 = 0,81616211 em
```

⚠️ Quem usar a fórmula `typo` (que pressupõe o bit LIGADO) erra 15px num corpo
de 225px. E o Chromium **arredonda ascent/descent para px inteiro** antes de
montar a line box, então o fator efetivo muda com o corpo (medido: 0,80454 a
0,82123 contra a constante 0,81616). O erro é sub-pixel e aceitável; para não
depender de constante, `MEDIDA.baseline()` pergunta ao renderizador com uma
sonda `inline-block` de altura zero e `vertical-align: baseline` — `offsetTop`,
não `getBoundingClientRect` (o rect volta em px de TELA, já escalados pelo fit).

### Exceção: quando `align-items: center` é o certo

Num nome **centrado dentro de uma placa**, o que se lê é o centro óptico. No
corpo máximo os dois coincidem por construção; quando o auto-fit reduz, a linha
fica opticamente centrada em vez de pregada na baseline, e a deriva é metade da
redução. É escolha, e tem que estar comentada — não é esquecimento.

### O piso, e o que ele compra

Não vem do manifesto: é decisão do gráfico. O kit todo fica em **~0,62 do
máximo** (28/44,49 · 26/42,8 · 42/68,19 · 30/49,29), e o número compra isso:

```
LOUD (4)                   68,19px, corpo cheio
PAIN GAMING (11)           68,19px, 622 de 657 do vão
INTZ E-SPORTS (13)         60,69px — aqui o fit começa a agir
CORINTHIANS PAULISTA (20)  42px (piso) e AINDA estoura por 36px — avisa e vai
```

Piso mais fundo (~0,49) vale quando o campo é mais estreito que o dos irmãos —
duas pessoas dividindo a barra, por exemplo. Escolha medindo os cadastros reais,
não por proporção: os `@` de Instagram do cadastro de hoje já roçavam o piso
antigo.

🚨 **No piso e ainda estourando: avisa e DEIXA no ar.** Cortar o nome de alguém
no meio é pior que passar alguns pixels da arte.

### A caixa do PSD pode ser MAIOR que o vão real

O auto-fit mede contra a caixa que você deu. Se essa caixa passa **por baixo de
outra plate**, ele conclui que cabe e não avisa — e o texto vai ao ar
**coberto**, não vazado. Sem erro, sem log.

```
A caixa do nome veio do placeholder do PSD (`TEAM NAME`, 224px), que é curto.
Medindo o render: a placa vai de x=700 a 1220, mas os slots de ban ocupam
596..746 e 1174..1324 e pintam POR CIMA dela — o amarelo livre é 746..1174.
As duas caixas de 224 enfiavam 14px cada uma sob um ban, e "QUIEROQUEQUE"
parava em 20,4px com o "E" final comido. No ar: "QUIEROQUEQU".
```

**Derive o vão do que está PINTADO**, e documente a conta:
`nomeA = 2 × (790 − 461,29) = 657,42 (aperta a estrela)`.

Ao auditar, a pergunta não é "o texto passou da caixa CSS?", é **"o que está
pintado embaixo das pontas da tinta?"** — `document.elementsFromPoint` responde.

### Palavra única: U+200B, nunca `overflow-wrap: anywhere`

Nome com espaço cai em duas linhas sozinho. Palavra única só faz o corpo ceder,
e dois lados da mesma placa com corpos diferentes leem como quebrado.

```js
function comQuebras(nome) {
  return String(nome == null ? "" : nome)
    .replace(/([a-z0-9])([A-Z])/g, "$1​$2")
    .toUpperCase();          // DEPOIS: toUpperCase() destrói a caixa que marca o ponto
}
```

⚠️ `overflow-wrap: anywhere` quebra em qualquer ponto **já no corpo cheio**:
`GORDITOS` sai `GORDI/TOS`, **passa no teste** e vai errado ao ar.

E faça a caixa alta **no JS**, não só por `text-transform`: com o DOM já na caixa
final, qualquer medição futura por `Range` mede o que o navegador pinta. Medir
texto minúsculo que o CSS sobe dá **~18% a MENOS, e sempre pra baixo** — o lado
que faz passar no teste exatamente o texto que deveria reprovar.

### Quando `MEDIDA.ajustar` NÃO serve

Texto de parágrafo (múltiplas linhas, caixa mista). Ali a restrição é a ALTURA,
e a largura do conteúdo é sempre a da caixa. Mede-se `scrollHeight` contra
`clientHeight` — **no FILHO, não na caixa**: se a caixa centra o bloco na
vertical, conteúdo maior transborda para os DOIS lados e a região rolável ignora
o de cima; o laço pararia cedo e o parágrafo iria ao ar cortado em cima e
embaixo. A largura entra na condição por causa de palavra que não quebra (URL,
hashtag longa).

E **separe as duas direções no aviso**: altura = texto comprido demais (corte
texto); largura = palavra que não quebra — e aí encurtar o resto não resolve
nada.

### Teto de linhas, não altura da caixa

Numa fileira de colunas, a caixa pode comportar 3 linhas e o designer ter
desenhado 2. Com 3, a coluna longa quebra o ritmo: uma coluna ocupando o vão
todo ao lado de outra com uma linha só lê como desalinhado, não como nome
grande. Com o teto, **o corpo cede em vez da altura** e as colunas mantêm o
eixo. No piso, solte o teto antes de deixar vazar — 3 linhas apertadas ainda é o
nome inteiro.

🚨 E `min-width: 0` no span dentro de flex. Item de flex nasce `min-width: auto`
e se recusa a encolher abaixo do min-content: com palavra única e longa o span
**ESTICA**, a medida compara a caixa esticada com ela mesma e aprova, e o
`overflow: hidden` corta **dos dois lados** (some a primeira letra e a última).

### Dígito de largura não-fixa, e `tabular-nums` que é no-op

```
Avanços medidos (upm 2048), em 224,89px:
  0 2 3 4 5 6 8 9 → 1745 upm → 191,65px
  7 ............. → 1613 upm → 177,14px
  1 ............. → 1482 upm → 162,75px
```

Num point text CENTRADO, sem célula o bloco recentraliza a cada tique: num `01`
o `0` anda 14,5px e o grupo encolhe 28,9px — **pisca a cada minuto que passa por
um `1` ou um `7`**, no ar.

🚨 E `font-variant-numeric: tabular-nums` **não resolve**: se o GSUB da face não
tem `tnum`, a propriedade é no-op. A saída é a **célula fixa** (`inline-block` da
largura do dígito largo, `text-align: center`) — e criar as células em JS, não
no markup: um espaço em branco entre dois `inline-block` vira espaço de verdade e
empurra o segundo dígito pra fora.

### Fonte sem acento é decisão de produção, não bug do gráfico

Medido: uma face de display cobria **1 de 26** caracteres acentuados do
português. O sintoma é `JOÃO` indo ao ar com o `Ã` na fallback, visivelmente mais
estreito, no meio do nome da pessoa.

Onde isso morde é **por campo**, e vale mapear no cabeçalho de cada peça: nome de
convidado e nome de time sofrem; um campo que só carrega dígitos e uma palavra
fixa, não. A fallback declarada é **escolha** (a menos destoante do kit), não
conserto — e quando o arquivo completo chegar, o critério de aceite é **26/26
conferido**, não "o designer disse que é o completo".

---

## 10. Imagem: as três políticas

| | plate (arte versionada) | imagem por NOME (cadastro) | genérico |
|---|---|---|---|
| pode faltar? | **não** — se faltou é bug | **sim**, e é normal | é o fallback |
| na falha | `log.error` alto | placeholder silencioso | — |
| quando carrega | no **boot**, antes do 1º change | a cada troca de conteúdo | — |
| como entra | `background-image` no CSS | `IMAGEM.pintar` | parâmetro `fallback` |

### `decode()`, token de corrida, e o que a promessa significa

`decode()` promete **decodificada e pronta para pintar** e **rejeita** quando o
arquivo não existe — uma API resolve o preload e o caminho de erro.

O token `el.__imgReq` não é zelo: ao vivo o operador troca de convidado duas
vezes em segundos, e sem ele a imagem ANTERIOR — que demorou mais — chega depois
e **sobrescreve a nova**. O sintoma é a peça mostrando a pessoa errada, sem erro
em lugar nenhum.

🚨 **E a requisição descartada não devolve `false` — devolve o desfecho de quem
VENCEU.** Isto pôs uma peça no ar com defeito:

```
A peça redesenha várias vezes no boot (render(null) → change → BS.carregar() →
refit de fonte), então a MESMA foto entra em 2 ou 3 requisições concorrentes. A
vencedora pintava o rosto; a descartada resolvia DEPOIS (dois decode() do mesmo
arquivo não resolvem em ordem garantida), devolvia `false`, e o chamador —
`.then(ok => el.classList.toggle("como-ph", !ok))` — carimbava a INICIAL do nome
por cima da foto certa. O painel de dev ainda dizia "sem imagem: foto 1, 4, 2, 3"
com as quatro pintadas.
```

O erro estava em `false` significar três coisas: falhou, veio vazia, e **perdeu a
corrida** — e só as duas primeiras são notícia para quem chamou.

### A entrada espera as imagens

```js
async function aplicar(estado) {
  render(estado);                          // texto entra na hora
  await IMAGEM.todas(pares);               // imagens ficam prontas
  if (querVisivel && !noAr) entrar();      // só agora anima
}
```

Numa peça `fs_` **não existe `entrar()` para segurar** — e o que aquela regra
realmente protege já está no utilitário: o `decode()` antes de pintar e o token
por elemento fazem o SETAR com o input no preview nunca mostrar meio retrato.
Segurar a peça INTEIRA até as fotos resolverem seria pior: esconderia nomes que
já estão certos, e o vMix cortaria para um quadro vazio. A promessa continua
sendo devolvida — para a tela de dev e para o `test()`.

### O resolvedor diz a verdade; a PEÇA decide o que desenhar

🚨 **Fallback dentro do resolvedor CEGA o painel.** Um resolvedor genérico que,
não achando o campo pedido, cai no campo principal **nunca devolve `null`** — e
aí o `!BS.fotoX(...)` do painel é sempre falso. O aviso "⚠ sem foto" vira
decoração: não dispara nem quando a arte de fato não existe. Num bundle real
isso ficou dois meses assim, e o mesmo fallback ainda punha um escudo quadrado de
512 esticado até 1080×1080 no slot de uma figura de corpo inteiro.

Divisão que funciona:

- **o resolvedor** responde *"existe arte desta pessoa?"* e devolve `null` quando
  não. Campo secundário quer **resolvedor próprio, sem fallback**.
- **a peça** responde *"o que eu desenho quando não existe?"*, passando o
  genérico como `fallback` do pintor. Só ela tem contexto: um slot **sem nick
  nenhum** não leva silhueta (senão inventa um jogador), enquanto um slot **com
  nick e sem foto** leva.
- o genérico entra no manifesto como **chave de topo** (fora de `itens`),
  resolvido por função separada — nunca indexado pelo nome, para ninguém achá-lo
  procurando uma pessoa.

A cadeia fica honesta e em ordem de especificidade:
**capa do capitão → foto do time → silhueta**, sem nenhum degrau fingindo ser o
de cima. E a peça carimba de ONDE veio, só para a tela de dev:

```js
capaDe: BS.capaDoTime(time) ? "capitão " + nick
      : BS.fotoTime(sigla)  ? "time " + sigla
      : BS.jogadorPadrao("capa") ? "silhueta (sem capitão e sem foto de time)"
      : "nenhuma",
```

### Encaixe: cobrir a franja, e escolher entre `cover` e `contain`

**A franja.** O miolo "branco puro" de uma moldura não é o limite: existe uma
franja de antialiasing de 1px que o teste de cor não pega. Medido num slot de
150×150 — miolo em 4..145, franja em x=3 (195,195,195) e x=146 (120,120,120).
Encaixar em `4/142` deixa a franja clara exposta: no ar é um fio claro vertical
em cada slot, em todos ao mesmo tempo. O certo é **3..146 nos quatro lados**.
`>245` acha o miolo, `>200` já pega parte da franja, e a diferença entre os dois
é exatamente o fio que aparece no ar.

**`cover` vs `contain`** não é preferência:

- `cover` corta rosto quando o arquivo não bate com a proporção. Rosto cortado é
  pior que folga.
- `cover` num slot com **margem transparente no arquivo** deixa a margem DENTRO
  da caixa — dois fios de 6,4px mostrando o fundo. Medido em 146 arquivos de um
  fankit: 50 sem margem, 96 com (quase todos 6px lateral). A saída foi
  `background-size: 110% 107%`, derivado da razão tinta/arquivo — escala **não
  uniforme**, autorizada em produção, com a nota de que quem trocar por `cover`
  devolve o fio.
- `cover` num logo quadrado dentro de caixa larga **decapita**: renderizados os
  oito escudos de uma liga, `cover` cortava 36% da altura — cabeça inteira,
  ponta de capacete, bico de brasão. `contain` põe centrado e deixa o resto
  transparente, que é o comportamento certo quando a plate vem VAZIA para ser
  fundo.
- 🚨 **`contain` sozinho encosta na moldura** quando o desenho preenche o
  quadrado inteiro do arquivo. A folga vem de `padding: 5px` +
  `background-origin: content-box` — e **não** de `background-size: 69px`, que
  fixa a largura e deixaria um wordmark horizontal baixinho e um escudo alto
  estourando. Com padding quem decide continua sendo `contain`.

**Recorte não-retangular vai num WRAPPER**, não no elemento da imagem: com o
`clip-path` na própria foto, o polígono fica em coordenada DELA, e mexer no
`left`/`top` para reenquadrar o rosto arrasta o recorte junto. Com o wrapper em
`inset: 0` do card, o polígono está em coordenada de CARD e a foto vira um knob
livre. E `overflow: hidden` não substitui: um card chanfrado deixa passar a
cunha da base, que é justamente onde a camiseta está.

---

## 11. O contrato da pasta de assets

Uma pasta por peça, derivada do nome do PSD (`L3_MetaLike.psd` →
`<assets>/l3/l3_metaLike/`). Dentro:

```
assets.json       o manifesto — a fonte da verdade de TODA coordenada
ASSETS.md         o guia de remontagem + as pendências abertas
<plate>.png       o que vai ao ar
<peça>.webm       idem, quando a arte é vídeo
_reference.png    o achatado do designer — régua, não runtime
_geo.json         bbox de alfa por plate
_origem.json      procedência (driveFileId + driveModifiedTime)
_proof_*.png      provas de conferência
```

Arquivo que **não vai ao ar leva `_`**. É o que separa runtime de régua de
calibração sem ninguém precisar lembrar.

### O `assets.json`, pelos campos que o gráfico consome

```jsonc
{
  "source": "refs/L3_Single.psd",
  "canvas": { "w": 1920, "h": 1080 },
  "origem": { "driveFileId": "…", "driveModifiedTime": "…" },
  "palette": { "amarelo": "#FFBF1F", "tinta": "#040F2B" },
  "fonts": {
    "display": {
      "family": "Akira Expanded", "psName": "AkiraExpanded-SuperBold", "weight": 800,
      "metrics": { "unitsPerEm": 2048, "hheaAsc": 1722, "hheaDesc": -427,
                   "USE_TYPO_METRICS": false, "baselineFactorLH1": 0.7656 }
    }
  },
  "plates": [{
    "id": "frame", "file": "frame.png",
    "x": 60, "y": 854, "w": 566, "h": 175,
    "arquivo": { "w": 566, "h": 175 },        // 🚨 recortado; se fosse 1920×1080 ancora em 0,0
    "plateShape": { "arestaEsquerda": "vertical", "anguloGraus": 12.5 },
    "nota": "…o que está queimado junto e por que não se separa…"
  }],
  "fields": [{
    "id": "nome", "type": "text", "plate": "frame",
    "box": { "x": 190, "y": 48.2, "w": 327.2, "h": 44.5 },
    "spanSource": "derivedFromPlate",
    "measured": { "w": 325.6 },               // a tinta do EXEMPLO, não um vão
    "sizePx": 44.49,
    "sizeDerivacao": "FontSize nominal 15,36925 × escala do transform 2,8948",
    "baselineCanvas": { "x": 413.58, "y": 936.24 },   // 🚨 o dado PRIMÁRIO
    "autoFit": { "obrigatorio": true, "larguraMax": 327.2, "tamMax": 44.49,
                 "tamMin": "NÃO DECIDIDO — ver ASSETS.md" }
  }],
  "naoDecidido": ["…"]
}
```

Cinco regras que esse formato impõe:

1. 🚨 **O corpo NOMINAL do PSD mente.** Ele vem redondo (100,0) ou repetido em
   todas as camadas porque o designer escalou a CAMADA em vez de mudar o corpo.
   O valor real é `FontSize × escala do transform` — escrever o nominal entrega
   um glifo 4× ou 28× errado. O manifesto declara a derivação; copie ela pro
   comentário do CSS.
2. **`baselineCanvas` é primário, `box.y` é derivado.** Ancore pela baseline.
3. **`measured` é o contorno do EXEMPLO**, não o vão. O vão honesto sai de
   `derivedFromPlate` — e às vezes nem dele (ver §9, a caixa maior que o vão).
4. **`arquivo` diz a convenção de export.** Sem ele, quem escreve o gráfico
   descobre renderizando.
5. **`naoDecidido` é parte do contrato.** Piso do auto-fit, escolha entre dois x
   divergentes, se a placa é elástica — tudo que ninguém decidiu fica listado, e
   a peça escolhe explicitamente, com a medição que sustenta a escolha.

### Procedência sobrevive ao clone

`origem.driveFileId` + `driveModifiedTime` respondem, noutra máquina, a única
pergunta que importa: **mudou alguma arte desde que extraímos?** Compare por
**id**, nunca por nome — o designer renomeia arquivo, o id não muda. E uma peça
pode aparecer com duas pastas: são extrações diferentes do mesmo PSD.

---

## 12. O painel de cada área

Vocabulário e regras gerais em `dashboard-ui.md`. O que é específico por área:

### Fábrica de bloco, quando os blocos são irmãos

Um painel de lower thirds tem 5 blocos com o mesmo miolo. Uma função chamada 5
vezes, parametrizada por `{rep, ids, air, setar, play, out, status, teto, norm,
ler, montar}` — e uma segunda fábrica para **bloco só de ar** (sem campo, logo
sem SETAR nem `sujo()`: a primeira indexa `campos[0]` pra decidir o SETAR).

🚨 **A flag `tocado` é POR BLOCO.** Compartilhada, editar um bloco congelaria a
sincronização dos outros.

### Um bloco de operação pode governar DUAS peças

Duas peças irmãs (um convidado / dois convidados) continuam sendo dois arquivos
e dois replicants — a §3 da SKILL é explícita. O que se junta é a **OPERAÇÃO**:

```js
const cvAlvo = () => (cvEstado()[2] ? DB_LTDOUBLE : DB_LTSINGLE);  // o PLAY escolhe
```

- **`cvAlvo` lê do ESTADO, não do formulário**: o que sobe é o que foi setado, e
  dizer o contrário faria o rótulo mentir enquanto o operador digita o 2º nome.
- **O OUT baixa AS DUAS, sempre.** Baixar só a que o formulário aponta deixaria a
  outra no ar se o operador editasse o Nome B depois do PLAY.
- **O SETAR grava o par A nos DOIS**, para alternar não exigir redigitar.
- ⚠️ Duas escritas em replicants **diferentes** não são a escrita dupla que a §4
  proíbe — aquela é sobre duas escritas no MESMO replicant, onde a segunda lê o
  valor velho da primeira.

### Aviso de colisão

Peças de uma mesma faixa são inputs separados no vMix: nada impede duas no ar ao
mesmo tempo, e aí uma cobre a outra.

```js
$("ltStatus").innerHTML = noAr.length > 1
  ? `⚠ <b>${noAr.join(" + ")}</b> no ar juntas — ocupam a mesma faixa` : "";
```

Liste as peças **separadas** mesmo quando compartilham bloco: o OUT do painel
baixa as duas, mas o vMix na mão não.

### Uma cena, um botão

Cena de fullscreen é acionada em **um lugar só**. As que ganharam painel próprio
e as de pré-show saem da grade, e a lista mora num `comum.js` compartilhado —
duas cópias da tabela de rótulos divergem no primeiro rename.

Custou uma sessão inteira de *"apertei créditos e não apareceu nada"*: havia dois
botões com o mesmo rótulo, e o mais visível era o que **só trocava a cena**, sem
rodar o rolo. Se uma cena precisa de dois efeitos, **o botão faz os dois**.

### `<select>` ou `<datalist>` não são intercambiáveis

- **`select`** quando o valor tem que existir no cadastro (confronto, draft). Ele
  guarda a **sigla**, não o nome: sigla é a chave, e o nome pode ser corrigido
  depois. Mostre a sigla no rótulo e o nome inteiro no `title` — nome longo é
  cortado sem aviso, e `scrollWidth` **não** acusa isso em `<select>`.
- **`datalist`** quando o valor pode ainda não estar cadastrado (chave montada
  com classificados, convidado de uma edição só). Travar impediria montar antes
  de o cadastro fechar.

E o datalist de times vem do **replicant de cadastro**, não do manifesto de arte:
quem manda no nome de um time é o cadastro, e um time recém-inscrito tem que
aparecer antes de o escudo chegar.

### Workspaces por ORDEM DE USO

O NodeCG ordena as abas alfabeticamente. Numere-as na sequência do programa
(`1. FULLSCREEN`, `2. LOWERTHIRDS`, `3. INGAME/DRAFT`…), não por tipo de peça.
Dois painéis que se alimentam um do outro ficam na MESMA aba — trocar de aba no
meio de um draft é onde o operador erra. O workspace `main` não pode ser
renomeado: deixe-o vazio de propósito e comente isso.

Registre `width` **e** um `_width` ao lado explicando a escolha com o conteúdo
real que a decidiu. Sem a nota, o próximo desfaz sem saber.

---

## 13. Checklists por família

**Lower third (`lt_`)**
- [ ] replicant com `visivel`, `persistent: false`, lido sem `defaultValue`
- [ ] as quatro funções: `entrar` / `sair` / `pular` / `aplicar`
- [ ] os quatro ramos do `aplicar`, nesta ordem
- [ ] `if (tl) tl.kill()` nas três; reset do estado inicial no topo da entrada
- [ ] o reset roda ANTES da espera do `play()`
- [ ] trava de OUT dentro do `.then` do `tocar()` **e** dentro do `onComplete` da troca
- [ ] `FORA` bate com o `transform` de repouso do CSS
- [ ] quem se move é o PAI (arte e texto viajam juntos)
- [ ] a chave de conteúdo não inclui campo derivado de outro
- [ ] vídeo: `clip-path` pela união dos 240 frames + 8px; pausa só no `onComplete`
- [ ] `test() → testOut() → test()` RE-ANIMA

**Fullscreen (`fs_`)**
- [ ] `opacity: 1` para sempre, sem `visivel`, sem GSAP, sem as duas travas
- [ ] conferido o que é `opaco: true` (input do vMix) contra o que o HTML desenha
- [ ] a ordem de pilha do PSD justifica cada plate desenhada aqui
- [ ] plate de frame cheio ancorada em 0,0 (conferido o tamanho do PNG)
- [ ] cena registrada no `cfg/<bundle>.json` e o painel diz **PEDIDO**, não "NO AR"
- [ ] se ROLA: `seq` no replicant, px/s calculado, ticker de diagnóstico

**Draft / picks & bans**
- [ ] duas cenas = dois arquivos, com o aviso de operação no `package.json`
- [ ] `revelado()` idêntico no painel e no gráfico, comentado nos dois
- [ ] `ORDEM_SLOT` igual nos dois lados; o espelho está no `x`
- [ ] `checarSimetria()` existe e passa
- [ ] fade por slot com guard de URL; `esquecerFades()` na saída
- [ ] relógio: uma régua só (`RELOGIO.agora()` ou o número pronto do servidor)
- [ ] o replicant do relógio não é escrito por dois donos

**In-game (`ig_`)**
- [ ] replicant ALWAYS ON declarado na **extension**
- [ ] fade, não deslize; `.animado` ligada depois do primeiro estado
- [ ] o vão do HUD nativo do jogo está livre e comentado
- [ ] simetria conferida par a par antes de assumir espelho
- [ ] cor de broadcast não usa token de cor do jogo

**Peça de canto**
- [ ] um replicant por pedaço que entra e sai sozinho
- [ ] travas e timelines próprias por pedaço
- [ ] cantos opostos
- [ ] integração externa: rota de consumidor, `allSettled`, último valor bom por fonte

**Antes de dizer que está pronto** — além do checklist da SKILL:
- [ ] deixei a peça no ar **mais de um loop do webm**: volta sem piscar e sem parar
- [ ] recarreguei a browser source com a peça no ar: voltou igual, com o loop RODANDO
- [ ] medi a caixa de `clip-path` sobre TODOS os frames, não por amostragem
- [ ] `?dev=1` mostra o que foi DESENHADO, sem campo órfão de estado removido
- [ ] o que a arte em vídeo fez PERDER está registrado no arquivo, não só no commit
