# TitA te pregunta · Spec básico (v0.1)

Web-juego para conocer los Lineamientos de IA de la Universidad El Bosque. TitA, la mascota de la universidad, hace un quiz de preguntas binarias; mientras tanto, un mapa 3D de conceptos ilumina las ideas relacionadas con cada pregunta. Al final, la persona ve su constelación personal.

Archivos que acompañan este spec:
- `fragmentos.jsonl`: 129 fragmentos de los 5 documentos (texto completo y metadatos). Es la fuente de verdad.
- `corpus_limpio.md`: el texto corrido, con la página marcada.
- `recuperar.py`: un recuperador BM25 de referencia (Python, sin dependencias).

---

## 1. Objetivo

Que estudiantes, profesores, investigadores y administrativos entiendan los lineamientos jugando, con cada respuesta respaldada por el texto oficial (documento y página). Se publica en la página de la universidad.

**Criterio de éxito:** una sesión de unas 10 preguntas en menos de 5 minutos, con cada pregunta citando su fuente y sin contenido inventado.

## 2. Corpus (RAG)

Esquema de cada línea de `fragmentos.jsonl`:

```json
{
  "id": "CIE-048",
  "documento": "Ciencia, Tecnología e Innovación",
  "seccion": "5. Usos posibles de la IA en CTeI",
  "pagina_inicio": 12,
  "parte": 1,
  "tokens_aprox": 895,
  "texto": "La IA puede usarse como apoyo para ordenar información..."
}
```

Documentos y prefijos: `GEN` Generales · `ENS` Enseñanza-Aprendizaje · `CIE` Ciencia, Tecnología e Innovación · `EXT` Extensión y Educación Continuada · `GES` Gestión Institucional. Son ~70.000 tokens en total.

**El RAG se usa sobre todo en el pipeline offline.** El juego en vivo consume JSON ya generados y revisados, sin llamadas al LLM. Así el costo por sesión es casi cero, no hay alucinaciones sobre una norma institucional y la comisión puede aprobar el contenido antes de publicarlo.

## 3. Pipeline offline (scripts, se corre una vez)

Lenguaje sugerido: Python o Node. LLM: Claude API.

**Paso A · Conceptos por fragmento.** Para cada fragmento, se le pide a Claude que extraiga de 3 a 8 conceptos normalizados (sustantivos cortos en minúscula, p. ej. `autoría`, `trazabilidad`, `datos sensibles`, `supervisión humana`). Después se consolidan los sinónimos en un vocabulario controlado de 40 a 80 conceptos.

**Paso B · Grafo.** El resultado es `graph.json`:

```json
{
  "nodes": [
    {"id": "autoria", "label": "Autoría", "peso": 14,
     "documentos": {"CIE": 6, "ENS": 5, "GEN": 3}, "doc_principal": "CIE",
     "fragmentos": ["CIE-048", "ENS-043", "GEN-021"]}
  ],
  "links": [
    {"source": "autoria", "target": "integridad-academica", "peso": 9}
  ]
}
```

- `peso` del nodo: número de fragmentos donde aparece el concepto.
- `peso` del enlace: número de fragmentos donde coaparecen los dos conceptos. Se descartan los enlaces con peso 1 para que el mapa no se sature.
- `doc_principal`: el documento donde más aparece. Define el color del nodo.

**Paso C · Banco de preguntas.** El resultado es `questions.json`, con 120 a 200 preguntas y al menos 20 por documento. Cada pregunta se genera a partir de 1 a 3 fragmentos recuperados con `recuperar.py` por concepto o sección.

```json
{
  "id": "q-042",
  "tipo": "verdad_mentira",
  "rol": ["investigador", "profesor", "estudiante"],
  "nivel": 2,
  "enunciado": "TitA dice: una herramienta de IA puede figurar como coautora de un artículo si aportó buena parte del texto.",
  "opciones": ["Verdad", "Mentira"],
  "correcta": 1,
  "explicacion": "Las herramientas de IA no pueden figurar como autoras, porque no pueden asumir responsabilidad sobre el contenido, su exactitud o su integridad.",
  "cita": {"fragmento": "CIE-048", "documento": "Ciencia, Tecnología e Innovación", "pagina": 13},
  "conceptos": ["autoria", "integridad-academica", "publicacion"],
  "estado": "pendiente_revision"
}
```

- `tipo`: `dilema` (Sí / No) o `verdad_mentira` (TitA afirma algo; parte de las afirmaciones son falsas a propósito).
- `nivel`: 1 a 3, alineado con los niveles de uso y cuidado de los lineamientos.
- `explicacion`: de 1 a 2 frases, parafraseadas o citadas del fragmento.
- Regla del prompt: **la respuesta correcta tiene que poder verificarse literalmente en el fragmento citado.** Si no se puede, la pregunta se descarta.
- `estado`: `pendiente_revision` → `aprobada` / `rechazada`. El juego solo usa las aprobadas.

