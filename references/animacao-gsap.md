# Animação com GSAP

Padrões fechados de entrada e saída de gráfico. Leia quando for animar qualquer
coisa além de um fade — e leia as **armadilhas** mesmo que o movimento pareça
trivial: as três primeiras só aparecem no ar, e a quinta parece bug de easing.

Para matte orgânico (tinta, pincel, dissolve) o caminho não é este:
`spritesheet-mask-reveal.md`.

## Carregando

Vendorize local. Máquina de transmissão pode estar sem internet, e CDN fora do ar
põe o gráfico no ar sem animação — ou sem aparecer.

```html
<script src="vendor/gsap.min.js"></script>
```

`graphics/vendor/gsap.min.js`, versionado junto com o bundle. Se o bundle já usa
transição CSS numa peça de dois estados que funciona, deixe — GSAP entra onde há
timeline, `stagger`, `clip-path` animado ou troca de conteúdo no meio do movimento.

## A forma canônica

```js
let tlAtual = null;

function entrar() {
  tlAtual && tlAtual.kill();

  const tl = gsap.timeline();

  // 1. Reset explícito de TODO filho animado. Não confie na saída ter rodado.
  tl.set(container, { opacity: 1 });

  /* 2. O movimento, em `fromTo`. O par explícito faz as duas coisas de uma vez:
     é o reset (o `from` aplica o estado inicial) E escapa da armadilha 5, porque
     a GSAP parseia os dois extremos em vez de ler o início já colapsado. */
  tl.fromTo(barra,
    { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)" },
    { clipPath: "polygon(0% 0%, 200% 0%, 0% 200%)", duration: 0.5, ease: "power2.out" });
  tl.fromTo(cards,
    { clipPath: "inset(0 0 100% 0)" },
    { clipPath: "inset(0 0 0% 0)", duration: 0.4, stagger: 0.1 }, 0.1);

  return (tlAtual = tl);
}

function sair() {
  tlAtual && tlAtual.kill();
  const tl = gsap.timeline({ onComplete: () => gsap.set(container, { opacity: 0 }) });
  tl.fromTo(cards,
    { clipPath: "inset(0 0 0% 0)" },
    { clipPath: "inset(0 0 100% 0)", duration: 0.3, stagger: { each: 0.1, from: "end" } });
  tl.fromTo(barra,
    { clipPath: "polygon(0% 0%, 200% 0%, 0% 200%)" },
    { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)", duration: 0.4 }, 0.1);
  return (tlAtual = tl);
}
```

## As armadilhas

**1. Replay-safety.** No modelo vMix a saída pode simplesmente nunca rodar: a
browser source recarregou, ou o OUT foi dado no switcher e não no painel. A segunda
entrada então começa do estado final e **não anima nada**. Por isso o bloco de
`tl.set(...)` no topo da entrada não é higiene — é o que faz o segundo PLAY
funcionar. Vale também para elementos que a saída escondeu.

**2. Flash no boot.** O container nasce `opacity: 0` no CSS. A entrada liga em
`gsap.set`, a saída desliga no `onComplete`. Sem isso o gráfico pisca inteiro no
instante em que a browser source carrega, antes de qualquer estado chegar.

**3. Trava de primeiro estado.** O primeiro `change` do replicant não é uma ordem
do operador: é o estado que já existia. Se a peça está no ar e a source recarrega,
animar a entrada faz ela **re-entrar deslizando, no ar**. Aplique o primeiro estado
sem animação e só depois libere as timelines:

```js
let primeiro = true;
DB_X.on("change", (s) => {
  const visivel = !!s && s.visivel === true;
  if (primeiro) {
    primeiro = false;
    gsap.set(container, { opacity: visivel ? 1 : 0 });   // pula direto pro estado final
    aplicarEstadoFinal(visivel);
    return;
  }
  if (visivel !== noArNaTela) { noArNaTela = visivel; visivel ? entrar() : sair(); }
});
```

**4. Trava de on-air.** PLAY com a peça já no ar não re-anima. É a comparação
`visivel !== noArNaTela` acima — sem ela, dois cliques seguidos dão dois wipes.

**5. `set` + `to` numa string CSS lê o valor COLAPSADO pelo browser.** Esta
custou um "metade da barra abre instantânea e a outra anima", que parece bug de
easing e não é.

```js
// PARECE certo e não é:
tl.set(el, { clipPath: "inset(0 50% 0 50%)" });                 // 4 valores
tl.to(el,  { clipPath: "inset(0 0% 0 0%)", duration: 0.5 });    // 4 valores
```

