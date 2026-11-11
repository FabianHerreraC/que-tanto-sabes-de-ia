# ¿Qué tanto sabes de IA? · Spec (v0.2)

Web-juego para explorar de manera crítica los Lineamientos de IA de la Universidad El Bosque. La persona lee afirmaciones sobre los lineamientos y responde **Verdad** o **Mentira**. Mientras juega, una nube de conceptos ilumina las ideas de cada pregunta. Al cerrar el ciclo, la persona gana una insignia y ve su constelación.

Una iniciativa de la Vicerrectoría de Investigaciones.

Este documento describe lo que está construido al 5 de noviembre de 2026. El spec original es `SPEC-v0.1.md`.

---

## 1. Objetivo y criterio de éxito

Que estudiantes, profesores, investigadores y administrativos entiendan los lineamientos jugando. Cada respuesta se respalda con el texto oficial (documento, página y fragmento).

**Criterio de éxito:** un ciclo de 10 preguntas en menos de 5 minutos, cada pregunta con su fuente y sin contenido inventado.

## 2. Cambios frente al v0.1

| Tema | v0.1 | v0.2 (construido) |
|---|---|---|
| Tipo de pregunta | Dilema (Sí/No) y Verdad/Mentira | Solo Verdad/Mentira: cada pregunta es una afirmación |
| Banco | 120 a 200 preguntas | 120 preguntas: 100 de verdad o mentira (20 por documento) y 20 dilemas reflexivos |
| Sesión | 10 preguntas | Ciclos de 10 que priorizan las preguntas aún no acertadas |
| Recompensa | Rango por puntaje (nombres por definir) | 4 insignias por ciclo según aciertos, coleccionables |
| Mapa | `3d-force-graph` (three.js) | Canvas 2D propio con proyección esférica, sin dependencias |
| Mapa explorable | Solo en el cierre | Pestaña «Mapa»: pausa al pasar el mouse y ficha al hacer clic |
| Stack | Vite + React sugerido | HTML, CSS y JS sin build ni dependencias |
| Generación de contenido | Pipeline con la API de Claude | Escrito por Claude en sesión y verificado con scripts; la API no se usa |
| Mascota | Personaje con 3 o 4 estados que hace las preguntas | Sin mascota |

## 3. Datos

### 3.1 Corpus (fuente de verdad)

- `data/fragmentos.jsonl`: 129 fragmentos de los 5 documentos, con texto completo y metadatos (`id`, `documento`, `seccion`, `pagina_inicio`, `texto`).
- `data/corpus_limpio.md`: el texto corrido, con marcas de página `<!-- Documento · pág. N -->`.
- Prefijos: `GEN` Generales · `ENS` Enseñanza-Aprendizaje · `CIE` Ciencia, Tecnología e Innovación · `EXT` Extensión y Educación Continuada · `GES` Gestión Institucional.

### 3.2 `web/data/questions.json`

```json
{
  "id": "gen-002",
  "tipo": "verdad_mentira",
  "rol": ["estudiante", "profesor", "investigador", "administrativo"],
  "nivel": 1,
  "enunciado": "La Comisión Institucional de Expertos en IA es la instancia que decide qué usos de IA se permiten en la universidad.",
  "opciones": ["Verdad", "Mentira"],
  "correcta": 1,
  "explicacion": "La Comisión cumple un papel orientador y consultivo: …",
  "cita": {"fragmento": "GEN-004", "documento": "Generales", "pagina": 8},
  "evidencia": "La Comisión cumple un papel orientador y consultivo",
  "conceptos": ["comision", "decisiones"],
  "estado": "pendiente_revision"
}
```

- `evidencia` es nueva: una frase **literal** del fragmento citado que respalda la respuesta correcta.
- `cita.pagina` es la página real donde aparece la evidencia, calculada con las marcas de `corpus_limpio.md`, no la página donde empieza el fragmento.
- Estado actual: 100 preguntas, todas en `pendiente_revision`. Respuestas: 52 Verdad y 48 Mentira. Niveles: 25 de nivel 1, 46 de nivel 2 y 29 de nivel 3.
- Reglas de redacción, aprendidas en la revisión:
  - Cada afirmación debe ser enteramente verdadera o enteramente falsa.
  - Nada de disyunciones en afirmaciones falsas («aprueba o prohíbe»).
  - Nada de medias verdades («puede resumir hojas de vida y decidir a quién contratar»).
  - Nada de formulaciones vagas («puede hacerse como…»).
  - Una disyunción en una afirmación verdadera sí es válida («puede producir citas inexistentes o atribuciones incorrectas»).

### 3.3 `web/data/graph.json`

