# Famílias de peça: como cada área é construída, animada e ligada ao estado

Este documento descreve o comportamento de runtime de um kit de broadcast: o que
muda de uma área para outra (lower third, fullscreen, draft, in-game, câmera) e o
que é igual em todas. Complementa `psd-to-html/tipos-de-peca.md`, que classifica
a arte que chega do designer; este diz como o HTML daquela arte se comporta no ar.

Os números concretos são exemplos de como cada restrição se manifesta. Copie o
raciocínio, não o valor.

Antes de qualquer outra coisa, responda: **quem põe esta peça no ar?** A resposta
decide a família, se existe timeline e se o replicant tem campo `visivel`.

---

## 0. Decidindo a família em três perguntas

| | Quem transiciona | Anima no HTML? | Campo `visivel`? | Prefixo |
|---|---|---|---|---|
| Entra e sai a cada informação | o próprio HTML, por replicant | sim, GSAP | sim | `lt_` |
| É uma cena do switcher | o vMix (`PreviewInput` + `Stinger`) | não | não | `fs_` |
| Fica no ar por trechos longos e se preenche | o HTML, uma vez só | entrada/saída da peça inteira | sim | sem prefixo |

**O critério é quem anima, não quanto do quadro a peça ocupa.** Uma barra que
cobre a faixa de baixo inteira, sobre a câmera do estúdio, e entra pela própria
timeline é `lt_`. Chamá-la de `fs_` promete uma cena no switcher que não existe,
e quem for ligar a peça procura um input que ninguém montou.

**O prefixo pode estar errado por herança** (ex.: um `lt_` que na verdade é peça
de canto, da terceira família, renomeado por outro motivo). Quando prefixo e
comportamento divergirem, o cabeçalho do arquivo manda e deve dizer isso na
primeira tela:

```
⚠️ O `lt_` do nome não põe este arquivo na família dos lower thirds. Lower third
aqui é peça que entra e sai a cada informação; esta fica no canto por trechos
longos, que é a terceira família. Procure a gramática de animação desta peça
lá, não nos `lt_` de verdade.
```

### Peça dirigida por utilitário (não é uma quarta família)

Quando quatro ou mais peças são o mesmo mecanismo com números diferentes (as
molduras de 2, 3, 4 e 5 câmeras), o runtime sobe para `utils/` e cada `.html`
guarda só a geometria daquela arte. Ver §7.

---

## 1. O esqueleto que toda peça tem

Vale para qualquer família. Faltar um destes é bug latente.

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

### A ordem do boot: um `Promise.all`

Não assine replicant antes de a peça conseguir desenhar direito. Toda peça segue
esta forma:

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

Regras:

- **Nenhuma das promessas rejeita.** Fonte atrasada cai na rede de segurança
  (`MEDIDA.aoCarregarFontes`); vídeo que falhou vira log. A peça assina o
  replicant de qualquer jeito, sem arte mas obedecendo ao painel. Travar a
  entrada porque o webm falhou troca "barra sem fundo" por "nada no ar".
- **Polling de dado fica fora do `Promise.all`.** Num arquivo que consome um
  gateway externo, o `LIVESTATS.assinar()` fica solto, acima. Dentro do
  `Promise.all`, um webm lento atrasaria a primeira contagem, e um webm que
  falhasse levaria junto os números de outra peça que nem tem vídeo.
- **`render(null)` antes de `iniciar()`.** A peça precisa de um quadro válido
  antes do primeiro `change`. Num relógio, `00:00` lê como "ninguém armou";
  quatro células vazias leem como peça quebrada.

### A rede de segurança de fonte, sempre

```js
MEDIDA.aoCarregarFontes(function () {
  if (ultimoEstado) render(ultimoEstado);
});
```

Sem isto, o corpo do texto depende da ordem de carga, e a browser source pode
recarregar no meio do programa com a rede em qualquer estado.

### `<link rel="preload">` de fonte é obrigatório com texto medido

O `@font-face` costuma ficar num `shared/fontes.css` alcançado por `@import` de
dentro do tema: o browser só descobre a face depois de buscar e parsear duas
folhas. Até lá o texto pinta na fallback, com outra métrica; o auto-fit escolhe
um corpo grande, a face real entra depois e o texto vaza a moldura.

```html
<link rel="preload" href="…/AkiraExpanded-SuperBold.otf" as="font" type="font/otf" crossorigin />
```

- `crossorigin` é obrigatório em preload de fonte, mesmo na mesma origem. Sem ele
  o browser busca o arquivo de novo.
- Peça que não desenha texto não leva preload: remova-o.
- Da mesma forma, se nenhum elemento da peça consome `--contorno`/`--sombra`,
  tire o `.bs-ar` do `.stage`.

### `window.test()` / `testOut()`, no fim do script

Permitem ensaiar a peça sem o painel e verificá-la por render headless.

- **Passe pelo caminho real de ar.** `test()` chama `entrar()`, não monta o
  estado final na mão. Assim o ensaio exercita a espera do `play()` do vídeo e o
  reset da timeline.
- **Devolva o que foi pedido, não o `diag`.** Com a peça no ar a troca é animada
  e o render acontece depois do `return`; o `diag` mostraria o nome anterior.

O comentário do bloco diz o que conferir:

```
Confira o replay: test() → testOut() → test() tem de RE-ANIMAR.
Confira o LOOP: deixe no ar mais de 10s — a arte volta ao início sem piscar.
```

---

## 2. Lower thirds (`lt_`)

**Definição:** entra, informa, sai. Entre uma informação e outra o conteúdo
troca. A browser source fica sempre carregada no vMix; quem controla o ar é o
replicant.

### O replicant

```js
{ visivel: false, nome: "", social: "" }       // um convidado
{ visivel: false, a: {nome,social}, b: {…} }   // dois convidados
{ visivel: false }                             // peça sem campo vivo
```

Declare com `defaultValue` e `persistent: false` (ar nunca persiste). Se o
gráfico também declara o replicant sem valor, ele pode ser criado vazio antes do
dashboard (ver a corrida de declaração na §2 da SKILL). Sintoma: o PLAY faz
`Object.assign({}, undefined, {visivel:true})` e a barra entra no ar sem nome e
sem social. Solução: declarar na extension (detalhes na §5).

### A máquina de estados: quatro ramos, nesta ordem

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

O que cada ramo evita:

1. **Primeiro estado:** sem ele, um refresh da browser source com a peça no ar
   faz a peça re-entrar deslizando, no ar.
2. **On-air:** sem ele, PLAY com a peça já no ar re-anima.
3. **Troca no ar:** trocar o texto no lugar faz o nome pular de largura por causa
   do auto-fit, o que lê como glitch ou erro de operação.
4. **Fora do ar:** não há o que esconder; troca direto.

Detalhes do ramo 3:

- O `eventCallback("onComplete", …)` **substitui** o callback do `sair()`, e é o
  desejado: para o operador a peça não saiu do ar, então o vídeo não pode pausar
  e rebobinar ali (a arte daria um salto visível no meio da troca).
- Mantenha a trava de OUT dentro do `onComplete`. Um OUT pode chegar durante a
  troca; sem a trava a peça volta ao ar sozinha depois de mandada sair.

### A chave de conteúdo é só conteúdo

```js
function chave(s) {
  return JSON.stringify([(s && s.nome) || "", (s && s.social) || ""]);
}
```

- Não inclua `visivel` (o ramo 2 já cuida).
- Não inclua campo que é função de outro (a foto resolvida do nome, o escudo
  resolvido do time). Hashear os dois conta a mesma mudança duas vezes e faz a
  peça sair e voltar à toa.
- Numa peça de dois modos, a chave inclui o modo e só o conjunto dele. Assim
  trocar de modo conta como troca de conteúdo (sai/volta), e escrever no conjunto
  que não está no ar não mexe em nada.

### A gramática de movimento do kit

Use um par de curvas para o kit inteiro. Referência:

