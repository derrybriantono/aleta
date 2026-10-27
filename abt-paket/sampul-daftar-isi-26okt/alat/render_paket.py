# -*- coding: utf-8 -*-
"""Render RTF paket memakai renderer php56 ABT ASLI (salinan aplikasi ABT dengan basis render = tampilan ke basis lab paket terpasang) dan SIMPAN keluarannya.
Prasyarat (laptop): paket terpasang di basis aps_badilag_s1 (sumber/siapkan_lab.sh + pasang-satker.sh lab); render_siapkan.py aps_badilag_s1 (paket alamat-ganda-26okt/alat).
pakai: python render_paket.py <folder keluaran> <perkara_id> [<perkara_id> ...]   -> <keluaran>/<nama berkas> [<perkara_id>].rtf untuk keenam RTF"""
import json, os, subprocess, sys

SALINAN = r'D:\Aplikasi\aleta\tmp\w82\render\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
SINI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def render(rtf_bytes, pid, keluar):
    sem = os.path.join(SALINAN, '_blangko_abt', '_uji_t_sementara.rtf')
    open(sem, 'wb').write(rtf_bytes)
    tugas = os.path.join(TMP, 'w82', '_tugas.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_t_sementara.rtf', 'keluar': keluar, 'sidang': ''}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    r = subprocess.run([PHP, '-d', 'memory_limit=512M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=env, capture_output=True)
    return os.path.exists(keluar), r.stdout.decode('cp1252', 'replace')[:200]


if __name__ == '__main__':
    tuj = sys.argv[1]
    os.makedirs(tuj, exist_ok=True)
    for pid in sys.argv[2:]:
        for akar, _, berkas in os.walk(os.environ.get('RAPI_RTF') or os.path.join(SINI, 'rtf')):   # RAPI_RTF = folder rtf lain (mis. paket sebelumnya, untuk pembanding)
            for b in sorted(berkas):
                data = open(os.path.join(akar, b), 'rb').read()
                keluar = os.path.join(tuj, '%s [%s].rtf' % (b[:-4], pid))
                ok, st = render(data, pid, keluar)
                print(pid, b, 'OK' if ok else 'GAGAL ' + st, os.path.getsize(keluar) if ok else '')