```json
{
  "provisional": true,
  "nodes": [
    {"id": "declaracion-de-uso", "label": "Declarar el uso", "peso": 33,
     "documentos": {"ENS": 11, "CIE": 10, "GES": 5, "EXT": 4, "GEN": 3}, "doc_principal": "ENS",
     "fragmentos": ["…"],
     "descripcion": "Informar qué apoyo dio la IA y asumir la responsabilidad por el resultado. …",
     "evidencia": "El uso debe declararse cuando la IA haya tenido incidencia en el producto …",
     "cita": {"fragmento": "ENS-037", "documento": "Enseñanza-Aprendizaje", "pagina": 13}}
  ],
  "links": [{"source": "autoria", "target": "responsabilidad", "peso": 9}]
}
```

- 52 conceptos y 893 enlaces (se descartan los de peso 1).
- **Provisional:** los conceptos salen de un vocabulario fijo contado con expresiones regulares, no del Paso A del v0.1.
- Cada concepto trae una descripción breve, una evidencia literal y su cita, también pendientes de revisión.

## 4. Pipeline (offline, sin LLM en ejecución)

```
pipeline/banco_preguntas.py        las 100 preguntas (tupla por pregunta, con evidencia)
pipeline/banco_reflexivas.py       los 20 dilemas reflexivos (mismo formato, tipo "d": Sí/No)
pipeline/construir_preguntas.py    valida y escribe web/data/questions.json
pipeline/conceptos_descripcion.py  descripción + evidencia de los 52 conceptos
pipeline/conceptos_provisionales.py  cuenta conceptos, arma enlaces, valida y escribe web/data/graph.json
pipeline/recuperar.py              recuperador BM25 de referencia (sin uso en el juego)
```

Para reconstruir, hay que regenerar primero el grafo, porque las preguntas validan sus conceptos contra él:

```bash
python3 pipeline/conceptos_provisionales.py && python3 pipeline/construir_preguntas.py
```

Validaciones. Si alguna falla, el script no escribe nada:

1. La evidencia aparece literalmente en el fragmento citado (con espacios normalizados).
2. El fragmento pertenece al documento de la pregunta.
3. Todos los conceptos de la pregunta existen en `graph.json`.
4. La página se calcula a partir del corpus y la evidencia puede cruzar un salto de página.

**Paso D del v0.1 (revisión humana) sin construir:** no hay hoja de revisión ni script de reimportación. La comisión hoy revisaría directamente `banco_preguntas.py`.

## 5. Experiencia

El juego es una sola página con vistas que cambian sin recargar: carga, inicio, quiz, cierre, mapa y acerca.

### 5.1 Carga
El logo de la universidad aparece al centro y un contador va de 000 a 100 abajo, en unos 1,3 s, mientras se cargan los datos.

### 5.2 Inicio
- Titular «¿Qué tanto sabes de IA? **¿Verdad o mentira?**», con «¿Verdad o mentira?» en bold sobre fondo lima. El texto mide hasta 60 px.
- «Lineamientos de IA · Universidad El Bosque» va en vertical, de abajo arriba, en la esquina inferior izquierda (en inicio, quiz y cierre).
- Debajo, «Vamos a revisar tus conocimientos sobre el uso de IA en la universidad.»
- **«¿Qué rol tienes?»:** una caja con flechas a izquierda y derecha para pasar por Estudiante, Profesor, Investigador y Administrativo, más el botón «Empezar →». También se cambia con ← y → del teclado, y recuerda el último rol.
- La colección de las 4 insignias.

### 5.3 Quiz (ciclo de 10)
- **Selección de preguntas:**
  - Primero las que la persona aún no ha acertado; si no alcanzan, se completa con repaso.
  - 70 % del documento del rol (`estudiante` y `profesor` → ENS, `investigador` → CIE, `administrativo` → GES) y 30 % de los demás, siempre con al menos una de Generales.
  - Se ordenan por nivel, de 1 a 3.
- **Al aparecer cada pregunta,** las letras del enunciado giran como rodillos de tragamonedas y se detienen de izquierda a derecha, en menos de 2 s.
- **Respuesta:** dos botones, Verdad y Mentira, o las teclas 1 y 2.
- **Al responder:**
  - Desaparece la opción incorrecta y queda solo la correcta, en verde y a todo el ancho.
  - Se muestra «Bien.» o «Esta vez no.», la explicación y la cita: «Lineamientos *Documento*, pág. N · ID».
- **Puntaje:** 10 × nivel por acierto, ×1,5 con racha de 3 o más.
- **Nube:** gira hacia los conceptos de la pregunta, que pulsan. Un acierto los deja con halo lima («dominados»); un error, con aro punteado y nombre tachado («por explorar»).

