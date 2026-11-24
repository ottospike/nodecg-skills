/* ---------------------------------------------------------------------------
   motion.js — peça cuja ENTRADA, HOLD e SAÍDA vêm desenhadas no webm da Motion.
   ---------------------------------------------------------------------------
   Desde a entrega de 2026-11-08 cada L3 é UM arquivo de 10s:

       0 ──── inFim ─── loopA ═══════ loopB ─── outIni ──── fim ── 240
         ENTRADA        (hold, com o brilho)      SAÍDA      vazio
                        └── repete ──┘

   Quem toca os trechos é este arquivo, e o TEXTO (HTML, dado vivo) é movido
   quadro a quadro pela TRILHA: a caixa de alfa da arte em cada quadro, medida
   pelo scripts/motion/aplicar.mjs e gravada em <arte>.trilha.json. O relógio
   é o do VÍDEO (requestVideoFrameCallback): texto e arte não têm como se
   desencontrar, nem com o Caspar engasgando — só existe um relógio.

   Leia docs/animacao-motion-lt.md §6 antes de mexer.

   USO NA PEÇA:

     var M = MOTION.criar({
       video: arteEl,
       src: "assets/l3/l3_single/l3_single.webm",     // o VIDEO.preparar é feito aqui
       trilha: "assets/l3/l3_single/l3_single.trilha.json",
       grupos: [
         // texto que DESLIZA para fora de trás do emote: segue a borda x2 da
         // faixa "vermelha"; a janela (estática) esconde o que ainda está
         // atrás do emote
         { el: nomeGrupo, entrada: { modo: "borda", banda: "vermelha", borda: "x2" } },
         // texto que escala junto com a placa inteira (o padrão)
         { el: outroGrupo },
       ],
       saidaHtml: function () { ... return promessa },  // só peça SEM saída no vídeo
       aoMudar: pintarDiag,
     });
     M.pronto.then(...)      // trilha + vídeo carregados; nunca rejeita
     M.entrar()              // toca do quadro 0
     M.sair().then(fn)       // espera um quadro quieto, toca a saída, resolve no fim
     M.pular(visivel)        // estado sem animação (reload com a peça no ar)

   🚨 REGRA DOS GRUPOS: o `el` de um grupo é um container de FRAME CHEIO
   (position:absolute; inset:0) com os campos dentro em coordenada de canvas.
   O transform é aplicado com origem 0 0, então a matemática da trilha (que é
   em canvas) vale direto. Um grupo que não é frame cheio sai deslocado.

   MODOS de um grupo (na entrada e na saída; o padrão é "caixa"/"full"):
     caixa  mapeia a caixa de repouso na caixa do quadro (escala por eixo +
            deslocamento). Serve para pop, crescer/encolher, subir.
     borda  só desloca, seguindo UMA borda da faixa (x1, x2, y1, y2). É a
            barra que desliza de trás do emote: a caixa da faixa cresce, mas
            o texto não escala, ele anda com a ponta da barra.
   Faixa sem arte no quadro (null) = o grupo fica invisível nesse quadro.

   🚨 NADA VAZA DEPOIS DA SAÍDA (2026-11-09, exigência da produção). Três travas,
   independentes do vídeo obedecer:
     1. fora do ar o <video> fica com visibility:hidden — o quadro 0 é vazio,
        mas um seek que não terminou ainda mostra o último quadro decodificado;
     2. na ENTRADA o vídeo só reaparece quando o quadro apresentado já é do
        começo (≤ inFim) — nunca um resto da saída anterior;
     3. CÃO DE GUARDA: toda saída tem prazo (espera do quieto + duração da
        saída + folga). Venceu, a peça é apagada na marra, travada ou não.

   FLICKER (2026-11-09): a trilha é medida no alfa e o brilho mexe na borda
   ±2px no fim da entrada — o texto tremia junto. `suavizar` encosta no
   repouso todo valor a ≤ TOL px dele perto da emenda e tapa quadro sem
   faixa entre dois com faixa. O estilo só é escrito quando muda, e os grupos
   têm camada própria (will-change): mover não repinta máscara nem texto.

   🚨 CÓDIGO DE AR, mesmas regras do video.js: nada aqui rejeita promessa nem
   estoura. Trilha que não carrega = a peça toca o vídeo sem mover o texto
   (fica parado no repouso), e o erro vai pro log.
   ------------------------------------------------------------------------- */
