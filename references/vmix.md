# Ponte com o vMix

Leia quando a extension precisar falar com o switcher, ou quando estiver portando
um gráfico do modelo CasparCG.

Se o playout do programa é um CasparCG (e não um bundle antigo que você está
trazendo DE lá), o documento é outro: `casparcg.md`.

Isto é sobre a ponte HTTP. O que acontece DENTRO da browser source — por que uma
animação lisa no navegador engasga no vMix, e o que custa área de repaint — é
outro assunto: `render-no-vmix.md`.

## O modelo de ar

Duas famílias de peça, e elas se comportam de forma oposta:

| | Quem transiciona | O que o HTML faz |
|---|---|---|
| **Fullscreen** (`fs_*`) | o vMix, por `PreviewInput` + `Stinger` | nada de entrada/saída — só desenha o campo vivo |
| **Lower third** (`lt_*`) | o próprio HTML | anima entrada e saída; a browser source fica sempre carregada |

Cada cena de fullscreen é um **input montado no vMix**: o PNG de frame cheio, e por
cima a browser source transparente com o que muda. O painel só grava a cena no
replicant; a extension traduz.

Consequência prática pro painel: **não ponha selo "no ar" numa cena de fullscreen.**
O painel não sabe o que está no ar — ele sabe o que pediu. O botão aceso já diz
isso sem mentir.

## Os helpers

```js
const VMIX_URL = 'http://localhost:8088/api/';

async function vmixCommand(Function, params) {
  const url = `${VMIX_URL}?${new URLSearchParams(Object.assign({ Function }, params || {}))}`;
  try {
    const r = await fetch(url);
    if (!r.ok) nodecg.log.warn(`[vmix] ${Function} respondeu ${r.status}`);
    return r.ok;
  } catch (e) {
    // Um vMix fora do ar não pode derrubar a extension no meio do programa.
    nodecg.log.error(`[vmix] ${Function} falhou:`, e.message);
    return false;
  }
}

async function previewThenStinger(input, n = 1) {
  await vmixCommand('PreviewInput', { Input: input });
  await new Promise((r) => setTimeout(r, 100));
  await vmixCommand(`Stinger${n}`);
}
```

**O delay de 100ms não é superstição.** O vMix processa os dois comandos em ordem,
mas não instantaneamente: stinger colado no preview pega o input *anterior* ainda no
preview e transiciona pra cena errada.

Outros comandos que aparecem:

```js
vmixCommand('OverlayInput1In',  { Input });   // canal de overlay, o vMix remove sozinho
vmixCommand('OverlayInput1Out', { Input });
// mídia: Restart antes de Play — QuickPlay não serve, ele re-corta o input
await vmixCommand('Restart', { Input: x });
await vmixCommand('Play',    { Input: x });
```

## Configuração, não código

Os nomes dos inputs têm que bater **letra por letra** com o vMix — acento, espaço e
caixa incluídos (`"COMEÇAMOS"`, `"FS_ DESTAQUES"`). Isso não fica no código:

```json
// cfg/<bundle>.json
{
  "vmix": {
    "url": "http://localhost:8088/api/",
    "stinger": 1,
    "enabled": true,
    "inputs": { "contador": "FS_CONTADOR", "break": "FS_BREAK", "end": "FS_END", "pgm": "PGM" }
  }
}
```

`enabled: false` desliga só os comandos de ar: numa máquina sem vMix (dev, ensaio no
navegador) o painel continua funcionando inteiro e os comandos viram log. Todo OUT
volta pro input `pgm`.

Cena sem input configurado é erro logado e **nada vai ao ar** — melhor não fazer
nada que transicionar pro input errado:

```js
if (cena && !input) {
  nodecg.log.error(`[vmix] cena "${cena}" não tem input configurado — nada foi ao ar`);
  return;
}
```

## A guarda de primeira emissão

O `change` inicial de um replicant é o estado que já existia, não uma ordem. Reagir a
ele manda o vMix pro PGM sozinho a cada boot do NodeCG:

```js
let primeiraCena = true;
DB_FS.on('change', (novo) => {
  if (primeiraCena) { primeiraCena = false; return; }
  ...
});
```

O replicant de cena é `persistent: false` pelo mesmo motivo: depois de um restart
nada pode se declarar no ar. O operador decide de novo.

## Migrando do modelo CasparCG

Bundles antigos seguem o modelo em que o HTML anima o próprio fade e escuta
`xPlay`/`xOut`/`outAllFs`. Ao portar um gráfico:

- o container passa a ser sempre `opacity: 1` — quem transiciona é o input do vMix;
- os listeners de `xPlay`/`xOut`/`outAllFs` saem; sobra o canal de update;
- o tween de opacidade do container sai junto.

E o principal: **converta o canal para replicant** em vez de manter
`sendMessage`/`listenFor`. O modelo de mensagem é a razão de gráficos voltarem em
branco depois de um refresh — ver §1 do SKILL.md. Se não der pra converter agora,
registre por quê no cabeçalho do arquivo.

Duas armadilhas da migração:

- **Reset de estado tem que ser síncrono.** Um `clearGFX` que zera flags dentro de um
  `setTimeout` roda *depois* do handler de play que ligou a flag de no-ar e a
  desliga. Zere as flags de forma síncrona.
- **Auditoria de canais.** Num bundle grande, cruze `sendMessage` × `listenFor` entre
  dashboard, graphics e extension: aparecem botões órfãos, listeners duplicados e
  canais sem ouvinte.
