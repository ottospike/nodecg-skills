# Áudio para browser sources ao vivo

Use para efeitos disparados pelo painel ou Stream Deck, trechos de música e
loops acionados na transmissão.

## Preparação dos arquivos

- Registre cada cue com arquivo, início, fim, ganho, fade e início do loop
  quando houver. Os tempos são em segundos e devem caber na duração do áudio.
  Cues de intro, loop e intro seguida de loop podem apontar para o mesmo arquivo.
- Ouça e meça o trecho que realmente toca. No projeto de origem, os efeitos
  tiveram referência de −16 LUFS no corte. Ajuste a referência ao mix da live,
  confira os picos e compare os cortes com voz e música ativas. Para loops,
  ouça várias voltas e confira a emenda no player final.
- Sirva a mídia localmente e pré-decodifique um buffer Web Audio por arquivo.
  Crie uma fonte e um ganho a cada acionamento. Para intro com loop, inicie no
  offset da intro e use `loopStart` e `loopEnd` na mesma fonte. A saída pode
  precisar de um clique durante o ensaio em navegador comum para liberar o
  áudio.

## Disparo, STOP e verificação

- Envie um ID único e o horário do servidor junto da cue. Se usar Replicant
  ou snapshot SSE, trate a cue como um disparo com validade curta. Ignore
  IDs já consumidos e pedidos vencidos. Na inicialização, alinhe a política
  de replay com a operação. Se a exigência é tocar no máximo uma vez mesmo
  depois de recarregar, mantenha o registro de consumo entre recargas ou
  confirme o consumo no servidor. O projeto de origem aceitava cues recentes
  na reconexão, com uma janela de 5 s.
- Controle o ganho dos sons em execução e faça o STOP geral baixar os ganhos
  antes de encerrar as fontes, inclusive as de loop. Use controles de corte
  no painel quando a produção precisar ajustar o trecho sem reexportar mídia.
- Escolha uma fonte de áudio por mix e habilite o controle de áudio da fonte
  pelo OBS. Se o player estiver embutido em saídas paralelas, verifique no
  mixer que só o player previsto alimenta cada destino.
- No OBS, confira corte, ganho, emenda, STOP, recarga e reconexão. Dispare uma
  cue e confirme no mixer e numa gravação que tocou uma vez. O diagnóstico do
  player ajuda a localizar erros de decodificação ou de autoplay.