| | duração | ease | observação |
|---|---|---|---|
| entrada (slide) | 0,55s | `expo.out` | |
| entrada (fade) | 0,28s | `power1.out` | em paralelo, na posição 0 |
| saída (slide) | 0,40s | `power2.in` | acelera embora |
| saída (fade) | 0,40s | `power1.in` | acompanha o slide inteiro |

**O fade de entrada é curto de propósito.** O `expo.out` concentra o movimento no
início: um fade da duração toda deixa a peça translúcida depois de ela ter parado,
o que lê como peça travando. Na saída é o contrário: a peça some enquanto sai.

Variações aceitas, cada uma com motivo:

- **`back.out(1.4)` em 0,5s** numa faixa institucional centrada que sobe do
  rodapé. Aqui o fade curto importa mais: o `back.out` passa do ponto e volta, e
  um fade longo deixaria a faixa clareando durante o repique.
- **Sem fade**, em peça de canto alto sobre gameplay: ali um fade lê como falha
  de sinal. As de rodapé usam fade porque sobem de dentro da borda.
- **`clip-path` que abre do centro**, em bloco centrado e horizontal.

### O `FORA` e o estado de repouso

O deslocamento de repouso fica no CSS (é a trava anti-flash do boot), e o `FORA`
do script tem que bater com ele:

```css
#lt { transform: translateX(calc(-1 * (var(--lt-x) + var(--lt-w)))); opacity: 0; }
```
```js
var FORA = -626;   /* −(60 + 566): a aresta direita da plate na borda esquerda.
                      Se mexer num, mexa no outro. */
```

Em peça de canvas cheio (arte em webm), o `FORA` também é derivado da bbox da
arte, não chutado: `−612` porque a bbox de alfa termina em x=602.

### As quatro funções de ar, sempre com os mesmos nomes

```js
function entrar()            // anima pra dentro; ESPERA o vídeo estar rodando
function sair()              // anima pra fora; pausa o vídeo no onComplete
function pular(visivel)      // põe no estado final SEM animar (primeiro estado)
function aplicar(estado)     // a máquina acima
```

- **Uma timeline por vez.** `if (tl) tl.kill()` no topo das três. Sem isso, um
  PLAY/OUT rápido empilha timelines nas mesmas propriedades e a peça trava no
  meio do movimento.
- **Replay-safety.** A entrada faz `gsap.set(...)` do estado inicial de cada
  filho animado, no topo. Não dependa da saída ter limpado: se ela nunca rodou
  (browser source recarregada, OUT que não chegou), a segunda entrada começa do
  estado final e não anima.
- **O reset roda antes da espera do vídeo, com `gsap.set` solto, não `tl.set`.**
  A peça vai para fora do quadro no mesmo quadro em que o PLAY chegou; se
  esperasse, piscaria no lugar final antes de voltar e animar.

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

### Quem se move é o pai

Num lower third com plates e texto, anime o **container**, não as plates. Se só
as plates deslizam, os campos de texto (irmãos delas dentro do container) ficam
parados no meio do quadro até a arte chegar embaixo deles. O defeito só aparece
durante o movimento; no quadro final tudo está no lugar.

### Peça com duas metades: não divida o vídeo

Para um barn-door (as duas metades entrando das laterais), não use dois
`<video>` do mesmo arquivo. Medido: p95 de 34ms entre quadros contra 17,8ms das
outras peças, ou seja, metade da taxa de quadro, e a saída anda aos trancos no
vMix. Além disso a deriva entre decodificadores obriga um `sincronizar()` por
quadro.

Use **um vídeo só + slide vertical**: as metades andam juntas, a costura nunca
abre e não há deriva.

---

## 3. Fullscreens (`fs_`)

**Definição:** cada cena é um input montado no vMix: o PNG (ou webm) de frame
cheio e, por cima, a browser source transparente só com o que muda. A troca é
`PreviewInput` + `Stinger`, na extension.

### O que muda em relação ao `lt_`

| | `lt_` | `fs_` |
|---|---|---|
| GSAP | sim | não |
| trava de primeiro estado | sim | não |
| trava de on-air | sim | não |
| campo `visivel` no replicant | sim | não |
| container | `opacity: 0` de nascença | `opacity: 1` sempre |

```css
/* Container da peça. `opacity: 1` para SEMPRE e sem campo `visivel`: numa peça
   fs_* o ar não é assunto deste arquivo. Um tween de opacidade aqui brigaria
   com o Stinger do vMix. */
#peca { position: absolute; inset: 0; opacity: 1; }
```

As duas travas protegem uma animação de entrada, e esta peça não tem nenhuma: um
refresh com a peça no ar só redesenha o mesmo quadro estático.

### O que o HTML desenha e o que vai como input: a regra do `opaco`

**Plate de frame cheio e opaca é input do vMix; o HTML não a desenha.** No
manifesto:

```json
{ "id": "bg", "arquivo": {"w":1920,"h":1080}, "opaco": true, "opacoPct": 100 }
```

Desenhar o `bg` no HTML criaria uma segunda cópia do quadro para manter alinhada
pixel a pixel, mais uma passada de composição por quadro, sem ganho.

**Exceção: a ordem de pilha pode obrigar o HTML a desenhar quase tudo.** Exemplo
de um card de versus (0 = topo):

```
0     Confronto  →  plate_a, plate_b, vs  (e os 4 textos)
1     logo
2     player_a          ← CONTEÚDO TROCÁVEL por confronto
3     player_b          ← CONTEÚDO TROCÁVEL por confronto
4,5,6 bg                ← input do vMix
```

As fotos são campo, então o HTML as desenha. E tudo que está acima delas na
pilha vem junto: se o logo estivesse queimado no input, a foto desenhada por cima
passaria na frente dele. Resultado: o input é só `[bg.png]`; a browser source
desenha fotos + logo + placas + estrela + texto.

Pelo mesmo motivo, uma arte animada de placas não pode ser camada de vídeo no
switcher: cobriria a browser source inteira e enterraria o texto. Como elemento
da peça, o empilhamento fica sob seu controle (fotos → logo → vídeo → texto).

### O `x/y/w/h` do manifesto não é o tamanho do arquivo

Vale no kit inteiro, mas aparece mais aqui porque pastas diferentes podem ter
sido exportadas de jeitos diferentes:

| Export | o `x/y/w/h` é | como ancorar |
|---|---|---|
| recortado (o PNG tem o tamanho da arte) | a geometria do arquivo | `left/top/width/height` direto |
| frame cheio (o PNG é 1920×1080) | o bbox da arte dentro do arquivo | `left:0; top:0; 1920×1080` |

Ancorar um PNG de frame cheio no bbox espreme o canvas inteiro naquela caixa (ex.:
um bloco de placar vira uma tira de 4px). O sintoma parece plate exportada
errada, não geometria. **Confira o tamanho do PNG antes de ancorar qualquer
plate** e declare a convenção no manifesto.

Para reutilizar uma plate de frame cheio em outra posição: o mesmo PNG num div do
tamanho da arte, na posição de destino, com `background-position` negativo da
posição de origem.

### As duas exceções da família

**1. Peça que rola.** Um crédito de encerramento tem GSAP, campo `visivel` e
timeline, porque o rolo é a peça: o vMix corta para a cena, mas quem faz os
créditos subirem é o HTML, que precisa de play, pausa e saber quando terminou. O
replicant carrega `{visivel, rodando, seq}`.

- `seq` faz um PLAY com a peça já no ar recomeçar do topo. Sem ele, `visivel:
  true` já sendo true não é mudança, e o segundo PLAY (o que o operador aperta
  quando o rolo terminou) não faz nada.
- **Calcule px/s antes de debugar.** Devagar demais parece quebrado: a 30px/s,
  com a janela começando na borda de baixo, o rolo leva ~2,5s para atravessar o
  fade de entrada e ~11s até o primeiro item estar inteiro em quadro, e o
  operador conclui que nada apareceu. Régua: ~0,72s por linha de nome passando
  (60px/s contra um leading de 43,3px).
