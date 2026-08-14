# Análise de PNG — quando não existe PSD

Leia isto quando a arte chegar **só como imagem achatada**: um PNG/JPG exportado,
um print, um frame de referência. Não dá pra abrir camada nenhuma, e ainda assim
você precisa dizer quais são os plates, o que é dinâmico, e o que falta pedir.

Também vale **junto** com o PSD: o export do designer é a única fonte honesta de
cor e de rampa, porque nenhum renderizador intermediário passou por ele.

O produto é um markdown descritivo — o que a peça é, o que ela precisa, e o que
está faltando. Ele não substitui o `ASSETS.md`: vem antes dele, e vira ele quando
os plates existirem de verdade.

## O princípio

**O script mede, você olha, e só então descreve.** Nenhuma dessas três partes
substitui as outras:

- medir no olho produz número que não fecha — "começa mais ou menos em 160" vira
  3px de erro que aparece no ar;
- medir sem olhar produz uma lista de retângulos que não diz o que a peça faz;
- descrever sem medir produz um documento que parece bom e não serve pra montar.

## 1. Medir

```bash
python <skill>/scripts/analyze_png.py ARTE.png --out graphics/assets/<NomeDoPSD>
```

Escreve `_analysis/report.json` e um recorte 1x + 3x de cada bloco. O `_` no nome
da pasta é o que garante que nada dali vá ao ar por engano.

O que ele devolve, e como ler cada coisa:

| Campo | O que significa na prática |
|---|---|
| `fundo.tipo` | `alpha` = já é overlay. `chapado` = mockup colado sobre uma cor; o `cor` é o que precisa virar alfa |
| `fundo.cobertura_canvas` | quanto do quadro é fundo. Alto = peça pequena num canvas grande, o normal num LT |
| `bbox_conteudo` | onde a arte realmente está dentro do canvas |
| `paleta` | cores por cobertura, já quantizadas; é a matéria-prima dos tokens |
| `blocos[].x/y/w/h` | **coordenada de canvas** — é o que vai virar `left`/`top` |
| `blocos[].tipo_provavel` | palpite: `texto`, `barra`, `bloco`, `grafismo`. Orienta o olhar, não decide |
| `blocos[].componentes` | quantas ilhas de tinta há dentro; muitas e de altura parecida = linha de texto |
| `blocos[].gradiente` | rampa detectada no núcleo saturado, com o CSS sugerido, ou `chapado: true` |

### Ajustando o raio

O `--raio` (default 9) é quanto o script fecha vãos antes de agrupar. Ele é a
única perilla que importa:

- **blocos demais**, arte picada em pedaços que o olho lê como um só → aumente;
- **blocos de menos**, duas linhas de texto soldadas numa caixa só → diminua
  (`--raio 2`) e rode de novo.

Rodar duas vezes com raios diferentes e comparar é barato, e é assim que se
descobre a estrutura real: o que continua junto em raio baixo é uma unidade de
verdade.

### O que ele não faz

Seja honesto sobre isto no documento que você escrever:

- **A bbox é apertada na tinta.** O limiar corta a franja antialiasada mais fraca,
  então espere ±2px contra a medida real do plate. O corte definitivo sai da
  recuperação de alfa, não daqui.
- **Fundo opaco de frame cheio vira um blocão só.** Num fullscreen com arte de
  ponta a ponta, o maior bloco é o próprio fundo. Tudo bem: nesse caso o plate é o
  frame inteiro mesmo (ver `bundle-conventions.md`), e o que interessa no report é
  a paleta e os elementos que contrastam.
- **Texto sobre plate escuro** entrega o plate como bloco, não os glifos. Se você
  quer medir a caixa de tinta do texto, recorte a região antes e rode nela.
- **Ele não sabe o que a peça faz.** Estado, gatilho, o que é dinâmico: isso sai de
  olhar e de perguntar.

## 2. Olhar

Abra os recortes de `_analysis/` — os `_3x` existem pra isso. É aqui que se
responde o que a medição não alcança:

- o que é **decoração estática** e o que é **dado vivo**;
- quais **estados** a arte mostra (vazio/cheio, normal/aceso), e quais ela *não*
  mostra mas a operação vai exigir;
- o que está **queimado** na arte e não deveria estar, porque precisa mudar no ar;
- onde o texto de exemplo já está **encostando no limite** da caixa.

A pergunta que resolve a maioria dos casos: *um operador precisaria mudar isso no
meio do programa?* Se sim, é campo dinâmico e tem que sair do plate. Se não, queima.

## 3. Descrever

O documento vai na pasta da peça, ao lado do `_analysis/`. Estrutura:

```markdown
# <NomeDaPeça> — análise da arte

**Origem:** ARTE.png (sem PSD) · **Canvas:** 1920×1080
![referência](_analysis/b00_bloco_3x.png)

## O que é
Uma frase sobre a peça e onde ela vive no quadro. Depois: quantos estados tem, o
que é fixo, o que muda, e o que o operador dispara.

## Plates propostos
| id | região (canvas) | papel | queimado | observação |
|---|---|---|---|---|
| `plate_barra` | 157, 805, 421×106 | estático | logo, textura, entalhe | medido em ±2px |

## Campos dinâmicos
| id | tipo | plate | caixa (local) | fonte / cor | limite |
|---|---|---|---|---|---|

## Paleta
| token | hex | cobertura | onde |

## Gradientes
O CSS medido, dizendo que foi amostrado do núcleo saturado do export.

## O que eu não consigo tirar daqui   ← a seção que faz este documento valer
```

**Essa última seção é o ponto.** Sem camadas, algumas coisas são impossíveis de
recuperar e é desonesto fingir que não. Liste o que precisa vir do designer ou de
uma decisão:

| Não dá pra extrair | O que pedir |
|---|---|
| Arte que está **atrás** de outra | o PSD, ou o plate isolado |
| Nome e corte exato da fonte | o PSD, ou o nome da família + peso |
| Estados que a arte não desenhou | o PSD (dá pra sintetizar), ou os PNGs dos estados |
| Texto sobre fundo texturizado, limpo | o plate sem o texto |
| A rampa exata sob antialiasing forte | confirmação dos stops |

Escreva isso como pedido, não como desculpa: *"pra fazer o estado aceso preciso do
PSD ou de um PNG da barra em laranja"* resolve; *"não foi possível determinar"*
não.

## 4. Cortar, se for seguir sem PSD

Dá pra produzir plates utilizáveis só da imagem, e às vezes é o caminho certo. O
procedimento está em `bundle-conventions.md` (seção do lower third): fundo chapado
vira alfa, o antialiasing vira alfa parcial, a cor é descontaminada
(`F = B + (C − B) / a`), e o corte sai no bbox do alfa.

O que isso **não** recupera: qualquer pixel que estava coberto por outra camada.
Se o texto está por cima do plate, o plate sem texto não existe na imagem — e é
exatamente o item que vai pra seção "o que eu não consigo tirar daqui".

## 5. Conferir

O mesmo teste de sempre: renderize sua reconstrução no tamanho da arte e sobreponha
o PNG original em `mix-blend-mode: difference`, com `opacity: 1`. Alinhado = preto.
Com `opacity: 0.5` o teste não serve pra nada — branco sobre branco dá 0 e
remistura com o fundo.
