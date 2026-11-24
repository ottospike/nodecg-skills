#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   aplicar.mjs — aplica uma entrega de MOTION (webm com entrada/hold/saída) no
   bundle: mede, reencoda com keyframes e grava a TRILHA que o texto segue.
   ---------------------------------------------------------------------------
   Uso (na pasta do bundle):
       node scripts/motion/aplicar.mjs            # todas as peças do pecas.json
       node scripts/motion/aplicar.mjs l3_single  # só as citadas
       node scripts/motion/aplicar.mjs --medir    # mede e imprime, não grava nada
       node scripts/motion/aplicar.mjs --trilha   # regrava só o .trilha.json

   POR QUE EXISTE (2026-11-08): a Motion passou a entregar cada L3 como UM
   arquivo de 10s com ENTRADA → HOLD → SAÍDA embutidos. O HTML precisa:
     1. saber onde cada trecho começa e termina (inFim, loopA/loopB, outIni);
     2. repetir o hold sem emenda (o brilho da barra tem período de 120
        quadros: o loop é o par de quadros mais parecido dentro do hold);
     3. pular para a saída sem cortar o brilho no meio (quadros "quietos");
     4. mover o TEXTO junto com a arte. O texto é HTML (dado vivo) e o vídeo
        não sabe dele, então a arte vira números: a caixa de alfa de cada
        faixa, quadro a quadro. utils/motion.js lê isso e move o texto.
   E o webm da Motion só tem keyframe em 0 e 5,333s: buscar o quadro 59 faria
   o decoder refazer 59 quadros VP9 com alfa num tique — engasgo no ar. Por
   isso a cópia do bundle é REENCODADA com keyframe exatamente em loopA e
   outIni (crf 18, a mesma receita de alfa do FS_REPLAY).

   Tudo que o script grava (por destino em `dst`):
     <nome>.webm           o vídeo reencodado
     <nome>.trilha.json    segmentos + caixas por quadro + recorte
   O arquivo anterior vai para _removidos/<data>/motion/<peça>/ na raiz do
   projeto. Rodar de novo com a mesma entrega dá o mesmo resultado.

   Depende só do ffmpeg do Caspar (Caspar-2.5.1/ffmpeg.exe, com libvpx-vp9).
   ------------------------------------------------------------------------- */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE = path.resolve(AQUI, "../..");
const PROJETO = path.resolve(BUNDLE, "../../..");
const cfg = JSON.parse(fs.readFileSync(path.join(AQUI, "pecas.json"), "utf8"));
const FFMPEG = path.resolve(AQUI, cfg.ffmpeg);
const FONTE = path.resolve(AQUI, cfg.fonte);
/* O fps vem de CADA ARQUIVO (ffprobe), não do pecas.json: a Motion pode
   reexportar a 60/59,94 (pedido de 2026-11-09 — 24 fps num canal 59,94 anda
   em cadência 2-3 e parece "low fps" no pop). As regras abaixo foram
   calibradas em quadros de 24 fps; `Q(n)` escala para o fps do arquivo. */
const FFPROBE = path.join(path.dirname(FFMPEG), "ffprobe.exe");
function fpsDe(src) {
	const r = spawnSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", src], { encoding: "utf8" });
	const [n, d] = (r.stdout || "").trim().split("/").map(Number);
	const f = d ? n / d : n;
	return f > 0 ? +f.toFixed(3) : cfg.fps || 24;
}

const args = process.argv.slice(2);
const SO_MEDIR = args.includes("--medir");
const SO_TRILHA = args.includes("--trilha");
const alvo = args.filter((a) => !a.startsWith("--"));
const pecas = Object.keys(cfg.pecas).filter((k) => !alvo.length || alvo.includes(k));

function ff(argv, binario = false) {
	const r = spawnSync(FFMPEG, ["-hide_banner", "-nostdin", ...argv], { maxBuffer: 1 << 30, encoding: binario ? "buffer" : "utf8" });
	if (r.status !== 0) throw new Error("ffmpeg falhou: " + (binario ? r.stderr.toString() : r.stderr).slice(-800));
	return r;
}

