/* ---------------------------------------------------------------------------
   video.js — a arte da peça vinda de um .webm em loop, e não de um PNG.
   ---------------------------------------------------------------------------
   Substitui o par `background-image` + `new Image()` das plates estáticas nas
   peças lt_*: o motion entregou a arte de cada lower third como VP9 com alfa,
   10s exatos, canvas cheio 1920x1080.

   🚨 ISTO É CÓDIGO DE AR. Roda em toda peça lt_ ao mesmo tempo, dentro de uma
   browser source do vMix. Nenhuma função aqui rejeita promessa nem estoura
   exceção: um vídeo que não carrega vira log e a peça CONTINUA entrando — sem
   arte, mas com o texto legível. Travar a entrada porque o webm falhou seria
   trocar "barra sem fundo" por "nada no ar", que é estritamente pior.

   ---------------------------------------------------------------------------
   AS QUATRO ARMADILHAS, e as quatro custam ar:

   1. VÍDEO NÃO-MUDO NUNCA TOCA. O Chrome bloqueia autoplay com som, e uma
      browser source não tem gesto de usuário para desbloquear. Sem `muted` a
      peça vai ao ar CONGELADA no frame 0 e não há erro visível — só uma barra
      parada que parece um PNG. Por isso `muted` e `playsinline` são forçados
      aqui no código, e não confiados ao atributo do HTML: um atributo é fácil
      de alguém remover "porque não tem áudio mesmo".

   2. `loadeddata` NÃO BASTA. Ele promete só o PRIMEIRO frame decodificado. Um
      loop de 10s que entra com 1 frame em buffer engasga no meio da animação de
      entrada — e engasgo no ar lê como "travou". O evento certo é
      `canplaythrough`, que é o que este arquivo espera.

   3. MAS `canplaythrough` PODE NUNCA DISPARAR. Com a rede ruim, ou com o
      arquivo em cache e o Chrome decidindo que já resolveu antes de a gente
      assinar o evento, a promessa ficaria pendente para sempre e a peça nunca
      entraria. Por isso há DUAS saídas além dele: o `readyState` conferido na
      hora (para o caso do cache) e um teto de tempo (para o caso da rede).
      Passar do teto não é erro: é degradar para "entra com o que tem".

   4. `play()` DEVOLVE PROMESSA QUE REJEITA. `NotAllowedError` quando a política
      de autoplay barra, `AbortError` quando um `pause()` chega no meio. As duas
      são normais na operação (PLAY/OUT rápido) e nenhuma pode derrubar o
      handler da peça.

   ---------------------------------------------------------------------------
   🚨 A REGRA DO RECORTE — POR QUE TODO `<video>` DE LT TEM `clip-path`.

   Esta é a regra de PERFORMANCE do kit, e ela mora aqui porque vale para toda
   peça que este arquivo carrega. Se você está pondo um webm novo num lt_, leia
   este bloco inteiro antes de escrever o CSS.

   O browser source do vMix não é o Chrome. É CEF em OFF-SCREEN RENDERING: não
   há compositing por GPU. A página é rasterizada para um bitmap em memória de
   SISTEMA e entregue ao vMix quadro a quadro, com a lista de retângulos sujos.
   Ou seja o que custa não é "a placa de vídeo dá conta" — é a ÁREA que precisa
   ser repintada e recopiada a cada quadro.

   E aqui está o problema que isso cria: a arte de LT vem em canvas CHEIO
   (1920×1080) com a barra ocupando um cantinho e todo o resto em alfa zero. O
   Chromium não sabe que o resto é vazio. Um `<video>` de 1920×1080 tocando em
   loop é uma camada de 1920×1080 que se declara suja a cada frame do vídeo —
   2,07 milhões de pixels, 24 vezes por segundo, PARADO NO AR, sem nada se
   mexendo na tela. É exatamente o relato que aparece no fórum do vMix: "mesmo
   depois que o L3 congela e fica lá, a GPU continua no talo".

   Isso é o que faz a saída engasgar. Durante o slide, a região suja é a UNIÃO
   da posição velha com a nova — o quadro inteiro — enquanto o fade ainda pede
   uma mistura de alfa por cima. Some ao loop do vídeo e a saída disputa o
   orçamento de quadro justamente no movimento em que o espectador está olhando.

   O conserto é declarar ao Chromium onde a arte REALMENTE está:

       #arte { clip-path: inset(<topo>px <dir>px <base>px <esq>px); }

   Um `inset()` sem raio vira um clip retangular puro (não vira máscara, não
   custa nada em pintura) e ele BOUNDS a região suja da camada. A área por
   quadro cai de 2,07 Mpx para a caixa da arte — entre 13× e 80× menos,
   dependendo da peça.

   TRÊS COISAS QUE FAZEM ISSO DAR ERRADO SE FOREM IGNORADAS:

   · As coordenadas são de CANVAS, não da caixa do elemento. Todo `<video>` do
     kit é 1920×1080 deslocado pelo negativo da âncora acumulada, justamente
     para cair em 0,0 do stage — então o sistema de coordenadas local do vídeo
     JÁ É o canvas. É o que permite a mesma linha funcionar em peça ancorada
     (lt_single, lt_metaLike) e em peça de canvas cheio (lt_hashtag).

   · 🚨 A caixa sai da UNIÃO da bbox de alfa sobre TODOS OS 240 FRAMES do loop.
     Não é um frame, e não é uma amostragem — e isso custou uma rodada inteira
     de teste para aprender.

     A primeira tentativa mediu a 3fps (30 amostras dos 10s), o que parece
     folgado e não é. Comparado contra os 240 frames de verdade:

       l3_winner ..... 3fps disse x0 = 22.  A verdade é x0 = 0 (o spray chega
                       a encostar na borda do quadro). A caixa derivada do
                       3fps decepava 18px de arte.
       l3_metaLike ... 3fps disse y0 = 39.  A verdade é y0 = 32. Cortava 3px
                       do topo do medalhão no pico do pulso.
       l3_single ..... 3fps disse y0 = 843. A verdade é y0 = 839.

     O motivo é que o extremo de um float dura POUCOS FRAMES: amostrar 1 em 8
     tem grande chance de cair sempre fora dele. E o defeito resultante é o
     pior tipo — a arte some por 2 ou 3 quadros uma vez a cada dez segundos,
     no ar, e ninguém liga o fio piscando à caixa de recorte.

     Então: meça `fps=24` (todo frame), com limiar de alfa em 1/255 para não
     comer a franja de antialiasing, e some 8px de folga em cada lado. A folga
     não é preguiça de medir — é o que absorve reexport do motion com a arte
     alguns pixels maior, que acontece toda temporada.

     O script está no scratchpad (`bbox.js`); reexecute quando a arte mudar.

   · `overflow: hidden` NÃO serve no lugar disto. Várias peças ancoram o vídeo
     numa caixa do tamanho da PLATE (o l3_single num 566×175), e a arte em
     movimento vaza essa caixa de propósito. `overflow` recortaria pela caixa
     errada; o `clip-path` recorta pela caixa MEDIDA, que é maior.

   ⚠️ E o que este recorte NÃO resolve: o DECODE. O VP9 com alfa continua sendo
   decodificado em 1920×1080 mesmo com 95% de pixel vazio. Cortar os webm para
   a bbox no ffmpeg cortaria isso junto — é o próximo degrau, e custa
   reexportar a arte e remendar as âncoras. Fica registrado, não feito.
   ------------------------------------------------------------------------- */
