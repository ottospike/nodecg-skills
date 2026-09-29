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
`utils/devmode.js` pinta o body de `#3c3c3c`; os gráficos usam
`stage.classList.toggle("dev", v === true)` pra mostrar seu painel de diagnóstico.

## 8. Estado vivo entre peças

Um gráfico pode ler o replicant de outro para não duplicar informação — o nome do
participante no bloco de valor vem do `DB_QUIZ`, que já sabe de quem é a pergunta
no ar. É isso que impede o nome de um com o valor de outro. Não redigite o que
outro replicant já sabe.

Isso vale para o painel também: um painel de confronto oferece "Puxar do Ingame
Setup" em vez de pedir os dois times de novo. E quando ele guarda a referência,
guarda a **chave** (sigla, id), nunca o rótulo: o rótulo é corrigível no cadastro, e
uma cópia congelada dele vira órfã na primeira correção.

## 9. Mudou o FORMATO do valor? Apague o persistido — com o servidor PARADO

`defaultValue` só vale quando NÃO existe valor persistido. Acrescentou um campo,
renomeou outro, trocou array por objeto: o replicant velho continua valendo e o campo
novo nasce `undefined` — sem erro, sem log, e o painel mostra branco.

```sql
DELETE FROM replicant WHERE namespace='<bundle>' AND name='DB_X';
```

⚠️ **Pare o NodeCG antes.** Com o servidor no ar ele tem o replicant em memória e
regrava a forma antiga no shutdown — você apaga, reinicia, e o valor velho está lá de
novo. Já custou um ciclo inteiro de debug em cima de nada.

Ordem: parar → `DELETE` → subir.

## 10. Verificar o caminho de dado sem abrir navegador

`GET` na URL só prova que o arquivo é servido. O que interessa — a peça desenha, a
animação anda, o texto cabe, o SETAR de fato gravou — só um browser responde. Um
Chromium headless dirigido por CDP (`chrome-headless-shell --remote-debugging-port`,
`Page.navigate` + `Runtime.evaluate` + `Page.captureScreenshot`) fecha o ciclo.

Duas pegadinhas que custam meia hora cada:

- **Painel servido pela URL normal NÃO recebe o objeto `nodecg`.** Quem injeta a API
  é o dashboard, no iframe. Sozinho, o script do painel morre no
  `nodecg is not defined` e a página fica só com o CSS — e o sintoma engana, porque
  o HTTP é 200 e o layout aparece. Use **`?standalone=true`**, que é a rota de painel
  que sobe com a API. (Gráfico não tem esse problema.)
- **`const` e `let` de topo não viram propriedade de `window`.** No
  `Runtime.evaluate`, referencie `DB_X` direto; `window.DB_X` é `undefined`, e a
  mensagem de erro não diz por quê. Só `function` de topo e `var` aparecem em
  `window`.

Prove o caminho INTEIRO, não a metade que você suspeita: com o painel e o gráfico
ambos verificados, o bug que sobra está no terceiro lugar — e foi assim que um
"Setar não retira o time" virou um `tocado` que o botão Limpar não marcava.

Duas coisas que o mesmo CDP responde e que não são caminho de dado:

- **`LayerTree.enable` + `LayerTree.layerTreeDidChange`** dão o inventário de
  camadas compositadas com as dimensões de cada uma. É como se prova custo de
  render — e com `--disable-gpu`, que é o caminho do CEF do vMix. Ver
  `render-no-vmix.md`.
- **Amostrar `getComputedStyle` a cada `requestAnimationFrame`** e contar os
  valores DISTINTOS prova que a peça ANIMOU (passa por ~20 estados) em vez de ter
  saltado (1 estado). É o teste das travas de primeiro estado e de on-air — e ele
  tem que chamar o `aplicar()` de verdade, não o `window.test()`, que pula a
  trava de propósito.