O browser **colapsa** `inset(0 50% 0 50%)` para `inset(0px 50%)` quando topo=base
e esquerda=direita. O `to` vai buscar o início no computed, acha **dois** números
de um lado e **quatro** do outro, pareia componente a componente, e o que sobra
salta pro valor final no primeiro quadro.

Medido (Chromium, GSAP 3.12, valor do computed dois quadros depois do início):

| forma | resultado | |
|---|---|---|
| `set`+`to` — `inset(0 50% 0 50%)` → `inset(0 0% 0 0%)` | `inset(0px 49.6% 0px 0%)` | ❌ esquerda já em 0 |
| `fromTo` — os mesmos dois valores | `inset(0px 49.2%)` | ✅ simétrico |
| `set`+`to` — `inset(50% 0 50% 0)` → `inset(0%)` | `inset(49.45%)` | ❌ fecha pelos 4 lados |
| `set`+`to` — `polygon(...)` → `polygon(...)` | simétrico | ✅ |

**A regra que sai daí:** com string de forma variável, use **`fromTo`** — ele
recebe os dois extremos como texto e parseia os dois, sem passar pelo computed.
Se precisar de `set`+`to` (é o caso quando o reset e o movimento estão em pontos
diferentes da timeline), use **`polygon()`**, que não colapsa:

```js
const FECHADO = "polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)";
const ABERTO  = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
```

Vale pra qualquer propriedade cuja sintaxe encolhe quando os valores se repetem:
`inset`, `border-radius`, `margin`/`padding` em shorthand, `background-position`.
Quando desconfiar, **meça**: amostre `getComputedStyle(el).propriedade` num
`requestAnimationFrame` e veja os números andarem. Um componente que já está no
valor final no primeiro quadro é a assinatura exata deste bug.

**6. Recriar DOM no meio do movimento.** Numa troca de conteúdo (barn-door, flip),
atualize só o `.textContent` dos spans num layout fixo. Trocar o `innerHTML` do
bloco recria os `<img>` e pisca a cada tique.

## O catálogo

**Wipe diagonal** (canto superior esquerdo → inferior direito), reverso na saída:

```js
gsap.fromTo(el,
  { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)" },
  { clipPath: "polygon(0% 0%, 200% 0%, 0% 200%)", duration: 0.5, ease: "power2.out" });
```

**Reveal vertical com stagger** — o padrão para lista de cards:

```js
gsap.fromTo(cards,
  { clipPath: "inset(0 0 100% 0)" },
  { clipPath: "inset(0 0 0% 0)", duration: 0.4, stagger: 0.1 });
// saída: reverso, stagger: { each: 0.1, from: "end" }
```

**Barn-door** — trocar conteúdo dentro de uma caixa fixa sem vazar:

```js
// `fromTo` nos dois trechos: com `to` puro, o segundo lê o início já colapsado
// e a caixa fecha pelos QUATRO lados em vez de só topo/base (medido — armadilha 5).
const ABERTA = "inset(0% 0% 0% 0%)";
const FECHADA = "inset(50% 0% 50% 0%)";

const tl = gsap.timeline();
tl.fromTo(caixa, { clipPath: ABERTA }, { clipPath: FECHADA, duration: 0.25 })
  .add(() => { valorEl.textContent = novo; })
  .fromTo(caixa, { clipPath: FECHADA }, { clipPath: ABERTA, duration: 0.25 });
```

Isso resolve o bug clássico de "vaza acima do quadro" que aparece quando se tenta
translatar uma caixa por trás de outra.

**Flip** — troca sutil de número:

```js
gsap.timeline()
  .to(el, { rotationX: 90, duration: 0.18 })
  .add(() => { el.textContent = novo; gsap.set(el, { rotationX: -90 }); })
  .to(el, { rotationX: 0, duration: 0.18 });
```

Precisa de `perspective` no pai e `transform-style: preserve-3d`.

**Push-up / push-down**:

```js
gsap.fromTo(el, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4 });
```

## Sequenciamento

Sobreponha em vez de enfileirar: comece os cards logo depois do título (posição
`0.1` na timeline) em vez de esperar ele terminar. Na saída, sobreponha o recolher
do título com o primeiro card. Entrada que espera cada etapa fica lenta no ar e o
diretor corta por cima.

## Ensaiando

O `window.test()` do gráfico deve conseguir disparar entrada e saída sem o painel:

```js
window.test = function test(dados) { render(dados); entrar(); return "ok"; };
window.testOut = () => sair();
```

E confira o replay: `test()` → `testOut()` → `test()`. Se a segunda entrada não
animar igual à primeira, falta `set` no topo da timeline.