(function (global) {
	"use strict";

	/* Teto da espera por `canplaythrough`. 4s é folgado para arquivo LOCAL —
	   medido: o maior do kit (l3_picksBans.webm, 3,0MB) carrega em muito menos
	   que isso servido pelo NodeCG na mesma máquina. O teto existe para a rede
	   patológica, não para o caso normal; se ele estiver sendo atingido em
	   operação, o problema é o servidor, e o log abaixo é que vai dizer isso. */
	var TETO_MS = 4000;

	function log(nivel, msg) {
		if (typeof nodecg !== "undefined" && nodecg.log && nodecg.log[nivel]) nodecg.log[nivel]("[video] " + msg);
		else if (console[nivel]) console[nivel]("[video] " + msg);
	}

	/* -----------------------------------------------------------------------
	   preparar(el, url) — carrega o webm e deixa o elemento pronto para tocar.

	   Chame UMA vez, no boot da peça, ANTES de assinar o replicant — mesma regra
	   das plates em fs_vs.html. Devolve `true` se o vídeo está pronto para
	   pintar, `false` se a peça vai ao ar sem ele. Nunca rejeita.
	   --------------------------------------------------------------------- */
	function preparar(el, url) {
		if (!el || !url) return Promise.resolve(false);

		/* Forçados aqui, não no HTML — ver armadilha 1. `loop` também: o pedido
		   da produção é que TODA peça lt_ rode em loop contínuo. (Peça com
		   entrada/hold/saída no vídeo — utils/motion.js — desliga o loop logo
		   depois: lá quem repete é o motion.js, só o trecho do hold.) */
		el.muted = true;
		el.defaultMuted = true;
		el.loop = true;
		el.playsInline = true;
		el.setAttribute("playsinline", "");
		el.setAttribute("muted", "");
		el.preload = "auto";

		el.src = url;
		el.load();

		return new Promise(function (resolver) {
			var resolvido = false;
			function pronto(ok, porque) {
				if (resolvido) return;
				resolvido = true;
				limpar();
				if (!ok) log("error", porque);
				resolver(ok);
			}

			function aoPoder() {
				pronto(true, "");
			}
			function aoFalhar() {
				/* Arte versionada no bundle: se sumiu, alguém quebrou o bundle, e
				   isso é erro ALTO — a peça vai ao ar sem fundo. Mesmo critério das
				   plates em fs_vs.html. */
				pronto(false, url + " não carregou — a peça vai ao ar sem a arte");
			}
			function limpar() {
				el.removeEventListener("canplaythrough", aoPoder);
				el.removeEventListener("error", aoFalhar);
				clearTimeout(timer);
			}

			el.addEventListener("canplaythrough", aoPoder);
			el.addEventListener("error", aoFalhar);

			/* Saída do cache (armadilha 3): se o Chrome já tinha o arquivo, o
			   `canplaythrough` pode ter passado antes deste addEventListener. O
			   readyState é a verdade no instante presente. HAVE_ENOUGH_DATA === 4. */
			if (el.readyState >= 4) pronto(true, "");

			/* Saída do teto (armadilha 3). Não é erro de arquivo, então é `warn` e
			   não `error`: o vídeo pode muito bem terminar de carregar logo depois
			   e tocar normalmente — só não deu tempo de PROVAR isso antes do ar. */
			var timer = setTimeout(function () {
				if (resolvido) return;
				resolvido = true;
				limpar();
				log("warn", url + " não ficou pronto em " + TETO_MS + "ms (readyState " + el.readyState + ") — entrando assim mesmo");
				resolver(false);
			}, TETO_MS);
		});
	}

	/* -----------------------------------------------------------------------
	   tocar(el) — garante que o vídeo está RODANDO, e só então devolve.

	   É o que a peça espera antes de rodar a timeline de entrada: sem isto a
	   barra desliza para dentro do quadro com o primeiro frame congelado e o
	   loop só começa depois, o que no ar lê como engasgo.

	   Nunca rejeita (armadilha 4). Se o play foi barrado, a peça entra mesmo
	   assim — com a arte parada, que ainda é melhor que sem arte.
	   --------------------------------------------------------------------- */
	function tocar(el) {
		if (!el) return Promise.resolve(false);
		var p;
		try {
			p = el.play();
		} catch (e) {
			log("warn", "play() estourou: " + e.message);
			return Promise.resolve(false);
		}
		/* Navegador antigo devolve undefined em vez de promessa. */
		if (!p || typeof p.then !== "function") return Promise.resolve(true);
		return p.then(
			function () {
				return true;
			},
			function (e) {
				/* AbortError é ROTINA: acontece quando um OUT (que chama parar())
				   chega antes de o play() resolver — PLAY/OUT rápido no painel. Não
				   polui o log com isso. */
				if (e && e.name === "AbortError") return false;
				log("warn", "play() barrado (" + (e && e.name) + ") — a arte entra parada");
				return false;
			},
		);
	}

	/* -----------------------------------------------------------------------
	   parar(el) — pausa e rebobina, para a próxima entrada começar do frame 0.

	   Chamado no `onComplete` da saída, nunca no início dela: pausar enquanto a
	   peça ainda está saindo do quadro congela a arte à vista do espectador.

	   Por que pausar e não deixar rodando: são até 7 peças lt_ carregadas ao
	   mesmo tempo, cada uma decodificando VP9 com alfa a 1920x1080. Deixar todas
	   girando fora do ar gasta CPU da máquina de transmissão sem nada aparecer
	   na tela. Como o arquivo já está inteiro em buffer, o `tocar()` da próxima
	   entrada volta a rodar no mesmo quadro.
	   --------------------------------------------------------------------- */
	function parar(el) {
		if (!el) return;
		try {
			el.pause();
			el.currentTime = 0;
		} catch (e) {
			/* `currentTime` pode estourar se a mídia não carregou. Silencioso de
			   propósito: parar uma peça que nunca entrou não é evento. */
		}
	}

	/* Estado legível para a tela de dev da peça. Mostra o que o ELEMENTO está
	   fazendo, não o que a peça pediu — é a diferença entre "mandei tocar" e
	   "está tocando", e ao vivo só a segunda responde alguma coisa. */
	function diag(el) {
		if (!el) return "—";
		if (!el.src) return "sem src";
		var st = el.paused ? "pausado" : "rodando";
		var dur = isFinite(el.duration) ? el.duration.toFixed(2) + "s" : "?";
		return st + " · " + el.videoWidth + "×" + el.videoHeight + " · t=" + el.currentTime.toFixed(1) + "/" + dur + " · rs=" + el.readyState;
	}

	global.VIDEO = {
		preparar: preparar,
		tocar: tocar,
		parar: parar,
		diag: diag,
		TETO_MS: TETO_MS,
	};
})(window);
