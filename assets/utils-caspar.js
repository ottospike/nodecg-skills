/* =====================================================================
   utils/caspar.js — o contrato de template do CasparCG para uma peça NodeCG
   =====================================================================
   Copie para `<bundle>/graphics/utils/caspar.js` SÓ quando alguma peça for
   dirigida por comando CG (CG ADD/PLAY/STOP/UPDATE) — pelo CasparCG Client,
   por outro controlador, ou pela extension no modo B de
   `references/casparcg.md` §3. No modo A (a peça carregada por
   `PLAY [HTML] <url>` e o ar no replicant) este arquivo não é necessário.

   🚨 Carregue no <head>, SÍNCRONO, antes do script da peça:

       <script src="utils/caspar.js"></script>

   O Caspar chama `update("…")` e `play()` pelo NOME, como globais, logo
   depois do evento `load` da página. Se essas funções só existirem depois
   de um passo assíncrono (fontes, plates, replicant), a chamada estoura
   ReferenceError, vai para o log do Caspar, e o comando se PERDE: a peça
   fica parada fora do quadro e o operador vê "202 CG OK". Por isso este
   arquivo define as globais na hora e ENFILEIRA as chamadas até a peça
   dizer que está pronta (`CASPAR.ligar(...)`).

   Quem manda no ar é UM só. Com `?ar=cg` na URL, o ar é do Caspar (CG PLAY
   e CG STOP) e a peça ignora o `visivel` do replicant; sem ele, o ar é do
   replicant e CG PLAY/STOP viram aviso no log. Dois donos para o mesmo ar é
   a peça entrando por um e saindo pelo outro — e ninguém sabe dizer por que
   ela está no ar.
   ===================================================================== */
(function () {
  "use strict";

  /* O servidor injeta `window.remove` nativo (fecha o navegador da camada)
     e `window.caspar = window.casparcg = {}` como sinal de "estou no Caspar".
     Guarde o nativo AGORA: a atribuição de `window.remove` logo abaixo o
     sobrescreve, e sem esta referência o CG REMOVE nunca mais fecharia nada. */
  var removeNativo = typeof window.remove === "function" ? window.remove : null;
  var noCaspar = !!(window.caspar || window.casparcg);

  var params = new URLSearchParams(location.search);
  var arPeloCG = params.get("ar") === "cg";

  var ganchos = null; // { play, stop, next, update } da peça
  var fila = [];

  function avisar(msg) {
    // console.* dentro do Caspar vai para o LOG do servidor (html[url] … Log:)
    if (window.nodecg && nodecg.log) nodecg.log.warn("[caspar] " + msg);
    else console.warn("[caspar] " + msg);
  }

  /* Três formatos chegam em update(str), e a peça não precisa saber qual:
       ""                          → CG ADD sem dado (o servidor SEMPRE chama update)
       {"u":"%7B…"}                → envelope do dadosCG() da extension
       {"f0":"…"} / {…}            → JSON cru (Client com "Send as JSON", casparcg-connection)
       <templateData>…             → XML, o PADRÃO do CasparCG Client (f0, f1…) */
  function interpretar(str) {
    if (str == null) return {};
    if (typeof str === "object") return str;
    var s = String(str).trim();
    if (!s) return {};
    try {
      if (s.charAt(0) === "<") {
        var doc = new DOMParser().parseFromString(s, "application/xml");
        var out = {};
        var comps = doc.getElementsByTagName("componentData");
        for (var i = 0; i < comps.length; i++) {
          var d = comps[i].querySelector('data[id="text"]') || comps[i].querySelector("data");
          out[comps[i].getAttribute("id")] = d ? d.getAttribute("value") : "";
        }
        return out;
      }
      var obj = JSON.parse(s);
      if (obj && typeof obj.u === "string" && Object.keys(obj).length === 1) {
        return JSON.parse(decodeURIComponent(obj.u));
      }
      return obj;
    } catch (e) {
      avisar("update() com dado ilegível — ignorado: " + s.slice(0, 120) + " (" + e.message + ")");
      return null;
    }
  }

  function chamar(nome, arg) {
    if (!ganchos) {
      fila.push([nome, arg]);
      return;
    }
    var fn = ganchos[nome];
    if (typeof fn !== "function") return;
    try {
      return fn(arg);
    } catch (e) {
      // Uma exceção aqui não pode matar a peça no ar: loga e segue.
      avisar(nome + "() estourou: " + e.message);
    }
  }

  window.update = function (str) {
    var d = interpretar(str);
    if (d) chamar("update", d);
  };

  window.play = function () {
    if (!arPeloCG) return avisar("CG PLAY ignorado: o ar desta peça é do replicant (abra com ?ar=cg para o Caspar mandar)");
    chamar("play");
  };

  window.stop = function () {
    if (!arPeloCG) return avisar("CG STOP ignorado: o ar desta peça é do replicant");
    return chamar("stop");
  };

  window.next = function () {
    chamar("next");
  };

  /* CG REMOVE: sai animando e SÓ DEPOIS fecha o navegador. Sem isto o
     nativo corta a peça seca, no meio do quadro. `stop` da peça devolve a
     timeline do GSAP, que é thenable. O nativo deixa a camada ocupada por um
     produtor morto: a extension ainda manda `CLEAR ch-camada` para liberar. */
  window.remove = function () {
    var saida = arPeloCG ? chamar("stop") : null;
    Promise.resolve(saida).then(function () {
      if (removeNativo) removeNativo();
    });
  };

  window.CASPAR = {
    noCaspar: noCaspar,
    arPeloCG: arPeloCG,
    interpretar: interpretar,
    /* A peça chama UMA vez, quando o boot terminou (fontes + plates
       decodificadas). As chamadas que chegaram antes rodam agora, em ordem. */
    ligar: function (g) {
      ganchos = g || {};
      var pend = fila;
      fila = [];
      for (var i = 0; i < pend.length; i++) chamar(pend[i][0], pend[i][1]);
    },
  };
})();
