"""Importa data/Juego_IA.xlsx y escribe los datos del juego y del mapa.

El Excel es la fuente de verdad desde 2026-11-21. Trae tres hojas:
  Preguntas   200 situaciones Sí/No (40 por documento), con explicación, «qué hacer»,
              los dos conceptos que trabaja, la relación entre ellos y el apartado citado
  Conceptos   los 52 conceptos del mapa: grupo (color), descripción, documentos y cita
  Relaciones  128 relaciones entre pares de conceptos, con su explicación y sus preguntas

Escribe:
  web/data/questions.json  las 200 del Excel (serie "base") + las 20 reflexivas de
                           banco_reflexivas.py (serie "reflexiva", con evidencia literal validada)
  web/data/graph.json      52 nodos y 128 enlaces (las relaciones del Excel, ya no la co-ocurrencia)

Si algo no cuadra (un concepto desconocido, una relación que no coincide con su pregunta,
una cita mal formada), no escribe nada.

Uso:  python3 pipeline/importar_excel.py
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / "pipeline"))
from banco_reflexivas import BANCO as BANCO_REFLEXIVO, ROLES as ROLES_REFLEXIVAS  # noqa: E402
from construir_preguntas import FRAG, norm, paginas_por_documento, pagina_de  # noqa: E402

XLSX = BASE / "data" / "Juego_IA.xlsx"
OUT_Q = BASE / "web" / "data" / "questions.json"
OUT_G = BASE / "web" / "data" / "graph.json"
GRAFO_ANTERIOR = OUT_G   # de aquí salen los ids (slugs) de los conceptos

# nombres del Excel → código y nombre canónico que usa el front
DOC = {
    "generales": ("GEN", "Generales"),
    "enseñanza-aprendizaje": ("ENS", "Enseñanza-Aprendizaje"),
    "ciencia, tecnología e innovación": ("CIE", "Ciencia, Tecnología e Innovación"),
    "extensión y educación continuada": ("EXT", "Extensión y Educación Continuada"),
    "gestión institucional": ("GES", "Gestión Institucional"),
}

# Las páginas del Excel (preguntas) son las impresas en cada documento, las del índice.
# corpus_limpio.md marca la página del archivo PDF, que va 1 o 2 por detrás según el documento
# (portada y créditos sin numerar). Para que todo el sitio use la página impresa, las citas que
# salen del corpus (conceptos y reflexivas) se corren con este desfase, comprobado contra las
# 200 preguntas del Excel y el índice de cada documento.
DESFASE = {"Generales": 1, "Enseñanza-Aprendizaje": 2, "Ciencia, Tecnología e Innovación": 1,
           "Extensión y Educación Continuada": 2, "Gestión Institucional": 2}


def doc(nombre):
    """(código, nombre canónico) para un nombre de documento escrito de cualquier forma."""
    return DOC.get(re.sub(r"\s*-\s*", "-", nombre.strip().lower()))


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def leer_xlsx(ruta):
    """{hoja: [filas]} con solo la biblioteca estándar (el .xlsx es un zip de XML)."""
    z = zipfile.ZipFile(ruta)
    compartidas = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            compartidas.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    libro = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}

    def columna(ref):
        n = 0
        for ch in re.match(r"[A-Z]+", ref).group():
            n = n * 26 + ord(ch) - 64
        return n - 1

    hojas = {}
    for hoja in libro.find("m:sheets", NS):
        ruta_hoja = "xl/" + rels[hoja.get(f"{{{NS['r']}}}id")].lstrip("/").replace("xl/", "")
        filas = []
        for fila in ET.fromstring(z.read(ruta_hoja)).iter(f"{{{NS['m']}}}row"):
            celdas = {}
            for c in fila.findall("m:c", NS):
                v, t = c.find("m:v", NS), c.get("t")
                if t == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter(f"{{{NS['m']}}}t"))
                elif v is None:
                    continue
                else:
                    val = compartidas[int(v.text)] if t == "s" else v.text
                celdas[columna(c.get("r"))] = val.strip()
            if celdas:
                filas.append([celdas.get(i, "") for i in range(max(celdas) + 1)])
        hojas[hoja.get("name")] = filas
    return hojas


def como_dicts(filas):
    cab = filas[0]
    return [dict(zip(cab, f + [""] * (len(cab) - len(f)))) for f in filas[1:]]


def main():
    hojas = leer_xlsx(XLSX)
    preguntas, conceptos, relaciones = (como_dicts(hojas[h]) for h in ("Preguntas", "Conceptos", "Relaciones"))
    errores = []

    # ---- conceptos: se conserva el id (slug) que ya usa el front para cada nombre
    anterior = {n["label"]: n["id"] for n in json.loads(GRAFO_ANTERIOR.read_text(encoding="utf-8"))["nodes"]}
    id_de, nodos = {}, []
    for c in conceptos:
        nombre = c["Concepto del mapa"]
        cid = anterior.get(nombre) or re.sub(r"[^a-z0-9]+", "-", nombre.lower()).strip("-")
        id_de[nombre] = cid
        grupo = doc(c["Grupo del mapa"])
        if not grupo:
            errores.append(f"concepto {nombre}: grupo desconocido «{c['Grupo del mapa']}»"); continue
        docs = {doc(n)[0]: int(k) for n, k in re.findall(r"([^·:(]+?) \((\d+)\)", c["Aparece en los documentos"])
                if doc(n)}
        m = re.match(r"«(.+)» — (.+), pág\. (\d+)$", c["Cita de respaldo en el inventario"])
        if not docs or not m or not doc(m.group(2)):
            errores.append(f"concepto {nombre}: no se pudo leer «Aparece en» o la cita"); continue
        doc_cita = doc(m.group(2))
        nodos.append({
            "id": cid, "label": nombre, "peso": sum(docs.values()), "documentos": docs,
            "doc_principal": grupo[0], "descripcion": c["Descripción del concepto"],
            "evidencia": m.group(1),
            "cita": {"documento": doc_cita[1], "pagina": int(m.group(3)) + DESFASE[doc_cita[1]]},
        })

    # ---- relaciones → enlaces del mapa
    enlaces, par_de = [], {}
    for r in relaciones:
        a, b = r["Concepto 1"], r["Concepto 2"]
        if a not in id_de or b not in id_de:
            errores.append(f"{r['ID relación']}: concepto desconocido ({a} / {b})"); continue
        qs = [q.strip() for q in r["Preguntas asociadas"].split(",") if q.strip()]
        par_de[r["ID relación"]] = {a, b}
        enlaces.append({"id": r["ID relación"], "source": id_de[a], "target": id_de[b],
                        "peso": len(qs), "explicacion": r["Explicación de la relación"], "preguntas": qs})

    # ---- preguntas del Excel
    salida = []
    for p in preguntas:
        qid = p["ID pregunta"]
        d = doc(p["Documento"])
        pag = re.search(r"\d+", p["Página inicial del apartado"])
        c1, c2 = p["Concepto 1"], p["Concepto 2"]
        if not d:
            errores.append(f"{qid}: documento desconocido «{p['Documento']}»"); continue
        if p["Respuesta correcta"] not in ("Sí", "No"):
            errores.append(f"{qid}: respuesta «{p['Respuesta correcta']}» no es Sí ni No")
        if c1 not in id_de or c2 not in id_de:
            errores.append(f"{qid}: concepto desconocido ({c1} / {c2})")
        if par_de.get(p["ID relación"]) != {c1, c2}:
            errores.append(f"{qid}: la relación {p['ID relación']} no une {c1} y {c2}")
        if not pag:
            errores.append(f"{qid}: sin página en «{p['Página inicial del apartado']}»")
        salida.append({
            "id": qid, "serie": "base", "tipo": "dilema",
            "rol": [r.strip().lower() for r in p["Roles del juego"].split(",")],
            "nivel": int(p["Nivel"]), "enunciado": p["Situación y pregunta"], "opciones": ["Sí", "No"],
            "correcta": 0 if p["Respuesta correcta"] == "Sí" else 1,
            "explicacion": p["Explicación"], "que_hacer": p["Qué hacer en una situación similar"],
            "cita": {"documento": d[1], "apartado": p["Apartado citado"], "pagina": int(pag.group()) if pag else None},
            "conceptos": [id_de.get(c1, c1), id_de.get(c2, c2)],
            "relacion": {"id": p["ID relación"], "texto": p["Relación entre los dos conceptos"]},
            "estado": "pendiente_revision",
        })

    # ---- serie reflexiva (la de antes, con evidencia literal comprobada en el fragmento)
    frags = {f["id"]: f for f in (json.loads(l) for l in FRAG.open(encoding="utf-8"))}
    paginas = paginas_por_documento()
    ids = set(id_de.values())
    n = 0
    for docc, qs in BANCO_REFLEXIVO.items():
        for tipo, nivel, enunciado, correcta, explicacion, fid, evidencia, cons in qs:
            n += 1
            qid = f"ref-{n:03d}"
            f = frags.get(fid)
            if not f or norm(evidencia) not in norm(f["texto"]):
                errores.append(f"{qid}: la evidencia no está en {fid}"); continue
            if any(c not in ids for c in cons):
                errores.append(f"{qid}: conceptos desconocidos {[c for c in cons if c not in ids]}")
            pag = (pagina_de(evidencia, f["documento"], f["pagina_inicio"], paginas) or f["pagina_inicio"]) + DESFASE[f["documento"]]
            salida.append({
                "id": qid, "serie": "reflexiva", "tipo": "dilema", "rol": ROLES_REFLEXIVAS[docc], "nivel": nivel,
                "enunciado": enunciado, "opciones": ["Sí", "No"], "correcta": correcta, "explicacion": explicacion,
                "cita": {"fragmento": fid, "documento": f["documento"], "pagina": pag},
                "evidencia": evidencia, "conceptos": cons, "estado": "pendiente_revision",
            })

    if errores:
        print("\n".join(errores)); sys.exit(1)

    # aviso (no bloquea): citas de concepto que no se encuentran literales en el corpus
    texto = {d: " ".join(t for _, t in hs) for d, hs in paginas.items()}
    for nd in nodos:
        if norm(nd["evidencia"]).lower() not in texto.get(nd["cita"]["documento"], "").lower():
            print(f"aviso: la cita de «{nd['label']}» no aparece literal en {nd['cita']['documento']}")

    OUT_Q.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_G.write_text(json.dumps({"provisional": False, "fuente": "data/Juego_IA.xlsx", "nodes": nodos, "links": enlaces},
                                ensure_ascii=False, indent=1), encoding="utf-8")
    base = sum(q["serie"] == "base" for q in salida)
    si = sum(q["correcta"] == 0 for q in salida)
    print(f"{len(salida)} preguntas ({base} del Excel + {len(salida) - base} reflexivas) · Sí {si} / No {len(salida) - si} → {OUT_Q.relative_to(BASE)}")
    print(f"{len(nodos)} conceptos · {len(enlaces)} relaciones → {OUT_G.relative_to(BASE)}")


if __name__ == "__main__":
    main()