(function (global) {
	"use strict";

	/* Espera máxima por um quadro QUIETO antes de pular para a saída. O
	   brilho da barra dura ~1,5s; esperar mais que isso já parece botão que
	   não respondeu. Passou do teto, pula assim mesmo. */
	var ESPERA_MAX_S = 1.4;

	function log(nivel, msg) {
		if (typeof nodecg !== "undefined" && nodecg.log && nodecg.log[nivel]) nodecg.log[nivel]("[motion] " + msg);
		else if (console[nivel]) console[nivel]("[motion] " + msg);
	}

	var BORDA = { x1: 0, y1: 1, x2: 2, y2: 3 };
	var TOL = 2; // px: tremor do brilho na borda medida (ver FLICKER)
	var FOLGA_S = 1.2; // cão de guarda: além da espera + duração da saída

	/* Limpa a trilha (em lugar) — ver FLICKER no cabeçalho. */
	function encostar(L, de, passo, R) {
		var feito = [false, false, false, false];
		for (var f = de; f >= 0 && f < L.length && L[f]; f += passo)
			for (var c = 0; c < 4; c++) {
				if (feito[c]) continue;
				if (Math.abs(L[f][c] - R[c]) <= TOL) L[f][c] = R[c]; else feito[c] = true;
			}
	}
	function suavizar(t) {
		if (!t || !t.full) return;
		var s = t.seg || {};
		var listas = { full: t.full };
		Object.keys(t.bandas || {}).forEach(function (k) { listas[k] = t.bandas[k]; });
		Object.keys(listas).forEach(function (nome) {
			var L = listas[nome];
			for (var i = 1; i < L.length - 1; i++) if (!L[i] && L[i - 1] && L[i + 1]) L[i] = L[i - 1].slice();
			/* Entrada: da emenda (inFim) para trás; saída: de outIni para frente. */
			if (t.refIn && t.refIn[nome] && s.inFim) encostar(L, s.inFim - 1, -1, t.refIn[nome]);
			if (t.refOut && t.refOut[nome] && s.outIni != null) encostar(L, s.outMov != null ? s.outMov : s.outIni, 1, t.refOut[nome]);
		});
	}

	function criar(o) {
		var video = o.video;
		var grupos = o.grupos || [];
		var t = null; // a trilha
		var fase = "fora"; // fora | entrando | hold | saindo
		/* FASE PARA O NODECG (2026-11-10): o showreel espera as animações de
		   verdade (entrada até o hold, saída até "fora") em vez de cronômetro —
		   a saída do vídeo espera um quadro quieto e dura o que durar. Só a
		   página carregada pelo Caspar (?caspar=N) avisa, com o canal dela. */
		var CANAL = Number(new URLSearchParams(location.search).get("caspar")) || 0;
		var PECA = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
		var avisada = null;
		function avisar() {
			if (o.aoMudar) o.aoMudar();
			/* Deslize do HTML ainda correndo: para fora, ainda é entrada. */
			var f = fase === "hold" && deslizando ? "entrando" : fase;
			if (f === avisada) return;
			avisada = f;
			if (CANAL && typeof nodecg !== "undefined" && nodecg.sendMessage) {
				try { nodecg.sendMessage("motionFase", { peca: PECA, canal: CANAL, fase: f }); } catch (e) { /* sem socket: o showreel cai no prazo */ }
			}
		}
		var pedidoSaida = false, esperaDesde = 0;
		function duracaoSaida() {
			var s = seg();
			/* continua: o pior caso é o hold dar uma volta inteira até o c. */
			if (s.continua) return (s.loopB - s.loopA) + (s.fim - s.outIni);
			return (s.fim || 240) - s.outIni;
		}
		var resolverSaida = null;
		var ultimoQuadro = -1;
		var cb = null; // handle do rVFC/rAF
		var temRVFC = !!(video && "requestVideoFrameCallback" in HTMLVideoElement.prototype);
		var guarda = null; // cão de guarda da saída (trava 3)
		var mostrarAte = null; // segurança da trava 2

		/* DESLIZE (2026-11-09): a Motion devolveu Winner, Text e Hashtag como
		   HOLD PURO (arte cheia do quadro 0 ao 239, sem entrada nem saída), a
		   pedido do cliente: "a antiga era eles entrando da esquerda pra
		   direita". Quem anima então é o HTML, como antes da entrega de 11-08:
		   o container (`deslize.el`) entra de `fora` px à esquerda e sai para lá.
		   Só vale quando a TRILHA diz que o vídeo não tem o trecho — se a Motion
		   mandar de novo com entrada/saída, o vídeo volta a mandar sozinho. */
		var D = o.deslize ? Object.assign({ fora: -560, entra: 0.55, fade: 0.28, sai: 0.4 }, o.deslize) : null;
		var tlD = null, deslizando = false;
		function semEntrada() {
			var s = seg();
			return !!t && (s.inFim || 0) <= Math.round((3 * ((t && t.fps) || 24)) / 24);
		}
		function deslizePor(v) {
			if (!D || !global.gsap) return;
			if (tlD) { tlD.kill(); tlD = null; }
			deslizando = false;
			gsap.set(D.el, { x: v ? 0 : D.fora, opacity: v ? 1 : 0 });
		}
		function deslizeEntra() {
			if (!D || !global.gsap) return;
			if (tlD) tlD.kill();
			deslizando = true;
			tlD = gsap.timeline({ onComplete: function () { deslizando = false; avisar(); } });
			tlD.to(D.el, { x: 0, duration: D.entra, ease: "expo.out" }, 0);
			tlD.to(D.el, { opacity: 1, duration: D.fade, ease: "power1.out" }, 0);
		}
		function deslizeSai() {
			if (!D || !global.gsap) return null;
			if (tlD) tlD.kill();
			deslizando = false;
			tlD = gsap.timeline();
			tlD.to(D.el, { x: D.fora, duration: D.sai, ease: "power2.in" }, 0);
			tlD.to(D.el, { opacity: 0, duration: D.sai, ease: "power1.in" }, 0);
			return tlD;
		}

		/* TELA (2026-11-10, "as fotos estão desyncadas, a entrada laga"): o
		   HTML por cima do vídeo andava UM quadro de tela atrás da arte — o
		   <video> pinta pelo compositor, o transform do texto só no próximo
		   desenho. Com `o.tela` (um <canvas>), o quadro do vídeo é DESENHADO no
		   canvas no mesmo tique em que os grupos se movem: arte e HTML mudam no
		   mesmo quadro de tela. O <video> segue tocando (é o relógio), invisível. */
		var tela = o.tela || null, ctxTela = tela ? tela.getContext("2d") : null, recTela = null;
		if (tela && video) video.style.opacity = "0";
		function desenharTela() {
			if (!ctxTela || !recTela) return;
			var w = recTela[2] - recTela[0], h = recTela[3] - recTela[1];
			ctxTela.clearRect(0, 0, w, h);
			try { ctxTela.drawImage(video, recTela[0], recTela[1], w, h, 0, 0, w, h); } catch (e) { /* sem quadro ainda */ }
		}
		/* Trava 1: fora do ar o vídeo não pinta. */
		function videoVisivel(v) {
			if (video) video.style.visibility = v ? "" : "hidden";
			if (tela) tela.style.visibility = v ? "" : "hidden";
		}
		videoVisivel(false);
		/* O vídeo acabou sem o tique ver o último quadro da saída (o Caspar
		   pula quadros; depois do `ended` o rVFC não chama mais): encerra aqui. */
		if (video) video.addEventListener("ended", function () { if (fase === "saindo") terminarSaida(); });
		/* Camada própria por grupo: o transform por quadro só recompõe. */
		grupos.forEach(function (g) { g.el.style.willChange = "transform, opacity"; g.el.style.transformOrigin = "0 0"; });

		/* SEM CACHE (2026-11-10): trilha e vídeo SEMPRE do disco, com a mesma
		   marca. Um cache (CEF do Caspar, navegador) que devolvesse a trilha
		   velha com o vídeo novo — ou o contrário — desencontra tudo: a saída
		   do Palpite saía pelo HTML (fade + desce) porque a página tinha uma
		   trilha antiga, sem saída no vídeo. São arquivos locais e pequenos. */
		var marca = Date.now().toString(36);
		function fresco(u) { return u + (u.indexOf("?") < 0 ? "?" : "&") + "v=" + marca; }
		var pronto = Promise.all([
			fetch(fresco(o.trilha), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) {
				t = j;
				suavizar(t);
				/* O recorte de PERFORMANCE do <video> (video.js, "A REGRA DO
				   RECORTE") sai da trilha: a união do alfa em TODOS os quadros,
				   inclusive o crescer da saída, que passa da caixa do hold. */
				var r = j.recorte;
				if (video && r) video.style.clipPath = "inset(" + r[1] + "px " + (1920 - r[2]) + "px " + (1080 - r[3]) + "px " + r[0] + "px)";
				if (tela && r) {
					recTela = r;
					tela.width = r[2] - r[0]; tela.height = r[3] - r[1];
					tela.style.cssText += ";position:absolute;left:" + r[0] + "px;top:" + r[1] + "px;width:" + (r[2] - r[0]) + "px;height:" + (r[3] - r[1]) + "px";
				}
				return true;
			}, function (e) {
				log("error", o.trilha + " não carregou (" + e.message + ") — o texto não acompanha a arte");
				return false;
			}),
			global.VIDEO ? VIDEO.preparar(video, fresco(o.src)) : Promise.resolve(false),
		]).then(function (r) {
			/* O video.js força loop=true (era o contrato do loop parado). Aqui o
			   loop é do HOLD, e quem faz é este arquivo. */
			if (video) video.loop = false;
			esconderGrupos();
			return { trilha: r[0], video: r[1] };
		});

		function seg() { return (t && t.seg) || {}; }

		/* ---------------- aplicar a trilha num quadro ---------------- */
		/* Escreve só quando muda: estilo reescrito a cada quadro ainda custa
		   recálculo no Caspar. */
		function por(g, op, tf) {
			if (g._op !== op) { g.el.style.opacity = op; g._op = op; }
			if (tf != null && g._tf !== tf) { g.el.style.transform = tf; g._tf = tf; }
		}
		function esconderGrupos() {
			grupos.forEach(function (g) { por(g, "0"); });
		}
		function repouso() {
			grupos.forEach(function (g) { por(g, "1", "none"); });
		}
		function caixaDe(nome, f) {
			if (!t) return undefined;
			if (nome === "full") return t.full[f];
			var b = t.bandas && t.bandas[nome];
			return b ? b[f] : undefined;
		}
		/* `qual` = "refIn" (entrada) ou "refOut" (saída): a caixa NA EMENDA do
		   trecho, para o texto chegar no repouso sem salto (ver aplicar.mjs). */
		function aplicarGrupo(g, modo, f, qual) {
			var nome = (modo && modo.banda) || "full";
			var refs = (t && t[qual]) || (t && t.ref) || {};
			var B = caixaDe(nome, f), R = refs[nome] || (t && t.ref[nome]);
			if (B === undefined || !R) return por(g, "1", "none");
			if (!B) return por(g, "0");
			if (modo && modo.modo === "borda") {
				var i = BORDA[modo.borda] != null ? BORDA[modo.borda] : 2;
				var d = B[i] - R[i];
				return por(g, "1", d === 0 ? "none" : i % 2 === 0 ? "translate(" + d + "px,0)" : "translate(0," + d + "px)");
			}
			var sx = (B[2] - B[0]) / (R[2] - R[0]), sy = (B[3] - B[1]) / (R[3] - R[1]);
			var tx = B[0] - sx * R[0], ty = B[1] - sy * R[1];
			if (sx === 1 && sy === 1 && tx === 0 && ty === 0) return por(g, "1", "none");
			por(g, "1", "matrix(" + sx.toFixed(4) + ",0,0," + sy.toFixed(4) + "," + tx.toFixed(2) + "," + ty.toFixed(2) + ")");
		}
		function aplicarQuadro(f) {
			if (!t) return;
			var s = seg();
			grupos.forEach(function (g) {
				if (f < s.inFim) aplicarGrupo(g, g.entrada, f, "refIn");
				/* Saída reversa (aplicar.mjs "saida": "reversa"): a saída é a entrada
				   de trás para frente, então o texto refaz o caminho da entrada. */
				/* Fusão do hold para o repouso (outIni..outMov-1): a arte quase não
				   se mexe, só o brilho some — o texto fica parado, não segue o brilho. */
				else if (s.outMov != null && f >= s.outIni && f < s.outMov) por(g, "1", "none");
				else if (s.outIni != null && f >= s.outIni) aplicarGrupo(g, g.saida || (s.saidaReversa ? g.entrada : null), f, "refOut");
				else por(g, "1", "none");
			});
		}

		/* ---------------- relógio: um tique por quadro do vídeo ---------------- */
		function quadroAgora(meta) {
			var tempo = meta && meta.mediaTime != null ? meta.mediaTime : video.currentTime;
			return Math.max(0, Math.min(((t && t.quadros) || 240) - 1, Math.round(tempo * ((t && t.fps) || 24))));
		}
		function irPara(f) {
			try { video.currentTime = (f + 0.1) / ((t && t.fps) || 24); } catch (e) { /* mídia sem buffer: o tique seguinte resolve */ }
		}
		function quieto(f) {
			var s = seg();
			if (!t || !t.quietos) return true;
			if (f < s.inFim) return false; // ainda entrando: termina a entrada antes
			for (var i = 0; i < t.quietos.length; i++) if (f >= t.quietos[i][0] && f <= t.quietos[i][1]) return true;
			return false;
		}
		function agendar() {
			if (!video || cb !== null) return;
			if (temRVFC) cb = video.requestVideoFrameCallback(function (agora, meta) { cb = null; tique(meta); });
			else cb = requestAnimationFrame(function () { cb = null; tique(null); });
		}
		function cancelar() {
			if (cb === null) return;
			if (temRVFC) video.cancelVideoFrameCallback(cb); else cancelAnimationFrame(cb);
			cb = null;
		}

		function tique(meta) {
			if (fase === "fora") return;
			var s = seg();
			var f = quadroAgora(meta);
			ultimoQuadro = f;
			ultimoTique = performance.now(); // o vigia da trava 3 lê isto

			/* Trava 2: entrando, o vídeo só aparece com um quadro do começo na
			   tela. Quadro velho (seek ainda não aplicado) = segue oculto, e o
			   texto também. */
			if (fase === "entrando" && video.style.visibility === "hidden") {
				if (f <= (s.inFim || 0)) mostrarVideo();
				else { esconderGrupos(); return agendar(); }
			}

			if (fase === "entrando" && f >= (s.inFim || 0)) {
				fase = "hold";
				avisar();
			}

			if (fase === "hold") {
				/* CONTINUA (saída reversa, aplicar.mjs): sem pulo. O OUT só tira o
				   "out hold point" — o vídeo não volta no loop e segue de onde está
				   até a saída, que vem logo depois do c no arquivo. */
				if (s.continua && f >= s.outIni && !pedidoSaida) {
					/* Sem OUT e já na saída = a busca do loop atrasou mais que a folga
					   de um quadro: volta ao hold (a peça nunca sai sozinha). */
					log("warn", "busca do loop atrasou (" + diag() + ") — de volta ao hold");
					irPara(s.loopA);
				} else if (s.continua && f >= s.outIni) {
					fase = "saindo";
					pedidoSaida = false;
					avisar();
				} else if (pedidoSaida && s.outIni != null && !s.continua) {
					var agora = performance.now() / 1000;
					if (quieto(f) || agora - esperaDesde > ESPERA_MAX_S) {
						fase = "saindo";
						pedidoSaida = false;
						irPara(s.outIni);
						if (video.paused) VIDEO.tocar(video);
						avisar();
						return agendar();
					}
				}
				if (s.estatico) {
					/* Hold parado: pausa no repouso (zero decode no ar). */
					if (!video.paused) video.pause();
				} else if (fase === "hold" && s.loopB != null && f >= s.loopB - 1 && !(s.continua && pedidoSaida)) {
					/* fase === "hold" de novo: se este tique acabou de virar "saindo"
					   (continua), voltar no loop desfaria a saída. */
					irPara(s.loopA);
				}
			}

			aplicarQuadro(f);
			desenharTela(); // mesmo tique dos grupos: arte e HTML juntos

			var fimSaida = (s.fim || 240) - 1;
			if (fase === "saindo" && (f >= fimSaida || video.ended)) return terminarSaida();
			agendar();
		}

		function mostrarVideo() {
			if (mostrarAte) { clearTimeout(mostrarAte); mostrarAte = null; }
			videoVisivel(true);
		}
		function desarmarGuarda() {
			if (guarda) { clearTimeout(guarda); guarda = null; }
			if (vigia) { clearInterval(vigia); vigia = null; }
		}
		/* Trava 3: prazo da saída, em segundos — e o VIGIA de travamento: da
		   ordem de saída em diante, um vídeo que fica MS_TRAVADO sem entregar
		   quadro é apagado na hora, sem esperar o prazo (quadro congelado na
		   tela é exatamente o vazamento). Medido no Caspar: travado no meio da
		   saída, só com o prazo, a peça ficava ~3s parada antes de sumir. */
		var MS_TRAVADO = 300;
		var ultimoTique = 0, vigia = null;
		function armarGuarda(prazo) {
			desarmarGuarda();
			ultimoTique = performance.now();
			guarda = setTimeout(function () {
				guarda = null;
				if (fase === "fora") return;
				log("warn", "saída passou do prazo (" + prazo.toFixed(1) + "s, " + diag() + ") — apagada na marra");
				terminarSaida();
			}, prazo * 1000);
			/* Peça sem saída no vídeo (saída HTML): o vídeo segue no hold e não
			   decide nada — só o prazo vale. */
			if (seg().outIni == null) return;
			vigia = setInterval(function () {
				if (fase === "fora") return desarmarGuarda();
				if (performance.now() - ultimoTique > MS_TRAVADO) {
					log("warn", "vídeo travou na saída (" + diag() + ") — apagada na hora");
					terminarSaida();
				}
			}, 50);
		}

		function terminarSaida() {
			fase = "fora";
			pedidoSaida = false;
			cancelar();
			desarmarGuarda();
			if (mostrarAte) { clearTimeout(mostrarAte); mostrarAte = null; }
			esconderGrupos();
			videoVisivel(false); // ANTES do parar: o seek para o 0 não é instantâneo
			VIDEO.parar(video); // quadro 0 = vazio: a arte some junto
			avisar();
			var r = resolverSaida; resolverSaida = null;
			if (r) r();
		}

		/* ---------------- API ---------------- */
		function entrar() {
			cancelar();
			desarmarGuarda();
			pedidoSaida = false;
			if (resolverSaida) { var r = resolverSaida; resolverSaida = null; r(); }
			esconderGrupos();
			videoVisivel(false); // volta no 1º quadro do começo (trava 2)
			fase = "entrando";
			var desliza = D && semEntrada();
			deslizePor(!desliza); // sem entrada no vídeo: começa fora, à esquerda
			irPara(0);
			avisar();
			/* Segurança da trava 2: sem tique (rVFC mudo), aparece em 300ms —
			   o seek para o 0 já assentou. */
			if (mostrarAte) clearTimeout(mostrarAte);
			mostrarAte = setTimeout(function () { mostrarAte = null; if (fase === "entrando" || fase === "hold") videoVisivel(true); }, 300);
			return VIDEO.tocar(video).then(function (ok) {
				if (fase !== "entrando" && fase !== "hold") return ok;
				/* A entrada do HTML espera o vídeo rodar (senão desliza com o
				   quadro congelado) — a mesma regra das páginas antigas. */
				if (desliza) { mostrarVideo(); deslizeEntra(); }
				if (fase !== "entrando") return ok;
				/* Sem trilha (falhou): o texto entra no repouso, sem acompanhar. */
				if (!t) { mostrarVideo(); repouso(); }
				agendar();
				return ok;
			});
		}

		function sair() {
			return new Promise(function (resolver) {
				if (fase === "fora") return resolver();
				if (resolverSaida) { var antigo = resolverSaida; resolverSaida = function () { antigo(); resolver(); }; }
				else resolverSaida = resolver;
				var s = seg();
				var fps = (t && t.fps) || 24;
				/* Peça sem saída no vídeo (L3_Palpite): a saída é do HTML. */
				if (s.outIni == null) {
					if (fase !== "saindo") armarGuarda(1.5);
					var feito = function () { if (fase !== "fora") terminarSaida(); };
					var p = o.saidaHtml ? o.saidaHtml() : deslizeSai();
					fase = "saindo";
					avisar();
					if (p && typeof p.then === "function") p.then(feito, feito);
					else if (p && typeof p.eventCallback === "function") p.eventCallback("onComplete", feito);
					else feito();
					return;
				}
				if (fase === "saindo") return; // já está saindo: só espera (a guarda já corre)
				if (!pedidoSaida) armarGuarda(ESPERA_MAX_S + duracaoSaida() / fps + FOLGA_S);
				pedidoSaida = true;
				esperaDesde = performance.now() / 1000;
				if (video.paused) VIDEO.tocar(video); // hold parado estava pausado
				agendar();
			});
		}

		function pular(visivel) {
			cancelar();
			desarmarGuarda();
			pedidoSaida = false;
			deslizePor(visivel);
			if (!visivel) {
				fase = "fora";
				esconderGrupos();
				videoVisivel(false);
				VIDEO.parar(video);
				avisar();
				if (resolverSaida) { var r = resolverSaida; resolverSaida = null; r(); }
				return;
			}
			var s = seg();
			fase = "hold";
			avisar();
			irPara(s.loopA != null ? s.loopA : s.inFim || 0);
			videoVisivel(true);
			repouso();
			if (s.estatico) return;
			VIDEO.tocar(video).then(agendar);
		}

		function diag() {
			var s = seg();
			return fase + " · q" + ultimoQuadro + (pedidoSaida ? " (esperando quieto)" : "") +
				(t ? " · in<" + s.inFim + " loop " + s.loopA + ".." + s.loopB + " out " + s.outIni + "→" + s.fim : " · SEM TRILHA") +
				(temRVFC ? "" : " · rAF");
		}

		return { pronto: pronto, entrar: entrar, sair: sair, pular: pular, diag: diag, fase: function () { return fase; }, trilha: function () { return t; } };
	}

	global.MOTION = { criar: criar, ESPERA_MAX_S: ESPERA_MAX_S };
})(window);
