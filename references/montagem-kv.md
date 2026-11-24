# Montagem de key visual e fullscreen: camadas, fotos, catálogos e texto

Medido num bundle real de esports (temporada de nov/2026: 14 fullscreens, 9
lower thirds, playout no CasparCG). Este arquivo trata do que acontece
**depois** que as plates existem: como uma peça empilha vídeo, plate, foto
recortada, logo, carta e texto, e como os assets de catálogo (pessoas,
times, itens do jogo) são padronizados para que a peça não precise de exceções.

Antes deste, leia `familias-de-peca.md` (esqueleto, regra do `opaco`, §8
plate/vídeo/híbrida) e `render-no-vmix.md` (`clip-path` pela caixa medida).

---

## 1. A pilha é decidida pela ARTE, não pelo arquivo

Monte a pilha que o PSD pede e só depois decida o que vai em cada arquivo:

```
fundo (vídeo no servidor ou <video>)  →  foto  →  moldura/vídeo vazado  →  plates que o vídeo não traz  →  texto
```

- **A camada `[HTML]` do Caspar fica acima de qualquer clipe.** Se o motion
  entrega dois vídeos (fundo + elementos de frente, ex.: "CAMPEÃO", raios) e a
  foto do jogador vai **entre** eles, o vídeo da frente **não pode** ser clipe
  do servidor: toca num `<video>` dentro do HTML, acima da foto. Regra: *todo
  vídeo que precisa ficar acima de um campo dinâmico toca no HTML.*
- **Foto POR BAIXO do vídeo quando a moldura é vazada.** A borda passa por cima
  da foto, como no PSD, e a foto não precisa de máscara. Uma máscara na foto
  mostra o fundo dela sempre que a foto e a arte desencontram 1 px.
- **Duplique só a fatia que se sobrepõe.** Se um rodapé vem queimado no vídeo
  de fundo, mas no PSD ele fica **acima** das fotos, redesenhe só o rodapé como
  plate, no mesmo pixel do vídeo, por cima das fotos. É mais barato que tirar o
  rodapé do vídeo ou subir tudo.
- **Peça que roda em outra máquina leva o vídeo junto:** `<video>` com o webm
  em `graphics/assets/<peça>/`, tudo numa URL só. Clipe no media-path só serve
  quando o servidor de playout é o mesmo.
- **Moldura que toca as quatro bordas não leva `clip-path`.** O recorte não
  economiza nada nela. Documente a exceção no comentário.

### Máscaras e janelas

- **Ícone de vetor que muda de cor por estado** (ativo, perdido, apagado): exporte
  **uma** máscara PNG e pinte com `background-color` + `mask`/`-webkit-mask`.
  Uma plate por cor triplica os assets e desalinha.
- **Janela estática para o texto nascer de trás de algo:** um container de
  frame cheio com `clip-path: inset(0 0 0 <borda>px)` na borda do elemento.
  O texto desliza dentro dela, então o que ainda está "atrás" do emote ou do
  escudo não aparece.
- **Rolo (créditos, ticker): a janela termina NO MEIO do rodapé,** para o
  texto nascer e sumir atrás da barra. No PSD parado, o texto vazando por baixo
  é composição; no ar, rolando, parece quebrado.

### Variantes de formato são tabelas, não peças

MD3 e MD5, 2 times e 4 times, com ou sem banimentos: é **o mesmo** painel com
outra geometria. Use uma peça com `LAYOUT = { md3: {...}, md5: {...} }` e
plates com sufixo (`box_md3.png`), escolhidas pelo **dado**, não por um botão
a mais no painel.

- **Layout que segue a quantidade:** na quantidade do PSD, use os centros
  exatos do PSD. Em outras, gere linhas (em cima a metade arredondada para
  cima), cada uma centrada com o **passo médio** do PSD. Campo vazio não vira
  buraco.
- **Elementos dependentes somem juntos:** sem nenhum ban, o ícone "proibido"
  sai com os slots.
- **A régua do PSD pode não ser uniforme** (passo de 86 com uma linha de 85).
  Guarde a lista de `y` medida, não `i × passo`.
- **Já escolhido fica apagado, não some:** `filter: grayscale(1)` + véu de ~55%.
  O espectador precisa ver quem sobrou.

---

## 2. Fotos de pessoas

### Padronize NA ENTREGA, num formato só por papel

Defina um formato por papel, anote no manifesto (`_leia`) e reprocesse tudo o
que chegar:

- RGBA sem fundo, canvas fixo por uso (ex.: `foto` 594×701 para retrato,
  `capa` 850×1080 para corpo inteiro).
- **Âncora:** topo da cabeça a ~6% do quadro, cabeça centrada, preenchendo a
  largura e encostando embaixo. Ou alinhe pelo **rosto** (detecção facial: rosto
  de tamanho fixo num x/y fixo) quando os recortes vierem muito diferentes.
  Escala **sempre** proporcional.
- A exceção (um recorte curto que precisa de rosto maior) é **anotada** no
  manifesto. As versões com fundo vão para `_removidos/`.
- Use **um fundo neutro único** (ex.: off-white) atrás de toda foto recortada,
  igual em todas as peças.

### Mesmo padronizado, enquadre em RUNTIME pelo alfa

As entregas variam muito: cabeça de 24% a 43% da altura, centro x de 38% a
60% da largura. Zoom fixo deixa uma foto minúscula e corta a outra. A peça
mede **cada PNG uma vez** (cache por URL), numa cópia pequena (~300 px de
altura) num canvas:

