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
  // cuatro rangos de resultado: cada ciclo de 10 preguntas da uno, según los aciertos (de mayor a menor exigencia)
  // (los ids se conservan para no perder lo que cada navegador ya guardó)
  const INSIGNIAS = [
    { id: "i10", nombre: "Dominio del tema", min: 10, marca: "10", requisito: "10 de 10" },
    { id: "i8", nombre: "Muy buen manejo", min: 8, marca: "8", requisito: "8 o 9" },
    { id: "i6", nombre: "Buen avance", min: 6, marca: "6", requisito: "6 o 7" },
    { id: "i0", nombre: "En proceso", min: 0, marca: "5", requisito: "5 o menos" },
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
    let cadena = [];   // inicio: conceptos elegidos en la rueda, en orden; se unen con una línea
    let resaltados = new Set();   // mapa: conceptos que comparten pregunta con el seleccionado (resalte suave)

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
      enlaces = graph.links.filter((l) => porId[l.source] && porId[l.target])
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
      // acerca: la esfera a la izquierda, el texto a la derecha
      if (vista === "acerca" && W >= 860) return { cx: W * 0.27, cy: H * 0.52, R: Math.min(H * 0.3, W * 0.17) * zoom };
      // inicio: esfera arriba a la izquierda, llamado a jugar debajo, rueda de conceptos a la derecha
      if (vista === "inicio") {
        if (W < 860) { const r = Math.min(W * 0.3, H * 0.14) * zoom; return { cx: W * 0.5, cy: 62 + r, R: r }; }
        // mismas medidas que usa el CSS para ubicar la rueda y los indicadores alrededor de la esfera
        return { cx: W * 0.4, cy: H * 0.37, R: Math.min(H * 0.21, W * 0.14) * zoom };
      }
      const conPanel = ["inicio", "quiz", "cierre", "acerca", "consulta"].includes(vista);
      // en móvil la ficha ocupa la mitad de abajo: la nube sube para que el punto elegido se vea
      const cy = movil && (conPanel || seleccionado) ? H * 0.27 : conPanel ? H * 0.38 : H * 0.5;
      const R = (movil ? (conPanel ? Math.min(W * 0.28, H * 0.22) : W * 0.3) : Math.min(W, H) * (conPanel ? 0.27 : 0.38)) * zoom;
      // en móvil las etiquetas salen a la derecha del punto: correr el centro a la izquierda
      return { cx: movil ? W * 0.4 : W / 2, cy: movil && !conPanel && !seleccionado ? H * 0.38 : cy, R };
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

      const enInicio = document.body.dataset.vista === "inicio";
      // enlaces (en el inicio quedan grises: lo que se ilumina es el recorrido)
      for (const l of enlaces) {
        const act = !enInicio && (l.a.estado !== "inactivo" && l.b.estado !== "inactivo");
        const prof = (l.a.pz + l.b.pz) / 2;
        // relación del concepto seleccionado con uno resaltado (comparten pregunta)
        const rel = seleccionado && ((l.a === seleccionado && resaltados.has(l.b)) || (l.b === seleccionado && resaltados.has(l.a)));
        cx.lineWidth = rel ? 1.4 + 0.3 * Math.min(l.peso, 5) : 0.6 + 0.25 * Math.min(l.peso, 5);   // más preguntas, línea más gruesa
        cx.strokeStyle = rel ? `rgba(247,74,45,${0.35 + 0.2 * (prof + 1)})`
          : act ? `rgba(247,74,45,${0.3 + 0.25 * (prof + 1)})` : `rgba(0,0,0,${0.04 + 0.06 * (prof + 1)})`;
        cx.beginPath(); cx.moveTo(l.a.px, l.a.py); cx.lineTo(l.b.px, l.b.py); cx.stroke();
      }

      // recorrido del inicio: cada concepto elegido se une con el siguiente
      if (enInicio && cadena.length > 1) {
        cx.strokeStyle = "#f74a2d"; cx.lineWidth = 2; cx.lineJoin = "round";
        cx.beginPath(); cadena.forEach((d, i) => (i ? cx.lineTo(d.px, d.py) : cx.moveTo(d.px, d.py))); cx.stroke();
      }

      const pulso = (Math.sin(now / 380) + 1) / 2;
      const enQuiz = document.body.dataset.vista === "quiz";
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
          // acierto: halo verde
          cx.fillStyle = "#2f9e5b"; cx.globalAlpha = 0.32;
          cx.beginPath(); cx.arc(d.px, d.py, r * 3.4, 0, 7); cx.fill();
          alfa = 1; txt = "#1d5c37";
        } else if (d.estado === "fallado") {
          // fallo: halo rojo
          cx.fillStyle = "#d83e2e"; cx.globalAlpha = 0.28;
          cx.beginPath(); cx.arc(d.px, d.py, r * 3.4, 0, 7); cx.fill();
          alfa = 1; txt = "#a52a1e";
        }
        if (resaltados.has(d)) {
          // resalte suave: halo del color de su documento y nombre visible
          cx.fillStyle = DOCS[d.doc_principal].color; cx.globalAlpha = 0.18;
          cx.beginPath(); cx.arc(d.px, d.py, r * 3.2, 0, 7); cx.fill();
          alfa = Math.max(alfa, 0.9); txt = "rgba(0,0,0,.75)";
        }

        cx.globalAlpha = alfa;
        cx.lineWidth = 0.75;
        if (d.estado === "fallado" || d.estado === "dominado") {
          // punto rojo si se falló, verde si se acertó
          cx.fillStyle = d.estado === "fallado" ? "#d83e2e" : "#2f9e5b";
          cx.strokeStyle = "rgba(0,0,0,.35)";
          cx.beginPath(); cx.arc(d.px, d.py, r, 0, 7); cx.fill(); cx.stroke();
        } else {
          // borde fino: la lima y la menta casi no se ven sobre blanco
          cx.fillStyle = d.estado === "inactivo" && enQuiz ? "#d9ccb0"
            : d.estado === "inactivo" && enInicio ? "#c3c6ca" : DOCS[d.doc_principal].color;
          cx.strokeStyle = "rgba(0,0,0,.35)";
          cx.beginPath(); cx.arc(d.px, d.py, r, 0, 7); cx.fill(); cx.stroke();
        }

        cx.globalAlpha = 1;
        if (d === seleccionado) {
          cx.strokeStyle = "#000"; cx.lineWidth = 1.5;
          cx.beginPath(); cx.arc(d.px, d.py, r + 6, 0, 7); cx.stroke();
        }
        const destacado = d.estado === "activo" || d.estado === "dominado" || d.estado === "fallado" || d.estado === "elegido" || d === hover || d === seleccionado || resaltados.has(d);
        const vistaAhora = document.body.dataset.vista;
        if ((vistaAhora === "inicio" || vistaAhora === "acerca") && !destacado) continue;   // inicio y acerca: esfera limpia
        if (vistaAhora === "mapa" && W < 860 && !destacado) continue;   // celular: en el mapa solo se rotula lo que se toca
        // celular, en el test: sin nombres hasta responder; luego solo los de las preguntas ya respondidas
        if (vistaAhora === "quiz" && W < 860 && d.estado !== "dominado" && d.estado !== "fallado" && d !== hover && d !== seleccionado) continue;
        cx.font = `${destacado ? 700 : 400} ${destacado ? 15 : 13.5}px "Jost", system-ui, sans-serif`;
        cx.fillStyle = d === hover || d === seleccionado ? "#000" : txt;
        // la etiqueta va a la derecha del punto; si se saldría de la pantalla, va a la izquierda
        const ancho = cx.measureText(d.label).width;
        // en el inicio, los puntos de la mitad derecha se rotulan hacia adentro para no pisar la rueda
        const haciaIzq = (enInicio && W >= 860 && d.px > m.cx) || d.px + r + 5 + ancho > W - 4;
        const tx = haciaIzq ? d.px - r - 5 - ancho : d.px + r + 5;
        cx.fillText(d.label, tx, d.py + 4);

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

    function fijarCadena(ids) { cadena = ids.map((i) => porId[i]).filter(Boolean); }
    function resaltar(ids) { resaltados = new Set(ids.map((i) => porId[i]).filter(Boolean)); }

    return { cargar, enfocar, estado, reiniciar, modo, seleccionar, encuadre, fijarCadena, resaltar, alSeleccionar: (fn) => (alSeleccionar = fn),
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
    Rueda.iniciar();
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
      <p class="etiqueta">Tu resultado en ${N_PREGUNTAS} preguntas</p>
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
    $("#revisados-lista").innerHTML = "";
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

  // a la izquierda: una píldora por concepto revisado en el ciclo, con ✓ (acertado alguna vez en el ciclo) o ✗
  function marcarRevisados(ids, bien) {
    const lista = $("#revisados-lista");
    ids.forEach((id) => {
      const n = Nube.nodo(id);
      if (!n) return;
      let b = lista.querySelector(`[data-concepto="${id}"]`);
      if (!b) {
        b = document.createElement("button");
        b.type = "button"; b.className = "pildora revisado"; b.dataset.concepto = id;
        b.innerHTML = `<span class="marca" aria-hidden="true"></span><span class="nombre"></span>`;
        b.querySelector(".nombre").textContent = n.label;
        lista.append(b);
      }
      // igual que la esfera: un concepto acertado en el ciclo queda en verde aunque luego se falle
      const ok = bien || juego.dominados.has(id);
      b.classList.toggle("bien", ok); b.classList.toggle("mal", !ok);
      b.querySelector(".marca").textContent = ok ? "✓" : "✗";
      b.setAttribute("aria-label", `${n.label}: ${ok ? "acertado" : "fallado"}. Ver ficha`);
    });
    lista.scrollTop = lista.scrollHeight;
  }
  $("#revisados-lista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-concepto]");
    if (b) abrirFicha(Nube.nodo(b.dataset.concepto), true);
  });

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
    marcarRevisados(p.conceptos, bien);
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
    // preguntas del Excel: «qué hacer» y la relación entre sus dos conceptos
    if (p.que_hacer) {
      const h = document.createElement("span");
      h.className = "para-pensar que-hacer";
      h.innerHTML = "<b>Qué hacer en una situación similar</b> ";
      h.append(p.que_hacer);
      $("#explicacion").append(h);
    }
    if (p.relacion) {
      const [a, b] = p.conceptos.map((c) => Nube.nodo(c)?.label || c);
      const r = document.createElement("span");
      r.className = "relacion";
      r.innerHTML = `<b>${a} + ${b}</b> `;
      r.append(p.relacion.texto);
      $("#explicacion").append(r);
    }
    $("#cita").textContent = p.cita.apartado
      ? `Lineamientos ${p.cita.documento} · ${p.cita.apartado}, pág. ${p.cita.pagina}`
      : `Lineamientos ${p.cita.documento}, pág. ${p.cita.pagina}`;
    $("#puntos").textContent = `${juego.puntos} pts`;
    $("#siguiente").firstChild.textContent = juego.i + 1 < juego.preguntas.length ? "Siguiente " : "Ver mis resultados ";
    $("#veredicto").hidden = false;
    $("#siguiente").focus({ preventScroll: true });
    // si la explicación no cabe (celular), baja el panel hasta el botón para seguir
    $("#siguiente").scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    const rango = `Tu resultado: ${insignia.nombre}`;
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
    x.fillStyle = "#eff0f0"; x.fillRect(0, 0, W, H);
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
      a.href = URL.createObjectURL(b); a.download = "mis-resultados.png";
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }

  /* ================= Rueda de conceptos (inicio) ================= */
  // Lista curva tipo tambor. En escritorio gira sola cuando el mouse se acerca al borde de arriba
  // o de abajo, y acelera cuanto más cerca está. Un clic elige el concepto: se colorea en la esfera
  // y se une con el anterior, armando un recorrido. Sin clics, la esfera queda en gris.
  const Rueda = (() => {
    const lista = $("#rueda-lista");
    let items = [], els = [], pos = 0, obj = 0, n = 0, arr = null;
    let vel = 0, desde = 0, tPrev = 0, elegidos = [], centro = -1;
    let impulso = 0, friccion = 0.955, usuario = false;   // usuario: ya movió la rueda (la intro no cuenta)   // rueda del mouse / arrastre: giro con inercia, como un rodillo de tragamonedas
    // conceptos explorados en esta visita: cada vez que se abre la página, el contador empieza en 00
    const explorados = new Set();
    try { localStorage.removeItem("tita.explorados"); } catch (e) { /* versión anterior lo guardaba */ }
    const NUM_DOC = { GEN: "01", ENS: "02", CIE: "03", EXT: "04", GES: "05" };
    const dos = (k) => String(k).padStart(2, "0");   // vel: renglones por segundo según el borde; desde: cuándo empezó
    const MAX_RECORRIDO = 12;
    const PASO = () => (innerWidth < 860 ? 30 : 40);        // alto de cada renglón
    const VISIBLES = () => (innerWidth < 860 ? 3 : 7);       // renglones a cada lado del centro

    function crear() {
      items = [...GRAFO.nodes].sort((a, b) => a.label.localeCompare(b.label, "es"));
      n = items.length;
      lista.innerHTML = "";
      els = items.map((it) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "rueda-item"; b.setAttribute("role", "option");
        b.textContent = it.label; b.tabIndex = -1;
        b.style.setProperty("--c", DOCS[it.doc_principal].color);
        lista.append(b);
        return b;
      });
      pos = obj = 0;
      pista();
      pintarExplorados();
    }
    // índice relativo más corto (la lista es circular)
    const rel = (i, p) => { let k = i - p; while (k > n / 2) k -= n; while (k < -n / 2) k += n; return k; };
    const centrar = (i) => { obj = Math.round(pos) + rel(i, Math.round(pos)); };
    const mover = (d) => { obj = Math.round(obj) + d; };

    function pintar(now) {
      const dt = Math.min(now - (tPrev || now), 300); tPrev = now;
      if (vel) {
        // giro por borde: la velocidad depende de qué tan cerca del borde está el mouse
        // y crece mientras se mantiene ahí (hasta 2,5 veces en 1,5 s)
        const acel = 1 + Math.min((now - desde) / 1000, 1.5);
        obj += vel * acel * dt / 1000; pos = obj;
      } else if (impulso) {
        // inercia: el rodillo sigue girando y frena solo; al detenerse cae en un concepto
        obj += impulso * dt / 1000; pos = obj;
        impulso *= Math.pow(friccion, dt / 16);
        if (Math.abs(impulso) < 1.2) { impulso = 0; friccion = 0.955; obj = Math.round(obj); }
      } else pos += (obj - pos) * Math.min(1, 0.16 * dt / 16);
      const paso = PASO(), vis = VISIBLES();
      // curva cóncava: los conceptos van sobre un arco con centro en el de la esfera
      const movil = innerWidth < 860;
      const radio = movil ? 900 : Math.max(200, lista.getBoundingClientRect().left + els[0].offsetLeft - innerWidth * 0.4);
      const da = paso / radio;
      els.forEach((el, i) => {
        const k = rel(i, pos), a = k * da;
        if (Math.abs(k) > vis + 0.5) { el.style.visibility = "hidden"; return; }
        el.style.visibility = "visible";
        const x = radio * (Math.cos(a) - 1), y = radio * Math.sin(a);
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translateY(-50%) rotate(${(a * 57.3 * 0.55).toFixed(2)}deg) scale(${(1 - Math.abs(k) * 0.03).toFixed(3)})`;
        el.style.opacity = Math.max(0, 1 - Math.abs(k) / (vis + 1)).toFixed(3);
      });
      // indicador: número y documento del concepto que pasa por el centro
      const c = ((Math.round(pos) % n) + n) % n;
      if (c !== centro) {
        centro = c;
        const it = items[c];
        $("#ind-num").textContent = dos(c + 1);
        $("#ind-doc").textContent = `doc ${NUM_DOC[it.doc_principal]}`;
      }
      // explorado: todo concepto en el que la rueda se detiene (o que se elige con clic)
      if (usuario && !vel && !impulso && !arr && Math.abs(obj - pos) < 0.02) explorar(items[c].id);
      requestAnimationFrame(pintar);
    }
    function explorar(id) {
      if (explorados.has(id)) return;
      explorados.add(id);
      pintarExplorados();
    }
    function pintarExplorados() {
      const k = [...explorados].filter((id) => items.some((it) => it.id === id)).length;
      $("#ind-exp").textContent = dos(k);   // explorados / total
      $("#ind-total").textContent = n;
    }

    // clic: el concepto se colorea en la esfera y se une con el elegido antes
    function elegir(i) {
      impulso = 0; vel = 0;
      const it = items[i];
      if (elegidos[elegidos.length - 1] !== it.id) {
        elegidos.push(it.id);
        if (elegidos.length > MAX_RECORRIDO) elegidos.shift();
      }
      usuario = true;
      explorar(it.id);
      els.forEach((el) => el.classList.remove("activa"));
      els[i].classList.add("activa");
      els.forEach((el, j) => el.classList.toggle("elegida", elegidos.includes(items[j].id)));
      centrar(i);
      $("#rueda-desc").textContent = it.descripcion || "";
      $("#rueda-mapa").hidden = false;
      $("#rueda-limpiar").hidden = elegidos.length < 2;
      $("#ficha-acciones [data-accion=limpiar]").hidden = elegidos.length < 2;
      // escritorio: la misma ficha que en el mapa (descripción, cita, documentos y relaciones)
      if (innerWidth >= 860) abrirFicha(Nube.nodo(it.id), true);
      pintarEsfera(true);
    }
    function pintarEsfera(enfocar) {
      if (document.body.dataset.vista !== "inicio") return;
      Nube.reiniciar();
      Nube.estado(elegidos, "elegido");
      if (elegidos.length) Nube.estado([elegidos[elegidos.length - 1]], "activo");
      Nube.fijarCadena(elegidos);
      if (enfocar && elegidos.length) Nube.enfocar([elegidos[elegidos.length - 1]]);
    }
    function pista() {
      $("#rueda-desc").textContent = "Elige un concepto para verlo en la esfera. Cada uno que elijas se une con el anterior.";
      $("#rueda-mapa").hidden = true;
      $("#rueda-limpiar").hidden = true;
    }
    function limpiar() {
      elegidos = [];
      els.forEach((el) => el.classList.remove("activa", "elegida"));
      if (!$("#ficha").hidden) { $("#ficha").hidden = true; document.body.classList.remove("con-ficha"); }
      pista(); pintarEsfera(false);
    }

    // escritorio: cerca del borde de arriba o de abajo, gira hacia ese lado y acelera
    lista.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      if (arr) return;
      const r = lista.getBoundingClientRect();
      if (innerWidth >= 860 && e.clientX < r.left + innerWidth * 0.1) { if (vel) { vel = 0; obj = Math.round(obj); } return; }
      const t = ((e.clientY - r.top) / r.height) * 2 - 1;      // -1 arriba · 1 abajo
      const zona = 0.45;                                         // el 27 % de arriba y de abajo
      const v = Math.abs(t) > zona ? Math.sign(t) * (1 + Math.pow((Math.abs(t) - zona) / (1 - zona), 2) * 9) : 0;   // 1 a 10 renglones/s
      if (v && !vel) { desde = performance.now(); usuario = true; }
      if (!v && vel) obj = Math.round(obj);
      vel = v;
    });
    lista.addEventListener("pointerleave", () => { vel = 0; obj = Math.round(obj); });

    lista.addEventListener("wheel", (e) => {
      e.preventDefault();
      usuario = true;
      const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;   // líneas → píxeles
      impulso = Math.max(-40, Math.min(40, impulso + d * 0.06));  // renglones por segundo
    }, { passive: false });
    // celular: arrastrar para girar, tocar para elegir
    lista.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") { arr = { y: e.clientY, obj, movido: false, mouse: true }; return; }
      usuario = true;
      arr = { y: e.clientY, obj: Math.round(obj), movido: false, t: performance.now(), yPrev: e.clientY, v: 0 };
      impulso = 0;
      lista.setPointerCapture(e.pointerId);
    });
    lista.addEventListener("pointermove", (e) => {
      if (!arr || arr.mouse) return;
      const dy = e.clientY - arr.y;
      if (Math.abs(dy) > 4) arr.movido = true;
      if (arr.movido) {
        obj = arr.obj - dy / PASO(); pos = obj;
        const ahora = performance.now(), dtm = Math.max(1, ahora - arr.t);
        arr.v = -((e.clientY - arr.yPrev) / PASO()) / (dtm / 1000);   // renglones por segundo
        arr.t = ahora; arr.yPrev = e.clientY;
      }
    });
    const soltar = (e) => {
      if (!arr) return;
      const { movido, v } = arr;
      arr = null;
      if (!movido) {
        const b = e.target.closest && e.target.closest(".rueda-item");
        if (b) elegir(els.indexOf(b));
      } else if (Math.abs(v) > 3) impulso = Math.max(-40, Math.min(40, v));
      else obj = Math.round(obj);
    };
    lista.addEventListener("pointerup", soltar);
    lista.addEventListener("pointercancel", () => { arr = null; obj = Math.round(obj); });
    lista.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); usuario = true; mover(1); }
      if (e.key === "ArrowUp") { e.preventDefault(); usuario = true; mover(-1); }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(((Math.round(pos) % n) + n) % n); }
    });
    $("#rueda-ant").addEventListener("click", () => { usuario = true; mover(-1); });
    $("#rueda-sig").addEventListener("click", () => { usuario = true; mover(1); });
    $("#rueda-limpiar").addEventListener("click", limpiar);
    function verEnMapa() {
      const id = elegidos[elegidos.length - 1];
      if (!id) return;
      ir("mapa");
      setTimeout(() => abrirFicha(Nube.nodo(id)), 350);
    }
    $("#rueda-mapa").addEventListener("click", verEnMapa);

    // al abrir la página: la esfera gira 1,4 s con todos los conceptos encendidos (y sus nombres)
    // mientras la rueda da vueltas rápido y frena; luego los conceptos se apagan uno a uno
    function intro() {
      if (pausado) return;
      const ids = items.map((it) => it.id);
      Nube.estado(ids, "elegido");
      impulso = 46; friccion = 0.965;   // ~1,7 s hasta detenerse
      Nube.modo({ zoom: 1, giro: 0.003 });
      setTimeout(() => {
        if (document.body.dataset.vista !== "inicio") return;
        Nube.modo({ zoom: 1, giro: 0.00025 });
        barajar(ids).forEach((id, k) => setTimeout(() => {
          if (document.body.dataset.vista === "inicio" && !elegidos.includes(id)) Nube.estado([id], "inactivo");
        }, k * 10));   // se apagan uno a uno en ~0,5 s
      }, 1400);
    }

    return {
      verEnMapa, limpiar, pista, intro,
      elegirId(id) { const i = items.findIndex((it) => it.id === id); if (i >= 0) elegir(i); },
      iniciar() { crear(); requestAnimationFrame(pintar); },
      activar() { pintarEsfera(false); },   // al volver al inicio, recupera el recorrido
    };
  })();

  /* ================= Ficha de concepto (mapa) ================= */
  const CORTO = { GEN: "Generales", ENS: "Enseñanza", CIE: "CTeI", EXT: "Extensión", GES: "Gestión" };

  // la misma ficha sirve en el mapa y en el inicio (al elegir un concepto en la rueda)
  function abrirFicha(n, enInicio = false) {
    if (!enInicio) {
      Nube.seleccionar(n.id);
      // cada pregunta del Excel une dos conceptos: se resaltan levemente los que comparten pregunta con este
      const pares = new Set();
      PREGUNTAS.forEach((p) => { if (p.serie === "base" && p.conceptos.includes(n.id)) p.conceptos.forEach((c) => c !== n.id && pares.add(c)); });
      Nube.resaltar([...pares]);
    }
    // la tarjeta gira como una carta: se voltea hasta quedar de canto, cambia el contenido y termina de girar
    const f = $("#ficha"), cambia = !f.hidden && f.dataset.concepto && f.dataset.concepto !== n.id;
    f.dataset.concepto = n.id;
    if (pausado || quieto.matches) { llenarFicha(n); return; }
    clearTimeout(f._volteo);
    f.classList.remove("voltea-sale", "voltea-entra");
    void f.offsetWidth;
    // al terminar se quita la clase: si la pestaña está en segundo plano y la animación no avanza, la ficha no queda de canto
    const entra = () => { llenarFicha(n); f.classList.add("voltea-entra"); f._volteo = setTimeout(() => f.classList.remove("voltea-entra"), 360); };
    if (cambia) {
      f.classList.add("voltea-sale");
      f._volteo = setTimeout(() => { f.classList.remove("voltea-sale"); void f.offsetWidth; entra(); }, 200);
    } else entra();
  }

  function llenarFicha(n) {
    const d = DOCS[n.doc_principal];
    $("#ficha-doc").innerHTML = `<i style="background:${d.color}"></i>Sobre todo en ${d.nombre}`;
    $("#ficha-titulo").textContent = n.label;
    $("#ficha-desc").textContent = n.descripcion || "";
    $("#ficha-evidencia").textContent = n.evidencia ? `«${n.evidencia}»` : "";
    $("#ficha-fuente").textContent = n.cita ? `Lineamientos ${n.cita.documento}, pág. ${n.cita.pagina}` : "";
    const docs = Object.entries(n.documentos).sort((a, b) => b[1] - a[1]);
    const max = docs[0][1];
    $("#ficha-docs").innerHTML = docs.map(([k, c]) =>
      `<li><span>${CORTO[k]}</span><b style="--c:${DOCS[k].color};width:${(100 * c) / max}%"></b><span>${c}</span></li>`).join("");
    // relaciones del Excel: cada una con su explicación
    const rel = GRAFO.links.filter((l) => l.source === n.id || l.target === n.id)
      .sort((a, b) => b.peso - a.peso)
      .map((l) => ({ otro: Nube.nodo(l.source === n.id ? l.target : l.source), l })).filter((x) => x.otro);
    $("#ficha-rel").innerHTML = "";
    rel.forEach(({ otro, l }) => {
      const li = document.createElement("div");
      li.className = "rel";
      li.innerHTML = `<button class="pildora" data-concepto="${otro.id}">${otro.label}</button><span></span>`;
      li.querySelector("span").textContent = l.explicacion || "";
      $("#ficha-rel").append(li);
    });
    const nq = PREGUNTAS.filter((p) => p.conceptos.includes(n.id)).length;
    $("#ficha-pie").textContent = `Aparece en ${n.peso} fragmentos de los lineamientos` +
      (nq ? ` y en ${nq} ${nq === 1 ? "pregunta" : "preguntas"} del juego.` : ".") +
      ` Tiene ${rel.length} ${rel.length === 1 ? "relación" : "relaciones"} en el mapa.`;
    $("#ficha").hidden = false;
    document.body.classList.add("con-ficha");
    $("#ficha").scrollTop = 0;
  }

  function cerrarFicha() {
    $("#ficha").hidden = true;
    document.body.classList.remove("con-ficha");
    Nube.resaltar([]);
    if (document.body.dataset.vista === "inicio") Rueda.pista(); else Nube.seleccionar(null);
  }

  Nube.alSeleccionar((n) => {
    const vista = document.body.dataset.vista;
    if (vista === "mapa") n ? abrirFicha(n) : cerrarFicha();
    // en el test y en sus resultados, un clic en un punto abre la misma ficha (sin tocar la esfera)
    else if ((vista === "quiz" || vista === "cierre") && n) abrirFicha(n, true);
  });
  $("#ficha-cerrar").addEventListener("click", cerrarFicha);
  $("#intro-cerrar").addEventListener("click", () => $("#intro-mapa").classList.add("oculta"));
  $("#ficha-rel").addEventListener("click", (e) => {
    const b = e.target.closest("[data-concepto]");
    if (!b) return;
    // en el inicio, una relación se elige en la rueda (y se suma al recorrido)
    const vista = document.body.dataset.vista;
    if (vista === "inicio") Rueda.elegirId(b.dataset.concepto);
    else abrirFicha(Nube.nodo(b.dataset.concepto), vista === "quiz" || vista === "cierre");
  });
  $("#ficha-acciones").addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (b && b.dataset.accion === "mapa") Rueda.verEnMapa();
    if (b && b.dataset.accion === "limpiar") Rueda.limpiar();
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#ficha").hidden) cerrarFicha(); });

  /* ================= Vistas ================= */
  function ir(vista) {
    const fuera = ["mapa", "consulta", "historias", "acerca"].includes(document.body.dataset.vista);
    if (vista === "inicio" && fuera && juego.preguntas.length && juego.i < juego.preguntas.length) {
      vista = "quiz"; // volver a una partida en curso
    }
    if (vista !== "mapa" && !$("#ficha").hidden) cerrarFicha();
    // lo que la rueda iluminó en el inicio no debe quedar marcado en el mapa
    if (document.body.dataset.vista === "inicio" && vista !== "inicio") Nube.reiniciar();
    document.body.dataset.vista = vista;
    const pestana = ["mapa", "consulta", "historias", "acerca"].includes(vista) ? vista : "inicio";
    document.querySelectorAll(".pestana").forEach((b) => {
      if (b.dataset.ir === pestana) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    if (vista === "mapa") Nube.modo({ zoom: 1.05, giro: 0.00025, interactiva: true });
    else if (vista === "cierre") Nube.modo({ zoom: 0.92, giro: 0.0004, interactiva: true });
    else if (vista === "quiz") Nube.modo({ zoom: 1.05, giro: 0, interactiva: true });   // un clic en un punto abre su ficha
    else if (vista === "inicio") Nube.modo({ zoom: 1, giro: 0.00025 });
    else Nube.modo({ zoom: 1, giro: 0.0007 });
    if (vista === "inicio") {
      juego.preguntas = []; Nube.reiniciar(); Rueda.activar();
      // el bloque del test emerge desde abajo: título, párrafo y botón, uno tras otro
      const ini = $("#inicio");
      ini.classList.remove("entra"); void ini.offsetWidth; ini.classList.add("entra");
    }
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
  // sin selector de rol: cada ciclo mezcla preguntas de los cinco documentos
  $("#empezar").addEventListener("click", () => empezar("todos"));
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
    if (document.body.dataset.vista === "inicio") Rueda.intro();
  }
  arrancar();
})();
