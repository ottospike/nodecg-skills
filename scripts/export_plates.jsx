// export_plates.jsx — exporta PLATES CONDENSADAS: N camadas do PSD viram 1 PNG trimado,
// com a posicao original no canvas registrada. Dirigido por especificacao.
//
//   $.global.OUTDIR = "C:\\caminho\\para\\plates\\MeuGrafico";
//   $.global.SPECS  = [ { out:"plate_x", keep:[[1,2]], ... }, ... ];
//   $.global.ONLY   = "plate_x,plate_y";   // opcional: roda so esses (lotes)
//   $.evalFile(new File("<skill>/scripts/export_plates.jsx"))
//
// Retorna { outDir, exported:[{file,x,y,w,h,note}], errors:[] } e grava/atualiza
// _plates.json no OUTDIR.
//
// ---------------------------------------------------------------------------
// CAMPOS DA SPEC (todos os caminhos sao "por indice", ex: [2,16] — ver inspect_psd.jsx)
//
//   out       string   nome do arquivo, sem .png  (obrigatorio)
//   keep      [path]   camadas/grupos que compoem a plate  (obrigatorio)
//   dropText  bool     remove textos DENTRO de grupos mantidos (padrao true) — o texto
//                      dinamico e reconstruido em HTML, nao deve ficar queimado
//   recolor   [{path,hex}]        troca a cor de uma fill layer (gerar variantes de estado)
//   lift      [path]              tira a camada do grupo e joga na raiz do documento
//   shift     [{path,dx,dy}]      desloca a camada em pixels
//   clip      {art,base,dx,dy}    poe `art` logo acima de `base`, desloca e cria clipping mask
//   note      string              vai pro manifesto
//
// ORDEM DE EXECUCAO: recolor -> lift -> shift -> clip -> achatar -> trim -> salvar.
//
// ---------------------------------------------------------------------------
// POR QUE ESTE SCRIPT RENOMEIA TUDO ANTES DE MEXER
//
// No ExtendScript qualquer move/reorder invalida silenciosamente as referencias de camada
// E de grupo que voce ja tinha na mao — elas passam a apontar pro vizinho errado, sem erro.
// Entao a primeira coisa que fazemos e resolver cada caminho UMA vez e renomear a camada
// pra uma tag unica (__P0, __P1...). Dai em diante toda operacao re-encontra a camada pela
// tag. E o que torna as operacoes encadeaveis de forma confiavel.

