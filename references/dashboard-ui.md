# Vocabulário do dashboard

Referência das classes do design system dos painéis (`dashboard/<bundle>.css`, no
Show do Apelão `betano.css`). **Painel novo não escreve CSS próprio** — usa estas
classes. Se falta uma, acrescente no CSS compartilhado com um comentário
explicando pra que serve, não um `<style>` local.

## Tokens

```css
--navy   #0F0F23   fundo do painel (= linha de cima das alternativas na arte)
--navy2  #272740   superfícies e bordas
--orange #FF3C00   destaque da marca / estado ligado
--txt    #ECECF2   texto
--muted  #6D6D8A   texto apagado
--label  #9A9AB5   rótulos e h2
--ok     #1D7A34   PLAY
--danger #A11F1F   OUT
--r      4px       raio
--h-ctl  28px      ALTURA de todo controle de linha: input, select, botão de ação
```

Os tokens de cor vêm do `assets.json` da arte oficial — o painel do operador tem a
mesma cor do que está no ar, de propósito. `--h-ctl` num lugar só é o que mantém
input, select e botão alinhados na mesma linha; mexer nele redimensiona o
dashboard inteiro de uma vez.

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
| `.bt-play` | verde — põe no ar / confirma |
| `.bt-out` | vermelho — tira do ar |
| `.bt-setar` | não estica: fica do tamanho da palavra, ao lado do campo |
| `.bt-cena` + `.on` | cena de fullscreen; `.on` = a que foi acionada |
| `.bt-mark` + `.on` | marcação toggle (alternativa escolhida) |
| `.bt-reveal` | revelar resposta |
| `.bt-avancar` / `.bt-voltar` | verde subiu / vermelho desfez — mesma linguagem do PLAY/OUT |
| `.bt-ovo` / `.bt-explic` + `.on` | grade de peças irmãs; a acesa é a que está no ar |

## Componentes maiores

| Classe | Uso |
|---|---|
| `.lista` / `.lista li` | lista selecionável (perguntas). `.sel` selecionada, `.feito` concluída, `.naVez` a próxima, `.encerrado` apagada, `.grupo` cabeçalho de participante |
| `.chk` | pílula clicável com input escondido (`pointer-events: none` no input é o que garante UM disparo por clique). `.on` marcada, `.off` bloqueada, `.pronto` pede ação |
| `.degrau` / `.bt-degrau` | ação em cima, resultado embaixo — o operador aperta olhando pro alvo |
| `.metas` / `.meta` | marcos horizontais (entregas de meta de like) |
| `.ovos` / `.ovo` | grade de botões por cor, cor vinda do manifest via `--cor` inline |
| `.tempo` / `.relogio[data-modo]` / `.tempo-bts` | relógio grande à esquerda, grade 3×2 de controles à direita |
| `.cenas` | linha de botões de cena do switcher |

## Regras de layout que já custaram debug

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
