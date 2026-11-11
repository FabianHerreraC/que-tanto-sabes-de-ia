/* ¿Qué tanto sabes de IA? · front (vanilla, sin build) */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const DOCS = {
    GEN: { nombre: "Generales", color: "#2a4f3c" },
    ENS: { nombre: "Enseñanza-Aprendizaje", color: "#f74a2d" },
    CIE: { nombre: "Ciencia, Tecnología e Innovación", color: "#234c92" },
    EXT: { nombre: "Extensión y Educación Continuada", color: "#f7c733" },
    GES: { nombre: "Gestión Institucional", color: "#1d1d11" },
  };
  const PREFIJO = Object.fromEntries(Object.entries(DOCS).map(([k, d]) => [d.nombre, k]));
  const DOC_DEL_ROL = { estudiante: "ENS", profesor: "ENS", investigador: "CIE", administrativo: "GES" };
  const N_PREGUNTAS = 10;
  // mientras la comisión revisa el banco se juega también lo pendiente; al publicar, dejar solo "aprobada"
  const ESTADOS_JUGABLES = ["aprobada", "pendiente_revision"];
  // cuatro insignias: cada ciclo de 10 preguntas da una, según los aciertos (de mayor a menor exigencia)
  const INSIGNIAS = [
    { id: "i10", nombre: "Guardián del criterio", min: 10, marca: "10", requisito: "10 de 10" },
    { id: "i8", nombre: "Criterioso", min: 8, marca: "8", requisito: "8 o 9" },
    { id: "i6", nombre: "Atento", min: 6, marca: "6", requisito: "6 o 7" },
    { id: "i0", nombre: "Curioso", min: 0, marca: "5", requisito: "5 o menos" },
  ];

  const quieto = matchMedia("(prefers-reduced-motion: reduce)");
  let pausado = quieto.matches;

  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  /* ================= Nube de conceptos ================= */
  const Nube = (() => {
    const cv = $("#nube"), cx = cv.getContext("2d");
    let W = 0, H = 0, DPR = 1, nodos = [], enlaces = [], porId = {};
    let yaw = 0.4, pitch = -0.25, yawObj = yaw, pitchObj = pitch;
    let zoom = 1, zoomObj = 1, giro = 0.0009, interactiva = false;
    let hover = null, arrastre = null, seleccionado = null, alSeleccionar = null, t0 = performance.now();

    function cargar(graph) {
      const orden = [...graph.nodes].sort((a, b) =>
        a.doc_principal.localeCompare(b.doc_principal) || b.peso - a.peso);
      const n = orden.length, oro = Math.PI * (3 - Math.sqrt(5));
      const maxPeso = Math.max(...orden.map((d) => d.peso));
      nodos = orden.map((d, i) => {
        const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * oro;
        return { ...d, x: Math.cos(th) * r, y, z: Math.sin(th) * r,
          tam: 1.6 + 3.2 * Math.sqrt(d.peso / maxPeso), estado: "inactivo", t: 0 };
      });
      porId = Object.fromEntries(nodos.map((d) => [d.id, d]));
      enlaces = graph.links.filter((l) => l.peso >= 8 && porId[l.source] && porId[l.target])
        .map((l) => ({ a: porId[l.source], b: porId[l.target], peso: l.peso }));
    }

    function medir() {
      DPR = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = W * DPR; cv.height = H * DPR;
    }

    // centro y radio según la vista: en móvil la nube sube para dejar sitio al panel
    function marco() {
      const movil = W < 720, vista = document.body.dataset.vista;
      const conPanel = ["inicio", "quiz", "cierre", "acerca", "consulta"].includes(vista);
      // en móvil la ficha ocupa la mitad de abajo: la nube sube para que el punto elegido se vea
      const cy = movil && (conPanel || seleccionado) ? H * 0.27 : conPanel ? H * 0.38 : H * 0.5;
      const R = (movil ? (conPanel ? Math.min(W * 0.3, H * 0.22) : W * 0.37) : Math.min(W, H) * (conPanel ? 0.27 : 0.38)) * zoom;
      // en móvil las etiquetas salen a la derecha del punto: correr el centro a la izquierda
      return { cx: movil ? W * 0.42 : W / 2, cy, R };
    }

    function proyectar(d, m) {
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = d.x * cyw + d.z * syw, z1 = -d.x * syw + d.z * cyw;
      const y2 = d.y * cp - z1 * sp, z2 = d.y * sp + z1 * cp;
      const f = 2.6 / (2.6 - z2);
      d.px = m.cx + x1 * m.R * f; d.py = m.cy + y2 * m.R * f; d.pz = z2; d.f = f;
    }

    function dibujar(now) {
      const dt = Math.min(now - t0, 50); t0 = now;
      // el giro se detiene mientras el puntero está sobre un punto o hay una ficha abierta
      if (!pausado && !arrastre && !hover && !seleccionado) yawObj += giro * dt;
      const k = pausado ? 1 : 0.06;
      yaw += (yawObj - yaw) * k; pitch += (pitchObj - pitch) * k; zoom += (zoomObj - zoom) * (pausado ? 1 : 0.05);

      cx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx.clearRect(0, 0, W, H);
      const m = marco();
      nodos.forEach((d) => proyectar(d, m));

      // enlaces
      cx.lineWidth = 0.6;
      for (const l of enlaces) {
        const act = (l.a.estado !== "inactivo" && l.b.estado !== "inactivo");
        const prof = (l.a.pz + l.b.pz) / 2;
        cx.strokeStyle = act ? `rgba(247,74,45,${0.3 + 0.25 * (prof + 1)})` : `rgba(0,0,0,${0.015 + 0.03 * (prof + 1)})`;
        cx.beginPath(); cx.moveTo(l.a.px, l.a.py); cx.lineTo(l.b.px, l.b.py); cx.stroke();
      }

      const pulso = (Math.sin(now / 380) + 1) / 2;
      const enQuiz = !interactiva && document.body.dataset.vista === "quiz";
      const orden = [...nodos].sort((a, b) => a.pz - b.pz);
      for (const d of orden) {
        const prof = (d.pz + 1) / 2;                     // 0 atrás · 1 frente
        const r = d.tam * d.f;
        let alfa = 0.25 + 0.75 * prof, txt = `rgba(0,0,0,${0.14 + 0.5 * prof})`;

        if (d.estado === "activo") {
          cx.strokeStyle = "#f74a2d"; cx.lineWidth = 1.5;
          cx.globalAlpha = 0.3 + 0.6 * (1 - pulso);
          cx.beginPath(); cx.arc(d.px, d.py, r + 4 + 10 * pulso, 0, 7); cx.stroke();
          alfa = 1; txt = "#000";
        } else if (d.estado === "dominado") {
          cx.fillStyle = "#f7c733"; cx.globalAlpha = 0.75;
          cx.beginPath(); cx.arc(d.px, d.py, r * 3.4, 0, 7); cx.fill();
          alfa = 1; txt = "#000";
        } else if (d.estado === "fallado") {
          alfa = 0.4 + 0.4 * prof; txt = `rgba(0,0,0,${0.3 + 0.35 * prof})`;
        }

        cx.globalAlpha = alfa;
        cx.lineWidth = 0.75;
        if (d.estado === "fallado") {
          cx.strokeStyle = "#000"; cx.setLineDash([2, 2]);
          cx.beginPath(); cx.arc(d.px, d.py, r + 1.5, 0, 7); cx.stroke();
          cx.setLineDash([]);
        } else {
          // borde fino: la lima y la menta casi no se ven sobre blanco
          cx.fillStyle = d.estado === "inactivo" && enQuiz ? "#d9ccb0" : DOCS[d.doc_principal].color;
          cx.strokeStyle = "rgba(0,0,0,.35)";
          cx.beginPath(); cx.arc(d.px, d.py, r, 0, 7); cx.fill(); cx.stroke();
        }

        cx.globalAlpha = 1;
        if (d === seleccionado) {
          cx.strokeStyle = "#000"; cx.lineWidth = 1.5;
          cx.beginPath(); cx.arc(d.px, d.py, r + 6, 0, 7); cx.stroke();
        }
        const destacado = d.estado === "activo" || d.estado === "dominado" || d === hover || d === seleccionado;
        cx.font = `${destacado ? 700 : 400} ${destacado ? 15 : 13.5}px "Jost", system-ui, sans-serif`;
        cx.fillStyle = d === hover || d === seleccionado ? "#000" : txt;
        const tx = d.px + r + 5;
        cx.fillText(d.label, tx, d.py + 4);
        if (d.estado === "fallado") {          // tachado: concepto por explorar
          cx.fillRect(tx, d.py, cx.measureText(d.label).width, 0.75);
        }
      }
      requestAnimationFrame(dibujar);
    }

    // gira la esfera para que el centroide de los conceptos quede al frente
    function enfocar(ids) {
      const v = ids.map((i) => porId[i]).filter(Boolean);
      if (!v.length) return;
      const s = v.reduce((a, d) => ({ x: a.x + d.x, y: a.y + d.y, z: a.z + d.z }), { x: 0, y: 0, z: 0 });
      let y0 = Math.atan2(-s.x, s.z);
      // tomar la vuelta más corta desde el giro actual
      while (y0 - yawObj > Math.PI) y0 -= 2 * Math.PI;
      while (y0 - yawObj < -Math.PI) y0 += 2 * Math.PI;
      yawObj = y0;
      const xz = Math.hypot(s.x, s.z);
      pitchObj = Math.max(-0.9, Math.min(0.9, Math.atan2(-s.y, xz)));
    }

    function estado(ids, e) { ids.forEach((i) => { if (porId[i]) porId[i].estado = e; }); }
    function reiniciar() { nodos.forEach((d) => (d.estado = "inactivo")); }

    function modo({ zoom: z = 1, giro: g = 0.0009, interactiva: inter = false } = {}) {
      zoomObj = z; giro = g; interactiva = inter;
      if (!inter) { hover = null; seleccionado = null; burbuja(null); }
    }

    // interacción: arrastrar para girar, hover para ver el concepto
    const burbujaEl = $("#burbuja");
    function burbuja(d, x, y) {
      if (!d) { burbujaEl.hidden = true; return; }
      const docs = Object.entries(d.documentos).map(([k, n]) => `${k} ${n}`).join(" · ");
      // la primera frase de la descripción del concepto
      const frase = (d.descripcion || "").split(/(?<=\.)\s/)[0];
      burbujaEl.innerHTML = `<b>${d.label}</b>${frase ? `<span>${frase}</span>` : ""}<small>${d.peso} fragmentos · ${docs}</small>`;
      // cerca del borde derecho, la burbuja se abre hacia la izquierda del puntero
      const izq = x + 300 > innerWidth;
      burbujaEl.style.left = (izq ? x - 24 : x) + "px"; burbujaEl.style.top = y + "px";
      burbujaEl.style.translate = izq ? "-100% 12px" : "";
      burbujaEl.hidden = false;
    }
    function cercano(x, y) {
      let mejor = null, dist = 18;
      for (const d of nodos) {
        if (d.pz < -0.2) continue;
        const dd = Math.hypot(d.px - x, d.py - y);
        if (dd < dist) { dist = dd; mejor = d; }
      }
      return mejor;
    }
    cv.addEventListener("pointerdown", (e) => {
      if (!interactiva) return;
      arrastre = { x: e.clientX, y: e.clientY, yaw: yawObj, pitch: pitchObj, movido: false };
      cv.setPointerCapture(e.pointerId); document.body.classList.add("arrastrando");
    });
    cv.addEventListener("pointermove", (e) => {
      if (!interactiva) return;
      if (arrastre && (arrastre.movido || Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y) > 4)) {
        arrastre.movido = true;
        yawObj = arrastre.yaw + (e.clientX - arrastre.x) * 0.006;
        pitchObj = Math.max(-1.2, Math.min(1.2, arrastre.pitch + (e.clientY - arrastre.y) * 0.006));
        burbuja(null);
      } else if (!arrastre) {
        hover = cercano(e.clientX, e.clientY);
        cv.style.cursor = hover ? "pointer" : "";
        burbuja(hover, e.clientX, e.clientY);
      }
    });
    const soltar = () => { arrastre = null; document.body.classList.remove("arrastrando"); };
    // un clic sin arrastre sobre un punto lo selecciona; en el vacío, cierra la ficha
    cv.addEventListener("pointerup", (e) => {
      const clic = arrastre && !arrastre.movido;
      soltar();
      if (clic && alSeleccionar) alSeleccionar(cercano(e.clientX, e.clientY));
    });
    cv.addEventListener("pointercancel", soltar);
    cv.addEventListener("pointerleave", () => { hover = null; burbuja(null); });

    addEventListener("resize", medir);
    medir();

    // caja (en px de pantalla) que ocupan los puntos visibles y sus etiquetas: sirve para recortar la imagen
    function encuadre() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      cx.font = '700 15px "Jost", system-ui, sans-serif';
      for (const d of nodos) {
        const r = d.tam * d.f + 6;
        x0 = Math.min(x0, d.px - r); x1 = Math.max(x1, d.px + r + cx.measureText(d.label).width);
        y0 = Math.min(y0, d.py - r - 8); y1 = Math.max(y1, d.py + r + 6);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, dpr: DPR };
    }

    function seleccionar(id) {
      seleccionado = (id && porId[id]) || null;
      if (seleccionado) enfocar([id]);
    }

    return { cargar, enfocar, estado, reiniciar, modo, seleccionar, encuadre, alSeleccionar: (fn) => (alSeleccionar = fn),
      canvas: cv, iniciar: () => requestAnimationFrame(dibujar),
      nodo: (id) => porId[id] };
  })();

  /* ================= Datos ================= */
  let PREGUNTAS = [], GRAFO = null;

  async function cargarDatos() {
    const [g, q] = await Promise.all([
      fetch("data/graph.json").then((r) => r.json()),
      fetch("data/questions.json").then((r) => r.json()),
    ]);
    GRAFO = g;
    PREGUNTAS = q.filter((p) => ESTADOS_JUGABLES.includes(p.estado));
    Nube.cargar(g);
    $("#leyenda").innerHTML = Object.values(DOCS)
      .map((d) => `<li><i style="background:${d.color}"></i>${d.nombre}</li>`).join("");
  }

  function barajar(a) {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const docDe = (p) => PREFIJO[p.cita.documento];

  // 70 % del documento del rol, 30 % del resto (siempre con algo de Generales)
  function elegir(pool, rol, n) {
    const docRol = DOC_DEL_ROL[rol];
    const delRol = barajar(pool.filter((p) => docDe(p) === docRol || p.rol.includes(rol)));
    const resto = barajar(pool.filter((p) => !delRol.includes(p)));
    const elegidas = delRol.slice(0, Math.round(n * 0.7));
    const gen = resto.find((p) => docDe(p) === "GEN");
    if (gen && !elegidas.some((p) => docDe(p) === "GEN")) elegidas.push(gen);
    for (const p of [...resto, ...delRol]) {
      if (elegidas.length >= n) break;
      if (!elegidas.includes(p)) elegidas.push(p);
    }
    return elegidas.slice(0, n);
  }

  // primero las que aún no ha acertado; si no alcanzan, completa con repaso
  function tomar(pool, rol, n) {
    let elegidas = elegir(pool.filter((p) => !progreso.has(p.id)), rol, n);
    if (elegidas.length < n) elegidas = elegidas.concat(elegir(pool.filter((p) => progreso.has(p.id)), rol, n - elegidas.length));
    return elegidas;
  }

  // cada ciclo abre con 2 dilemas de la serie reflexiva y sigue con 8 del banco base en dificultad creciente
  const N_REFLEXIVAS = 2;
  function armarSesion(rol) {
    const reflexivas = PREGUNTAS.filter((p) => p.serie === "reflexiva");
    const base = PREGUNTAS.filter((p) => p.serie !== "reflexiva");
    const nRef = Math.min(N_REFLEXIVAS, reflexivas.length);
    return tomar(reflexivas, rol, nRef)
      .concat(tomar(base, rol, N_PREGUNTAS - nRef).sort((a, b) => a.nivel - b.nivel));
  }

  /* ================= Progreso e insignias ================= */
  // ids de preguntas acertadas al menos una vez; vive en el navegador de quien juega
  const progreso = (() => {
    try { return new Set(JSON.parse(leer("tita.acertadas") || "[]")); } catch (e) { return new Set(); }
  })();
  const guardarProgreso = () => guardar("tita.acertadas", JSON.stringify([...progreso]));

  // colección: cuántas veces se ha ganado cada insignia; vive en el navegador de quien juega
  const coleccion = (() => {
    try { return JSON.parse(leer("tita.insignias") || "{}"); } catch (e) { return {}; }
  })();
  const insigniaDe = (aciertos) => INSIGNIAS.find((i) => aciertos >= i.min);

  function pintarInsignias(el, actual) {
    el.innerHTML = `
      <p class="etiqueta">Insignias por ciclo de ${N_PREGUNTAS} preguntas</p>
      <ul class="insignias">${[...INSIGNIAS].reverse().map((i) => {
        const veces = coleccion[i.id] || 0;
        const clase = ["insignia", veces ? "ganada" : "", i.id === actual ? "nueva" : ""].join(" ");
        return `<li class="${clase}" title="${i.nombre}: ${i.requisito} aciertos">
          <span class="sello">${i.marca}</span><b>${i.nombre}</b><small>${i.requisito}${veces ? ` · ×${veces}` : ""}</small></li>`;
      }).join("")}</ul>`;
  }

  /* ================= Juego ================= */
  const juego = { rol: null, preguntas: [], i: 0, puntos: 0, racha: 0, rachaMax: 0, aciertos: 0, respondida: false,
    dominados: new Set(), fallados: new Set() };

  function empezar(rol) {
    Object.assign(juego, { rol, preguntas: armarSesion(rol), i: 0, puntos: 0, racha: 0, rachaMax: 0, aciertos: 0,
      dominados: new Set(), fallados: new Set() });
    Nube.reiniciar();
    ir("quiz");
    mostrarPregunta();
  }

  // cada letra gira como un rodillo de tragamonedas y se detiene, de izquierda a derecha, hasta formar la frase
  const GLIFOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzáéíóúñ";
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let ruletaT = 0;
  function ruleta(el, texto) {
    clearTimeout(ruletaT);
    const signo = `<span class="signo" aria-hidden="true">&gt;</span> `;   // el «>» verde antes de cada afirmación
    const plano = () => { el.innerHTML = signo + esc(texto); };
    if (pausado) return plano();
    const paso = Math.min(18, 700 / texto.length);   // la frase entera se arma en menos de un segundo
    let i = 0;
    const palabras = texto.split(" ").map((palabra) => {
      const letras = [...palabra].map((c) => {
        const giros = 6 + Math.floor(Math.random() * 5);
        const tira = Array.from({ length: giros }, () => GLIFOS[Math.floor(Math.random() * GLIFOS.length)]);
        return `<span class="rodillo"><span class="fijo">${esc(c)}</span>` +
          `<span class="tira" style="--n:${giros};animation-delay:${Math.round(i++ * paso)}ms">${esc(tira.join("\n"))}\n${esc(c)}</span></span>`;
      }).join("");
      i++;
      return `<span class="palabra">${letras}</span>`;
    }).join(" ");
    el.innerHTML = `${signo}<span class="sr">${esc(texto)}</span><span aria-hidden="true">${palabras}</span>`;
    // al terminar, texto normal: se puede seleccionar y se ve nítido
    ruletaT = setTimeout(plano, i * paso + 900);
  }

  function mostrarPregunta() {
    const p = juego.preguntas[juego.i];
    juego.respondida = false;
    const total = juego.preguntas.length;
    $("#serie").innerHTML = `${String(juego.i + 1).padStart(2, "0")}<small>/${String(total).padStart(2, "0")}</small>`;
    $("#meta").textContent = `Nivel ${p.nivel} · ${p.cita.documento}`;
    $("#puntos").textContent = `${juego.puntos} pts`;
    $("#enunciado").classList.toggle("largo", p.enunciado.length > 140);   // los dilemas son escenarios: letra un poco menor
    ruleta($("#enunciado"), p.enunciado);
    $("#veredicto").hidden = true;
    const ops = $("#opciones");
    ops.innerHTML = "";
    p.opciones.forEach((o, k) => {
      const b = document.createElement("button");
      b.className = "opcion";
      b.innerHTML = `<span>${o}</span><kbd>${k + 1}</kbd>`;
      b.addEventListener("click", () => responder(k));
      ops.appendChild(b);
    });
    // los conceptos de la pregunta en curso pulsan; los ya resueltos conservan su estado
    p.conceptos.forEach((c) => {
      const n = Nube.nodo(c);
      if (n && n.estado !== "dominado") n.estado = "activo";
    });
    Nube.enfocar(p.conceptos);
    ops.firstChild.focus({ preventScroll: true });
  }

  function responder(k) {
    if (juego.respondida) return;
    juego.respondida = true;
    const p = juego.preguntas[juego.i], bien = k === p.correcta;
    // un solo aviso: queda únicamente la opción correcta, a todo el ancho
    [...$("#opciones").children].forEach((b, j) => {
      b.disabled = true;
      if (j === p.correcta) b.classList.add("bien");
      else b.hidden = true;
    });
    if (bien) {
      juego.aciertos++; juego.racha++;
      juego.rachaMax = Math.max(juego.rachaMax, juego.racha);
      juego.puntos += Math.round(10 * p.nivel * (juego.racha >= 3 ? 1.5 : 1));
      p.conceptos.forEach((c) => { juego.dominados.add(c); juego.fallados.delete(c); });
      Nube.estado(p.conceptos, "dominado");
      // lo acertado se recuerda para que los próximos ciclos traigan preguntas nuevas
      if (!progreso.has(p.id)) { progreso.add(p.id); guardarProgreso(); }
    } else {
      juego.racha = 0;
      p.conceptos.forEach((c) => { if (!juego.dominados.has(c)) juego.fallados.add(c); });
      Nube.estado(p.conceptos.filter((c) => !juego.dominados.has(c)), "fallado");
    }
    const res = $("#resultado");
    res.className = "resultado " + (bien ? "bien" : "mal");
    res.textContent = bien
      ? (juego.racha >= 3 ? `Bien. Racha de ${juego.racha} ×1,5` : "Bien.")
      : "Esta vez no.";
    // los dilemas cierran con «Para pensar: …»: va en su propio renglón
    const [texto, pensar] = p.explicacion.split(/\s*Para pensar:\s*/);
    $("#explicacion").textContent = texto;
    if (pensar) {
      const q = document.createElement("span");
      q.className = "para-pensar";
      q.innerHTML = "<b>Para pensar</b> ";
      q.append(pensar);
      $("#explicacion").append(q);
    }
    $("#cita").textContent = `Lineamientos ${p.cita.documento}, pág. ${p.cita.pagina} · ${p.cita.fragmento}`;
    $("#puntos").textContent = `${juego.puntos} pts`;
    $("#siguiente").firstChild.textContent = juego.i + 1 < juego.preguntas.length ? "Siguiente " : "Ver mi constelación ";
    $("#veredicto").hidden = false;
    $("#siguiente").focus({ preventScroll: true });
  }

  function siguiente() {
    juego.i++;
    if (juego.i < juego.preguntas.length) mostrarPregunta();
    else cerrar();
  }

  function cerrar() {
    const insignia = insigniaDe(juego.aciertos);
    coleccion[insignia.id] = (coleccion[insignia.id] || 0) + 1;
    guardar("tita.insignias", JSON.stringify(coleccion));
    const rango = `Insignia: ${insignia.nombre}`;
    const mejorPrevio = Number(leer("tita.mejor") || 0);
    const mejor = Math.max(mejorPrevio, juego.puntos);
    guardar("tita.mejor", String(mejor));

    $("#total").textContent = juego.puntos;
    $("#rango").innerHTML = `<span>${rango}</span>`;
    $("#aciertos").textContent = `${juego.aciertos}/${juego.preguntas.length}`;
    $("#racha").textContent = juego.rachaMax;
    $("#mejor").textContent = mejor;
    const lista = (ids) => ids.length
      ? ids.slice(0, 6).map((i) => `<span>${Nube.nodo(i)?.label ?? i}</span>`).join(" ")
        + (ids.length > 6 ? ` <span>y ${ids.length - 6} más</span>` : "")
      : `<span>—</span>`;
    $("#dominados").innerHTML = lista([...juego.dominados]);
    $("#explorar").innerHTML = lista([...juego.fallados]);
    pintarInsignias($("#progreso-cierre"), insignia.id);
    ir("cierre");
  }

  async function compartir() {
    const logo = new Image();
    logo.src = "img/bosque-logo.svg";
    await logo.decode().catch(() => {});
    const src = Nube.canvas, W = 1080, H = 1350;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "#f6edda"; x.fillRect(0, 0, W, H);
    // recorta solo la constelación y la centra en el espacio entre el logo y el puntaje
    const caja = Nube.encuadre(), area = { x: 72, y: 170, w: W - 144, h: H - 170 - 300 };
    const s = Math.min(area.w / caja.w, area.h / caja.h);
    const w = caja.w * s, h = caja.h * s;
    x.drawImage(src, caja.x * caja.dpr, caja.y * caja.dpr, caja.w * caja.dpr, caja.h * caja.dpr,
      area.x + (area.w - w) / 2, area.y + (area.h - h) / 2, w, h);
    try { x.drawImage(logo, 72, 56, 260, (260 * 317) / 1108); } catch (e) { /* sin logo, la imagen sigue */ }
    x.fillStyle = "#000";
    x.font = '100 160px "Jost", sans-serif';
    x.fillText(`${juego.puntos}`, 72, H - 170);
    x.font = '700 46px "Jost", sans-serif';
    const rango = $("#rango").textContent, rw = x.measureText(rango).width;
    x.fillStyle = "#f7c733"; x.fillRect(64, H - 142, rw + 16, 58);
    x.fillStyle = "#000"; x.fillText(rango, 72, H - 100);
    x.font = '400 26px "Jost", sans-serif'; x.fillStyle = "#6b6b6b";
    x.fillText("Lineamientos de IA · Universidad El Bosque", 72, H - 56);
    c.toBlob((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = "mi-constelacion.png";
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }

  /* ================= Ficha de concepto (mapa) ================= */
  const CORTO = { GEN: "Generales", ENS: "Enseñanza", CIE: "CTeI", EXT: "Extensión", GES: "Gestión" };

  function abrirFicha(n) {
    Nube.seleccionar(n.id);
    const d = DOCS[n.doc_principal];
    $("#ficha-doc").innerHTML = `<i style="background:${d.color}"></i>Sobre todo en ${d.nombre}`;
    $("#ficha-titulo").textContent = n.label;
    $("#ficha-desc").textContent = n.descripcion || "";
    $("#ficha-evidencia").textContent = n.evidencia ? `«${n.evidencia}»` : "";
    $("#ficha-fuente").textContent = n.cita ? `Lineamientos ${n.cita.documento}, pág. ${n.cita.pagina} · ${n.cita.fragmento}` : "";
    const docs = Object.entries(n.documentos).sort((a, b) => b[1] - a[1]);
    const max = docs[0][1];
    $("#ficha-docs").innerHTML = docs.map(([k, c]) =>
      `<li><span>${CORTO[k]}</span><b style="--c:${DOCS[k].color};width:${(100 * c) / max}%"></b><span>${c}</span></li>`).join("");
    const rel = GRAFO.links.filter((l) => l.source === n.id || l.target === n.id)
      .sort((a, b) => b.peso - a.peso).slice(0, 6)
      .map((l) => Nube.nodo(l.source === n.id ? l.target : l.source)).filter(Boolean);
    $("#ficha-rel").innerHTML = rel.map((r) => `<button class="pildora" data-concepto="${r.id}">${r.label}</button>`).join("");
    const nq = PREGUNTAS.filter((p) => p.conceptos.includes(n.id)).length;
    $("#ficha-pie").textContent = `Aparece en ${n.peso} fragmentos de los lineamientos` +
      (nq ? ` y en ${nq} ${nq === 1 ? "pregunta" : "preguntas"} del juego.` : ".");
    $("#ficha").hidden = false;
    document.body.classList.add("con-ficha");
    $("#ficha").scrollTop = 0;
  }

  function cerrarFicha() {
    $("#ficha").hidden = true;
    document.body.classList.remove("con-ficha");
    Nube.seleccionar(null);
  }

  Nube.alSeleccionar((n) => {
    if (document.body.dataset.vista !== "mapa") return;
    n ? abrirFicha(n) : cerrarFicha();
  });
  $("#ficha-cerrar").addEventListener("click", cerrarFicha);
  $("#intro-cerrar").addEventListener("click", () => $("#intro-mapa").classList.add("oculta"));
  $("#ficha-rel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-concepto]");
    if (b) abrirFicha(Nube.nodo(b.dataset.concepto));
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#ficha").hidden) cerrarFicha(); });

  /* ================= Vistas ================= */
  function ir(vista) {
    const fuera = ["mapa", "consulta", "historias", "acerca"].includes(document.body.dataset.vista);
    if (vista === "inicio" && fuera && juego.preguntas.length && juego.i < juego.preguntas.length) {
      vista = "quiz"; // volver a una partida en curso
    }
    if (vista !== "mapa" && !$("#ficha").hidden) cerrarFicha();
    document.body.dataset.vista = vista;
    const pestana = ["mapa", "consulta", "historias", "acerca"].includes(vista) ? vista : "inicio";
    document.querySelectorAll(".pestana").forEach((b) => {
      if (b.dataset.ir === pestana) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    if (vista === "mapa") Nube.modo({ zoom: 1.05, giro: 0.00025, interactiva: true });
    else if (vista === "cierre") Nube.modo({ zoom: 0.92, giro: 0.0004, interactiva: true });
    else if (vista === "quiz") Nube.modo({ zoom: 1.05, giro: 0 });
    else Nube.modo({ zoom: 1, giro: 0.0007 });
    if (vista === "inicio") { juego.preguntas = []; Nube.reiniciar(); pintarInsignias($("#progreso-inicio")); }
    if (vista === "historias") $("#historias").scrollTop = 0;
    if (vista !== "historias" && location.hash.startsWith("#historia-")) history.replaceState(null, "", location.pathname);
    if (vista === "historias") mostrarHistoria(location.hash);
  }

  /* ================= Historias: cada tarjeta abre un artículo tipo blog ================= */
  const HISTORIAS = [...document.querySelectorAll(".rv-nota")].map((el) => ({
    num: el.querySelector(".rv-num").textContent,
    tema: el.querySelector(".rv-tag").textContent,
    titulo: el.querySelector("h2").textContent,
    bajada: el.querySelector("p").textContent,
  }));
  // conceptos de los lineamientos que toda historia debería contar cómo cuidó
  const CUIDADOS = ["declaracion-de-uso", "datos-personales", "supervision-humana", "autoria", "propiedad-intelectual"];

  function pintarArticulo(i) {
    const h = HISTORIAS[i];
    const conceptos = CUIDADOS.map((id) => Nube.nodo(id)).filter(Boolean)
      .map((n) => `<button class="pildora" type="button" data-concepto="${n.id}">${esc(n.label)}</button>`).join("");
    const otras = HISTORIAS.map((o, j) => j === i ? "" :
      `<li><button type="button" data-historia="${j}"><span class="rv-num">${o.num}</span><small>${esc(o.tema)}</small>${esc(o.titulo)}</button></li>`).join("");
    $("#rv-articulo").innerHTML = `
      <button class="pildora art-volver" type="button" data-volver>← Historias</button>
      <div class="art-cabeza"><span class="rv-num">${h.num}</span><span class="rv-tag">${esc(h.tema)}</span></div>
      <h1 class="art-titulo">${esc(h.titulo)}</h1>
      <p class="art-bajada">${esc(h.bajada)}</p>
      <p class="art-meta"><span><b>Estado:</b> por publicar</span><span><b>Línea:</b> ${esc(h.tema)}</span></p>
      <div class="art-imagen">Imagen del proyecto</div>
      <div class="art-cuerpo">
        <h2>El proyecto</h2>
        <p class="pendiente">Aquí irá quién lo hace, desde qué facultad o unidad, y qué pregunta o necesidad lo mueve.</p>
        <h2>Cómo usa la IA</h2>
        <p class="pendiente">Qué herramientas o sistemas usa, en qué parte del proceso intervienen y qué hace la IA y qué hacen las personas.</p>
        <blockquote class="art-cita">Aquí irá una frase de alguien del equipo.</blockquote>
        <h2>Cuidados según los lineamientos</h2>
        <p class="pendiente">Cómo declaró el uso de IA, qué datos usó y cómo los protegió, quién revisó los resultados y cómo resolvió la autoría.</p>
        <div class="art-conceptos">${conceptos}</div>
        <h2>Lo que aprendió</h2>
        <p class="pendiente">Qué funcionó, qué no y qué le recomendaría a otro equipo de la universidad.</p>
      </div>
      <nav class="art-otras" aria-label="Otras historias"><p class="etiqueta">Otras historias</p><ul>${otras}</ul></nav>`;
  }

  // la dirección (#historia-02) decide qué se ve: así funciona el botón «atrás» del navegador
  function mostrarHistoria(hash) {
    const m = /^#historia-(\d+)$/.exec(hash || "");
    const i = m ? HISTORIAS.findIndex((h) => h.num === m[1]) : -1;
    $("#rv-portada").hidden = i >= 0;
    $("#rv-articulo").hidden = i < 0;
    if (i >= 0) pintarArticulo(i);
    $("#historias").scrollTop = 0;
  }
  const abrirHistoria = (i) => { location.hash = `historia-${HISTORIAS[i].num}`; };
  addEventListener("hashchange", () => {
    if (location.hash.startsWith("#historia-") && document.body.dataset.vista !== "historias") ir("historias");
    else if (document.body.dataset.vista === "historias") mostrarHistoria(location.hash);
  });
  $("#historias").addEventListener("click", (e) => {
    const t = e.target.closest("[data-historia], [data-volver], [data-concepto]");
    if (!t) return;
    if (t.dataset.volver !== undefined) { history.pushState(null, "", location.pathname); mostrarHistoria(""); }
    else if (t.dataset.concepto) { ir("mapa"); abrirFicha(Nube.nodo(t.dataset.concepto)); }
    else abrirHistoria(Number(t.dataset.historia));
  });
  $("#historias").addEventListener("keydown", (e) => {
    const t = e.target.closest(".rv-nota[data-historia]");
    if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirHistoria(Number(t.dataset.historia)); }
  });

  /* ================= Consulta (asistente aún sin conectar) ================= */
  function mensaje(texto, quien) {
    const p = document.createElement("p");
    p.className = `msg ${quien}`;
    p.textContent = texto;
    $("#chat").appendChild(p);
    $("#chat").scrollTop = $("#chat").scrollHeight;
  }
  $("#form-consulta").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#pregunta").value.trim();
    if (!q) return;
    mensaje(q, "yo");
    $("#pregunta").value = "";
    setTimeout(() => mensaje("Gracias por tu pregunta. Todavía no estoy conectado, así que no puedo responderla. " +
      "Cuando esté listo, responderé con la cita exacta del documento y la página.", "bot"), 450);
  });


  document.querySelectorAll("[data-ir]").forEach((b) =>
    b.addEventListener("click", (e) => { e.preventDefault(); ir(b.dataset.ir); }));
  // selector de rol: flechas (o ← → del teclado) para cambiar, «Empezar» para jugar
  const ROLES = [["estudiante", "Estudiante"], ["profesor", "Profesor"], ["investigador", "Investigador"], ["administrativo", "Administrativo"]];
  let rolI = Math.max(0, ROLES.findIndex(([r]) => r === leer("tita.rol")));
  function pintarRol(dir) {
    const el = $("#rol-actual");
    el.textContent = ROLES[rolI][1];
    el.classList.remove("cambia-sig", "cambia-ant");
    if (dir) { void el.offsetWidth; el.classList.add(dir > 0 ? "cambia-sig" : "cambia-ant"); }
  }
  const moverRol = (dir) => { rolI = (rolI + dir + ROLES.length) % ROLES.length; pintarRol(dir); };
  $("#rol-ant").addEventListener("click", () => moverRol(-1));
  $("#rol-sig").addEventListener("click", () => moverRol(1));
  $(".caja-rol").addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); moverRol(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); moverRol(1); }
  });
  $("#empezar").addEventListener("click", () => { guardar("tita.rol", ROLES[rolI][0]); empezar(ROLES[rolI][0]); });
  pintarRol(0);
  $("#siguiente").addEventListener("click", siguiente);
  $("#otra").addEventListener("click", () => empezar(juego.rol));
  $("#compartir").addEventListener("click", compartir);
  const btnMov = $("#movimiento");
  const pintarMov = () => { btnMov.setAttribute("aria-pressed", pausado); btnMov.title = pausado ? "Reanudar movimiento" : "Pausar movimiento"; };
  btnMov.addEventListener("click", () => { pausado = !pausado; pintarMov(); });
  pintarMov();

  addEventListener("keydown", (e) => {
    if (document.body.dataset.vista !== "quiz" || e.metaKey || e.ctrlKey) return;
    if (!juego.respondida && (e.key === "1" || e.key === "2")) responder(Number(e.key) - 1);
  });

  /* ================= Arranque ================= */
  async function arrancar() {
    const cont = $("#contador"), dur = pausado ? 0 : 1300, t = performance.now();
    const datos = cargarDatos();
    // con setTimeout y no rAF: una pestaña en segundo plano no debe quedarse en la carga
    await new Promise((fin) => {
      const paso = () => {
        const p = dur ? Math.min(1, (performance.now() - t) / dur) : 1;
        cont.textContent = String(Math.round(100 * (1 - Math.pow(1 - p, 3)))).padStart(3, "0");
        p < 1 ? setTimeout(paso, 30) : fin();
      };
      paso();
    });
    try {
      await datos;
      $("#pie").textContent = `${GRAFO.nodes.length} conceptos · 5 documentos`;
    } catch (e) {
      cont.textContent = "sin datos";
      console.error(e);
      return;
    }
    Nube.iniciar();
    ir(location.hash.startsWith("#historia-") ? "historias" : "inicio");
  }
  arrancar();
})();
