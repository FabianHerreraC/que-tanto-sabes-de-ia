"""Importa data/Historias_IA_Bosque.docx y escribe web/data/historias.json para la vitrina.

El documento trae un título, un párrafo de entrada y una historia por cada «Título 2»:
sus párrafos de texto y, al final, los enlaces a la fuente. Aquí solo se agrega el tema
de cada historia (para filtrar la vitrina), que el documento no trae.

Uso:  python3 pipeline/importar_historias.py
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
DOCX = BASE / "data" / "Historias_IA_Bosque.docx"
OUT = BASE / "web" / "data" / "historias.json"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

# tema de cada historia según palabras de su título (el primero que coincide)
TEMAS = [
    ("Formación", r"formaci[oó]n|academia|doctorado|diplomado|medicamentos|pregrado|creaci[oó]n digital|educadores"),
    ("Salud", r"citolog|im[aá]genes m[eé]dicas|salud|falla cardiaca"),
    ("Creación", r"arquitectura"),
    ("Investigación", r"investig|semilleros|grupos"),
]


# imagen principal de la noticia enlazada en cada historia (og:image o la imagen que abre el artículo).
# Sin imagen: 02 y 07 enlazan a PDF, 04 enlaza a una página vencida, 05 y 08 no tienen una imagen propia.
# La 10 (formación de educadores) usa una ilustración propia del sitio, el hombre con el ábaco:
# web/img/historias/10.jpg se pone a mano y no tiene fuente externa.
U = "https://www.unbosque.edu.co/sites/default/files/"
IMAGENES = {
    "01": U + "2025-10/alma-inteligencia-artificial-deteccion-cancer-cervical-universidad-elbosque%20%281%29.png",
    "03": U + "2025-03/Relato%2520-%2520Lab%2520IAx.jpg",
    "06": U + "2025-06/cursos-inteligencia-artificial-ciencia-datos-universidad-elbosque.png",
    "09": U + "2026-05/doctorado-en-ciencia-de-datos-e-inteligencia-artificial-carrucel.jpg",
    "11": U + "2025-05/E-00936-cabezotes.jpg",
    "12": U + "2025-02/DisenoDigitalElBosque32.png",
    "13": U + "2025-11/tesoro-quimbaya-inteligencia-artificial-universidad-elbosque.png",
}
IMG_DIR = BASE / "web" / "img" / "historias"
# videos propios (se ponen a mano, ya comprimidos): web/img/historias/NN.mp4 y su cuadro de portada NN-video.jpg
# 12 Creación Digital: creaciondigitalPauta02.mov → 720×720 H.264 (avconvert, PresetAppleM4V720pHD)


def descargar_imagenes():
    """Baja cada imagen una sola vez y la deja en JPEG de máximo 1400 px de ancho (sips, de macOS)."""
    import subprocess, tempfile
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    for num, url in IMAGENES.items():
        destino = IMG_DIR / f"{num}.jpg"
        if destino.exists():
            continue
        with tempfile.TemporaryDirectory() as tmp:
            crudo = Path(tmp) / "original"
            subprocess.run(["curl", "-sfL", "--max-time", "30", "-A", "Mozilla/5.0 (compatible; sitio-lineamientos)", "-o", str(crudo), url], check=True)
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "78", "-Z", "1400", str(crudo), "--out", str(destino)],
                           check=True, capture_output=True)
        print(f"imagen {num}: {destino.stat().st_size // 1024} KB")


def tema_de(titulo):
    for tema, patron in TEMAS:
        if re.search(patron, titulo, re.I):
            return tema
    return "Investigación"


def main():
    doc = ET.fromstring(zipfile.ZipFile(DOCX).read("word/document.xml"))
    titulo, intro, historias = "", "", []
    for p in doc.iter(W + "p"):
        st = p.find(f"{W}pPr/{W}pStyle")
        estilo = st.get(W + "val") if st is not None else ""
        texto = "".join(t.text or "" for t in p.iter(W + "t")).strip()
        if not texto:
            continue
        if estilo == "Title":
            titulo = texto
        elif estilo.startswith("Heading"):
            historias.append({"titulo": texto, "parrafos": [], "enlaces": []})
        elif not historias:
            intro = (intro + " " + texto).strip()
        elif re.match(r"https?://\S+$", texto):
            historias[-1]["enlaces"].append(texto)
        else:
            historias[-1]["parrafos"].append(texto)

    errores = [f"«{h['titulo']}» no tiene texto" for h in historias if not h["parrafos"]]
    if not titulo or not historias or errores:
        print("\n".join(errores) or "no se encontró el título o las historias"); sys.exit(1)
    descargar_imagenes()
    for i, h in enumerate(historias, 1):
        h["num"] = f"{i:02d}"
        h["tema"] = tema_de(h["titulo"])
        if (IMG_DIR / f"{h['num']}.jpg").exists():
            h["imagen"] = f"img/historias/{h['num']}.jpg"
            if h["num"] in IMAGENES:
                h["imagen_fuente"] = IMAGENES[h["num"]]
        if (IMG_DIR / f"{h['num']}.mp4").exists():
            h["video"] = f"img/historias/{h['num']}.mp4"
            h["video_poster"] = f"img/historias/{h['num']}-video.jpg"
    OUT.write_text(json.dumps({"titulo": titulo, "intro": intro, "historias": historias}, ensure_ascii=False, indent=1), encoding="utf-8")
    temas = {}
    for h in historias:
        temas[h["tema"]] = temas.get(h["tema"], 0) + 1
    print(f"{len(historias)} historias {temas} → {OUT.relative_to(BASE)}")


if __name__ == "__main__":
    main()