/* Caixa de alfa por quadro, numa região [x0,y0,x1,y1] do canvas (ou o
   quadro todo). Limiar 2/255: não come a franja de antialiasing, e o
   ruído de compressão no alfa zero fica abaixo dele. null = quadro vazio
   na região. */
function caixas(src, regiao) {
	const crop = regiao ? `crop=${regiao[2] - regiao[0]}:${regiao[3] - regiao[1]}:${regiao[0]}:${regiao[1]},` : "";
	const r = ff(["-c:v", "libvpx-vp9", "-i", src, "-vf", `alphaextract,${crop}cropdetect=limit=2:round=1:reset=1:skip=0`, "-f", "null", "-"]);
	const ox = regiao ? regiao[0] : 0, oy = regiao ? regiao[1] : 0;
	const out = [];
	for (const m of r.stderr.matchAll(/x1:(-?\d+) x2:(-?\d+) y1:(-?\d+) y2:(-?\d+)/g)) {
		const [x1, x2, y1, y2] = m.slice(1).map(Number);
		out.push(x2 < x1 || y2 < y1 ? null : [x1 + ox, y1 + oy, x2 + 1 + ox, y2 + 1 + oy]);
	}
	return out;
}

const igual = (a, b, tol = 1) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= tol);

function moda(lista) {
	const n = new Map();
	for (const c of lista) if (c) { const k = c.join(","); n.set(k, (n.get(k) || 0) + 1); }
	let melhor = null, q = 0;
	for (const [k, v] of n) if (v > q) { q = v; melhor = k; }
	return melhor ? melhor.split(",").map(Number) : null;
}

/* Quadros pequenos (1/4) da união da arte, RGBA, para comparar quadros. */
function quadrosPequenos(src, u) {
	const w = Math.ceil((u[2] - u[0]) / 4), h = Math.ceil((u[3] - u[1]) / 4);
	const r = ff(["-c:v", "libvpx-vp9", "-i", src, "-vf", `crop=${u[2] - u[0]}:${u[3] - u[1]}:${u[0]}:${u[1]},scale=${w}:${h},format=rgba`, "-f", "rawvideo", "-"], true);
	const tam = w * h * 4, n = Math.floor(r.stdout.length / tam);
	return Array.from({ length: n }, (_, i) => r.stdout.subarray(i * tam, (i + 1) * tam));
}
function mad(a, b) {
	let s = 0, n = 0;
	for (let i = 0; i < a.length; i += 7) { s += Math.abs(a[i] - b[i]); n++; }
	return s / n;
}
const mediana = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

