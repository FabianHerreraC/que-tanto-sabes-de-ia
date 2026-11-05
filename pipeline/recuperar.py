"""Recupera fragmentos pertinentes de los lineamientos de IA (BM25, solo texto).

Uso:
  python3 recuperar.py "pregunta" [--presupuesto 25000] [--max 25] [--doc Generales] [--vecinos]

Por defecto devuelve una recuperación amplia: hasta 25 fragmentos o ~25.000 tokens,
textos completos sin resumir, ordenados por pertinencia y con su ubicación.
"""
import argparse, json, math, re, unicodedata
from collections import Counter
from pathlib import Path

BASE = Path(__file__).parent
FRAG = BASE / "fragmentos.jsonl" if (BASE / "fragmentos.jsonl").exists() else BASE / "out" / "fragmentos.jsonl"

STOP = set("""a al algo algunas algunos ante antes como con contra cual cuales cuando de del desde donde dos e el
ella ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos fue fueron ha han hasta la las le les
lo los mas me mi muy no nos o otra otras otro otros para pero por porque que se segun ser si sin sobre su sus tal tambien
te tiene tienen todo todos tu un una uno unos y ya debe deben puede pueden cada sea son esta estan asi""".split())


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def stem(w):
    for suf in ("aciones", "imientos", "amientos", "aciones", "mente", "acion", "ciones", "cion", "idades", "idad",
                "ables", "ibles", "able", "ible", "istas", "ista", "ores", "ados", "idos", "ando", "iendo",
                "es", "as", "os", "or", "ar", "er", "ir", "a", "o", "e", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4:
            return w[: -len(suf)]
    return w


def toks(s):
    return [stem(w) for w in re.findall(r"[a-z0-9ñ]+", norm(s)) if w not in STOP and len(w) > 1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pregunta")
    ap.add_argument("--presupuesto", type=int, default=25000, help="tokens máximos a recuperar")
    ap.add_argument("--max", type=int, default=25, help="fragmentos máximos")
    ap.add_argument("--doc", default=None, help="filtra por documento (texto parcial)")
    ap.add_argument("--vecinos", action="store_true", help="añade el fragmento siguiente de la misma sección")
    ap.add_argument("--salida", default=None, help="archivo .md de salida")
    a = ap.parse_args()

    cs = [json.loads(l) for l in open(FRAG, encoding="utf-8")]
    docs = [toks(c["seccion"] + " " + c["seccion"] + " " + c["texto"]) for c in cs]
    N, avg = len(docs), sum(map(len, docs)) / len(docs)
    df = Counter(t for d in docs for t in set(d))
    q = toks(a.pregunta)
    k1, b = 1.5, 0.75
    scores = []
    for i, d in enumerate(docs):
        tf, s = Counter(d), 0.0
        for t in q:
            if t in tf:
                idf = math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5))
                s += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * len(d) / avg))
        if a.doc and norm(a.doc) not in norm(cs[i]["documento"]):
            s = 0
        scores.append(s)

    order = [i for i in sorted(range(N), key=lambda i: -scores[i]) if scores[i] > 0]
    chosen, used = [], 0
    for i in order:
        group = [i]
        if a.vecinos and i + 1 < N and cs[i + 1]["seccion"] == cs[i]["seccion"]:
            group.append(i + 1)
        for j in group:
            if j in chosen: continue
            t = cs[j]["tokens_aprox"]
            if used + t > a.presupuesto or len(chosen) >= a.max: break
            chosen.append(j); used += t
        if used >= a.presupuesto or len(chosen) >= a.max: break

    out = [f"# Fragmentos recuperados\n\n**Pregunta:** {a.pregunta}\n\n"
           f"**{len(chosen)} fragmentos · ~{used:,} tokens**\n"]
    for rank, j in enumerate(chosen, 1):
        c = cs[j]
        out.append(f"\n---\n\n## {rank}. [{c['id']}] {c['documento']} · {c['seccion']} (pág. {c['pagina_inicio']})\n"
                   f"_pertinencia {scores[j]:.1f} · ~{c['tokens_aprox']} tokens_\n\n{c['texto']}\n")
    md = "".join(out)
    if a.salida:
        Path(a.salida).write_text(md, encoding="utf-8")
        print(f"{len(chosen)} fragmentos · ~{used:,} tokens → {a.salida}")
    else:
        print(md)


if __name__ == "__main__":
    main()