- **Painel que acompanha animação longa precisa tiquetear.** Repintando só em
  mudança de estado, o diagnóstico mostra `progresso: 0%` com a peça a 27%. Use
  `setInterval(pintarDiag, 250)` enquanto roda; só custa em dev (o `pintarDiag`
  sai cedo sem a classe).
- Percurso: o rolo começa com o topo na base da janela e termina com a base do
  rolo no topo dela: `y: ALTURA_JANELA → −alturaConteudo()`, `ease: "none"`.
- Meça o conteúdo com `scrollHeight`, não `getBoundingClientRect().height`: o
  `fit.js` escala o stage por transform, o rect viria escalado e a duração
  mudaria com o tamanho da janela de preview.

**2. Peça só de texto.** As molduras de câmera não desenham fundo, moldura nem
barra: a arte entra por baixo, num input próprio, e a browser source é a camada
transparente por cima. Coloque no cabeçalho:

```
Se você abrir este arquivo e vir só duas palavras flutuando num quadro vazio,
está CERTO. Para conferir o encaixe, componha contra `_reference.png`.
```

---

## 4. Draft / picks & bans

**Definição:** fica no ar do começo ao fim do draft e se preenche
progressivamente; não entra e sai a cada pick. Anima uma vez na entrada e uma na
saída.

### Um gráfico, um replicant, e quando usar dois arquivos

Os blocos compartilham a mesma barra; separá-los obrigaria a alinhar duas browser
sources no ar. Mas **duas peças que entram e saem sozinhas são dois arquivos**,
mesmo com 80% do CSS repetido. Exemplos:

- Ban global como `modo` do draft: o PLAY dele punha no ar tudo que já estivesse
  digitado nos bans de set (e eles já estão digitados nessa altura). E com um
  input só no vMix não dá para montar uma cena de ban global e outra de draft e
  cortar entre elas. Por isso é peça própria.
- Uma variante da mesma barra (escudo no lugar do ban global) também é arquivo
  próprio: o torneio sem ban global aponta a browser source para ela sem mudar a
  operação.

**Aviso de operação:** quando dois arquivos desenham na mesma coordenada, nomeie
os inputs do vMix de forma que ninguém abra o errado no meio do programa, e
registre isso no `package.json`. (Vale também para a §7.)

### Reveal: digitar não é pôr no ar

```js
function revelado(s, id) {
  return ordemPlana(s.primeiro || "a").indexOf(id) < (s.revelados || 0);
}
```

O operador adianta a digitação; só o **REVELAR** incrementa `revelados` e põe o
pick na tela. O painel tem o mesmo guard: mantenha os dois idênticos e comente a
duplicação nos dois lados. Se só um mudar, painel e ar discordam, e o operador
confia no painel.

### O espelho fica na geometria, não na ordem

```js
var SLOT_X   = { a: [8, 161, 315], b: [1762, 1609, 1455] };
var ORDEM_SLOT = { a: [1, 2, 3], b: [1, 2, 3] };   // IGUAIS, e não é redundância
```

Não inverta a ordem do lado B (`b: [3,2,1]`): o `x` já põe o b1 na borda
direita, então índice 1 já significa "o mais externo" nos dois lados. Inverter
aplica o espelho duas vezes. Sintoma: numa fase de dois picks o lado A acende os
dois da borda e o lado B os dois do meio.

Transforme a simetria em asserção executável:

```js
window.checarSimetria = function () {
  /* para uma plate de largura w em x, o lado B fica em 1920 − x − w */
};
```

### Fade por slot, com guard contra piscar

Um pick aparecendo seco lê como glitch. Mas `aplicar()` roda a cada `change`, e
num draft chegam muitos (relógio, fase, reveal, placar).

```js
function pintarComFade(el, url, rotulo, nomeItem) {
  var alvo = url || "";
  if (el.__url === alvo) return Promise.resolve(true);   // só anima quando MUDA
  el.__url = alvo;
  …
  return fundoComFallback(el, url, rotulo).then(function (ok) {
    el.style.backgroundColor = cor;                      // a cor SÓ com o retrato
    gsap.fromTo(el, {opacity: 0}, {opacity: 1, duration: 0.35, ease: "power2.out"});
    return ok;
  });
}
```

- Sem o `__url`, cada tique do relógio reanimaria os seis retratos.
- Pinte a cor de fundo dentro do `.then`. Fora dele, ela aparece no quadro
  seguinte enquanto o `decode()` ainda está em voo: um retângulo colorido acende
  sozinho e o retrato chega depois. Com cache quente não aparece; aparece numa
  browser source recém-aberta.
- **Sem fade-out:** o slot volta na hora para o "?". Sumir devagar parece peça
  travando.
- Na saída da peça inteira, esqueça o que foi pintado (`el.__url = undefined`).
  Senão, a peça que volta com os mesmos picks acha que nada mudou e os retratos
  reaparecem secos.

### O relógio do draft

O padrão do kit é guardar o **prazo** (`fimEm`, epoch ms) e cada tela calcular
sozinha. Funciona quando tudo roda na mesma máquina, e faz uma browser source que
recarrega no meio de um pick voltar com o número certo.

**Com o dashboard em outro PC, o padrão falha.** O prazo é carimbado pelo relógio
de quem clicou e lido pelo relógio de quem desenha; dois Windows fora de domínio
divergem. Medido, com o gráfico recebendo um `fimEm` deslocado:

```
desvio            o que ia ao ar
0                 08   (certo)
+30s adiantado    00 VERMELHO, travado
+5min adiantado   00 VERMELHO, travado
−60s atrasado     68   (conta de um número errado)
```

Passando da duração de um pick, o `Math.max(0, …)` satura em zero, o tick vê
`seg === 0` e para de pedir frame: o relógio nunca arranca.

Duas saídas, nesta ordem de preferência:

1. **`shared/relogio.js`.** Cada tela mede o offset contra o servidor por
   round-trip (5 amostras, fica com a de menor RTT) e usa `RELOGIO.agora()` no
   lugar de `Date.now()`. Barato, e mantém o prazo absoluto. Duas fontes: a rota
   `/hora` da extension e, quando ela dá 404, o cabeçalho `Date` de qualquer
   resposta HTTP (resolução de 1s truncada para baixo: some 500ms para tirar o
   viés).
2. **O servidor conta e publica o número pronto**, quando a degradação silenciosa
   da opção 1 não é aceitável (uma tela que falha ao sincronizar volta em
   silêncio para o relógio local). Isso contraria a regra "nada de replicant
   tickado"; registre o porquê no código, com o custo: uma escrita por segundo
   enquanto um pick conta, ~210 num draft inteiro (o `tick` roda a 250ms mas só
   escreve quando o inteiro muda).

**O replicant do relógio é próprio.** Se o servidor escrevesse no mesmo replicant
que o painel, as duas escritas partiriam da mesma revisão e o NodeCG rejeitaria
uma em silêncio (`Mismatched revision number`). O servidor lê o ar e escreve só
no dele. Contrato: o painel incrementa um `cronoSeq` a cada turno novo e diz em
`cronoAtivo` se há alguém contando; nenhum dos dois é hora.

Guarda que impede o contador de recomeçar sozinho:

```js
if (seq === jaFeito) return;   // sem isto, QUALQUER escrita no AR reinicia os 35s
```

---

## 5. In-game (`ig_`)

**Definição:** overlay que fica sobre o gameplay a partida inteira e se preenche.
É a mesma terceira família da §6, com outro vocabulário de arte.

### Fade, nunca deslize

```css
#peca { position: absolute; inset: 0; opacity: 0; }
.stage.animado #peca { transition: opacity .4s ease; }   /* ligada DEPOIS do 1º estado */
#peca.on { opacity: 1; }
```

- A peça ocupa as quatro bordas do quadro ao mesmo tempo, então não há um lado
  de onde ela entra.
- O conteúdo troca com a peça no ar (um ban entra, o placar vira); animar a cada
  troca faria a peça inteira piscar.
