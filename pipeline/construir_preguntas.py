"""Valida el banco de preguntas y escribe web/data/questions.json.

Comprueba, para cada pregunta, que la evidencia esté literalmente en el fragmento citado,
que sus conceptos existan en graph.json y calcula la página real de la evidencia con las
marcas de página de corpus_limpio.md. Si algo falla, no escribe nada.

Uso:  python3 pipeline/construir_preguntas.py
"""
import json, re, sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / "pipeline"))
from banco_preguntas import BANCO, ROLES  # noqa: E402

FRAG = BASE / "data" / "fragmentos.jsonl"
CORPUS = BASE / "data" / "corpus_limpio.md"
GRAFO = BASE / "web" / "data" / "graph.json"
OUT = BASE / "web" / "data" / "questions.json"
OPCIONES = {"vm": ["Verdad", "Mentira"], "d": ["Sí", "No"]}
TIPO = {"vm": "verdad_mentira", "d": "dilema"}


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def paginas_por_documento():
    """{documento: [(pagina, texto normalizado)]} a partir de las marcas <!-- Doc · pág. N -->."""
    docs, actual, pag = {}, None, None
    for linea in CORPUS.read_text(encoding="utf-8").splitlines():
        m = re.match(r"<!-- (.+?) · pág\. (\d+) -->", linea)
        if m:
            actual, pag = m.group(1), int(m.group(2))
            docs.setdefault(actual, []).append([pag, ""])
        elif actual:
            docs[actual][-1][1] += " " + linea
    return {d: [(p, norm(t)) for p, t in v] for d, v in docs.items()}


def pagina_de(evidencia, documento, desde, paginas):
    # la evidencia puede cruzar un salto de página: se busca en ventanas de dos páginas
    ev = norm(evidencia)
    hojas = paginas.get(documento, [])
    for i, (p, t) in enumerate(hojas):
        if p < desde:
            continue
        if ev in t:
            return p
        if i + 1 < len(hojas) and ev in t + " " + hojas[i + 1][1]:
            return p
    return None


def main():
    frags = {f["id"]: f for f in (json.loads(l) for l in FRAG.open(encoding="utf-8"))}
    conceptos = {n["id"] for n in json.loads(GRAFO.read_text(encoding="utf-8"))["nodes"]}
    paginas = paginas_por_documento()
    errores, salida = [], []

    for doc, preguntas in BANCO.items():
        for i, (tipo, nivel, enunciado, correcta, explicacion, fid, evidencia, cons) in enumerate(preguntas, 1):
            qid = f"{doc.lower()}-{i:03d}"
            f = frags.get(fid)
            if not f:
                errores.append(f"{qid}: no existe el fragmento {fid}"); continue
            if not fid.startswith(doc):
                errores.append(f"{qid}: el fragmento {fid} no es de {doc}")
            if norm(evidencia) not in norm(f["texto"]):
                errores.append(f"{qid}: la evidencia no está en {fid}: «{evidencia[:60]}…»")
            faltan = [c for c in cons if c not in conceptos]
            if faltan:
                errores.append(f"{qid}: conceptos que no están en graph.json: {faltan}")
            pag = pagina_de(evidencia, f["documento"], f["pagina_inicio"], paginas) or f["pagina_inicio"]
            salida.append({
                "id": qid, "tipo": TIPO[tipo], "rol": ROLES[doc], "nivel": nivel,
                "enunciado": enunciado, "opciones": OPCIONES[tipo], "correcta": correcta,
                "explicacion": explicacion,
                "cita": {"fragmento": fid, "documento": f["documento"], "pagina": pag},
                "evidencia": evidencia, "conceptos": cons, "estado": "pendiente_revision",
            })

    por_doc = {d: len(v) for d, v in BANCO.items()}
    if errores:
        print("\n".join(errores)); sys.exit(1)
    OUT.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    verdad = sum(1 for q in salida if q["correcta"] == 0)
    print(f"{len(salida)} preguntas {por_doc} · correcta=0: {verdad}, correcta=1: {len(salida) - verdad} → {OUT.relative_to(BASE)}")


if __name__ == "__main__":
    main()