1. **topo** = primeira linha com ≥3% da largura opaca;
2. **ombro** = primeira linha mais larga que 1,8× a largura da cabeça;
3. **pescoço** = a linha mais estreita entre topo e ombro;
4. **cx** = centroide da cabeça.

Encaixe o topo a 6% da moldura e o pescoço a 80%: toda cabeça sai do mesmo
tamanho e centrada. Proteções:
- cabeça medida fora de [20%, 60%] → use o valor típico (35%);
- foto **opaca** (sem alfa) → `cover` ancorado no topo;
- medição ruim conhecida (topo cortado no arquivo) → mediana do grupo;
- uma tabela pequena de ajuste por arquivo, com o motivo de cada linha.

**Proporções diferentes convivem.** Um retrato de rosto (ex.: 386×428, vindo
de outro projeto) vai em `cover` no topo; o retrato padrão vai pelo
enquadramento medido. O manifesto diz qual é qual.

**Capa de corpo inteiro em KV:** `background-size: auto <altura maior que o
quadro>` e `top` negativo (começa acima do quadro, como no PSD), centrada no
x do jogador **no PSD**.

---

## 3. Catálogos de itens (cartas, personagens, logos)

Ao montar uma tabela de assets de um jogo a partir de uma fonte externa:

- **Escolha a fonte pela arte limpa** (sem overlay pintado, sem o elemento
  comprimido). Nomes e arte podem vir de fontes diferentes: cruze por uma chave
  normalizada (NFD, só ASCII, minúsculas).
- **Canvas único, escala nativa, alinhado por uma referência MEDIDA na arte.**
  Ex.: a borda de baixo da moldura, lida na coluna central com alfa ≥250. O
  limiar alto ignora o brilho semitransparente de raridades. O que for maior que
  o padrão (brasão, coroa) **sobra para cima**.
- **O manifesto grava a caixa do CORPO** (`[x0,y0,x1,y1]` da moldura comum).
  Na peça, o slot do PSD **é o corpo**: `escala = largura do slot ÷ largura do
  corpo`, base do corpo na base do slot, e um filho com `overflow: visible`
  deixa o brasão passar do slot, como no jogo. Com `contain`, o brasão entra na
  caixa e cada item sai de um tamanho.
- **Do PSD, use só o centro do slot e a base da linha.** Os bboxes das camadas
  incluem brilho e brasão e variam em ±5%.
- **Desconfie de "mesma escala".** Meça a moldura **por família** de arquivo
  (comum, evolução, herói…). Uma família vinha 3,6% maior com o mesmo tamanho
  de arquivo. A correção é por família, não por item.
- **Logo de time:** `contain` num miolo com respiro (~14 px) dentro do selo. O
  placeholder do PSD ("TEAM LOGO") é o fallback.
- **Plate de várias colunas fatiada:** quando uma faixa única do PSD cobre
  várias colunas que animam separadas, fatie por coluna. Meça os deslocamentos
  por correlação: o PSD pode ter colunas em meio pixel (`DX = [0, 165.5, 332,
  496.5]`).

---

## 4. Texto sobre a arte

- **Centre no espaço LIVRE, não no centro do PSD,** quando há molduras de
  larguras diferentes dos dois lados. No ar, o centro do PSD parece puxado.
- **Caixa de uma linha com altura ~1,1em**, não o corpo. A posição continua
  presa à baseline, e a área de conteúdo não estoura a checagem abaixo.
- **Shape que recebe texto com stroke centrado de N px:** a caixa útil é o
  retângulo + N/2 de cada lado.
- **Folga:** o vão de cada auto-fit é a caixa menos 4 px (540 → 536).

### O gate de pior caso: `conferirTexto()` + `testLongo(n)`

Cada peça registra seus piores casos: n× "W" (a letra mais larga da fonte),
n× "M", um nome com espaços, um CamelCase de palavra única. `conferirTexto()`
mede todo texto dentro do `.stage` e classifica:

| Marca | Significa |
|---|---|
| **ESTOUROU** | a tinta passa da caixa |
| **QUEBROU** | mais de uma linha numa caixa de uma linha |
| **ENCOSTA** | cabe, mas com menos de 2 px de folga de um lado |

Rode antes de entregar cada peça (CDP ou console com `?dev=1`). As armadilhas
de medição estão em `familias-de-peca.md` (Range + `text-transform`,
`fonts.ready` com texto vazio).

---

## 5. Organização dos assets

- **Toda pasta de catálogo tem um `_manifest.json` GERADO** com `_leia`:
  procedência, data da entrega, padrão de recorte, qual arquivo foi escolhido
  quando havia vários, e "não edite à mão, rode o script". `padrao` (silhueta)
  fica fora de `itens`. `aliases` cobrem nick sem símbolos e primeiro nome. A
  busca ignora acento e caixa.
- **A cadeia de fallback entre pastas fica na peça** (ex.: técnicos → casters
  → jogadores → silhueta), não no manifesto.
- **Plate recortada do achatado do designer** quando um efeito de camada
  (anel, glow) não sai no export do Photopea: recorte do PNG achatado com
  máscara (circular, retangular) na posição medida.
- **Duas versões de arte na mesma peça** (marca A / marca B): dois `<video>`,
  cada um com seu `clip-path`, escolhidos por um campo do replicant
  (`versao`), não duas peças.
- `_moldura.png` e `_reference.png` de 1920×1080 são **régua**: ficam na pasta,
  mas nenhum código os carrega.
