# -*- coding: utf-8 -*-
"""Render ABT ASLI (php56, salinan vs30/abt -> sipp_vs + aps_badilag_vs) untuk satu RTF + satu perkara. Keluaran RTF memuat data perkara: SIMPAN DI LUAR REPO.
pakai: python -B render_abt.py <rtf sumber> <perkara_id> <keluar.rtf> [kunci unik]
Berkas sumber disalin sementara ke _blangko_abt/_a5_<kunci>.rtf di salinan lalu dihapus. PHP salinan tidak disentuh. Render ABT menulis urutan sidang ke sipp_vs (bawaan ABT)."""
import json
import os
import shutil
import subprocess
import sys
import time

ABT = os.environ.get('UJI_ABT_DIR', r'D:\Aplikasi\aleta\tmp\vs30\abt')
PHP = os.environ.get('UJI_PHP', r'D:\sipp-server\php56\php.exe')
TMP = os.environ.get('TMP', r'D:\Aplikasi\aleta\tmp')


def render(sumber, pid, keluar, kunci):
    rel = '_blangko_abt/_a5_%s.rtf' % kunci
    p = os.path.join(ABT, rel.replace('/', os.sep))
    tugas = os.path.join(TMP, 'a5_tugas_%s.json' % kunci)
    shutil.copyfile(sumber, p)
    json.dump({'perkara_id': int(pid), 'rtf': rel, 'keluar': keluar, 'sidang': ''}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    t0 = time.time()
    try:
        r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=ABT, env=env, capture_output=True, timeout=1800)
    finally:
        for f in (p, tugas):
            try:
                os.remove(f)
            except OSError:
                pass
    out = r.stdout.decode('cp1252', 'replace').strip()
    return out[-200:], round(time.time() - t0, 1)


if __name__ == '__main__':
    print(render(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else str(os.getpid())))
