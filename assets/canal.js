/* ---------------------------------------------------------------------------
   canal.js — página no canal que NÃO está recebendo comandos fica CONGELADA
   ---------------------------------------------------------------------------
   Os gráficos ficam carregados nos DOIS canais do Caspar (programa e teste).
   O botão de saída só troca para qual canal os comandos vão — o outro segue
   exatamente como estava (decisão da produção, 2026-10-03: teste é PREVIEW,
   apertar não pode resetar o que está no ar).

   Só que os replicants são um só: sem isto, ensaiar um LT no canal 2
   acenderia a mesma barra no programa. Então a página carregada pelo Caspar
   (`?caspar=<canal>`) só repassa os `change` quando o canal dela é o
   DB_CASPAR.canalVivo. Fora disso guarda o último valor. Quando o canal
   volta a ser o vivo: entrega (o canal de teste espelha o programa ao entrar
   em teste) ou, com DB_CASPAR.descartar, JOGA FORA (volta ao programa: o
   ensaio nunca vai ao ar).

   Fora do Caspar (navegador, vMix, ?dev=1) não faz nada. Nem com `?livre=1`:
   o canal FS_CAM (cfg.caspar.fsCam, 2026-11-12) não tem teste nem programa,
   é sempre vivo — congelado ali, os nomes nunca mudariam.
   Carregar ANTES de qualquer script que chame nodecg.Replicant.
   ------------------------------------------------------------------------- */
(function () {
	var qs = new URLSearchParams(location.search);
	var meu = Number(qs.get("caspar")) || 0;
	if (!meu || qs.has("livre") || typeof nodecg === "undefined") return;

	var vivo = null; // até o DB_CASPAR chegar, ninguém recebe nada
	var ouvintes = [];
	var clonar = function (v) {
		return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
	};

	function soltar() {
		ouvintes.forEach(function (o) {
			if (!o.pendente) return;
			o.pendente = false;
			o.fn(o.novo, o.ultimo);
			o.ultimo = o.novo;
		});
	}

	var original = nodecg.Replicant.bind(nodecg);
	var DB_CASPAR = original("DB_CASPAR");
	DB_CASPAR.on("change", function (v) {
		vivo = (v && v.canalVivo) || null;
		if (vivo !== meu) return;
		if (v.descartar) {
			// volta ao programa: o que acumulou foi ensaio — o ar não recebe
			ouvintes.forEach(function (o) { o.pendente = false; });
		} else soltar();
	});

	nodecg.Replicant = function () {
		var r = original.apply(null, arguments);
		if (r.__canal) return r;
		r.__canal = true;
		var on = r.on.bind(r);
		r.on = function (evento, fn) {
			if (evento !== "change") return on(evento, fn);
			var o = { fn: fn, pendente: false };
			ouvintes.push(o);
			return on(evento, function (novo) {
				if (vivo === meu) {
					fn(novo, o.ultimo);
					o.ultimo = clonar(novo);
				} else {
					o.pendente = true;
					o.novo = clonar(novo);
				}
			});
		};
		return r;
	};
})();