- A classe `.animado` no stage é a trava de primeiro estado em CSS. Sem ela, um
  refresh da browser source com a peça no ar a faz reaparecer com fade no meio da
  partida.

### ALWAYS ON: o replicant tem que nascer certo

```js
nodecg.Replicant("DB_OVERLAY_JOGO", {
  defaultValue: { visivel: true, placar: null },
  persistent: false,
});
```

🚨 **Declare isto na extension.** Declarado só no painel, num restart do NodeCG a
browser source reconecta antes de alguém abrir o dashboard e cria o replicant sem
valor. Sem `visivel: true` a peça fica em `opacity: 0`, com todos os dados certos
por baixo e nenhum erro no console. Como é `persistent: false`, isso acontece em
todo restart, não só em instalação nova.

### Documente o que a peça não desenha

```
· O CRONÔMETRO. O vão de 177px no topo central (x 871..1047) é deliberado: é
  onde a pílula do relógio do JOGO aparece (medida em `_frame_jogo.png`, 161px,
  com folga dos dois lados). Não encoste nada nesse vão.
· O BAN GLOBAL e os PICKS. São do draft; aqui só os bans de set.
```

Uma pendência que se liga numa linha:

```css
:root {
  /* O placar NATIVO do jogo tem pixel de y=0 pra baixo e esta peça começa em
     y=23: sobra uma tira de placar do JOGO por cima do de BROADCAST. O default
     é 0 porque 0 é o que o PSD manda. PARA LIGAR: troque por 23px. */
  --sobe-blocos: 0px;
}
#topo { top: calc(0px - var(--sobe-blocos)); }
```

Use uma propriedade num contêiner só, não vários `top` corrigidos à mão: o
deslocamento tem que levar junto todo campo vivo do topo.

### Simetria parcial: meça antes de assumir

```
⚠ Esta peça não é simétrica em 960:
  · a barra de série (pips) é espelho exato — medido;
  · a placa do nome e a caixa do placar não são: as duas inclinam para o mesmo
    lado nos dois blocos. São translações, não espelhos.
```

- Onde é espelho exato, use `transform: scaleX(-1)` em vez de um segundo
  conjunto de números: um `left` copiado à mão diverge na primeira revisão da
  arte.
- O `scaleX` espelha só o horizontal. Se o vertical dos dois lados divergir em
  1px, isso precisa de regra própria.

### Quando não virar plate

Uma barra de série de Bo3/Bo5 dá 2 formatos × (2 ou 3) posições × 2 estados × 2
lados = 20 variantes, e a cor de cada pip é um papel (cor do time / branco). Faça
em CSS; os PNGs ficam como régua de conferência.

Não use o token de cor do jogo numa arte de broadcast: ele existe e resolve para
outra cor, que parece certa. Cor de arte sem token fica como custom property
local, com um comentário dizendo que a decisão vale para o kit inteiro.

---

## 6. Peça de canto (sem prefixo: a terceira família)

**Definição:** fica no canto por trechos longos, tem PLAY/OUT próprio e não entra
e sai por bloco de informação. Ex.: `bug.html`, `chat.html`, medidor de meta,
contador de views.

### Dois pedaços no mesmo arquivo, dois replicants

Juntar duas peças num arquivo é decisão de operação: uma browser source a menos
no vMix e um polling em vez de dois.

**Mas o ar continua em dois replicants.** Pela §3 da SKILL, duas peças que
precisam estar no ar ao mesmo tempo com conteúdos diferentes são dois replicants
(ex.: a audiência no ar sem a barra de meta). Achatar os dois `visivel` num
objeto faria o PLAY de uma mexer no ar da outra.

Consequências no código, todas obrigatórias:

- **Trava de primeiro estado e trava de on-air próprias** por peça. Flags
  compartilhadas fariam o primeiro `change` de uma cancelar a animação da outra.
- **Timeline própria** por peça, com sufixo no nome. Compartilhada, o OUT de uma
  mata a entrada da outra.
- `else if`, não dois `if` soltos, no `aplicar`. Com dois `if`, no primeiro change
  com a peça no ar os dois ramos rodam e o primeiro anima no refresh, que é o que
  a trava de primeiro estado existe para impedir.
- **Cantos opostos.** Duas peças no mesmo canto só colidem quando as duas entram
  no ar, ou seja, ao vivo.

### Consumir dado externo: o bundle só lê

```
LEIA. NUNCA CONFIGURE.
```

- Use a rota de consumidor, que aceita os alvos na própria chamada
  (`GET /stats?channels=a,b&provider=youtube`). A rota que responde sobre o que
  o painel do gateway tem ligado serve ao painel dele; ligar um canal lá muda o
  número do overlay de outra pessoa.
- Um único módulo fala com o gateway, e quem desenha se inscreve. Com polling
  por peça, a mesma live seria consultada duas vezes a cada 5s e dois gráficos
  poderiam mostrar valores de instantes diferentes.

Requisitos do módulo:

| | por quê |
|---|---|
| `Promise.allSettled`, não `all` | uma plataforma fora do ar não pode zerar a outra |
| último número bom por plataforma | uma falha de rede de 5s não significa que a live perdeu os likes; zerar faria a barra despencar e voltar |
| trava de request em voo | com 3 canais sequenciais o ciclo custa ~4,5s contra um piso de 5s, e os requests se empilham |
| intervalo derivado da lista | o gateway consulta uma das plataformas em série, ~1,5s por canal |
| assinante que estoura não para os outros | um bug na barra não pode derrubar o contador junto |
| um campo `temYoutube` explícito | sem a plataforma que tem likes, a meta não é 0, é indisponível, e as duas coisas desenham diferente |
| dois formatadores | a contagem não abrevia: com 1.234.567 de 1.236.000 os dois lados viram "1,2 mi" e o número perde a diferença. A placa apertada abrevia |

A lista de alvos é estado do bundle: replicant na extension, editado num painel
próprio, com liga/desliga separado da lista. Inferir "ativo" de "a lista tem
canal" obrigaria o operador a apagar os canais para desligar e redigitá-los
depois.

---

## 7. Câmeras: quando o runtime sobe para `utils/`

Quatro peças (2, 3, 4 e 5 câmeras) com o mesmo mecanismo e só os números
diferentes. A regra de promoção do bundle é "sobe quando a segunda peça
precisa"; aqui são quatro, conhecidas de antemão.

```js
CAMS.montar({
  peca: "fs_4cam",
  corpo: 34.653, piso: 22, vao: 429,
  slots: [{ cx: 266.0, baseline: 871.62 }, …],
});
```

- No `.html` fica só a geometria daquela arte.
- Sobe para o utilitário: criação dos elementos, auto-fit, reancoragem por
  baseline, tela de dev e `window.test()`.
- **Um replicant só para as quatro.** A peça de N câmeras desenha os N primeiros
  nomes da lista; assim trocar de 3cam para 4cam no switcher não exige mexer em
  painel.

### Dois modelos convivendo

Existe também um **modelo solo** (uma peça por pessoa, com a própria barra,
posicionada à mão no switcher). Ele lê o mesmo replicant, por meio desta
indireção:

```js
/* Qual posição do replicant cada elemento lê. Nas peças de moldura o elemento i
   lê o caster i; nas SOLO existe um elemento só, e ele lê o caster que o arquivo
   escolheu — `cam3.html` desenha `casters[2]`. Sem esta indireção o solo leria
   sempre o caster 1. */
var idx = slots.map(function (s, i) { return s.i == null ? i : s.i; });
```

São nove inputs fazendo a mesma coisa de dois jeitos: aplique o aviso de
operação da §4 no `package.json`.

---

## 8. A gramática da arte: plate, vídeo ou híbrida

O motion às vezes entrega a arte como **webm com alfa** (VP9, `alpha_mode=1`),
canvas cheio 1920×1080, loop de 10s a 24fps, em vez de PNG. Nem sempre o webm
cobre a peça inteira.

