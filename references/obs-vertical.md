# Overlays verticais no OBS

Use para browser sources em 9:16 ou para compor saídas diferentes por plataforma.
O critério de operação é o mesmo de um bundle NodeCG. Em NodeCG, o estado chega
por Replicants. Numa aplicação independente, use o snapshot do servidor e os
updates do transporte que o projeto já oferece.

## Palco, câmera e áreas seguras

- Use um palco transparente com a resolução de referência da composição,
  como 1080×1920. Meça topo, chat, controles, rosto e área da ação a partir de
  capturas da plataforma e do enquadramento reais. As interfaces de live e de
  feed podem cobrir regiões diferentes. Guarde essas regiões como retângulos no
  preview e marque quais delas impedem a colocação de uma peça.
- Posicione as peças pelos cantos ou em colunas estreitas e confira a leitura em
  uma captura reduzida à largura de um celular. Valide pares que podem ficar
  juntos no ar com interseção de caixas. Declare as sobreposições deliberadas,
  como um destaque de tela cheia.
- Separe a âncora de layout da camada que anima. Assim, arrastar ou redimensionar
  no preview preserva a timeline que está rodando. Para layout associado a duas
  câmeras empilhadas, derive as posições relacionadas da linha divisória. Uma
  altura ajustada no preview pode mover o bloco inteiro.
- Para uma única fonte no OBS, empilhe as páginas em iframes transparentes com
  ordem de camadas explícita e as mesmas dimensões do palco. Reaproveite as
  páginas como fontes individuais quando a operação precisar. Confira o limite
  real de conexões se cada iframe abrir seu próprio SSE. Uma saída pode
  compartilhar um stream ou usar HTTP/2 com limites suficientes no servidor e
  no proxy. Use uma instância por peça na composição. Audite o total de
  conexões com preview, painel e saídas simultâneas. No ensaio, simule uma
  conexão que ficou aberta sem publicar e confira se o watchdog recupera o
  snapshot. Para posições por plataforma, repasse só os parâmetros que se
  aplicam às peças filhas.

## PLAY, modo foco e recuperação

- Uma peça que alterna entre detalhe e resumo fica na mesma página. O PLAY ou
  uma mudança relevante abre a versão detalhada. Depois de um prazo, o conteúdo
  recolhe para uma forma compacta. Se for uma gaveta, mantenha o cabeçalho
  ancorado e desloque o corpo num trilho recortado. O OUT funciona a partir
  de ambas as formas. No refresh, monte a aparência correspondente ao estado
  atual sem repetir a entrada. Para relógios ou rotações, derive o quadro do prazo e do relógio do
  servidor, inclusive ao reconectar.
- Derive o foco do destaque ativo e de seu prazo. Oculte temporariamente as
  peças concorrentes na composição e mantenha o estado de PLAY de cada uma.
  Na volta, restaure somente as peças que continuam no ar. Defina qual
  camada desenha o véu para que duas opacidades não se somem.
- Se o destaque depende de uma imagem, só libere o foco quando a arte estiver
  decodificada ou quando o fallback estiver decidido. Use uma regra comum entre
  as fontes e um prazo máximo para liberar o resto da composição.
- Faça um modo de ensaio com dados de exemplo e um diagnóstico que mostre o que
  foi desenhado. Em cada saída, confira alpha em repouso, legibilidade,
  coincidência de peças, PLAY e OUT rápidos, recarga no ar, imagem ausente e
  reconexão. Repita dentro do OBS na resolução de produção.
