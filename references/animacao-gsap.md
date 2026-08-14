# Animação com GSAP

Padrões fechados de entrada e saída de gráfico. Leia quando for animar qualquer
coisa além de um fade — e leia as **armadilhas** mesmo que o movimento pareça
trivial, porque as três primeiras só aparecem no ar.

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
  tl.set(barra, { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)" });
  tl.set(cards, { clipPath: "inset(0 0 100% 0)" });

  // 2. O movimento.
  tl.to(barra, { clipPath: "polygon(0% 0%, 200% 0%, 0% 200%)", duration: 0.5, ease: "power2.out" });
  tl.to(cards, { clipPath: "inset(0 0 0% 0)", duration: 0.4, stagger: 0.1 }, 0.1);

  return (tlAtual = tl);
}

function sair() {
  tlAtual && tlAtual.kill();
  const tl = gsap.timeline({ onComplete: () => gsap.set(container, { opacity: 0 }) });
  tl.to(cards, { clipPath: "inset(0 0 100% 0)", duration: 0.3, stagger: { each: 0.1, from: "end" } });
  tl.to(barra, { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)", duration: 0.4 }, 0.1);
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

**5. Recriar DOM no meio do movimento.** Numa troca de conteúdo (barn-door, flip),
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
const tl = gsap.timeline();
tl.to(caixa, { clipPath: "inset(50% 0 50% 0)", duration: 0.25 })
  .add(() => { valorEl.textContent = novo; })
  .to(caixa, { clipPath: "inset(0%)", duration: 0.25 });
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