| A peça é | quando | como ancorar |
|---|---|---|
| plate | tudo é PNG | por coordenada de canvas, do manifesto |
| vídeo | um webm cobre a arte toda | elemento em 0,0, 1920×1080, `object-fit: fill` |
| híbrida | o webm cobre uma das plates | o vídeo entra no lugar daquela plate; as outras continuam PNG |

**Antes de portar, meça a bbox de alfa do webm contra as plates declaradas.** O
webm pode ter vindo trocado entre peças, ou ser apenas uma das plates da
composição (o que parece "divergência de layout"). Três verificações
independentes:

1. quais plates só aquele arquivo usa;
2. quais elementos aparecem no frame extraído;
3. se a união das coordenadas bate com a bbox do vídeo.

### `object-fit: fill`, nunca `cover`

O arquivo tem exatamente o tamanho do stage; `cover` reamostraria por
arredondamento e borraria o contorno preto e a franja de alfa.

### Sem `src` no HTML

Quem atribui o `src` é o `VIDEO.preparar()`, que também força `muted`/`loop`/
`playsinline`. Com o `src` no markup, o Chrome começa a carregar antes de o
utilitário assinar os eventos, e a peça perde o `canplaythrough` em caso de
cache.

### As quatro armadilhas do `<video>` (e o que o utilitário faz)

1. **Vídeo sem `muted` nunca toca.** A peça vai ao ar congelada no frame 0, sem
   erro visível, parecendo um PNG. O utilitário força `muted` no código, sem
   depender do atributo (que alguém pode remover por o vídeo não ter áudio).
2. **`loadeddata` não basta**: garante só o primeiro frame. O evento certo é
   `canplaythrough`.
3. **`canplaythrough` pode nunca disparar** (cache ou rede ruim). Confira também
   `readyState >= 4` na hora e use um teto de tempo (4s é folgado para arquivo
   local). Passar do teto é `warn`, não `error`.
4. **`play()` rejeita.** `NotAllowedError` e `AbortError` são rotina (PLAY/OUT
   rápido) e não podem derrubar o handler.

### `clip-path` em todo `<video>` de canvas cheio

A browser source do vMix é CEF em off-screen rendering: não há compositing por
GPU. A página é rasterizada para um bitmap em memória de sistema, e o custo é a
área repintada por quadro.

Um `<video>` de 1920×1080 em loop marca a camada inteira como suja a cada frame:
2,07 Mpx, 24×/s, mesmo com a peça parada no ar. O sintoma é a GPU no máximo
depois que o lower third já parou.

```css
#arte { clip-path: inset(<topo>px <dir>px <base>px <esq>px); }
```

Um `inset()` sem raio é clip retangular puro (não vira máscara, não custa em
pintura) e limita a região suja da camada. Ganho medido:

| peça | área/quadro | ganho |
|---|---|---|
| medalhão de 155×164 num canvas cheio | 2,07 → 0,031 Mpx | 67× |
| faixa institucional | 2,07 → 0,10 Mpx | 21× |
| barra de convidado | 2,07 → 0,12 Mpx | 17× |
| placa de vencedor | 2,07 → 0,15 Mpx | 13× |
| placa dupla (um vídeo só) | 2,07 → 0,22 Mpx | 9× |

Como fazer certo:

- **As coordenadas são de canvas.** Todo `<video>` do kit é 1920×1080 deslocado
  pelo negativo da âncora acumulada, para cair em 0,0 do stage; então o sistema
  local dele já é o canvas. A mesma linha funciona em peça ancorada e em peça de
  canvas cheio.
- 🚨 **A caixa sai da união da bbox de alfa sobre todos os frames do loop**, não
  de um frame nem de amostragem. Comparado com os 240 frames reais, uma medição a
  3fps errou assim:

  ```
  peça A ... 3fps disse x0 = 22.  A verdade é x0 = 0 (o spray encosta na borda).
                                  A caixa do 3fps decepava 18px de arte.
  peça B ... 3fps disse y0 = 39.  A verdade é 32. Cortava 3px no pico do pulso.
  peça C ... 3fps disse y0 = 843. A verdade é 839.
  ```

  O extremo de um float dura poucos frames, e amostrar 1 em 8 tende a perdê-lo.
  Sintoma: a arte some por 2 ou 3 quadros uma vez a cada dez segundos, sem
  ligação aparente com o recorte. Meça com `fps=24`, limiar de alfa em 1/255, e
  some 8px de folga em cada lado (absorve reexport do motion com a arte alguns
  pixels maior).
- **`overflow: hidden` não substitui.** Várias peças ancoram o vídeo numa caixa
  do tamanho da plate, e a arte em movimento vaza essa caixa pelos quatro lados
  de propósito (medido: 14px em x0, 17px em y0, 13px em y1, numa peça cujo
  cabeçalho dizia "±2px"). `overflow` recortaria pela caixa errada; o `clip-path`
  recorta pela caixa medida, que é maior.

O recorte não resolve o decode: o VP9 com alfa continua decodificado em 1920×1080
mesmo com 95% de pixel vazio. O próximo passo seria cortar os webm para a bbox no
ffmpeg, o que exige reexportar a arte e ajustar as âncoras.

### `will-change` num elemento de canvas cheio piora

Medido pelo LayerTree, com uma peça no ar:

```
sem will-change ..... 6 camadas,  8,1 Mpx, 1 de quadro cheio
com will-change ..... 7 camadas, 10,1 Mpx, 2 de quadro cheio
```

Ele desfez o ganho do `clip-path` e somou uma camada. Regra: promova o que se
move **se a caixa dele for pequena** (ex.: um container de 970×194 ou um vídeo já
recortado). Nesses casos compensa, porque evita a promoção e demoção a cada
tween, onde o primeiro quadro da saída engasga.

O mesmo vale no `fit.js`:

- Com escala exatamente 1 e deslocamento zero, o transform é `none`, não
  `scale(1)`: um transform identidade ainda cria nó de transformação na árvore de
  propriedades do Chromium.
- Escala fracionária (0,9990, de uma browser source em 1918 ou de um DPR ≠ 1)
  reamostra o stage inteiro com filtragem bilinear a cada quadro. Tolerância:
  `1/1080`, ponto em que a diferença vale menos que meio pixel na altura do
  canvas.

### Fora do ar, pause, mas só no fim da saída

Sete peças decodificando VP9 com alfa a 1920×1080 ao mesmo tempo gastam CPU da
máquina de transmissão sem nada aparecer. O `VIDEO.parar()` pausa e rebobina;
como o arquivo já está em buffer, o `tocar()` da próxima entrada volta a rodar no
mesmo quadro.

- Pausar no início da saída congela a arte à vista, com a peça ainda cruzando o
  quadro. Numa peça sem fade (canto alto), ela fica visível durante o deslize
  inteiro. Pause só no fim do movimento.
- `pular(true)` também chama `tocar()`. Um refresh com a peça no ar tem que
  voltar com o loop rodando; senão ela reaparece correta e congelada.

### O que se perde quando a arte vira vídeo

Registre no arquivo:

- **Animação por camada.** Um sticker que entrava por cima (`scale: 0.5→1`,
  rotação −14°, `back.out(1.8)`) deixa de existir quando vira parte do webm.
  Recuperar exige o motion entregar aquela camada num arquivo à parte; sobrepor o
  PNG ao vídeo que já a contém faria a arte crescer de dentro de si mesma.
- **Campo vivo que virou queimado.** Uma hashtag que era texto e chega queimada
  no webm: manter o texto por cima a mostraria duas vezes. Custo a registrar:
  trocar a hashtag passa a exigir vídeo novo do motion, não uma linha de CSS.
  Apague o código e mantenha o bloco de comentário dizendo isso.
- **Simetria entre modos.** Se o motion entregou o webm de um modo e não do
  outro, um modo tem fundo em movimento e o outro fundo parado, e a troca
  acontece com a peça no ar. Registre o que falta e o custo do port quando o
  material chegar.
- **Texto que não acompanha o float.** A arte oscila ±2px (ou 32px) no loop e o
  texto HTML fica parado. Custo aceito: acompanhar exigiria a curva quadro a
  quadro, que o vídeo não expõe em runtime.

