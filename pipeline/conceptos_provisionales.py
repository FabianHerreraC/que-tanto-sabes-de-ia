"""Grafo provisional para el front (sin LLM).

Mientras no exista el Paso A del SPEC (conceptos extraídos con Claude), este script
cuenta un vocabulario fijo de conceptos por expresión regular sobre fragmentos.jsonl
y escribe web/data/graph.json con el mismo esquema que pide el SPEC.

Uso:  python3 pipeline/conceptos_provisionales.py
"""
import json, re, sys
from collections import Counter
from itertools import combinations
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / "pipeline"))
from conceptos_descripcion import DESCRIPCIONES  # noqa: E402
from construir_preguntas import norm, paginas_por_documento, pagina_de  # noqa: E402
FRAG = BASE / "data" / "fragmentos.jsonl"
OUT = BASE / "web" / "data" / "graph.json"

PREFIJO = {"Generales": "GEN", "Enseñanza-Aprendizaje": "ENS", "Ciencia, Tecnología e Innovación": "CIE",
           "Extensión y Educación Continuada": "EXT", "Gestión Institucional": "GES"}

VOCAB = {
    "autoria": ("Autoría", r"autor[ií]a|coautor"),
    "responsabilidad": ("Responsabilidad", r"responsabilidad"),
    "supervision-humana": ("Supervisión humana", r"supervisi[oó]n humana|revisi[oó]n humana|validaci[oó]n humana"),
    "trazabilidad": ("Trazabilidad", r"trazabilidad"),
    "transparencia": ("Transparencia", r"transparen"),
    "declaracion-de-uso": ("Declarar el uso", r"declarar|declaraci[oó]n"),
    "datos-personales": ("Datos personales", r"datos personales"),
    "datos-sensibles": ("Datos sensibles", r"datos sensibles|sensibles"),
    "datos-clinicos": ("Datos clínicos", r"cl[ií]nic"),
    "confidencialidad": ("Confidencialidad", r"confidencial"),
    "privacidad": ("Privacidad", r"privacidad"),
    "anonimizacion": ("Anonimización", r"anonimi|enmascar|seudonimi"),
    "consentimiento": ("Consentimiento", r"consentimiento"),
    "seguridad-informacion": ("Seguridad de la información", r"seguridad de la informaci[oó]n"),
    "propiedad-intelectual": ("Propiedad intelectual", r"propiedad intelectual|derechos de autor|titularidad"),
    "integridad-academica": ("Integridad académica", r"integridad acad[eé]mica|honestidad acad[eé]mica"),
    "integridad-cientifica": ("Integridad científica", r"integridad cient[ií]fica"),
    "evaluacion": ("Evaluación", r"evaluaci[oó]n|calificaci[oó]n"),
    "retroalimentacion": ("Retroalimentación", r"retroalimentaci[oó]n"),
    "mediacion-docente": ("Mediación docente", r"mediaci[oó]n docente|papel de profesores"),
    "aprendizaje": ("Aprendizaje", r"aprendizaje"),
    "competencias": ("Competencias", r"competencia"),
    "agencia-humana": ("Agencia humana", r"agencia humana|criterio propio|pensamiento cr[ií]tico"),
    "sesgos": ("Sesgos", r"sesgo"),
    "verificacion": ("Verificación", r"verific|contrastar"),
    "fuentes": ("Fuentes", r"fuentes"),
    "citas": ("Citas", r"\bcitas?\b|citaci[oó]n"),
    "detectores": ("Detectores de IA", r"detector"),
    "alucinaciones": ("Información inventada", r"plausible|invent|alucinac"),
    "publicacion": ("Publicación", r"publicaci[oó]n|editorial"),
    "revision-por-pares": ("Revisión por pares", r"revisi[oó]n por pares|pares evaluadores"),
    "etica": ("Ética", r"[eé]tica"),
    "riesgo": ("Gestión del riesgo", r"riesgo"),
    "alto-riesgo": ("Alto riesgo", r"alto riesgo|alto cuidado"),
    "niveles-de-uso": ("Niveles de uso", r"niveles? de uso"),
    "decisiones": ("Decisiones sobre personas", r"decisiones"),
    "automatizacion": ("Automatización", r"automatiza"),
    "proveedores": ("Proveedores", r"proveedor"),
    "herramientas-autorizadas": ("Herramientas autorizadas", r"autorizadas|aprobadas|cat[aá]logo"),
    "terceros": ("Terceros", r"terceros"),
    "comunidades": ("Comunidades", r"comunidad"),
    "poblacion-vulnerable": ("Población vulnerable", r"vulnerable"),
    "entregables": ("Entregables", r"entregable"),
    "calidad": ("Calidad", r"calidad"),
    "reputacion": ("Reputación", r"reputaci"),
    "auditoria": ("Auditoría", r"auditor"),
    "formacion": ("Formación", r"formaci[oó]n|alfabetizaci[oó]n"),
    "inclusion": ("Inclusión", r"inclusi[oó]n|equidad|accesibilidad"),
    "transferencia": ("Transferencia", r"transferencia"),
    "prototipos": ("Prototipos y creación", r"prototip|creaci[oó]n"),
    "ia-generativa": ("IA generativa", r"generativa"),
    "comision": ("Comisión de expertos", r"comisi[oó]n"),
}


def main():
    cs = [json.loads(l) for l in open(FRAG, encoding="utf-8")]
    por_frag = {}
    for c in cs:
        t = c["seccion"] + " " + c["texto"]
        por_frag[c["id"]] = [k for k, (_, p) in VOCAB.items() if re.search(p, t, re.I)]

    frag_por_id = {c["id"]: c for c in cs}
    paginas = paginas_por_documento()
    errores = []
    nodes = []
    for k, (label, _) in VOCAB.items():
        frs = [c for c in cs if k in por_frag[c["id"]]]
        if not frs:
            continue
        docs = Counter(PREFIJO[c["documento"]] for c in frs)
        nodo = {"id": k, "label": label, "peso": len(frs), "documentos": dict(docs.most_common()),
                "doc_principal": docs.most_common(1)[0][0], "fragmentos": [c["id"] for c in frs]}
        if k in DESCRIPCIONES:
            desc, fid, ev = DESCRIPCIONES[k]
            f = frag_por_id.get(fid)
            if not f or norm(ev) not in norm(f["texto"]):
                errores.append(f"{k}: la evidencia no está en {fid}: «{ev[:60]}…»")
            else:
                pag = pagina_de(ev, f["documento"], f["pagina_inicio"], paginas) or f["pagina_inicio"]
                nodo.update(descripcion=desc, evidencia=ev,
                            cita={"fragmento": fid, "documento": f["documento"], "pagina": pag})
        else:
            errores.append(f"{k}: sin descripción")
        nodes.append(nodo)
    if errores:
        print("\n".join(errores)); sys.exit(1)

    co = Counter()
    for ks in por_frag.values():
        co.update(combinations(sorted(ks), 2))
    links = [{"source": a, "target": b, "peso": n} for (a, b), n in co.most_common() if n > 1]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"provisional": True, "nodes": nodes, "links": links}, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    print(f"{len(nodes)} nodos · {len(links)} enlaces → {OUT.relative_to(BASE)}")


if __name__ == "__main__":
    main()