function medir(nome, p, src = path.join(FONTE, p.src), forcarOut = null) {
	if (!fs.existsSync(src)) throw new Error(nome + ": não achei " + src);
	const FPS = fpsDe(src);
	const Q = (n) => Math.max(1, Math.round((n * FPS) / 24)); // n quadros a 24 fps → no fps do arquivo
	const full = caixas(src);
	const N = full.length;
	const bandas = {};
	for (const [b, reg] of Object.entries(p.bandas || {})) bandas[b] = caixas(src, reg);

	/* Pose de REPOUSO = a caixa mais comum (o hold). É contra ela que as
	   coordenadas do PSD valem, e é a referência de toda a trilha. */
	const ref = moda(full);
	/* inFim: primeiro quadro em repouso que continua em repouso por 3 quadros (a 24). */
	let inFim = full.findIndex((c, i) => { for (let d = 0; d <= Q(3); d++) if (!igual(full[i + d], ref)) return false; return true; });
	/* ...e cada FAIXA também assentou (2026-11-10): no L3_Single a caixa
	   inteira para no 22, mas a barra amarela cresce até o 28 — com o inFim
	   no 22 o @ pulava 10px no fim da entrada, e um loop que começasse ali
	   fazia a barra "recuar e voltar". Tolerância 2px (o brilho mexe a
	   borda); faixa que nunca assenta (a gema do L3_Palpite oscila ~12px no
	   topo) não segura o inFim: procura até 2s, senão fica o da caixa. */
	const listasBanda = Object.values(bandas);
	if (listasBanda.length && inFim >= 0) {
		const modas = listasBanda.map((l) => moda(l));
		const assentou = (i) => { for (let d = 0; d <= Q(3); d++) if (!listasBanda.every((l, k) => igual(l[i + d], modas[k], 2))) return false; return true; };
		for (let i = inFim; i <= inFim + Q(48) && i < N; i++) if (assentou(i)) { inFim = i; break; }
	}
	/* fim: depois do último quadro com arte. */
	let fim = N; while (fim > 0 && !full[fim - 1]) fim--;

	/* Diferença entre quadros VIZINHOS. É ela, e não a caixa, que acha a
	   saída: a caixa do L3_Text oscila 3px no hold (a aba do topo) e a do
	   L3_Social não muda de largura nunca (ele só desce). Na saída a
	   diferença sobe e não volta mais. */
	const u = full.reduce((a, c) => (c ? [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])] : a), [1920, 1080, 0, 0]);
	const q = quadrosPequenos(src, u);
	const viz = q.map((f, i) => (i + 1 < q.length ? mad(f, q[i + 1]) : 0));
	const medViz = mediana(viz.slice(inFim, fim - 1));
	const estatico = medViz < 0.15;
	/* outIni: a saída começa depois da ÚLTIMA sequência calma (≥ 8 quadros
	   seguidos com diferença de hold). Não basta voltar enquanto a diferença
	   está alta: a saída da temporada CRESCE, ASSENTA uns 4 quadros e só
	   então encolhe, e o assento parece hold. O começo da saída é lento
	   (ease-in): tira 3 quadros de margem. Uma cauda sem arte (fim < N) ou
	   com movimento é saída; parada até o último quadro = sem saída
	   (L3_Palpite). */
	const lim = Math.max(0.8, medViz * 2.2);
	let ini = fim - 1, calma = 0;
	for (let f = fim - 2; f > inFim; f--) {
		if (viz[f] <= lim) { if (++calma >= Q(8)) { ini = f + calma; break; } }
		else calma = 0;
	}
	const temSaida = forcarOut != null || fim < N || ini < fim - Q(4);
	const outIni = forcarOut != null ? forcarOut : temSaida ? Math.max(inFim + 1, ini - Q(3)) : null;
	const fimHold = outIni ?? N;
	if (SO_MEDIR) console.log(`   [${nome}] vizinhos 180..fim: ` + viz.slice(180, fim).map((v, i) => i + 180 + ":" + v.toFixed(1)).join(" "));

	/* Loop: o par (a, b) mais parecido com b − a entre 96 e 144 quadros
	   (o brilho desta temporada tem período 120). Toca a..b-1 e volta a `a`. */
	let loopA = null, loopB = null, loopErro = null;
	if (!estatico) {
		let melhor = Infinity;
		for (let a = inFim; a <= Math.min(inFim + Q(72), fimHold - Q(97)); a++)
			for (let b = a + Q(96); b <= Math.min(a + Q(144), fimHold - 1); b++) {
				const m = mad(q[a], q[b]);
				if (m < melhor) { melhor = m; loopA = a; loopB = b; }
			}
		loopErro = +melhor.toFixed(2);
	}

	/* Quietos: quadros do hold de onde dá para pular para outIni sem salto
	   visível (o brilho fora da barra). */
	let quietos = null;
	if (outIni != null && !estatico && loopA != null) {
		const d = [];
		/* Do fim da entrada (não do loopA): um OUT pode chegar logo depois do
		   PLAY, e o trecho inFim..loopA também tem brilho em algumas peças. */
		for (let f = inFim; f < loopB; f++) d.push([f, mad(q[f], q[outIni])]);
		let lim = Math.max(2.0, medViz * 3);
		let ok = d.filter(([, m]) => m <= lim).map(([f]) => f);
		if (ok.length < d.length * 0.15) ok = [...d].sort((x, y) => x[1] - y[1]).slice(0, Math.ceil(d.length * 0.3)).map(([f]) => f).sort((x, y) => x - y);
		quietos = faixas(ok);
	}

	const recorte = [Math.max(0, u[0] - 8), Math.max(0, u[1] - 8), Math.min(1920, u[2] + 8), Math.min(1080, u[3] + 8)];
	const refBandas = {};
	for (const [b, lista] of Object.entries(bandas)) {
		/* Repouso da faixa = a caixa dela no quadro de repouso mais comum. */
		refBandas[b] = moda(lista.slice(inFim, fimHold));
	}
	/* Referências das EMENDAS: a entrada mapeia contra a caixa no inFim e a
	   saída contra a caixa no outIni. Assim o texto não salta na troca de
	   trecho mesmo quando o hold oscila (o brilho da gema do L3_Palpite mexe
	   12px no topo da coluna; a aba do L3_Text, 3px). `ref` (a moda) fica
	   como fallback. */
	const naEmenda = (lista, f) => { if (f == null) return null; for (let d = 0; d < 6; d++) { if (lista[f - d]) return lista[f - d]; if (lista[f + d]) return lista[f + d]; } return null; };
	const refIn = { full: naEmenda(full, inFim) }, refOut = { full: naEmenda(full, outIni) };
	for (const [b, lista] of Object.entries(bandas)) { refIn[b] = naEmenda(lista, inFim); refOut[b] = naEmenda(lista, outIni); }
	return {
		versao: 2, fonte: p.src, medido: new Date().toISOString().slice(0, 10), fps: FPS, quadros: N,
		seg: { inFim, loopA, loopB, outIni, fim, estatico, saidaReversa: forcarOut != null },
		loopErro, difVizinhos: +medViz.toFixed(2), quietos,
		recorte, ref: { full: ref, ...refBandas }, refIn, refOut,
		full, bandas,
	};
}