---

## 9. Texto: as medidas, e as cinco que mentem

Tudo em `utils/medida.js`. Por família:

| família | o que se mede | tipo de auto-fit |
|---|---|---|
| `lt_` de nome | largura contra um vão do PSD (subpixel) | `MEDIDA.ajustar` (Range) |
| `lt_` de parágrafo | altura da caixa | `scrollHeight > clientHeight` próprio |
| `fs_` de nome | igual ao `lt_`, com reancoragem por baseline | `MEDIDA.ajustar` |
| draft / grade | `scrollWidth > clientWidth` (inteiro contra inteiro) | laço local |
| relógio / dígito | nenhum | célula de largura fixa |

### Ancore pela baseline, não pela caixa

O PSD ancora point text pela linha de base. Centralizar numa caixa de altura
fixa falha no nome longo: quando o auto-fit reduz o corpo, o texto centralizado
sobe, e dois nomes lado a lado (um curto, um longo) ficam em alturas diferentes.

```js
el.style.top = MEDIDA.topoParaBaseline(BASE, r.tam, familia, peso, 1) + "px";
```

- Chame **depois do `ajustar`**: o corpo final define o offset.
- Use `align-items: flex-start`, nunca `center`. Centrado, a linha se recentra a
  cada encolhida e a baseline anda junto (no piso, um nome chegou a 8,9px abaixo
  da âncora).

O fator sai das tabelas da própria face, não de nota de manifesto:

```
AkiraExpanded-SuperBold.otf
  upem 2048 · hhea 1722/−427 · USE_TYPO_METRICS DESLIGADO
  usWinAscent/Descent 1722/427 — IDÊNTICOS ao hhea, então os dois caminhos que
  o Chrome pode escolher dão o mesmo número
  baseline = (1 − (1722+427)/2048)/2 + 1722/2048 = 0,81616211 em
```

- A fórmula `typo` (que pressupõe o bit ligado) erra 15px num corpo de 225px.
- O Chromium arredonda ascent/descent para px inteiro antes de montar a line box,
  então o fator efetivo varia com o corpo (medido: 0,80454 a 0,82123 contra a
  constante 0,81616). O erro é sub-pixel e aceitável.
- Para não depender de constante, `MEDIDA.baseline()` pergunta ao renderizador
  com uma sonda `inline-block` de altura zero e `vertical-align: baseline`, lendo
  `offsetTop`, não `getBoundingClientRect` (o rect volta em px de tela, já
  escalados pelo fit).

### Exceção: quando `align-items: center` é o certo

Num nome centrado dentro de uma placa, o que se lê é o centro óptico. No corpo
máximo os dois coincidem; quando o auto-fit reduz, a linha fica opticamente
centrada em vez de presa na baseline, e a deriva é metade da redução. É uma
escolha e precisa estar comentada.

### O piso do auto-fit

O piso é decisão do gráfico, não vem do manifesto. Referência: **~0,62 do
máximo** (28/44,49 · 26/42,8 · 42/68,19 · 30/49,29). O que esse piso compra:

```
nome de 4 caracteres    68,19px, corpo cheio
nome de 11 caracteres   68,19px, 622 de 657 do vão
nome de 13 caracteres   60,69px — aqui o fit começa a agir
nome de 20 caracteres   42px (piso) e AINDA estoura por 36px — avisa e vai
```

- Piso mais baixo (~0,49) vale quando o campo é mais estreito que o dos irmãos
  (ex.: duas pessoas dividindo a barra).
- Escolha medindo os cadastros reais, não por proporção.
- **No piso e ainda estourando: avise e deixe no ar.** Cortar o nome de alguém é
  pior que passar alguns pixels da arte.

### A caixa do PSD pode ser maior que o vão real

O auto-fit mede contra a caixa que você deu. Se essa caixa passa por baixo de
outra plate, ele conclui que cabe e não avisa, e o texto vai ao ar coberto, sem
erro nem log. Exemplo:

```
A caixa do nome veio do placeholder do PSD (`TEAM NAME`, 224px), que é curto.
Medindo o render: a placa vai de x=700 a 1220, mas os slots de ban ocupam
596..746 e 1174..1324 e pintam POR CIMA dela — o amarelo livre é 746..1174.
As duas caixas de 224 enfiavam 14px cada uma sob um ban, e um nome de 12
letras parava em 20,4px com a última letra comida.
```

- Derive o vão do que está pintado e documente a conta:
  `nomeA = 2 × (790 − 461,29) = 657,42 (aperta a estrela)`.
- Ao auditar, pergunte "o que está pintado embaixo das pontas da tinta?", não "o
  texto passou da caixa CSS?". `document.elementsFromPoint` responde.

### Palavra única: U+200B, nunca `overflow-wrap: anywhere`

Nome com espaço quebra em duas linhas sozinho. Palavra única só faz o corpo
ceder, e dois lados da mesma placa com corpos diferentes parecem quebrados.

```js
function comQuebras(nome) {
  return String(nome == null ? "" : nome)
    .replace(/([a-z0-9])([A-Z])/g, "$1​$2")
    .toUpperCase();          // DEPOIS: toUpperCase() destrói a caixa que marca o ponto
}
```

- `overflow-wrap: anywhere` quebra em qualquer ponto já no corpo cheio: uma
  palavra de 8 letras sai partida no meio, passa no teste e vai errada ao ar.
- Faça a caixa alta no JS, não só por `text-transform`. Com o DOM já na caixa
  final, a medição por `Range` mede o que o navegador pinta. Medir minúsculas que
  o CSS sobe dá ~18% a menos, sempre para baixo, e aprova justamente o texto que
  deveria reprovar.

### Quando `MEDIDA.ajustar` não serve

Texto de parágrafo (múltiplas linhas, caixa mista): a restrição é a altura, e a
largura do conteúdo é sempre a da caixa.

- Meça `scrollHeight` contra `clientHeight` **no filho, não na caixa**. Se a
  caixa centra o bloco na vertical, conteúdo maior transborda para os dois lados
  e a região rolável ignora o de cima; o laço pararia cedo e o parágrafo iria ao
  ar cortado em cima e embaixo.
- Inclua a largura na condição por causa de palavra que não quebra (URL, hashtag
  longa).
- Separe as duas direções no aviso: altura = texto comprido demais (corte texto);
  largura = palavra que não quebra (encurtar o resto não resolve).

### Teto de linhas, não altura da caixa

Numa fileira de colunas, a caixa pode comportar 3 linhas e o designer ter
desenhado 2. Com 3, uma coluna longa ao lado de outra com uma linha só parece
desalinhada. Com o teto, o corpo cede em vez da altura e as colunas mantêm o
eixo. No piso, solte o teto antes de deixar vazar: 3 linhas apertadas ainda
mostram o nome inteiro.

Use `min-width: 0` no span dentro de flex. Item de flex nasce `min-width: auto` e
não encolhe abaixo do min-content: com palavra única e longa o span estica, a
medida compara a caixa esticada com ela mesma e aprova, e o `overflow: hidden`
corta dos dois lados (somem a primeira e a última letra).

### Dígito de largura não fixa, e `tabular-nums` que é no-op

```
Avanços medidos (upm 2048), em 224,89px:
  0 2 3 4 5 6 8 9 → 1745 upm → 191,65px
  7 ............. → 1613 upm → 177,14px
  1 ............. → 1482 upm → 162,75px
```

Num point text centrado, sem célula fixa o bloco recentraliza a cada tique: num
`01` o `0` anda 14,5px e o grupo encolhe 28,9px. O relógio pisca a cada vez que
um `1` ou `7` entra.

- `font-variant-numeric: tabular-nums` não resolve se o GSUB da face não tem
  `tnum` (a propriedade vira no-op).
- Use célula fixa: `inline-block` da largura do dígito mais largo,
  `text-align: center`.
- Crie as células em JS, não no markup: espaço em branco entre dois
  `inline-block` vira espaço de verdade e empurra o segundo dígito.

