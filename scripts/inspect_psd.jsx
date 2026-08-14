// inspect_psd.jsx — leitura completa do documento ativo numa unica chamada.
// Retorna a arvore de camadas com CAMINHOS POR INDICE (ex: "2/16"), as specs de todos os
// textos (fonte, tamanho, cor, alinhamento, bbox), o hex das camadas de preenchimento
// solido e os GRADIENTES (fill layers e gradient overlay) ja com as paradas em % e o
// angulo convertido pra CSS. E o unico dump que voce precisa pra planejar a extracao.
//
// Uso: $.evalFile(new File("<skill>/scripts/inspect_psd.jsx"))
//
// Os caminhos por indice sao o enderecamento usado por export_plates.jsx. Indice 0 = camada
// do TOPO (Photoshop indexa de cima pra baixo) — isso importa pra clipping mask, que sempre
// recorta na camada imediatamente abaixo.

(function () {
  var doc = app.activeDocument;
  var layers = [], texts = [], fills = [], gradients = [];

  function h2(n) { var s = Math.round(n).toString(16).toUpperCase(); return s.length < 2 ? "0" + s : s; }

  function bounds4(L) {
    try {
      return [Math.round(L.bounds[0].as("px")), Math.round(L.bounds[1].as("px")),
              Math.round(L.bounds[2].as("px")), Math.round(L.bounds[3].as("px"))];
    } catch (e) { return [0, 0, 0, 0]; }
  }

  // A cor de uma fill layer nao existe no DOM — so via Action Manager, na lista "adjustment".
  function solidFillHex(L) {
    try {
      doc.activeLayer = L;
      var r = new ActionReference();
      r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
      var d = executeActionGet(r);
      if (!d.hasKey(stringIDToTypeID("adjustment"))) return null;
      var adj = d.getList(stringIDToTypeID("adjustment")).getObjectValue(0);
      var c = adj.getObjectValue(stringIDToTypeID("color"));
      return "#" + h2(c.getDouble(charIDToTypeID("Rd  "))) +
                   h2(c.getDouble(charIDToTypeID("Grn "))) +
                   h2(c.getDouble(charIDToTypeID("Bl  ")));
    } catch (e) { return null; }
  }

  // Le um descritor de gradiente do Photoshop e devolve ja pronto pro CSS.
  // No Photoshop as paradas vao de 0 a 4096 e o angulo 0 aponta pra DIREITA;
  // no CSS as paradas sao % e 0deg aponta pra CIMA — dai a conversao 90 - angulo.
  function readGradient(gradDesc, angle, typeName) {
    var stops = [], colors = gradDesc.getList(stringIDToTypeID("colors"));
    for (var i = 0; i < colors.count; i++) {
      var st = colors.getObjectValue(i);
      var c = st.getObjectValue(stringIDToTypeID("color"));
      var hexv;
      try {
        hexv = "#" + h2(c.getDouble(charIDToTypeID("Rd  "))) +
                     h2(c.getDouble(charIDToTypeID("Grn "))) +
                     h2(c.getDouble(charIDToTypeID("Bl  ")));
      } catch (e) { hexv = null; }
      var loc = 0;
      try { loc = st.getInteger(stringIDToTypeID("location")); } catch (e) {}
      stops.push({ hex: hexv, pct: Math.round(loc / 4096 * 1000) / 10 });
    }
    var cssAngle = (typeof angle === "number") ? ((90 - angle) % 360 + 360) % 360 : null;
    var css = null;
    if (stops.length) {
      var parts = [];
      for (var i = 0; i < stops.length; i++) parts.push(stops[i].hex + " " + stops[i].pct + "%");
      css = (typeName === "radial" ? "radial-gradient(circle, " : "linear-gradient(" + cssAngle + "deg, ") + parts.join(", ") + ")";
    }
    return { type: typeName || "linear", psAngle: angle, cssAngle: cssAngle, stops: stops, css: css };
  }

  // Gradiente pode vir de dois lugares: uma gradient FILL layer (adjustment) ou um
  // efeito Gradient Overlay aplicado sobre outra camada (layerEffects.gradientFill).
  function gradientOf(L) {
    try {
      doc.activeLayer = L;
      var r = new ActionReference();
      r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
      var d = executeActionGet(r);

      if (d.hasKey(stringIDToTypeID("adjustment"))) {
        var adj = d.getList(stringIDToTypeID("adjustment")).getObjectValue(0);
        if (adj.hasKey(stringIDToTypeID("gradient"))) {
          var ang = null, tp = "linear";
          try { ang = adj.getUnitDoubleValue(stringIDToTypeID("angle")); } catch (e) {}
          try { tp = String(typeIDToStringID(adj.getEnumerationValue(stringIDToTypeID("type")))); } catch (e) {}
          var g = readGradient(adj.getObjectValue(stringIDToTypeID("gradient")), ang, tp);
          g.source = "fillLayer";
          return g;
        }
      }

      if (d.hasKey(stringIDToTypeID("layerEffects"))) {
        var fx = d.getObjectValue(stringIDToTypeID("layerEffects"));
        if (fx.hasKey(stringIDToTypeID("gradientFill"))) {
          var go = fx.getObjectValue(stringIDToTypeID("gradientFill"));
          var ang2 = null, tp2 = "linear";
          try { ang2 = go.getUnitDoubleValue(stringIDToTypeID("angle")); } catch (e) {}
          try { tp2 = String(typeIDToStringID(go.getEnumerationValue(stringIDToTypeID("type")))); } catch (e) {}
          var g2 = readGradient(go.getObjectValue(stringIDToTypeID("gradient")), ang2, tp2);
          g2.source = "gradientOverlay";
          return g2;
        }
      }
    } catch (e) {}
    return null;
  }

  function walk(container, path) {
    for (var i = 0; i < container.layers.length; i++) {
      var L = container.layers[i];
      var p = path.concat([i]);
      var id = p.join("/");
      var bb = bounds4(L);
      var isSet = (L.typename === "LayerSet");
      var kind = isSet ? "GROUP" : String(L.kind).replace("LayerKind.", "");

      var rec = { path: id, name: String(L.name), kind: kind, visible: L.visible,
                  x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1] };

      if (!isSet && L.kind == LayerKind.TEXT) {
        var t = L.textItem, col = "", sz = 0;
        try { col = "#" + t.color.rgb.hexValue; } catch (e) {}
        try { sz = Math.round(t.size.as("px")); } catch (e) {}

        // POINTTEXT: a bbox e so o contorno dos glifos do texto de exemplo — ela cresce e
        // encolhe com o conteudo, entao NAO diz qual o espaco disponivel.
        // PARAGRAPHTEXT: tem uma caixa que o designer desenhou. Essa sim e o span real.
        var isPara = false;
        try { isPara = (t.kind == TextType.PARAGRAPHTEXT); } catch (e) {}

        var span = null;
        if (isPara) {
          try { span = { w: Math.round(t.width.as("px")), h: Math.round(t.height.as("px")) }; } catch (e) {}
        }

        var lead = null, track = null, caps = null;
        try { lead = t.useAutoLeading ? null : Math.round(t.leading.as("px")); } catch (e) {}
        try { track = t.tracking; } catch (e) {}
        try { caps = String(t.capitalization).replace("TextCase.", ""); } catch (e) {}

        rec.text = String(t.contents).substring(0, 80);
        texts.push({
          path: id, layer: String(L.name),
          contents: String(t.contents).substring(0, 200),
          font: String(t.font), sizePx: sz, color: col,
          align: String(t.justification).replace("Justification.", ""),
          textKind: isPara ? "paragraph" : "point",
          // span = caixa desenhada pelo designer (so existe em paragraph text)
          span: span,
          // measured = contorno dos glifos do conteudo de exemplo (sempre presente)
          measured: { x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1] },
          leadingPx: lead, tracking: track, capitalization: caps,
          lines: String(t.contents).split(/[\r\n]+/).length,
          x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1]
        });
      }

      if (!isSet) {
        var fh = solidFillHex(L);
        if (fh) { rec.fill = fh; fills.push({ path: id, layer: String(L.name), hex: fh }); }
        var gr = gradientOf(L);
        if (gr) {
          rec.gradient = gr.css;
          gradients.push({ path: id, layer: String(L.name), source: gr.source, type: gr.type,
                           psAngle: gr.psAngle, cssAngle: gr.cssAngle, stops: gr.stops, css: gr.css,
                           x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1] });
        }
      }

      layers.push(rec);
      if (isSet) walk(L, p);
    }
  }

  walk(doc, []);

  return {
    doc: String(doc.name),
    canvas: { w: Math.round(doc.width.as("px")), h: Math.round(doc.height.as("px")) },
    layerCount: layers.length,
    layers: layers, texts: texts, fills: fills, gradients: gradients
  };
})();
