# Vocabulário do dashboard

Referência do design system dos painéis, que vive num CSS único do bundle
(`dashboard/<bundle>.css`). **Painel novo não escreve CSS próprio** — usa estas
classes. Se falta uma, acrescente no CSS compartilhado com um comentário
explicando pra que serve, não um `<style>` local.

## Tokens

Os **papéis** abaixo são fixos; os valores são do projeto. Os hex aqui são
exemplo de um dashboard escuro — troque pelos da arte e o vocabulário continua
valendo.

```css
--bg      #0F0F23   fundo do painel
--surface #272740   superfícies e bordas
--accent  #FF3C00   destaque / estado ligado
--txt     #ECECF2   texto
--muted   #6D6D8A   texto apagado
--label   #9A9AB5   rótulos e h2
--ok      #1D7A34   PLAY
--danger  #A11F1F   OUT
--r       4px       raio
--h-ctl   28px      ALTURA de todo controle de linha: input, select, botão de ação
--h-tecla 42px      ALTURA de tecla isolada: PLAY/OUT, grade de cenas
```

**Dois tokens de altura, e a escolha vem do vizinho.** Botão que divide a linha com
um input usa `--h-ctl` — senão a linha não bate. Botão de ação isolado usa
`--h-tecla`: tecla larga e baixa lê como barra, não como alvo. Aumentar só a largura
não resolve; o que o operador percebe é a proporção.

**Puxe as cores do `assets.json` da arte**, não do gosto: o painel do operador
ficando na mesma paleta do que está no ar é o que faz ele reconhecer no painel a
peça que está na tela. `--h-ctl` num lugar só é o que mantém input, select e botão
alinhados na mesma linha; mexer nele redimensiona o dashboard inteiro de uma vez.
28px é o mínimo confortável para fonte de 13px — abaixo disso o texto encosta na
borda e o alvo de clique fica pequeno pra quem opera com o programa no ar.

## Estrutura de bloco

| Classe | Uso |
|---|---|
| `.sechd` | cabeçalho de seção: `<h2>` à esquerda, `.onair` à direita |
| `.sechd.sep` | idem, com linha e respiro em cima — separa do bloco anterior |
| `.onair` + `data-on="true|false"` | selo "no ar"/"fora do ar"; o ponto pulsa quando ligado (respeitando `prefers-reduced-motion`) |
| `.campo` | linha de formulário: `.rot` + input/select + botão |
| `.rot` | rótulo curto à esquerda do campo |
| `.campo select.largo` | select que precisa de largura maior (rótulos tipo "NOME · @social") |
| `.barra` | linha de botões de ação |
| `.status` | uma linha de texto sob o bloco; `:empty` não ocupa altura |

## Botões

| Classe | Uso |
|---|---|
| `.bt` | base |
| `.bt-play` | põe no ar / confirma — leva a **cor de ação primária da arte** (ex.: verde numa arte neutra, amarelo numa arte que usa amarelo como primária) |
| `.bt-out` | vermelho — tira do ar |
| `.bt-setar` | não estica: fica do tamanho da palavra, ao lado do campo |
| `.bt-cena` + `.on` | cena de fullscreen; `.on` = a que foi acionada |
| `.bt-mark` + `.on` | marcação toggle (alternativa escolhida) |
| `.bt-reveal` | revelar resposta |
| `.bt-avancar` / `.bt-voltar` | verde subiu / vermelho desfez — mesma linguagem do PLAY/OUT |
| `.bt-ovo` / `.bt-explic` + `.on` | grade de peças irmãs; a acesa é a que está no ar |

**PLAY leva a cor primária da arte, e SETAR não pode levar a mesma.** Pôr no ar é
a ação primária do dashboard, então PLAY recebe o tratamento cheio (bisel, cor de
marca): é o botão que o operador procura com o olho. Se SETAR usar a mesma cor,
os dois disputam o olhar e o operador aperta SETAR achando que está pondo no ar.
SETAR fica neutro com um fio da cor primária: legível como ação, sem competir.

## Componentes maiores

| Classe | Uso |
|---|---|
| `.lista` / `.lista li` | lista selecionável (perguntas). `.sel` selecionada, `.feito` concluída, `.naVez` a próxima, `.encerrado` apagada, `.grupo` cabeçalho de participante |
| `.chk` | pílula clicável com input escondido (`pointer-events: none` no input é o que garante UM disparo por clique). `.on` marcada, `.off` bloqueada, `.pronto` pede ação |
| `.degrau` / `.bt-degrau` | ação em cima, resultado embaixo — o operador aperta olhando pro alvo |
| `.metas` / `.meta` | marcos horizontais (entregas de meta de like) |
|  `.grade` / `.grade-item` | grade de botões irmãos (um por variante); a cor vem do manifest via `--cor` inline |
| `.tempo` / `.relogio[data-modo]` / `.tempo-bts` | relógio grande à esquerda, grade 3×2 de controles à direita |
| `.cenas` | linha de botões de cena do switcher |

## Regras de layout