### Fonte sem acento é decisão de produção, não bug do gráfico

Medido: uma face de display cobria 1 de 26 caracteres acentuados do português.
Sintoma: `JOÃO` vai ao ar com o `Ã` na fallback, visivelmente mais estreito.

- Mapeie o impacto por campo no cabeçalho de cada peça: nome de convidado e de
  time sofrem; um campo só de dígitos e uma palavra fixa, não.
- A fallback declarada é escolha (a menos destoante do kit), não conserto.
- Quando o arquivo completo da fonte chegar, o critério de aceite é 26/26
  conferido.

---

## 10. Imagem: as três políticas

| | plate (arte versionada) | imagem por nome (cadastro) | genérico |
|---|---|---|---|
| pode faltar? | não; se faltou é bug | sim, e é normal | é o fallback |
| na falha | `log.error` | placeholder silencioso | — |
| quando carrega | no boot, antes do 1º change | a cada troca de conteúdo | — |
| como entra | `background-image` no CSS | `IMAGEM.pintar` | parâmetro `fallback` |

### `decode()`, token de corrida, e o que a promessa significa

`decode()` garante a imagem decodificada e pronta para pintar, e rejeita quando o
arquivo não existe: uma API cobre o preload e o caminho de erro.

O token `el.__imgReq` é necessário: o operador pode trocar de convidado duas vezes
em segundos, e sem o token a imagem anterior (mais lenta) chega depois e
sobrescreve a nova. Sintoma: a peça mostra a pessoa errada, sem erro em lugar
nenhum.

🚨 **A requisição descartada não devolve `false`; devolve o desfecho da que
venceu.** Exemplo do defeito quando isso não é respeitado:

```
A peça redesenha várias vezes no boot (render(null) → change → BS.carregar() →
refit de fonte), então a MESMA foto entra em 2 ou 3 requisições concorrentes. A
vencedora pintava o rosto; a descartada resolvia DEPOIS (dois decode() do mesmo
arquivo não resolvem em ordem garantida), devolvia `false`, e o chamador —
`.then(ok => el.classList.toggle("como-ph", !ok))` — carimbava a INICIAL do nome
por cima da foto certa. O painel de dev ainda dizia "sem imagem: foto 1, 4, 2, 3"
com as quatro pintadas.
```

A causa: `false` significava três coisas (falhou, veio vazia, perdeu a corrida),
e só as duas primeiras interessam a quem chamou.

### A entrada espera as imagens

```js
async function aplicar(estado) {
  render(estado);                          // texto entra na hora
  await IMAGEM.todas(pares);               // imagens ficam prontas
  if (querVisivel && !noAr) entrar();      // só agora anima
}
```

Numa peça `fs_` não existe `entrar()` para segurar, e o que essa regra protege já
está no utilitário: o `decode()` antes de pintar e o token por elemento fazem o
SETAR com o input no preview nunca mostrar meio retrato. Não segure a peça
inteira até as fotos resolverem: isso esconderia nomes já certos e o vMix
cortaria para um quadro vazio. A promessa continua sendo devolvida, para a tela
de dev e para o `test()`.

### O resolvedor diz a verdade; a peça decide o que desenhar

**Não coloque fallback dentro do resolvedor.** Um resolvedor que, sem o campo
pedido, cai no campo principal nunca devolve `null`, e o `!BS.fotoX(...)` do
painel nunca dispara: o aviso "⚠ sem foto" não aparece nem quando a arte falta.
O mesmo fallback pode ainda pôr um escudo quadrado de 512 esticado até 1080×1080
no slot de uma figura de corpo inteiro.

Divisão de responsabilidades:

- **O resolvedor** responde "existe arte desta pessoa?" e devolve `null` quando
  não. Campo secundário tem resolvedor próprio, sem fallback.
- **A peça** responde "o que desenho quando não existe?", passando o genérico
  como `fallback` do pintor. Só ela tem contexto: um slot sem nick não leva
  silhueta (inventaria um jogador); um slot com nick e sem foto leva.
- **O genérico** entra no manifesto como chave de topo (fora de `itens`),
  resolvido por função separada, nunca indexado pelo nome.

A cadeia fica em ordem de especificidade, sem degrau fingindo ser o de cima:
**capa do capitão → foto do time → silhueta**. A peça registra de onde veio, para
a tela de dev:

```js
capaDe: BS.capaDoTime(time) ? "capitão " + nick
      : BS.fotoTime(sigla)  ? "time " + sigla
      : BS.jogadorPadrao("capa") ? "silhueta (sem capitão e sem foto de time)"
      : "nenhuma",
```

### Encaixe: cobrir a franja, e escolher entre `cover` e `contain`

**A franja.** O miolo branco de uma moldura não é o limite: há uma franja de
antialiasing de 1px que o teste de cor não pega. Medido num slot de 150×150:
miolo em 4..145, franja em x=3 (195,195,195) e x=146 (120,120,120). Encaixar em
`4/142` deixa a franja exposta (um fio claro vertical em cada slot). Use
**3..146 nos quatro lados**. `>245` acha o miolo, `>200` já pega parte da franja,
e a diferença entre os dois é o fio que aparece no ar.

**`cover` vs `contain`:**

- `cover` corta rosto quando o arquivo não bate com a proporção. Rosto cortado é
  pior que folga.
- `cover` num slot com margem transparente no arquivo deixa a margem dentro da
  caixa (dois fios de 6,4px mostrando o fundo). Medido em 146 arquivos de um
  fankit: 50 sem margem, 96 com (quase todos 6px lateral). Solução:
  `background-size: 110% 107%`, derivado da razão tinta/arquivo (escala não
  uniforme, aceita), com nota de que trocar por `cover` devolve o fio.
- `cover` num logo quadrado dentro de caixa larga corta o topo: em oito escudos
  de uma liga, cortava 36% da altura. `contain` centraliza e deixa o resto
  transparente, o certo quando a plate vem vazia para ser fundo.
- `contain` sozinho encosta na moldura quando o desenho preenche o quadrado do
  arquivo. Dê folga com `padding: 5px` + `background-origin: content-box`, não
  com `background-size: 69px` (que fixa a largura, deixando um wordmark
  horizontal baixo e um escudo alto estourando). Com padding, quem decide
  continua sendo `contain`.

**Recorte não retangular vai num wrapper**, não no elemento da imagem. Com o
`clip-path` na própria foto, o polígono fica na coordenada dela, e mexer em
`left`/`top` para reenquadrar o rosto arrasta o recorte junto. Com o wrapper em
`inset: 0` do card, o polígono fica em coordenada de card e a foto se move
livre. `overflow: hidden` não substitui: num card chanfrado deixa passar a cunha
da base, onde fica a camiseta.

---

## 11. O contrato da pasta de assets

Uma pasta por peça, derivada do nome do PSD (`L3_MetaLike.psd` →
`<assets>/l3/l3_metaLike/`). Conteúdo:

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

