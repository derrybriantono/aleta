# -*- coding: utf-8 -*-
"""Render RTF lewat jalur cetak ABT asli (Abt_model->variabel_library, PHP 5.6) pada SALINAN ABT sendiri (DB aps_badilag_u2).
Pakai:
  python render_u2.py <perkara_id> <berkas.rtf> [keluar.rtf]      -> cetak teks hasil render
  python render_u2.py --daftar <berkas.tsv>                        -> baris: perkara_id<TAB>rtf<TAB>keluar_dasar
Lingkungan: U2_ABT = folder salinan ABT (bawaan D:/Aplikasi/aleta/tmp/u2/abt-app)."""
import json, os, re, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks
ABT = os.environ.get('U2_ABT', r'D:\Aplikasi\aleta\tmp\u2\abt-app')
PHP = r'D:\sipp-server\php56\php.exe'


def render(pid, rtf, keluar=None):
    sem = os.path.join(ABT, '_blangko_abt', '_uji_u2_%d.rtf' % os.getpid())
    shutil.copy(rtf, sem)
    out = keluar or os.path.join(os.environ.get('TMP', '.'), 'u2_render_%s_%d.rtf' % (pid, os.getpid()))
    tugas = os.path.join(os.environ.get('TMP', '.'), 'u2_tugas_%d.json' % os.getpid())
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/' + os.path.basename(sem), 'keluar': out, 'sidang': ''}, open(tugas, 'w'))
    try:
        r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_u2', 'render'], cwd=ABT,
                           env=dict(os.environ, UJI_U2_TUGAS=tugas), capture_output=True, timeout=900)
        st = r.stdout.decode('cp1252', 'replace').strip()
    finally:
        os.remove(tugas)
        os.remove(sem)
    if not st.startswith('OK') or not os.path.exists(out):
        return st + ' ' + r.stderr.decode('utf-8', 'replace')[:300], ''
    teks = rtf_ke_teks(open(out, 'rb').read().decode('latin1'))
    return st, re.sub(r'\n{3,}', '\n\n', teks)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if sys.argv[1] == '--daftar':
        for b in open(sys.argv[2], encoding='utf-8').read().splitlines():
            if not b.strip() or b.startswith('#'):
                continue
            pid, rtf, dasar = b.split('\t')[:3]
            st, t = render(pid, rtf, dasar + '.rtf')
            open(dasar + '.txt', 'w', encoding='utf-8').write(t)
            print(pid, st[:80], len(t))
    else:
        st, t = render(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
        print(st[:200])
        print(t)