- **Grade, não linhas independentes.** Cinco controles numa `grid` de 3 colunas
  alinham nas bordas; um `.campo` empilhado sobre uma `.barra` se dimensiona
  sozinho e nada bate na vertical.
- **A barra de rolagem precisa aparecer.** A default do Chromium é quase
  invisível; numa lista longa o operador não descobre que tem mais conteúdo.
  `.lista` estiliza `::-webkit-scrollbar` de propósito.
- **`.status:empty` some.** Painel com quatro fichas empilhadas não pode ganhar
  altura por causa de status vazio.
- **Apagar ≠ esconder.** Item encerrado fica apagado, mas se estiver no ar
  continua legível — se está na tela, tem que dar pra ler no painel.
- **Pílula em vez de checkbox nativo.** O controle do Chromium não aceita a
  linguagem visual do painel e o alvo de clique fica pequeno pra quem opera com o
  programa no ar.
- **Rótulo de tecla é curto porque a tecla tem altura fixa.** Rótulo que quebra em
  duas linhas vaza. Nome comprido vai no `title`, e a tabela de rótulos mora num
  arquivo compartilhado — duas cópias divergem no primeiro rename.

## Contraste se mede contra o fundo REAL, não contra o token

`--muted` é calibrado contra UMA superfície. Aninhe uma caixa translúcida
(`rgba(255,255,255,.04)`) sobre um fundo claro e o mesmo token cai para **1,02:1** —
ilegível, e o defeito só aparece quando o operador reclama de "baixa visibilidade".

A correção não é clarear o token (isso estraga onde ele estava certo): é dar à caixa
interna um fundo **opaco conhecido**, uma classe `.caixa` com a mesma cor de placa
para a qual os tokens foram medidos. Quando aparecer a terceira cópia de
`rgba(255,255,255,.04)` num painel, ela já é o bug.

Mesma família: placeholder. O cinza que parece "apagado o suficiente" costuma ficar
abaixo de 4,5:1 — meça.

## `box-sizing: border-box` é uma decisão, não um default

Ligar o reset global num dashboard que já existe **encolhe todo campo com padding de
uma vez**. Se algum painel calibra largura em `calc(NNch + Xpx)` contando o padding
por fora, ligar border-box quebra a calibração inteira em silêncio.

Escolha um dos dois e escreva qual, com o porquê, no CSS. Se ficar com content-box:

- **Nada de `width: 100%` em input com padding** — vaza da coluna. Numa coluna flex
  ele já estica sozinho; basta não declarar largura.
- **Anel de foco e contorno por `box-shadow`, nunca por `border`** — sombra não ocupa
  layout, então o campo não muda de tamanho ao ganhar o anel.
- **Sombra não ocupa layout, mas ocupa pixel.** Ao trocar caixa lisa por contorno,
  revise as margens negativas: um `margin-top: -2px` que colava duas linhas passa a
  puxar o anel de um campo por cima do outro, e por cima do rótulo acima.

## Sugerir ou restringir: `datalist` e `select` não são intercambiáveis

- **`<select>`** quando o valor TEM que existir no cadastro. Guarde a **chave**
  (sigla, id), não o rótulo: o rótulo pode ser corrigido no cadastro depois, e um
  rótulo congelado vira órfão.
- **`<datalist>`** quando o valor pode ainda não estar cadastrado — um classificado
  de fase anterior, um convidado. Travar ali impede montar antes de o cadastro
  fechar; sugerir já resolve o erro real, que é a grafia divergente.

⚠️ **`scrollWidth` não acusa truncamento em `<select>`** como acusa num `<input>`.
Uma verificação automatizada dirá "nada cortado" enquanto a tela mostra
o nome cortado (ex.: `NOME COMPRIDO DO T`). Mostre a forma curta no rótulo da `<option>` e o nome inteiro no
`title`; o `value` continua sendo a chave.

## O painel mostra o número VIVO, não o que foi configurado

Repetir a configuração ("meta: 500") é a forma mais fácil de o dashboard concordar
consigo mesmo enquanto o ar diverge. Mostre o que a fonte devolve agora, com a
configuração ao lado.

Corolário: **painel que acompanha animação longa precisa tiquetear.** Um diagnóstico
que só repinta em mudança de estado mostra `progresso: 0%` com a peça a 27% — e um
painel que mente sobre progresso é pior que um painel sem progresso. Um `setInterval`
de ~250ms enquanto roda, desligado no fim.

## Larguras de painel

`width` é em colunas do dashboard do NodeCG (1–8ish). Escolha olhando o conteúdo
real renderizado e **grave o motivo num campo `_width`** ao lado, no
`package.json` — o NodeCG ignora chaves que não conhece, e a nota impede que o
próximo desfaça a escolha sem saber:

```json
{
  "name": "ativacoes",
  "title": "Ativações",
  "file": "ativacoes.html",
  "_width": "4 e não 3: os cinco botões de ovo ficam numa linha só; com 3 o rótulo quebrava.",
  "width": 4,
  "headerColor": "#0F0F23"
}
```