### 5.4 Cierre
- Puntaje grande, en peso thin.
- «Insignia: *nombre*» sobre fondo lima, y la colección con la insignia del ciclo resaltada.
- Aciertos, racha máxima y mejor puntaje.
- Conceptos dominados y por explorar (máximo 6 de cada uno, más «y N más»).
- **«Jugar otra vez»:** arranca otro ciclo con el mismo rol.
- **«Compartir mi constelación»:** descarga un PNG de 1080×1350 con el logo, la constelación recortada y centrada, el puntaje, la insignia y la firma.

### 5.5 Insignias (una por ciclo)

| Aciertos en el ciclo | Insignia |
|---|---|
| 10 de 10 | Guardián del criterio |
| 8 o 9 | Criterioso |
| 6 o 7 | Atento |
| 5 o menos | Curioso |

Se coleccionan: cada insignia muestra «×N», las veces que se ha ganado. Las que nunca se han ganado aparecen con contorno punteado.

### 5.6 Mapa
- La nube completa gira despacio y se puede arrastrar para girarla.
- Al pasar el mouse sobre un punto, el giro se detiene y aparece una etiqueta con el número de fragmentos.
- **Clic en un punto:** el punto queda marcado con un aro, la nube lo trae al frente y se abre una ficha.
- **La ficha muestra:**
  - el documento principal y el nombre del concepto;
  - una descripción breve y una cita literal con su fuente;
  - barras de presencia por documento;
  - los 6 conceptos más relacionados, cada uno clicable;
  - en cuántos fragmentos y en cuántas preguntas aparece.
- La ficha se cierra con ×, con Escape o con un clic en el vacío. En escritorio sale a la derecha; en móvil, como hoja inferior, y la nube sube para que el punto elegido no quede tapado.
- Leyenda de colores por documento.

### 5.7 Consulta (asistente, aún sin conectar)
- Panel con «Pregúntale a los **lineamientos**», un saludo y un campo para escribir. La página ya no anuncia que está en construcción.
- Hoy no responde: si alguien envía una pregunta, contesta que todavía no está conectado y que, cuando lo esté, responderá con la cita del documento y la página. Es la fase v3 del v0.1 (RAG en vivo con citas).
- Aquí irán también los documentos descargables. Todavía no se agregan.

### 5.8 Historias (revista)
- Página completa tipo revista con la gráfica del resto del sitio: velo blanco translúcido sobre la nube, titular «Historias **con IA**» en Jost fino con resaltado lima, números grandes en thin, etiquetas en bold sobre pastilla gris y tarjetas como los paneles (borde gris fino, esquinas redondeadas).
- **Edición de muestra:** no hay historias reales todavía. Los seis espacios corresponden a las líneas de trabajo con IA del levantamiento de capacidades (Generales, pág. 11): investigación aplicada (destacada), formación y alfabetización, recursos educativos, análisis de datos, servicios al entorno y procesos administrativos.
- La agenda solo nombra acciones que aparecen en los documentos (talleres de alfabetización, orientaciones para trabajos de grado y el canal comisionia@unbosque.edu.co), sin fechas.
- Cierra con «¿Tu proyecto usa IA?», sin enlace por ahora.
- **Cada tarjeta abre un artículo tipo blog** dentro de la misma sección, con dirección propia (`#historia-02`): funcionan el botón «atrás», el «← Historias» y los enlaces directos.
  - Estructura: número y línea de trabajo, título, bajada, estado, espacio para imagen, y las secciones «El proyecto», «Cómo usa la IA», una cita del equipo, «Cuidados según los lineamientos» y «Lo que aprendió».
  - En «Cuidados» hay pastillas de conceptos (Declarar el uso, Datos personales, Supervisión humana, Autoría, Propiedad intelectual) que abren su ficha en el Mapa.
  - Al final, «Otras historias» con las cinco restantes.
  - Hoy es una plantilla: cada sección explica qué irá en ella, en gris.

### 5.9 Acerca
- Titular: «Un proyecto para explorar **de manera compleja y crítica** la documentación institucional en torno al uso de la IA.»
- «**Una iniciativa de la Vicerrectoría de Investigaciones** de la Universidad El Bosque.»
- Explica las fuentes, que no hay un LLM respondiendo en vivo, cómo son los ciclos y dónde se guarda el progreso.
- Aviso de versión de prueba. No hay botón para borrar el progreso.

## 6. Diseño