function faixas(lista) {
	const r = [];
	for (const f of lista) { const u = r[r.length - 1]; if (u && f === u[1] + 1) u[1] = f; else r.push([f, f]); }
	return r;
}

function reencodar(src, dst, t) {
	const kf = [t.seg.loopA, t.seg.outIni, t.seg.inFim].filter((v) => v != null);
	const expr = "expr:" + kf.map((n) => `eq(n,${n})`).join("+");
	const tmp = dst + ".tmp.webm";
	ff(["-y", "-c:v", "libvpx-vp9", "-i", src, "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-crf", "18", "-b:v", "0",
		"-auto-alt-ref", "0", "-row-mt", "1", "-force_key_frames", expr, "-metadata:s:v:0", "alpha_mode=1", tmp]);
	/* Confere que os keyframes caíram onde pedimos — sem eles a busca engasga. */
	const pr = spawnSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0", tmp], { encoding: "utf8" });
	const kfs = pr.stdout.split("\n").filter((l) => l.includes("K")).map((l) => Math.round(parseFloat(l) * t.fps));
	const faltam = kf.filter((n) => !kfs.includes(n));
	if (faltam.length) throw new Error(path.basename(dst) + ": keyframe faltando em " + faltam.join(",") + " (tem " + kfs.join(",") + ")");
	return { tmp, kfs };
}

/* SAÍDA REVERSA ("saida": "reversa" no pecas.json — pedidos de 2026-11-10:
   saída = entrada ao contrário; "não pode flicar"; "sem salto: no OUT ele só
   tira o out hold point e deixa o vídeo prosseguir"; "leve erro de loop
   point no single"; "a saída do palpite está travada e anima coisas antes").

     0 ── inFim ── loopA ══ loop ══ loopB-1 │ FUNDE │ inFim-1 … 0
                     └────────◄──────────┘   ▲ out hold point

   · O LOOP é o da entrega (o par mais parecido do aplicar: costura do tamanho
     de um passo normal). Sem OUT, o motion.js volta de loopB-1 para loopA.
   · Com OUT, o vídeo SEGUE: logo depois de loopB-1 vêm FUNDE quadros em que
     o hold (o que tocaria a seguir) funde para a pose de repouso (o quadro
     inFim), e então a entrada de trás para frente. O 1º quadro da saída é a
     continuação do hold — não há pulo, e a saída não toca hold ao contrário
     (isso parecia travado).
   · seg.outMov: onde a entrada ao contrário começa. Antes dele (na fusão) o
     texto fica no repouso — senão seguiria o brilho e "animaria antes".
   O preço: o OUT espera o hold chegar em loopB-1 (até 1 volta, ~5s). */
