# ¿Qué tanto sabes de IA? · Verdad o mentira

Web-juego sobre los Lineamientos de IA de la Universidad El Bosque. El spec vigente (v0.2, lo construido) está en [SPEC.md](SPEC.md); el original está en [SPEC-v0.1.md](SPEC-v0.1.md).

```
data/       fragmentos.jsonl y corpus_limpio.md (fuente de verdad)
pipeline/   recuperar.py (BM25) · conceptos_provisionales.py (grafo sin LLM)
web/        front estático, sin build: index.html, style.css, app.js
web/data/   graph.json y questions.json
```

Para verlo en local:

```bash
python3 -m http.server 4321 --directory web
```

Publicado en **https://fabianherrerac.github.io/que-tanto-sabes-de-ia/**. Cada `git push` a `main` republica: el workflow `.github/workflows/pages.yml` sirve la carpeta `web/`. Al cambiar `app.js` o `style.css`, sube el `?v=` de sus enlaces en `index.html` para que los navegadores no usen la versión en caché.

## Estado

- El front está completo: carga, inicio con elección de rol, quiz con feedback y cita, cierre con constelación y PNG para compartir, mapa explorable y página de acerca.
- `graph.json` es **provisional**: 52 conceptos contados por regex (`pipeline/conceptos_provisionales.py`). Lo reemplaza el Paso A/B del spec.
- Cada concepto trae una descripción breve y una cita literal verificada (`pipeline/conceptos_descripcion.py`), que se ven en la ficha del mapa al hacer clic en un punto. También están pendientes de revisión.
- `questions.json` trae **100 preguntas de verdad o mentira** (20 por documento) en estado `pendiente_revision`. Salen de `pipeline/banco_preguntas.py`; cada una guarda una `evidencia` literal del fragmento citado. `python3 pipeline/construir_preguntas.py` comprueba que esa evidencia esté en el fragmento y que los conceptos existan en el grafo, calcula la página real y escribe el JSON. Mientras la comisión revisa, el juego usa también las pendientes (`ESTADOS_JUGABLES` en `app.js`); al publicar, hay que dejar solo `aprobada`.
- Ciclos de 10 preguntas sacadas del banco de 100, priorizando las que aún no has acertado. Cada ciclo da una de cuatro insignias según los aciertos: Guardián del criterio (10), Criterioso (8–9), Atento (6–7) y Curioso (5 o menos). La colección y lo acertado se guardan en el navegador (`localStorage`).
- La nube es un canvas 2D propio en lugar de `3d-force-graph`, para mantener la estética mínima y el sitio sin dependencias.