- **Referencia:** gionatannese.com. Fondo blanco, pestañas pequeñas con número en superíndice, contador de carga y una nube flotante como protagonista.
- **Paleta:** blanco y tres verdes: `#00E245` (correcto, acento), `#4EF581` y `#DDFF88` (lima para resaltados e insignias). Negro y grises para texto. El logo conserva su tinta `#00230C`.
- **Colores por documento en la nube:** GEN negro, ENS `#00E245`, CIE `#4EF581`, EXT `#DDFF88`, GES blanco con borde. Todos los puntos llevan un borde fino para verse sobre blanco.
- **Tipografía:** solo **Jost** (Google Fonts, variable 100–900). La jerarquía va únicamente por peso:
  - fino (200), y thin (100) para el puntaje, en titulares, enunciados, opciones y cifras;
  - bold (700) en etiquetas en mayúsculas, botones, énfasis e insignias;
  - regular (400) en el texto corrido;
  - cursiva ligera (300) solo en las citas.
- **Marca:** logo de la Universidad El Bosque en la barra superior y en la pantalla de carga (`web/img/bosque-logo.svg`).
- **Navegación:** logo, pestañas «Juego¹ Mapa² Consulta³ Historias⁴ Acerca⁵» y un botón cuadrado que pausa el movimiento. En móvil, las pestañas se deslizan.

## 7. Persistencia

Todo vive en `localStorage`. Cada lectura y escritura va envuelta en try/catch y el juego funciona sin almacenamiento. Las claves conservan el prefijo `tita.` de una versión anterior: renombrarlas borraría el progreso ya guardado.

| Clave | Contenido |
|---|---|
| `tita.acertadas` | ids de preguntas acertadas al menos una vez (para no repetirlas) |
| `tita.insignias` | `{id_insignia: veces}` |
| `tita.mejor` | mejor puntaje de un ciclo |
| `tita.rol` | último rol elegido |

No hay backend: el progreso es por navegador y no se comparte entre dispositivos.

## 8. Accesibilidad

- Todo funciona con teclado:
  - flechas para el rol;
  - 1 y 2 para responder;
  - Escape para cerrar la ficha;
  - foco automático en la primera opción y en «Siguiente».
- Con `prefers-reduced-motion`, o con el botón de pausa:
  - no hay animaciones de cámara, giro ni rodillos;
  - el enunciado aparece completo.
- Los lectores de pantalla reciben el enunciado completo y no las letras al azar de la animación.
- Diseño adaptable: panel inferior y hoja de ficha en móvil, 16 px de margen lateral y sin scroll horizontal.

## 9. Stack y estructura

Sitio estático, sin build ni dependencias. Las únicas peticiones externas son las de Google Fonts.

```
SPEC.md · SPEC-v0.1.md · README.md
data/       fragmentos.jsonl, corpus_limpio.md
pipeline/   scripts de la sección 4
web/        index.html, style.css, app.js
web/data/   questions.json, graph.json
web/img/    bosque-logo.svg
```

Para correrlo en local:

```bash
python3 -m http.server 4400 --directory web
```

## 10. Criterios de aceptación (MVP)

- [x] Cada pregunta tiene `cita` con fragmento y página, y una evidencia verificada literalmente.
- [ ] Cada pregunta publicada tiene `estado: aprobada`. **Pendiente: revisión de la comisión.**
- [x] Cada concepto de una pregunta existe en `graph.json`.
- [x] Un ciclo completo se juega en escritorio y en móvil sin errores de consola. Probado en el panel de vista previa; falta probarlo en dispositivos reales.
- [x] El mapa resalta los conceptos de cada pregunta y conserva los estados hasta el cierre.
- [x] Funciona sin conexión a ningún LLM: todo es estático.
- [x] Accesibilidad básica: teclado, reduced-motion y texto completo para lectores de pantalla. Falta medir el contraste AA con una herramienta.

## 11. Pendientes y decisiones abiertas

1. **Revisión de contenido.** Las 120 preguntas y las 52 descripciones deben pasar por la comisión. Al publicar, `ESTADOS_JUGABLES` en `app.js` debe quedar solo con `"aprobada"`. Falta definir el flujo de revisión (Paso D del v0.1).
2. **Grafo definitivo.** Reemplazar el conteo por regex por la extracción de conceptos del Paso A/B del v0.1, o validar el vocabulario actual con la comisión.
3. **Rol de extensión.** Ningún rol se asocia a EXT: sus preguntas solo entran en el 30 % «de otros documentos». Evaluar si se agrega un rol, como «Extensión y educación continuada».
4. **Publicación.** El proyecto aún no tiene repositorio ni despliegue. El v0.1 pide que se pueda embeber por iframe en la página de la universidad; no se ha probado.
5. **Nombres de las insignias.** Curioso, Atento, Criterioso y Guardián del criterio son propuestas.
6. **Fases siguientes (del v0.1).**
   - v2: registro anónimo de respuestas para un mapa colectivo y un ranking por facultad, con backend.
   - v3: un modo consulta con preguntas libres respondidas en vivo por un LLM sobre el corpus, siempre con citas.
