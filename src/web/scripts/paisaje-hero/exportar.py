"""Graba una escena pixel art a video (webm + mp4) y su póster.

Escenas: paisaje (generador.html, hero) y atardecer (atardecer.html, cierre).

Dibuja cada cuadro con generador.html en Chromium, lo guarda sin pérdida y lo
codifica con ffmpeg a 2x (cada pixel de arte = 2x2) para que el submuestreo de
color no manche los bordes. En la web se escala con image-rendering: pixelated.
Uso: uv run --with playwright python exportar.py [paisaje|atardecer] [--vista]
"""
import base64
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI.parents[1] / 'src' / 'features' / 'marketing' / 'assets' / 'hero'
CHROME = next(Path.home().glob('.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'), None)
FPS = 10
ESCENAS = {'paisaje': 'generador.html', 'atardecer': 'atardecer.html'}


def cuadros(pagina: str, destino: Path, solo: int | None = None) -> int:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=str(CHROME) if CHROME else None)
        pg = b.new_page()
        pg.goto((AQUI / pagina).as_uri() + '?quieto')
        pg.evaluate('window.listo || null')
        total = pg.evaluate('window.CUADROS')
        for i in ([solo] if solo is not None else range(total)):
            png = pg.evaluate(f"(() => {{ window.dibujar({i}); return document.getElementById('lienzo').toDataURL('image/png'); }})()")
            (destino / f'c{i:03d}.png').write_bytes(base64.b64decode(png.split(',')[1]))
        b.close()
    return total


def main() -> None:
    tmp = Path(tempfile.mkdtemp())
    escena = next((a for a in sys.argv[1:] if a in ESCENAS), 'paisaje')
    pagina = ESCENAS[escena]
    if '--vista' in sys.argv:
        cuadros(pagina, tmp, 0)
        subprocess.run(['magick', str(tmp / 'c000.png'), '-filter', 'point', '-resize', '300%', str(AQUI / 'vista.png')], check=True)
        print(AQUI / 'vista.png')
        return
    cuadros(pagina, tmp)
    SALIDA.mkdir(parents=True, exist_ok=True)
    escala = ['-vf', 'scale=iw*2:ih*2:flags=neighbor']
    entrada = ['-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', str(tmp / 'c%03d.png')]
    subprocess.run(['ffmpeg', *entrada, *escala, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '18', '-pix_fmt', 'yuv420p',
                    '-row-mt', '1', str(SALIDA / f'{escena}.webm')], check=True)
    subprocess.run(['ffmpeg', *entrada, *escala, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', str(SALIDA / f'{escena}.mp4')], check=True)
    shutil.copy(tmp / 'c000.png', SALIDA / f'{escena}-poster.png')
    shutil.rmtree(tmp)
    for f in sorted(SALIDA.iterdir()):
        print(f.name, f.stat().st_size // 1024, 'KB')


main()
