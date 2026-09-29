/* =====================================================================
   caspar-amcp.js — cliente AMCP mínimo para a extension de um bundle NodeCG
   =====================================================================
   Copie para `<bundle>/extension/caspar-amcp.js` e faça
   `const { criarCaspar, q, dadosCG } = require("./caspar-amcp");`.

   O QUE É: um socket TCP para a porta AMCP do CasparCG (5250), com
   correlação de resposta por `REQ <id>`, keepalive por `PING`, reconexão e
   timeout. Zero dependência — só `net` e `events` do Node.

   O QUE NÃO É: um espelho de estado do Caspar. Estado real de camada vem do
   OSC (UDP 6250); isto aqui só manda comando e lê a resposta. Ver
   `references/casparcg.md` §6.

   Por que não `casparcg-connection` (a lib da SuperFly):
     · a 7.x é ESM puro e exige Node 22 — a extension do NodeCG é CommonJS,
       então vira `await import()` no boot, e numa máquina de transmissão com
       Node 20 ela nem sobe;
     · ela só liga o timeout de requisição quando `autoConnect: true` é passado
       EXPLÍCITO — sem isso, comando sem resposta fica pendurado para sempre;
     · `playHtml` manda a URL sem aspas e `cgInvoke` manda o método sem aspas:
       qualquer espaço parte o token.
   Ela é boa e serve se o bundle já for ESM/Node 22 — aí use-a e ignore este
   arquivo. O protocolo é pequeno o bastante para não precisar dela.

   Três decisões que parecem erradas e não são:

   1. `enviar()` NUNCA rejeita. Devolve `{ ok, codigo, msg, linhas }`. Um
      Caspar fora do ar não pode derrubar a extension no meio do programa —
      é a mesma regra do `vmixCommand`.

   2. Desconectado, o comando FALHA NA HORA, não entra em fila. Um fullscreen
      pedido às 21:03:10 e executado às 21:03:40, quando o Caspar voltou, é pior
      que nenhum. Quem restaura o ar depois de reconectar é a RECONCILIAÇÃO
      (evento "conectou" → reaplica o estado dos replicants), não uma fila de
      comandos velhos.

   3. Todo comando sai com `REQ <id>`. O Caspar tem UMA FILA POR CANAL: a
      resposta de um comando no canal 2 pode chegar antes da de um comando
      no canal 1 enviado antes. Casar resposta por ordem de chegada casa
      errado; casar por id não.
   ===================================================================== */
"use strict";

const net = require("net");
const { EventEmitter } = require("events");

/* ---------------------------------------------------------------------
   Aspas AMCP.

   O tokenizador do Caspar processa `\` DENTRO de aspas: `\"` vira `"`, `\\`
   vira `\`, `\n` vira quebra de linha real — e QUALQUER OUTRO `\x` SOME
   (os dois caracteres). Um caminho Windows `C:\media\x` mandado cru chega
   como `C:mediax`. Por isso toda string que vai como parâmetro passa por aqui.
   --------------------------------------------------------------------- */
function q(s) {
  return (
    '"' +
    String(s == null ? "" : s)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, "\\n") +
    '"'
  );
}

/* ---------------------------------------------------------------------
   Dados para CG ADD / CG UPDATE, blindados.

   O servidor (2.5.1) monta `update("<dados>")` escapando SÓ as aspas. Barra
   invertida e quebra de linha passam cruas para dentro do literal JS: um
   nome com `\` ou um texto com Enter quebra a chamada, e o erro só aparece
   no log do Caspar. E o dado inline TEM que começar com `{` ou `<` — qualquer
   outra coisa ele trata como NOME de dataset em disco.

   Saída: um envelope `{"u":"<json em encodeURIComponent>"}`. Começa com `{`
   (passa como inline), e o miolo é só ASCII sem aspas nem barra (passa por
   todos os escapes intacto). O `utils/caspar.js` do gráfico desembrulha.
   --------------------------------------------------------------------- */
function dadosCG(obj) {
  return q(JSON.stringify({ u: encodeURIComponent(JSON.stringify(obj == null ? {} : obj)) }));
}

