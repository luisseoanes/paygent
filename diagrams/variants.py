"""Light/dark transparent variants of the draw.io SVGs for GitHub's README."""
import re, sys, pathlib

GH_BG = {"light": "#ffffff", "dark": "#0d1117"}  # GitHub page backgrounds

ARG = r"(?:[^,()]+|\w+\([^)]*\))"
LD = re.compile(r"light-dark\(\s*(" + ARG + r")\s*,\s*(" + ARG + r")\s*\)")

def variant(svg: str, mode: str) -> str:
    s = LD.sub(lambda m: (m.group(1) if mode == "light" else m.group(2)).strip(), svg)
    # Sin fondo: ni el estilo del <svg> ni el rect de página
    s = re.sub(r'(<svg[^>]*?) style="[^"]*"', r"\1", s, count=1)
    s = re.sub(r'<rect fill="#ffffff" width="100%" height="100%"[^>]*/>', "", s, count=1)
    page = "rgb(255, 255, 255)" if mode == "light" else "rgb(18, 18, 18)"
    # Cajas sin relleno (transparentes); el azul del Gateway se conserva
    s = s.replace(f"fill: {page}", "fill: none")
    if mode == "dark":
        s = re.sub(r'fill="#ffffff"', 'fill="none"', s, flags=re.I)
    # Fondos de etiquetas sobre flechas = color de la página de GitHub
    for c in ("#FFFFFF", "#ffffff", "#121212", "rgb(255, 255, 255)", "rgb(18, 18, 18)"):
        s = s.replace(f"background-color: {c}", f"background-color: {GH_BG[mode]}")
    if mode == "dark":
        # Lo que quedó fijo en gris oscuro pasa al gris claro de draw.io
        s = re.sub(r"#1f2937", "#c4ccd8", s, flags=re.I)
    return s

src, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
svg = src.read_text()
for mode in ("light", "dark"):
    (out_dir / f"{src.stem}-{mode}.svg").write_text(variant(svg, mode))
    print(out_dir / f"{src.stem}-{mode}.svg")
