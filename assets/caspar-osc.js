/* =====================================================================
   caspar-osc.js — o que o CasparCG ESTÁ mostrando, resumido por camada
   =====================================================================
   Copie para `<bundle>/extension/caspar-osc.js`:

       const { ouvirOSC } = require("./caspar-osc");
       ouvirOSC({ porta: 6250, log: nodecg.log, aoMudar: (estado) => { ... } });

   POR QUE EXISTE: no vMix o painel só sabe o que PEDIU, e por isso a skill
   proíbe selo "NO AR" em fullscreen. O Caspar publica o estado real de toda
   camada por OSC — então aqui o selo pode ser honesto: "a camada 10 do canal
   1 está tocando `fs/break`", lido do servidor, não deduzido do botão.

   COMO O CASPAR MANDA: UDP, a ÁRVORE INTEIRA a cada quadro (50×/s num canal
   1080p50), em bundles OSC de ~2 KB. Todo cliente AMCP conectado recebe na
   porta 6250 do próprio IP sem pedir nada (`<osc><default-port>`). Nada disso
   pode virar escrita de replicant por quadro — ver "nada de replicant
   tickado" no SKILL.md §4. Este módulo:

     · decodifica sem dependência (OSC 1.0: bundle, i/f/s/h/d/T/F/b);
     · agrega por canal/camada e considera VIVA a camada cujo `producer` foi
       visto nos últimos `validadeMs` — camada limpa simplesmente para de
       aparecer na árvore, não existe "mensagem de saiu";
     · resume a cada `intervaloMs` e só chama `aoMudar` quando o RESUMO muda;
     · converte o tempo do clipe em PRAZO (`fimEm`, epoch ms), que fica
       parado enquanto o clipe toca — cada tela calcula o restante sozinha.

   Endereços lidos (servidor 2.2+; os caminhos da wiki antiga, sem
   `foreground/`, estão OBSOLETOS):
     /channel/N/stage/layer/L/foreground/producer   "ffmpeg" | "html" | "route" | "transition" | …
     /channel/N/stage/layer/L/foreground/file/path  caminho do clipe, ou a URL no html
     /channel/N/stage/layer/L/foreground/file/name  nome como foi mandado no PLAY (ffmpeg)
     /channel/N/stage/layer/L/foreground/file/time  [decorrido_s, total_s] (ffmpeg)
     /channel/N/stage/layer/L/foreground/paused     bool
     /channel/N/stage/layer/L/foreground/loop       bool (ffmpeg)
   ===================================================================== */
"use strict";

const dgram = require("dgram");

/* ---------- decodificador OSC 1.0 ---------- */

function lerString(buf, pos) {
  let fim = buf.indexOf(0, pos);
  if (fim < 0) fim = buf.length;
  const s = buf.toString("utf8", pos, fim);
  return [s, (fim + 4) & ~3]; // string + NUL, alinhada em 4
}

function lerMensagem(buf, aoMsg) {
  let [endereco, pos] = lerString(buf, 0);
  if (pos >= buf.length) return aoMsg(endereco, []);
  let tipos;
  [tipos, pos] = lerString(buf, pos);
  const args = [];
  for (const t of tipos.slice(1)) {
    switch (t) {
      case "i": args.push(buf.readInt32BE(pos)); pos += 4; break;
      case "f": args.push(buf.readFloatBE(pos)); pos += 4; break;
      case "h": args.push(Number(buf.readBigInt64BE(pos))); pos += 8; break;
      case "d": args.push(buf.readDoubleBE(pos)); pos += 8; break;
      case "s": { let s; [s, pos] = lerString(buf, pos); args.push(s); break; }
      case "b": { const n = buf.readInt32BE(pos); args.push(buf.subarray(pos + 4, pos + 4 + n)); pos += (4 + n + 3) & ~3; break; }
      case "T": args.push(true); break;
      case "F": args.push(false); break;
      case "N": args.push(null); break;
      default: return; // tipo que não conheço: descarta a mensagem, não o pacote
    }
  }
  aoMsg(endereco, args);
}

function lerPacote(buf, aoMsg) {
  if (buf.length >= 16 && buf.toString("ascii", 0, 7) === "#bundle") {
    let pos = 16; // "#bundle\0" + timetag de 8 bytes
    while (pos + 4 <= buf.length) {
      const n = buf.readInt32BE(pos);
      pos += 4;
      lerPacote(buf.subarray(pos, pos + n), aoMsg);
      pos += n;
    }
  } else if (buf.length && buf[0] === 0x2f /* "/" */) {
    lerMensagem(buf, aoMsg);
  }
}