const FUNDE = 6; // quadros a 24 fps

function conferirKf(arq, kf, fps) {
	const pr = spawnSync(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0", arq], { encoding: "utf8" });
	const kfs = pr.stdout.split("\n").filter((l) => l.includes("K")).map((l) => Math.round(parseFloat(l) * fps));
	const faltam = kf.filter((n) => !kfs.includes(n));
	if (faltam.length) throw new Error(path.basename(arq) + ": keyframe faltando em " + faltam.join(",") + " (tem " + kfs.join(",") + ")");
	return kfs;
}
function encodarRaw(argv, quadros) {
	return new Promise((ok, falha) => {
		const pr = spawn(FFMPEG, ["-hide_banner", "-nostdin", ...argv], { stdio: ["pipe", "ignore", "pipe"] });
		let err = "";
		pr.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
		pr.on("close", (c) => (c === 0 ? ok() : falha(new Error("ffmpeg falhou: " + err.slice(-800)))));
		(async () => {
			for (const b of quadros()) if (!pr.stdin.write(b)) await new Promise((r) => pr.stdin.once("drain", r));
			pr.stdin.end();
		})().catch(falha);
	});
}

async function montarReversa(nome, p) {
	const src = path.join(FONTE, p.src);
	const t0 = medir(nome, p);
	const s0 = t0.seg, FPS = t0.fps;
	if (s0.loopA == null) throw new Error(nome + ": saída reversa precisa de loop no hold");
	const Q = (n) => Math.max(1, Math.round((n * FPS) / 24));
	const { inFim, loopA, loopB } = s0;
	const fimHold = s0.outIni ?? t0.quadros;
	const funde = Q(FUNDE);
	let [x0, y0, x1, y1] = t0.recorte;
	x0 -= x0 % 2; y0 -= y0 % 2; x1 += x1 % 2; y1 += y1 % 2;
	const w = x1 - x0, h = y1 - y0, tam = w * h * 4;
	const bruto = ff(["-c:v", "libvpx-vp9", "-i", src, "-vf", `crop=${w}:${h}:${x0}:${y0},format=rgba`, "-f", "rawvideo", "-"], true).stdout;
	const q = (i) => bruto.subarray(i * tam, (i + 1) * tam);
	/* O que o hold tocaria depois de loopB-1 sem voltar: loopB, loopB+1… da
	   entrega (enquanto ainda é hold); passou do hold, o equivalente no loop. */
	const seguinte = (i) => { const f = loopB + i; return f < fimHold ? f : loopA + (f - loopB); };
	const repouso = q(inFim);
	function fundir(a, b, t) {
		const o = Buffer.allocUnsafe(tam);
		for (let i = 0; i < tam; i += 4) {
			const aa = a[i + 3] * (1 - t), ab = b[i + 3] * t, A = aa + ab;
			o[i + 3] = Math.round(A);
			for (let c = 0; c < 3; c++) o[i + c] = A > 0 ? Math.round((a[i + c] * aa + b[i + c] * ab) / A) : 0;
		}
		return o;
	}
	function* quadros() {
		for (let f = 0; f < loopB; f++) yield q(f);
		for (let i = 0; i < funde; i++) yield i === funde - 1 ? repouso : fundir(q(seguinte(i)), repouso, (i + 1) / funde);
		for (let f = inFim - 1; f >= 0; f--) yield q(f);
	}
	const total = loopB + funde + inFim;
	const kf = [...new Set([inFim, loopA])];
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-rev-"));
	const out = path.join(dir, path.basename(p.src));
	await encodarRaw(["-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${w}x${h}`, "-r", String(FPS), "-i", "-",
		"-vf", `pad=1920:1080:${x0}:${y0}:color=black@0,format=yuva420p`, "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
		"-crf", "18", "-b:v", "0", "-auto-alt-ref", "0", "-row-mt", "1",
		"-force_key_frames", "expr:" + kf.map((n) => `eq(n,${n})`).join("+"), "-metadata:s:v:0", "alpha_mode=1", out], quadros);
	const kfs = conferirKf(out, kf, FPS);
	const full = caixas(out);
	const bandas = {};
	for (const [b, reg] of Object.entries(p.bandas || {})) bandas[b] = caixas(out, reg);
	const t = Object.assign({}, t0, {
		fonte: p.src + " (saída reversa montada)", quadros: total,
		seg: { inFim, loopA, loopB, outIni: loopB, outMov: loopB + funde, fim: total, estatico: false, saidaReversa: true, continua: true },
		quietos: null, full, bandas, refOut: t0.refIn,
	});
	console.log(`   [${nome}] saída reversa: loop ${loopA}..${loopB - 1} (costura ${t0.loopErro}, passo típico ${t0.difVizinhos}) · funde ${loopB}..${loopB + funde - 1} · entrada ao contrário ${loopB + funde}..${total - 1}`);
	return { src: out, t, kfs };
}

const hoje = new Date().toISOString().slice(0, 10);
for (const nome of pecas) {
	const p = cfg.pecas[nome];
	const rev = p.saida === "reversa" ? await montarReversa(nome, p) : null;
	const t = rev ? rev.t : medir(nome, p);
	const s = t.seg;
	console.log(`\n== ${nome}  (${p.src})`);
	console.log(`   repouso ${t.ref.full}  inFim ${s.inFim}  loop ${s.loopA}..${s.loopB} (erro ${t.loopErro}, vizinhos ${t.difVizinhos})  outIni ${s.outIni}  fim ${s.fim}${s.estatico ? "  HOLD PARADO" : ""}`);
	console.log(`   quietos ${JSON.stringify(t.quietos)}  recorte ${t.recorte}`);
	for (const b of Object.keys(t.bandas)) console.log(`   banda ${b}: repouso ${t.ref[b]}`);
	if (SO_MEDIR) continue;

	const src = rev ? rev.src : path.join(FONTE, p.src);
	for (const rel of p.dst) {
		const dst = path.join(BUNDLE, rel);
		const trilha = dst.replace(/\.webm$/, ".trilha.json");
		const bak = path.join(PROJETO, "_removidos", hoje, "motion", nome);
		for (const f of [dst, trilha]) if (fs.existsSync(f)) { fs.mkdirSync(bak, { recursive: true }); const b = path.join(bak, path.basename(f)); if (!fs.existsSync(b)) fs.copyFileSync(f, b); }
		/* --trilha: só regrava o JSON (mudou banda/regra, a entrega é a mesma).
		   Os keyframes do webm já gravado TÊM de bater com os segmentos novos. */
		if (SO_TRILHA) {
			fs.writeFileSync(trilha, JSON.stringify(t));
			console.log(`   trilha regravada ${path.basename(trilha)} (webm intocado — confira os keyframes se os segmentos mudaram)`);
			continue;
		}
		let kfs;
		if (rev) { fs.copyFileSync(rev.src, dst); kfs = rev.kfs; } // já sai com os keyframes
		else { const r = reencodar(src, dst, t); fs.renameSync(r.tmp, dst); kfs = r.kfs; }
		fs.writeFileSync(trilha, JSON.stringify(t));
		console.log(`   gravado ${rel} (keyframes ${kfs.length > 12 ? kfs.slice(0, 6).join(",") + ",… (" + kfs.length + ")" : kfs.join(",")}) + ${path.basename(trilha)}`);
	}
}