Arquivo que não vai ao ar começa com `_`. Isso separa runtime de régua de
calibração.

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
    "arquivo": { "w": 566, "h": 175 },        // recortado; se fosse 1920×1080 ancora em 0,0
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
    "baselineCanvas": { "x": 413.58, "y": 936.24 },   // o dado PRIMÁRIO
    "autoFit": { "obrigatorio": true, "larguraMax": 327.2, "tamMax": 44.49,
                 "tamMin": "NÃO DECIDIDO — ver ASSETS.md" }
  }],
  "naoDecidido": ["…"]
}
```

Cinco regras desse formato:

1. **O corpo nominal do PSD é enganoso.** Ele vem redondo (100,0) ou repetido em
   todas as camadas quando o designer escalou a camada em vez de mudar o corpo.
   O valor real é `FontSize × escala do transform`; usar o nominal dá um glifo 4×
   ou 28× errado. O manifesto declara a derivação; copie-a para o comentário do
   CSS.
2. **`baselineCanvas` é primário, `box.y` é derivado.** Ancore pela baseline.
3. **`measured` é o contorno do exemplo**, não o vão. O vão sai de
   `derivedFromPlate`, e às vezes nem dele (ver §9, a caixa maior que o vão).
4. **`arquivo` diz a convenção de export.** Sem ele, quem escreve o gráfico só
   descobre renderizando.
5. **`naoDecidido` faz parte do contrato.** Piso do auto-fit, escolha entre dois
   x divergentes, se a placa é elástica: tudo que ninguém decidiu fica listado, e
   a peça escolhe explicitamente, com a medição que sustenta a escolha.

### Procedência sobrevive ao clone

`origem.driveFileId` + `driveModifiedTime` respondem, em outra máquina: mudou
alguma arte desde a extração? Compare por **id**, nunca por nome (o designer
renomeia o arquivo; o id não muda). Uma peça pode aparecer com duas pastas: são
extrações diferentes do mesmo PSD.

---

## 12. O painel de cada área

Vocabulário e regras gerais em `dashboard-ui.md`. O específico por área:

### Fábrica de bloco, quando os blocos são irmãos

Um painel de lower thirds com 5 blocos de mesmo miolo usa uma função chamada 5
vezes, parametrizada por `{rep, ids, air, setar, play, out, status, teto, norm,
ler, montar}`. Use uma segunda fábrica para **bloco só de ar** (sem campo, logo
sem SETAR nem `sujo()`; a primeira indexa `campos[0]` para decidir o SETAR).

A flag `tocado` é **por bloco**. Compartilhada, editar um bloco congelaria a
sincronização dos outros.

### Um bloco de operação pode governar duas peças

Duas peças irmãs (um convidado / dois convidados) continuam sendo dois arquivos
e dois replicants (§3 da SKILL). O que se junta é a operação:

```js
const cvAlvo = () => (cvEstado()[2] ? DB_LTDOUBLE : DB_LTSINGLE);  // o PLAY escolhe
```

- **`cvAlvo` lê do estado, não do formulário**: o que sobe é o que foi setado.
  Ler do formulário faria o rótulo mudar enquanto o operador digita o 2º nome.
- **O OUT baixa as duas, sempre.** Baixar só a apontada pelo formulário deixaria a
  outra no ar se o operador editasse o Nome B depois do PLAY.
- **O SETAR grava o par A nas duas**, para alternar sem redigitar.
- Duas escritas em replicants diferentes não são a escrita dupla que a §4
  proíbe; aquela é sobre duas escritas no mesmo replicant, onde a segunda lê o
  valor velho da primeira.

### Aviso de colisão

Peças da mesma faixa são inputs separados no vMix: nada impede duas no ar ao
mesmo tempo, uma cobrindo a outra.

```js
$("ltStatus").innerHTML = noAr.length > 1
  ? `⚠ <b>${noAr.join(" + ")}</b> no ar juntas — ocupam a mesma faixa` : "";
```

Liste as peças separadas mesmo quando compartilham bloco: o OUT do painel baixa
as duas, mas o vMix operado à mão não.

### Uma cena, um botão

Cena de fullscreen é acionada em um lugar só. As que têm painel próprio e as de
pré-show saem da grade, e a lista fica num `comum.js` compartilhado (duas cópias
da tabela de rótulos divergem no primeiro rename).

Não tenha dois botões com o mesmo rótulo para a mesma cena: se um só troca a
cena e o outro também roda o rolo, o operador aperta o errado e nada aparece. Se
uma cena precisa de dois efeitos, o botão faz os dois.

### `<select>` e `<datalist>` não são intercambiáveis

- **`select`** quando o valor tem que existir no cadastro (confronto, draft).
  Guarda a sigla, não o nome: a sigla é a chave e o nome pode ser corrigido
  depois. Mostre a sigla no rótulo e o nome inteiro no `title`: nome longo é
  cortado sem aviso, e `scrollWidth` não acusa isso em `<select>`.
- **`datalist`** quando o valor pode ainda não estar cadastrado (chave montada
  com classificados, convidado de uma edição só). Travar impediria montar antes
  de o cadastro fechar.

O datalist de times vem do replicant de cadastro, não do manifesto de arte: quem
manda no nome é o cadastro, e um time recém-inscrito tem que aparecer antes de o
escudo chegar.

### Workspaces por ordem de uso

O NodeCG ordena as abas alfabeticamente. Numere-as na sequência do programa
(`1. FULLSCREEN`, `2. LOWERTHIRDS`, `3. INGAME/DRAFT`…), não por tipo de peça.

- Dois painéis que se alimentam um do outro ficam na mesma aba; trocar de aba no
  meio de um draft provoca erro de operação.
- O workspace `main` não pode ser renomeado: deixe-o vazio de propósito e comente
  isso.
- Registre `width` e um `_width` ao lado explicando a escolha com o conteúdo real
  que a decidiu. Sem a nota, alguém desfaz sem saber.

---

## 13. Checklists por família

**Lower third (`lt_`)**
- [ ] replicant com `visivel`, `persistent: false`, lido sem `defaultValue`
- [ ] as quatro funções: `entrar` / `sair` / `pular` / `aplicar`
- [ ] os quatro ramos do `aplicar`, nesta ordem
- [ ] `if (tl) tl.kill()` nas três; reset do estado inicial no topo da entrada
- [ ] o reset roda antes da espera do `play()`
- [ ] trava de OUT dentro do `.then` do `tocar()` e dentro do `onComplete` da troca
- [ ] `FORA` bate com o `transform` de repouso do CSS
- [ ] quem se move é o pai (arte e texto viajam juntos)
- [ ] a chave de conteúdo não inclui campo derivado de outro
- [ ] vídeo: `clip-path` pela união dos 240 frames + 8px; pausa só no `onComplete`
- [ ] `test() → testOut() → test()` re-anima

**Fullscreen (`fs_`)**
- [ ] `opacity: 1` sempre, sem `visivel`, sem GSAP, sem as duas travas
- [ ] conferido o que é `opaco: true` (input do vMix) contra o que o HTML desenha
- [ ] a ordem de pilha do PSD justifica cada plate desenhada aqui
- [ ] plate de frame cheio ancorada em 0,0 (conferido o tamanho do PNG)
- [ ] cena registrada no `cfg/<bundle>.json` e o painel diz **PEDIDO**, não "NO AR"
- [ ] se rola: `seq` no replicant, px/s calculado, ticker de diagnóstico

**Draft / picks & bans**
- [ ] duas cenas = dois arquivos, com o aviso de operação no `package.json`
- [ ] `revelado()` idêntico no painel e no gráfico, comentado nos dois
- [ ] `ORDEM_SLOT` igual nos dois lados; o espelho está no `x`
- [ ] `checarSimetria()` existe e passa
- [ ] fade por slot com guard de URL; `esquecerFades()` na saída
- [ ] relógio: uma régua só (`RELOGIO.agora()` ou o número pronto do servidor)
- [ ] o replicant do relógio não é escrito por dois donos

**In-game (`ig_`)**
- [ ] replicant ALWAYS ON declarado na extension
- [ ] fade, não deslize; `.animado` ligada depois do primeiro estado
- [ ] o vão do HUD nativo do jogo está livre e comentado
- [ ] simetria conferida par a par antes de assumir espelho
- [ ] cor de broadcast não usa token de cor do jogo

**Peça de canto**
- [ ] um replicant por pedaço que entra e sai sozinho
- [ ] travas e timelines próprias por pedaço
- [ ] cantos opostos
- [ ] integração externa: rota de consumidor, `allSettled`, último valor bom por fonte

**Antes de dizer que está pronto** (além do checklist da SKILL):
- [ ] deixei a peça no ar mais de um loop do webm: volta sem piscar e sem parar
- [ ] recarreguei a browser source com a peça no ar: voltou igual, com o loop rodando
- [ ] medi a caixa de `clip-path` sobre todos os frames, não por amostragem
- [ ] `?dev=1` mostra o que foi desenhado, sem campo órfão de estado removido
- [ ] o que a arte em vídeo fez perder está registrado no arquivo, não só no commit