**Paso D · Revisión humana.** Una hoja (CSV o Google Sheets) exportada desde `questions.json` donde la comisión marca el estado y corrige textos. Un script la reimporta.

## 4. Experiencia (frontend)

**Flujo:**
1. **Inicio:** TitA se presenta ("Yo pregunto, tú respondes") y la persona elige su rol: estudiante, profesor, investigador o administrativo.
2. **Quiz:** 10 preguntas. El 70 % sale del documento del rol y el 30 % de los demás (siempre incluye `GEN`). La dificultad sube de nivel 1 a 3.
3. **En cada pregunta:**
   - TitA muestra el enunciado en una burbuja y aparecen dos botones grandes.
   - El mapa 3D vuela hacia los `conceptos` de la pregunta y los resalta con un pulso suave.
   - Al responder: feedback (acierto o error), la explicación y la cita ("Lineamientos CTeI, pág. 13").
   - Un acierto deja esos nodos encendidos de forma permanente; un error los deja en penumbra, marcados.
4. **Cierre:** la cámara se aleja y muestra la constelación completa. Se ven el puntaje, la racha máxima, los conceptos dominados y los conceptos por explorar. Botones: "Jugar otra vez" y "Compartir mi constelación" (una imagen PNG del canvas).

**Puntaje:**
- Acierto: 10 × nivel. Racha de 3 o más aciertos: ×1,5.
- El puntaje final da un rango con nombre (por ejemplo: Curioso → Criterioso → Guardián del criterio). Los nombres quedan por definir.

**Mapa 3D:**
- Librería: `3d-force-graph` (three.js), o `react-force-graph-3d` si se usa React.
- Color del nodo según `doc_principal` (5 colores), tamaño según `peso`.
- Estados del nodo: `inactivo` (gris tenue), `activo` (pulso, pregunta en curso), `dominado` (brillante), `fallado` (contorno, sin brillo).
- Se puede explorar con el mouse en el cierre. Durante el quiz, la cámara se mueve sola.
- Con `prefers-reduced-motion` o en móvil de gama baja, se usa una vista 2D o se apagan las animaciones de cámara.

**UI de TitA:** un personaje con 3 o 4 estados (pregunta, celebra, duda, explica). Hacen falta ilustraciones o un sprite de la mascota oficial; mientras llegan, se usa un placeholder.

## 5. Stack y estructura sugerida

- Vite + React (o vanilla JS) + `react-force-graph-3d`. Es un sitio estático, sin backend en el MVP.
- `public/data/graph.json`, `public/data/questions.json` (solo las aprobadas).
- Estado de la sesión en memoria. `localStorage` opcional para el mejor puntaje, siempre envuelto en try/catch.
- Se debe poder embeber por iframe en la página de la universidad.

```
/pipeline
  extract_concepts.py   # Paso A
  build_graph.py        # Paso B
  generate_questions.py # Paso C (usa recuperar.py)
  review_sync.py        # Paso D
/data  fragmentos.jsonl
/web   (app Vite)
```

## 6. Fases

- **MVP:** pipeline A a D, quiz de 10 preguntas, mapa 3D con estados, pantalla de cierre. Sin backend.
- **v2:** registro anónimo de respuestas (Supabase) para un **mapa colectivo** que muestre qué conceptos falla más la comunidad, y un ranking por facultad.
- **v3 (opcional):** un "modo consulta": pregunta libre respondida con RAG en vivo (`recuperar.py` + Claude), siempre con citas, para cumplir el encargo original del bot.

## 7. Criterios de aceptación (MVP)

- [ ] Cada pregunta publicada tiene `cita` con fragmento y página, y `estado: aprobada`.
- [ ] Cada concepto de una pregunta existe en `graph.json`.
- [ ] Una sesión completa se juega en móvil y en escritorio sin errores.
- [ ] El mapa resalta los conceptos correctos en cada pregunta y conserva los estados hasta el cierre.
- [ ] El juego funciona sin conexión al LLM (todo estático).
- [ ] Accesibilidad básica: botones con teclado, contraste AA, reduced-motion.

## 8. Decisiones abiertas

- Ilustraciones oficiales de TitA y permiso de uso de la mascota.
- Nombres de los rangos y tono de voz de TitA (cercano o institucional).
- Número de preguntas por sesión (propuesta: 10).
- Si en v2 el mapa colectivo será público o solo para la comisión.

## Notas sobre el corpus

- Hay encabezados mal asignados en los PDF originales: *Gestión Institucional* lleva el encabezado de *Extensión*, y *Generales* el de *Ciencia, Tecnología e Innovación*. Ya se limpiaron del corpus.
- En *Generales*, pág. 8, hay una frase cortada en el original ("…oce el carácter dinámico").
- Las tablas de "niveles de uso y cuidado" quedaron como texto plano. Si se necesitan estructuradas, hay que transcribirlas a mano desde el PDF.
