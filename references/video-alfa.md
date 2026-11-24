# Vídeo com alfa (webm VP9): receber, converter, conferir

Use este arquivo quando receber arte em vídeo com alfa para o playout
(CasparCG 2.5.1): clipes VP9 1920×1080 com alfa, molduras com janela vindas de
sequência PNG (ex.: 60 fps) e entregas do motion em outro fps (ex.: 24). Use junto com
`motion-in-hold-out.md` (peça IN/HOLD/OUT), `familias-de-peca.md` §8
(`<video>` na peça) e `casparcg.md` §6 (clipes no servidor).

## 🚨 O `ffprobe` não mostra o alfa do VP9

`ffprobe arte.webm` diz `yuv420p` mesmo quando o arquivo tem alfa. O decoder
nativo (`vp9`) ignora o canal extra. O alfa só aparece:

- forçando o libvpx **antes** do `-i`: `ffprobe -c:v libvpx-vp9 -i arte.webm`,
  que mostra `yuva420p`;
- ou na tag do stream: `alpha_mode=1` (`-show_entries stream_tags=alpha_mode`).

Toda leitura de pixel ou alfa por ffmpeg (cropdetect no alfa, `alphaextract`,
conferência de janela) precisa do `-c:v libvpx-vp9` antes do `-i`. Sem isso,
a medida sai "sem alfa" e passa em silêncio.

## Sequência PNG RGBA → VP9 com alfa

```
ffmpeg -framerate 60 -start_number <n> -i pref%0Nd.png \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 28 -row-mt 1 \
  -deadline good -cpu-used 2 -auto-alt-ref 0 -an \
  -metadata:s:v:0 alpha_mode=1  saida.webm
```

- O prefixo, o número de dígitos e o `start_number` saem do **primeiro arquivo**
  da pasta. Sequências do AE começam em 0, 1 ou num número arbitrário.
- `-auto-alt-ref 0` é obrigatório com alfa no libvpx.
- **crf:** 28 para moldura que só toca. 18 para arte que sofre **seek** (loop
  dentro do hold), porque o seek amplifica artefato. Nesse caso, ponha
  keyframes nos pontos de corte (`-force_key_frames "expr:eq(n,A)+eq(n,B)"`) e
  confira com ffprobe.

## Encode num tmp, confira, só então promova

Nunca encode direto no `media/` nem no `graphics/assets/`:

1. Encode para um arquivo temporário.
2. **Confira o alfa:** decodifique um quadro do meio (com `-c:v libvpx-vp9`) e
   leia o alfa no **centro de cada janela vazada**, que deve ser 0, e num ponto
   do fundo, que deve ser 255. Se falhar, o arquivo fica no tmp e nada é
   copiado.
3. **Confira a emenda do loop:** a diferença média entre o último e o primeiro
   quadro comparada com a de dois quadros vizinhos no meio. Se for maior que
   `3×vizinhos+1`, o loop pula.
4. Só então mova para o destino. O anterior vai para `_removidos/<AAAA-MM-DD>/`.

## Vídeo que não foi feito para loop

Um institucional 4K h264 a 80 Mbps não entra assim no PC do programa (decode e
downscale ao vivo). Converta para a resolução e o fps do canal e:

- dê **fade-in curto** (~0,5 s, fica escondido sob o sting) e **fade-out** de ~1 s,
  preto→preto, para a volta do loop não ter corte;
- guarde a versão sem fade em `_removidos/`.

## fps do motion contra fps do canal

24 fps num canal de 59,94 roda em cadência 2-3, e o movimento rápido parece
"low fps". Leia o fps de cada arquivo com ffprobe. Se as regras de medida
estiverem em quadros (ex.: "repouso por 4 quadros"), escreva-as para 24 fps e
escale por `Q(n) = n · fps / 24`. Pedir o export no fps do canal resolve na
origem.

## Organização da mídia no servidor

- **Uma pasta por projeto** no media-path (`media/<PROJETO>/`), com os clipes
  referenciados como `<PROJETO>/FS_X`. Arquivos soltos na raiz do `media/`
  costumam ser de outro projeto, e o `CLS` mistura os dois.
- Renomeie as entregas sem espaço e sem acento ao ingerir.
- Peça que roda em outra máquina leva o vídeo junto (`<video>` no HTML; veja
  `montagem-kv.md` §1).

## Gerar o HTML a partir da arte medida

Para molduras de câmera ou nome (N janelas com barras de nome), um script de
ingestão pode:

- achar as **faixas de cor** (as barras) no último quadro, varrendo primeiro as
  linhas e depois as colunas, e avisar se o número de barras não bater com N;
- tirar a tipografia de uma **peça irmã já calibrada**, escalada pela altura da
  barra (`k = altura/altura_ref`), com tamanho mínimo de ~55%;
- gerar o HTML com as medidas num comentário de cabeçalho e "GERADO, não edite";
- registrar a cena no `cfg` editando o **texto** do JSON (preserva `_leia` e a
  ordem), e rodar `JSON.parse` antes de gravar para nunca deixar um cfg
  quebrado.

## O contrato de todo script de ingestão

- `--medir`: roda tudo e imprime, sem gravar nada.
- **Idempotente:** rodar de novo dá o mesmo resultado.
- O anterior vai para `_removidos/<AAAA-MM-DD>/<tipo>/<peça>/`, nunca é apagado.
- Depende só do que a máquina de ar já tem (ex.: o `ffmpeg.exe` que vem com o
  Caspar).
- Cabeçalho com **"POR QUE EXISTE"** e data.
- Script destrutivo **aborta antes de apagar** se a fonte veio pequena demais
  (ex.: scraping que trouxe menos de 100 itens).
- Entregas entram numa pasta `latest/` com os mesmos nomes. A pasta do bundle é
  saída, não entrada.
- **Caminho com colchetes** (`[PROJECTS]`) quebra `glob` em Python: use
  `glob.escape(raiz)`. Sem isso a limpeza não casa nada e arquivos velhos
  ficam esquecidos em silêncio.