function criarCaspar(opcoes) {
  const o = Object.assign(
    {
      host: "127.0.0.1",
      port: 5250,
      ativo: true,
      timeoutMs: 5000,
      reconectarMs: 3000,
      pingMs: 10000,
      log: console,
      rotulo: "caspar",
    },
    opcoes || {}
  );
  const log = o.log;
  const tag = `[${o.rotulo}]`;
  const ev = new EventEmitter();

  let socket = null;
  let conectado = false;
  let encerrado = false;
  let buffer = "";
  let seq = 0;
  let ultimoPong = 0;
  let timerReconectar = null;
  let timerPing = null;

  const pendentes = new Map(); // id → { resolve, timer, cmd }

  /* Resposta em andamento: o cabeçalho já chegou e faltam linhas de dado.
     200 = várias linhas até uma VAZIA; 201 e 400 = exatamente uma linha. */
  let emCurso = null; // { id, codigo, msg, linhas, faltam: n | "vazia" }

  function novoId() {
    seq = (seq + 1) % 1e6;
    return "n" + seq;
  }

  function resolver(id, r) {
    const p = pendentes.get(id);
    if (!p) return; // chegou depois do timeout, ou é resposta sem dono
    clearTimeout(p.timer);
    pendentes.delete(id);
    if (!r.ok) log.warn(`${tag} ${p.cmd} → ${r.codigo || ""} ${r.msg}`);
    p.resolve(r);
  }

  function fecharResposta() {
    const r = emCurso;
    emCurso = null;
    const ok = r.codigo >= 200 && r.codigo < 300;
    const resp = { ok, codigo: r.codigo, msg: r.msg, linhas: r.linhas };
    if (r.id) resolver(r.id, resp);
    else if (!ok) log.warn(`${tag} resposta sem REQ: ${r.codigo} ${r.msg} ${r.linhas.join(" | ")}`);
  }

  function linha(l) {
    if (emCurso) {
      if (emCurso.faltam === "vazia") {
        if (l === "") return fecharResposta();
        emCurso.linhas.push(l);
        return;
      }
      emCurso.linhas.push(l);
      if (--emCurso.faltam <= 0) fecharResposta();
      return;
    }

    if (l === "") return;

    if (/^PONG\b/i.test(l)) {
      ultimoPong = Date.now();
      return;
    }

    // `RES <id> 202 PLAY OK` ou, sem REQ, `202 PLAY OK`
    const m = /^(?:RES (\S+) )?(\d{3})\s*(.*)$/.exec(l);
    if (!m) {
      log.warn(`${tag} linha inesperada: ${l}`);
      return;
    }
    const codigo = Number(m[2]);
    emCurso = { id: m[1] || null, codigo, msg: m[3], linhas: [], faltam: 0 };
    if (codigo === 200) emCurso.faltam = "vazia";
    else if (codigo === 201 || codigo === 400) emCurso.faltam = 1;
    else fecharResposta();
  }

  function aoDados(chunk) {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\r\n")) !== -1) {
      const l = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      linha(l);
    }
  }

  function falharPendentes(msg) {
    for (const id of Array.from(pendentes.keys())) resolver(id, { ok: false, codigo: 0, msg, linhas: [] });
  }

  function agendarReconexao() {
    if (encerrado || timerReconectar) return;
    timerReconectar = setTimeout(() => {
      timerReconectar = null;
      conectar();
    }, o.reconectarMs);
  }

  function conectar() {
    if (!o.ativo || encerrado) return;
    buffer = "";
    emCurso = null;
    const s = net.createConnection({ host: o.host, port: o.port });
    socket = s;
    s.setEncoding("utf8");
    s.setNoDelay(true);
    s.setKeepAlive(true, 5000);

    s.on("connect", () => {
      conectado = true;
      ultimoPong = Date.now();
      log.info(`${tag} conectado em ${o.host}:${o.port}`);
      ev.emit("conectou");
    });
    s.on("data", aoDados);
    s.on("error", (e) => {
      // ECONNREFUSED a cada 3s com o Caspar fechado vira ruído: loga só na
      // transição conectado → caído (no "close").
      if (conectado) log.error(`${tag} erro no socket: ${e.message}`);
    });
    s.on("close", () => {
      if (socket !== s) return;
      const estava = conectado;
      conectado = false;
      socket = null;
      falharPendentes("conexão caiu antes da resposta");
      if (encerrado) return; // fomos nós que fechamos (BYE): não é queda
      if (estava) {
        log.error(`${tag} conexão com ${o.host}:${o.port} caiu — tentando de novo a cada ${o.reconectarMs}ms`);
        ev.emit("caiu");
      }
      agendarReconexao();
    });
  }

  /* Keepalive. TCP não percebe cabo puxado nem Caspar congelado: o socket
     fica "aberto" e os comandos somem. PING é respondido FORA da fila de
     comandos (antes do parse), então um PONG atrasado é sinal de servidor
     travado ou rede morta, não de fila cheia. */
  function iniciarPing() {
    if (!o.pingMs) return;
    timerPing = setInterval(() => {
      if (!conectado || !socket) return;
      if (Date.now() - ultimoPong > o.pingMs * 2.5) {
        log.error(`${tag} sem PONG há ${Math.round((Date.now() - ultimoPong) / 1000)}s — derrubando o socket`);
        socket.destroy();
        return;
      }
      socket.write("PING nodecg\r\n");
    }, o.pingMs);
    if (timerPing.unref) timerPing.unref();
  }

  /* Manda um comando e espera a resposta dele. Nunca rejeita. */
  function enviar(cmd) {
    if (!o.ativo) {
      log.info(`${tag} (desligado) ${cmd}`);
      return Promise.resolve({ ok: false, codigo: 0, msg: "desligado", linhas: [] });
    }
    if (!conectado || !socket) {
      log.error(`${tag} sem conexão — NÃO enviado: ${cmd}`);
      return Promise.resolve({ ok: false, codigo: 0, msg: "desconectado", linhas: [] });
    }
    const id = novoId();
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => resolver(id, { ok: false, codigo: 0, msg: `sem resposta em ${o.timeoutMs}ms`, linhas: [] }),
        o.timeoutMs
      );
      pendentes.set(id, { resolve, timer, cmd });
      socket.write(`REQ ${id} ${cmd}\r\n`);
    });
  }

  /* Lote atômico (servidor 2.4+): tudo entra no MESMO quadro.

     É o que faz o fundo de um fullscreen e o HTML por cima dele começarem
     juntos — em dois `enviar()` seguidos eles podem cair em quadros
     diferentes, e no ar isso é um quadro de fundo sem texto.

     Protocolo, lido no fonte (AMCPProtocolStrategy.cpp): `BEGIN` e `DISCARD`
     não respondem nada; os comandos de dentro só respondem se tiverem REQ
     próprio (por isso vão SEM); o `COMMIT` responde `202 COMMIT OK` ou
     `202 COMMIT PARTIAL` com o id do `REQ … BEGIN`. PARTIAL = algum comando
     falhou (clipe que não existe, por exemplo) e os outros foram. */
  function lote(cmds) {
    if (!cmds || !cmds.length) return Promise.resolve({ ok: true, codigo: 202, msg: "lote vazio", linhas: [] });
    /* Medido no servidor 2.5.1: um lote com UM comando executa, mas o COMMIT
       nunca responde (o log nem mostra "Executing batch"). Um comando só já é
       atômico — vai direto. */
    if (cmds.length === 1) return enviar(cmds[0]);
    if (!o.ativo || !conectado || !socket) {
      log[o.ativo ? "error" : "info"](`${tag} ${o.ativo ? "sem conexão — NÃO enviado" : "(desligado)"}: lote ${cmds.join(" · ")}`);
      return Promise.resolve({ ok: false, codigo: 0, msg: o.ativo ? "desconectado" : "desligado", linhas: [] });
    }
    const id = novoId();
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => resolver(id, { ok: false, codigo: 0, msg: `lote sem resposta em ${o.timeoutMs}ms`, linhas: [] }),
        o.timeoutMs
      );
      pendentes.set(id, {
        timer,
        cmd: `lote[${cmds.length}]`,
        resolve: (r) => {
          if (r.ok && /PARTIAL/i.test(r.msg)) {
            log.warn(`${tag} lote PARCIAL — algum destes falhou: ${cmds.join(" · ")}`);
            r = Object.assign({}, r, { ok: false, parcial: true });
          }
          resolve(r);
        },
      });
      socket.write(`REQ ${id} BEGIN\r\n` + cmds.map((c) => c + "\r\n").join("") + "COMMIT\r\n");
    });
  }

  function encerrar() {
    encerrado = true;
    clearTimeout(timerReconectar);
    clearInterval(timerPing);
    falharPendentes("encerrado");
    if (socket) socket.end("BYE\r\n");
  }

  if (o.ativo) {
    conectar();
    iniciarPing();
  } else {
    log.warn(`${tag} DESLIGADO (enabled:false) — os comandos viram log`);
  }

  Object.assign(ev, { enviar, lote, encerrar });
  /* defineProperty e não `get` dentro do Object.assign: o assign LÊ o getter
     uma vez e copia o valor — `caspar.conectado` ficaria `false` para sempre. */
  Object.defineProperty(ev, "conectado", { get: () => conectado, enumerable: true });
  return ev;
}

module.exports = { criarCaspar, q, dadosCG };
