#!/usr/bin/env node
/* =====================================================================
   scripts/caspar.js — falar com um CasparCG direto do terminal
   =====================================================================
   Para ensaiar peça e cena SEM o painel: carregar um gráfico do NodeCG numa
   camada, dar CG PLAY, ver o que está no ar. Usa os mesmos módulos que a
   extension usa (assets/caspar-amcp.js e assets/caspar-osc.js) — se funciona
   aqui, a parte de protocolo funciona lá.

   Uso:
     node caspar.js [host[:porta]] <comando AMCP> [<comando> …]
     node caspar.js [host[:porta]] --lote <cmd> <cmd> …     BEGIN/COMMIT, mesmo quadro
     node caspar.js [host[:porta]] --osc [portaUDP]          estado das camadas, ao vivo
     node caspar.js [host[:porta]] --cg <ch-camada> <url> '<json>'   ADD + PLAY com dado blindado

   Exemplos:
     node caspar.js VERSION INFO
     node caspar.js 192.168.0.20 'PLAY 1-20 [HTML] "http://192.168.0.10:9090/bundles/b/graphics/lt_single.html"'
     node caspar.js 'CALL 1-20 RELOAD'
     node caspar.js 'PLAY 1-10 fs/break MIX 12' 'MIXER 1-20 OPACITY 0 12'
     node caspar.js --cg 1-20 http://127.0.0.1:9090/bundles/b/graphics/lt_single.html?ar=cg '{"nome":"Fulano"}'
     node caspar.js --osc

   Cada comando é UM argumento: ponha entre aspas simples no bash (as duplas
   ficam para o AMCP). No PowerShell, aspas simples também.
   ===================================================================== */
"use strict";

const path = require("path");
const { criarCaspar, q, dadosCG } = require(path.join(__dirname, "..", "assets", "caspar-amcp.js"));
const { ouvirOSC } = require(path.join(__dirname, "..", "assets", "caspar-osc.js"));

const args = process.argv.slice(2);
let host = "127.0.0.1";
let port = 5250;
// Host é o 1º argumento quando parece host: não é flag (`--lote`) nem comando
// em maiúscula (`VERSION`).
if (args[0] && !args[0].startsWith("-") && /^[\w.-]+(:\d+)?$/.test(args[0]) && !/^[A-Z]+$/.test(args[0])) {
  const [h, p] = args.shift().split(":");
  host = h;
  if (p) port = Number(p);
}

const log = {
  info: (m) => console.error("·", m),
  warn: (m) => console.error("⚠", m),
  error: (m) => console.error("✖", m),
};

function mostrar(cmd, r) {
  console.log(`\n> ${cmd}\n${r.codigo || "---"} ${r.msg}`);
  for (const l of r.linhas) console.log("  " + l);
}

async function main() {
  if (!args.length) {
    console.error("uso: node caspar.js [host[:porta]] <comando AMCP> … | --lote … | --osc | --cg …");
    process.exit(2);
  }

  if (args[0] === "--osc") {
    const porta = Number(args[1]) || 6250;
    // O Caspar só manda OSC para quem está CONECTADO no AMCP (ou para os
    // predefined-clients do config). Por isso conecta mesmo sem mandar nada.
    const c = criarCaspar({ host, port, log, pingMs: 5000 });
    c.on("conectou", async () => {
      if (porta !== 6250) mostrar(`OSC SUBSCRIBE ${porta}`, await c.enviar(`OSC SUBSCRIBE ${porta}`));
    });
    ouvirOSC({
      porta,
      log,
      aoMudar: (e) => {
        console.log(`\n[${new Date().toLocaleTimeString()}] recebendo=${e.recebendo} ${JSON.stringify(e.formatos)}`);
        for (const [k, v] of Object.entries(e.camadas)) {
          const resta = v.fimEm ? ` resta ${((v.fimEm - Date.now()) / 1000).toFixed(1)}s` : "";
          console.log(`  ${k.padEnd(6)} ${String(v.produtor).padEnd(10)} ${v.arquivo || ""}${v.pausado ? " (pausado)" : ""}${v.loop ? " (loop)" : ""}${resta}`);
        }
      },
    });
    return; // fica rodando até Ctrl+C
  }

  const c = criarCaspar({ host, port, log, reconectarMs: 60000 });
  await new Promise((ok) => {
    c.once("conectou", ok);
    setTimeout(() => {
      if (!c.conectado) {
        console.error(`✖ sem resposta de ${host}:${port} — o CasparCG está aberto? a porta AMCP é essa?`);
        process.exit(1);
      }
    }, 4000);
  });

  let falhou = false;
  if (args[0] === "--lote") {
    const cmds = args.slice(1);
    const r = await c.lote(cmds);
    mostrar(`lote: ${cmds.join(" · ")}`, r);
    falhou = !r.ok;
  } else if (args[0] === "--cg") {
    const [, alvo, url, json] = args;
    const dado = json ? JSON.parse(json) : {};
    const cmd = `CG ${alvo} ADD 1 ${q(url)} 1 ${dadosCG(dado)}`;
    const r = await c.enviar(cmd);
    mostrar(cmd, r);
    falhou = !r.ok;
  } else {
    for (const cmd of args) {
      const r = await c.enviar(cmd);
      mostrar(cmd, r);
      if (!r.ok) falhou = true;
    }
  }
  c.encerrar();
  setTimeout(() => process.exit(falhou ? 1 : 0), 100);
}

main();