/* ---------- agregação por camada ---------- */

const RE_CAMADA = /^\/channel\/(\d+)\/stage\/layer\/(-?\d+)\/foreground\/(.+)$/;
const RE_FORMATO = /^\/channel\/(\d+)\/format$/;

function ouvirOSC(opcoes) {
  const o = Object.assign(
    { porta: 6250, intervaloMs: 250, validadeMs: 600, log: console, aoMudar: () => {}, rotulo: "caspar-osc" },
    opcoes || {}
  );
  const tag = `[${o.rotulo}]`;
  const camadas = new Map(); // "1-10" → { visto, campos: {} }
  const formatos = {};
  let ultimoPacote = 0;
  let resumoAnterior = "";
  let fimEmAnterior = {}; // "1-10" → fimEm, para não publicar jitter

  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });

  sock.on("message", (buf) => {
    ultimoPacote = Date.now();
    try {
      lerPacote(buf, (end, args) => {
        let m = RE_CAMADA.exec(end);
        if (m) {
          const chave = m[1] + "-" + m[2];
          let c = camadas.get(chave);
          if (!c) camadas.set(chave, (c = { visto: 0, campos: {} }));
          if (m[3] === "producer") c.visto = ultimoPacote;
          /* Cada campo guarda QUANDO foi visto. Medido no servidor real: quando
             uma vinheta acaba e o EMPTY assume, o produtor vira "color" e para
             de mandar `file/name` — sem o carimbo, o resumo seguia dizendo que a
             camada tocava a vinheta, com o prazo velho. */
          c.campos[m[3]] = { v: args.length === 1 ? args[0] : args, t: ultimoPacote };
          return;
        }
        m = RE_FORMATO.exec(end);
        if (m) formatos[m[1]] = args[0];
      });
    } catch (e) {
      // Pacote truncado não pode derrubar a extension. Um por quadro chega.
    }
  });

  sock.on("error", (e) => {
    // EADDRINUSE = outra coisa já escuta a 6250 (o CasparCG Client, outro
    // NodeCG). Os dois não dividem a porta no Windows sem reuseAddr dos DOIS.
    o.log.error(`${tag} UDP ${o.porta}: ${e.message} — sem estado real do Caspar`);
  });

  sock.bind(o.porta, () => o.log.info(`${tag} ouvindo OSC em UDP ${o.porta}`));

  function resumir() {
    const agora = Date.now();
    const out = { recebendo: agora - ultimoPacote < 2000, formatos: Object.assign({}, formatos), camadas: {} };
    for (const [chave, c] of camadas) {
      if (agora - c.visto > o.validadeMs) {
        camadas.delete(chave);
        delete fimEmAnterior[chave];
        continue;
      }
      // Só os campos vistos junto com o produtor atual; o resto é de quem já saiu.
      const f = {};
      for (const k in c.campos) {
        if (agora - c.campos[k].t <= o.validadeMs) f[k] = c.campos[k].v;
        else delete c.campos[k];
      }
      const r = {
        produtor: f.producer,
        arquivo: f["file/name"] || f["file/path"] || null,
        pausado: f.paused === true,
        loop: f.loop === true,
      };
      const t = f["file/time"];
      if (Array.isArray(t) && t[1] > 0 && !r.pausado && !r.loop) {
        const fimEm = agora + (t[1] - t[0]) * 1000;
        const prev = fimEmAnterior[chave];
        // Só troca o prazo se ele mudou de verdade (seek, pause, outro clipe):
        // jitter de quadro não pode reescrever o replicant.
        r.fimEm = prev && Math.abs(prev - fimEm) < 1000 ? prev : Math.round(fimEm);
        fimEmAnterior[chave] = r.fimEm;
      } else {
        delete fimEmAnterior[chave];
      }
      out.camadas[chave] = r;
    }
    const s = JSON.stringify(out);
    if (s !== resumoAnterior) {
      resumoAnterior = s;
      try {
        o.aoMudar(out);
      } catch (e) {
        o.log.error(`${tag} aoMudar estourou: ${e.message}`);
      }
    }
  }

  const timer = setInterval(resumir, o.intervaloMs);
  if (timer.unref) timer.unref();

  return {
    fechar() {
      clearInterval(timer);
      sock.close();
    },
  };
}

module.exports = { ouvirOSC, lerPacote };