(function () {
  var OUTDIR = $.global.OUTDIR;
  var SPECS = $.global.SPECS;
  if (!OUTDIR) throw new Error("defina $.global.OUTDIR");
  if (!SPECS || !SPECS.length) throw new Error("defina $.global.SPECS");

  var TAG = "__P";
  var src = app.activeDocument;
  var outDir = new Folder(OUTDIR);
  if (!outDir.exists) outDir.create();

  var pngOpts = new PNGSaveOptions();
  pngOpts.compression = 9;
  pngOpts.interlaced = false;

  var results = [], errors = [];

  // ---------- helpers -------------------------------------------------------

  function px(n) { return new UnitValue(n, "px"); }

  function resolvePath(doc, p) {
    var node = doc;
    for (var i = 0; i < p.length; i++) node = node.layers[i === 0 ? p[0] : p[i]];
    return node;
  }

  // procura recursivamente pela tag — sempre chame isto, nunca guarde a referencia
  function findTag(container, tag) {
    for (var i = 0; i < container.layers.length; i++) {
      var L = container.layers[i];
      if (L.name === tag) return L;
      if (L.typename === "LayerSet") { var f = findTag(L, tag); if (f) return f; }
    }
    return null;
  }

  function parentOf(container, tag) {
    for (var i = 0; i < container.layers.length; i++) {
      var L = container.layers[i];
      if (L.name === tag) return container;
      if (L.typename === "LayerSet") { var f = parentOf(L, tag); if (f) return f; }
    }
    return null;
  }

  // Cria/solta clipping mask via Action Manager. O setter DOM `.grouped` vira no-op quando
  // ele acha que o valor ja e o desejado — mas o Photoshop solta o recorte sozinho quando
  // camadas entram ou saem do grupo, entao DOM e estado real dessincronizam. O AM nao cacheia.
  function amClip(doc, layer, create) {
    doc.activeLayer = layer;
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    d.putReference(charIDToTypeID("null"), r);
    executeAction(charIDToTypeID(create ? "GrpL" : "Ungr"), d, DialogModes.NO);
  }

  function setSolidFill(doc, layer, hex) {
    doc.activeLayer = layer;
    var r = parseInt(hex.substr(1, 2), 16),
        g = parseInt(hex.substr(3, 2), 16),
        b = parseInt(hex.substr(5, 2), 16);
    var ref = new ActionReference();
    ref.putEnumerated(stringIDToTypeID("contentLayer"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    var col = new ActionDescriptor();
    col.putDouble(charIDToTypeID("Rd  "), r);
    col.putDouble(charIDToTypeID("Grn "), g);
    col.putDouble(charIDToTypeID("Bl  "), b);
    var fill = new ActionDescriptor();
    fill.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), col);
    var d = new ActionDescriptor();
    d.putReference(charIDToTypeID("null"), ref);
    d.putObject(charIDToTypeID("T   "), stringIDToTypeID("solidColorLayer"), fill);
    executeAction(charIDToTypeID("setd"), d, DialogModes.NO);
  }

  // Deleta o que nao interessa. Deletar e mais confiavel que esconder: "Merge Visible" falha
  // com uma camada so, e camadas ocultas remanescentes bagunçam a leitura de bounds depois.
  function prune(container, inherited, dropText) {
    var kept = false;
    for (var i = container.layers.length - 1; i >= 0; i--) {
      var L = container.layers[i];
      var tagged = (L.name.indexOf(TAG) === 0);
      var live = tagged || inherited;

      if (L.typename === "LayerSet") {
        if (live) { L.visible = true; prune(L, true, dropText); kept = true; }
        else if (prune(L, false, dropText)) { L.visible = true; kept = true; }
        else L.remove();
      } else {
        if (!live) { L.remove(); continue; }
        if (dropText && !tagged && L.kind == LayerKind.TEXT) { L.remove(); continue; }
        L.visible = true; kept = true;
      }
    }
    return kept;
  }

  // Achata tudo numa camada so, preservando alpha.
  //
  // Duas sutilezas que custam caro se ignoradas:
  //  - Merge tem que ser de DENTRO PRA FORA. Mandar merge num grupo que ainda contem
  //    subgrupos falha com "The command Select is not currently available".
  //  - Merge de grupo resolve clipping mask corretamente, entao nunca tente merge direto
  //    na camada recortada — o Photoshop bloqueia "Merge Layers" nela.
  function deepestGroup(container) {
    for (var i = 0; i < container.layers.length; i++) {
      var L = container.layers[i];
      if (L.typename === "LayerSet") { var inner = deepestGroup(L); return inner ? inner : L; }
    }
    return null;
  }

  function flattenAll(doc) {
    var guard = 0;
    while (guard++ < 80) {
      var g = deepestGroup(doc);
      if (!g) break;
      g.merge();
    }
    if (doc.layers.length > 1) { try { doc.mergeVisibleLayers(); } catch (e) {} }
    return doc.layers[0];
  }

  // ---------- coleta de caminhos referenciados -------------------------------

  function specPaths(spec) {
    var all = [];
    function add(p) { if (p && p.length) all.push(p); }
    for (var i = 0; i < (spec.keep || []).length; i++) add(spec.keep[i]);
    for (var i = 0; i < (spec.recolor || []).length; i++) add(spec.recolor[i].path);
    for (var i = 0; i < (spec.lift || []).length; i++) add(spec.lift[i]);
    for (var i = 0; i < (spec.shift || []).length; i++) add(spec.shift[i]);
    if (spec.clip) { add(spec.clip.art); add(spec.clip.base); }
    return all;
  }

  function keyOf(p) { return p.join("/"); }

  // ---------- exportacao de uma spec ----------------------------------------

  function runSpec(spec) {
    var work = null;
    try {
      work = src.duplicate("work_" + spec.out);
      app.activeDocument = work;

      // 1) etiqueta cada camada referenciada (resolve o caminho UMA unica vez)
      var tagFor = {}, n = 0;
      var paths = specPaths(spec);
      for (var i = 0; i < paths.length; i++) {
        var k = keyOf(paths[i]);
        if (tagFor[k]) continue;
        var L = resolvePath(work, paths[i]);
        if (!L) throw new Error("caminho inexistente: " + k);
        var tag = TAG + (n++);
        L.name = tag;
        tagFor[k] = tag;
      }

      // 2) remove todo o resto (inclui o fundo do mockup e os textos dinamicos)
      var dropText = (spec.dropText !== false);
      prune(work, false, dropText);

      // 3) recolorir (gera variantes de estado a partir de uma unica arte)
      for (var i = 0; i < (spec.recolor || []).length; i++) {
        var rc = spec.recolor[i];
        var L = findTag(work, tagFor[keyOf(rc.path)]);
        if (L) setSolidFill(work, L, rc.hex);
      }

      // 4) "lift": tira da hierarquia e joga na raiz. Necessario antes de clipar — inserir
      //    qualquer camada acima de uma mascara de recorte solta o recorte, entao o grupo
      //    que sera clipado tem que ficar so com arte + base.
      //    Percorre de TRAS PRA FRENTE: cada lift vai pro topo da pilha, entao iterar ao
      //    contrario preserva a ordem escrita na spec (indice 0 = mais acima, como no PSD).
      var lifts = spec.lift || [];
      for (var i = lifts.length - 1; i >= 0; i--) {
        var L = findTag(work, tagFor[keyOf(lifts[i])]);
        if (L) L.move(work, ElementPlacement.PLACEATBEGINNING);
      }

      // 5) deslocamentos
      for (var i = 0; i < (spec.shift || []).length; i++) {
        var sh = spec.shift[i];
        var L = findTag(work, tagFor[keyOf(sh.path)]);
        if (L && (sh.dx || sh.dy)) L.translate(px(sh.dx || 0), px(sh.dy || 0));
      }

      // 6) clipping mask (sempre por ultimo)
      if (spec.clip) {
        var artTag = tagFor[keyOf(spec.clip.art)], baseTag = tagFor[keyOf(spec.clip.base)];
        var base = findTag(work, baseTag);
        var art = findTag(work, artTag);
        art.move(base, ElementPlacement.PLACEBEFORE);
        art = findTag(work, artTag);              // move invalidou a referencia
        if (spec.clip.dx || spec.clip.dy) art.translate(px(spec.clip.dx || 0), px(spec.clip.dy || 0));
        art = findTag(work, artTag);
        try { amClip(work, art, false); } catch (e) {}   // solta se ja vinha clipada
        art = findTag(work, artTag);
        amClip(work, art, true);
      }

      // 7) achatar, ler posicao no canvas ANTES do trim, trimar, salvar
      var single = flattenAll(work);
      var b = single.bounds;
      var ox = Math.round(b[0].as("px")), oy = Math.round(b[1].as("px"));

      work.trim(TrimType.TRANSPARENT);
      var w = Math.round(work.width.as("px")), h = Math.round(work.height.as("px"));

      work.saveAs(new File(outDir.fsName + "\\" + spec.out + ".png"), pngOpts, true, Extension.LOWERCASE);
      work.close(SaveOptions.DONOTSAVECHANGES);
      app.activeDocument = src;

      results.push({ file: spec.out + ".png", x: ox, y: oy, w: w, h: h, note: spec.note || "" });
    } catch (e) {
      errors.push(spec.out + " :: " + e);
      try { if (work) work.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
      app.activeDocument = src;
    }
  }

  // ---------- loop ----------------------------------------------------------

  var only = $.global.ONLY ? String($.global.ONLY).split(",") : null;
  function wanted(name) {
    if (!only) return true;
    for (var i = 0; i < only.length; i++) if (only[i] === name) return true;
    return false;
  }

  for (var s = 0; s < SPECS.length; s++) if (wanted(SPECS[s].out)) runSpec(SPECS[s]);

  // manifesto acumulativo (lotes sucessivos nao se sobrescrevem)
  try {
    var mf = new File(outDir.fsName + "\\_plates.json");
    var prev = [];
    if (mf.exists) {
      mf.encoding = "UTF-8"; mf.open("r");
      var raw = mf.read(); mf.close();
      try { prev = eval("(" + raw + ")").plates || []; } catch (e) { prev = []; }
    }
    var merged = [];
    for (var i = 0; i < prev.length; i++) {
      var dup = false;
      for (var j = 0; j < results.length; j++) if (results[j].file === prev[i].file) dup = true;
      if (!dup) merged.push(prev[i]);
    }
    for (var j = 0; j < results.length; j++) merged.push(results[j]);

    mf.encoding = "UTF-8"; mf.open("w");
    mf.write('{"canvas":{"w":' + Math.round(src.width.as("px")) + ',"h":' + Math.round(src.height.as("px")) +
             '},"plates":' + merged.toSource().replace(/^\(/, "").replace(/\)$/, "") + "}");
    mf.close();
  } catch (e) { errors.push("manifesto :: " + e); }

  return { outDir: outDir.fsName, exported: results, errors: errors };
})();
