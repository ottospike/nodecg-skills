# Padrões de replicant recorrentes

Catálogo dos padrões de estado já resolvidos em bundles reais. Antes de inventar um jeito novo de
guardar estado, veja se o caso é um destes.

## 1. Liga/desliga simples

O caso mais comum: uma peça que só entra e sai.

```js
// painel
const DB_BUG = nodecg.Replicant("DB_BUG", { defaultValue: { visivel: false } });

playBtn.addEventListener("click", () => { DB_BUG.value.visivel = true; });
outBtn.addEventListener("click",  () => { DB_BUG.value.visivel = false; });

DB_BUG.on("change", (s) => {
  const noAr = !!s && s.visivel === true;
  marcarAr(airEl, noAr);          // selo
  playBtn.disabled = noAr;         // o botão apagado É a informação
  outBtn.disabled = !noAr;
});
```

```js
// gráfico
const DB_BUG = nodecg.Replicant("DB_BUG");
let noArNaTela = false, primeiro = true;

DB_BUG.on("change", (s) => {
  const visivel = !!s && s.visivel === true;

  // trava de primeiro estado: um refresh com a peça no ar não pode re-animar
  if (primeiro) {
    primeiro = false;
    noArNaTela = visivel;
    pular(visivel);          // gsap.set direto pro estado final, sem animação
    return;
  }

  // trava de on-air: só anima na TRANSIÇÃO
  if (visivel !== noArNaTela) {
    noArNaTela = visivel;
    visivel ? entrar() : sair();
  }
});
```

As timelines `entrar()`/`sair()`/`pular()` e as armadilhas de replay estão em
`animacao-gsap.md`.

## 2. Valor preparado + confirmação (SETAR)

Digitar não pode ir ao ar: o operador precisa preparar o próximo valor com o
atual na tela.

```js
const digitos = (s) => String(s || "").replace(/\D/g, "");   // aceita "1.836.302"

function sujo() {
  const d = digitos(campoEl.value);
  return d !== "" && Number(d) !== Number((rep.value && rep.value.valor) || 0);
}

setBtn.disabled = !sujo();                       // dentro do pintar()
setBtn.addEventListener("click", () => {
  const d = digitos(campoEl.value);
  if (d === "") return;
  rep.value.valor = Number(d);                   // só este campo
});

rep.on("change", (v) => {
  // NÃO atropela quem está digitando
  if (document.activeElement !== campoEl) campoEl.value = fmt.format(v.valor || 0);
  pintar();
});
```

`Enter` no campo faz o mesmo que o botão. O `.status` mostra `no ar: <b>R$X</b>`
e, quando sujo, `· pendente — clique SETAR`.

## 3. Dois blocos iguais → fábrica

Mesmo comportamento com ids diferentes não se copia:

```js
function montarValor(cfg) { /* usa cfg.replicant, cfg.campo, cfg.play, ... */ }

montarValor({ replicant: "DB_VALOR",      air: "arrecAir", campo: "arrecCampo", … });
montarValor({ replicant: "DB_VALOR_CHAT", air: "chatAir",  campo: "chatCampo",  … });
```

No lado do gráfico o equivalente é uma tabela de configuração (`BLOCOS`) e uma
função que a percorre — foi o que substituiu três arquivos quase idênticos
(`valor`, `valorV2`, `valorChat`) por um.

## 4. Relógio: guarde o prazo, não o tique

```js
// forma do valor
{ modo: "parado" | "rodando" | "pausado",
  fimEm: null,        // epoch ms do zero — só vale em "rodando"
  restante: 1200000,  // ms congelados — vale em "parado" e "pausado"
  inicial: 1200000 }  // o tempo do último START, pra onde o RESET volta

// mesma conta nas duas pontas (painel e gráfico)
function restanteMs(t, agora) {
  if (!t) return 0;
  const ms = t.modo === "rodando" ? (Number(t.fimEm) || 0) - agora : Number(t.restante) || 0;
  return Math.min(TETO_MS, Math.max(0, ms));
}
```

Ninguém escreve no replicant a cada segundo. O painel repinta num
`setInterval(250)`, o gráfico anda em `requestAnimationFrame`. Fechar o painel não
para o relógio, e um refresh da browser source reentra no segundo certo.

Ao mudar de modo, o objeto é reescrito inteiro — **carregue o `inicial` adiante**,
senão o RESET perde pra onde voltar.

Custo aceito: se a browser source rodar em outra máquina, o relógio dela tem que
bater com o do NodeCG.

## 5. Seleção exclusiva

Grade de peças irmãs (variantes de uma mesma arte, cenas, slots): um campo `atual`, não um booleano
por peça.

```js
const DB_SELECAO = nodecg.Replicant("DB_SELECAO", { defaultValue: { atual: null } });

bt.addEventListener("click", () => {
  DB_SELECAO.value.atual = DB_SELECAO.value.atual === cor ? null : cor;  // toggle
});
```

No painel, o botão aceso é a resposta — não precisa de `.status` embaixo.

## 6. Efeito colateral no servidor

Quando a mudança tem que virar comando pra outro software (vMix, OBS, API), o
painel **só grava o replicant**; a extension escuta e traduz.

```js
// extension
let primeira = true;                       // a 1ª emissão é o estado inicial,
DB_FS.on("change", (novo) => {             // não uma ordem do operador
  if (primeira) { primeira = false; return; }
  ...
});
```

Aqui o replicant vive na extension e é `persistent: false` — depois de um restart
nada pode se declarar no ar; o operador decide de novo.

## 7. Dev mode

`DB_DEVMODE` é publicado pela extension (env `NODE_ENV=development` ou
`devMode: true` em `cfg/<bundle>.json`), `persistent: false`, e o cliente **nunca
escreve nele** — não tem como "esquecer ligado" e ir ao ar com fundo cinza.
`shared/devmode.js` pinta o body de `#3c3c3c`; os gráficos usam
`stage.classList.toggle("dev", v === true)` pra mostrar seu painel de diagnóstico.

## 8. Estado vivo entre peças

Um gráfico pode ler o replicant de outro para não duplicar informação — o nome do
participante no bloco de valor vem do `DB_QUIZ`, que já sabe de quem é a pergunta
no ar. É isso que impede o nome de um com o valor de outro. Não redigite o que
outro replicant já sabe.
