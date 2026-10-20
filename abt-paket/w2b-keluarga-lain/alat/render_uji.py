# -*- coding: utf-8 -*-
"""Render RTF blangko memakai renderer php56 ABT (Abt_model::variabel_library) atas SALINAN aplikasi ABT yang menunjuk basis
ABT sementara aps_badilag_w2blain (tabel lain = view baca-saja ke aps_badilag; abt_variabel = salinan + variabel paket).
Tidak menyentuh aplikasi ABT asli maupun basisnya.
  python render_uji.py <keluar_dir> <kode>=<rtf>@<perkara_id>[,<perkara_id>...] ...
Keluaran: <keluar_dir>/<kode>-<pid>.rtf dan .txt (teks polos) ; ringkasan.json"""
import json, os, re, shutil, subprocess, sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
from rtf2txt import rtf_ke_teks  # noqa: E402

SALINAN = r'D:\Aplikasi\aleta\tmp\w2b-lain\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'


def main():
    keluar_dir = sys.argv[1]
    os.makedirs(keluar_dir, exist_ok=True)
    env = dict(os.environ, TMP=TMP, TEMP=TMP)
    sementara = os.path.join(SALINAN, '_blangko_abt')
    os.makedirs(sementara, exist_ok=True)
    sementara = os.path.join(sementara, '_uji_t_sementara.rtf')
    hasil = []
    for arg in sys.argv[2:]:
        kode, sisa = arg.split('=', 1)
        rtf, pids = sisa.rsplit('@', 1)
        shutil.copy(rtf, sementara)
        for pid in pids.split(','):
            out = os.path.join(keluar_dir, '%s-%s.rtf' % (kode, pid))
            tugas = os.path.join(TMP, '_tugas_w2blain.json')
            json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_t_sementara.rtf', 'keluar': out, 'sidang': ''}, open(tugas, 'w'))
            r = subprocess.run([PHP, '-d', 'memory_limit=512M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=dict(env, UJI_T_TUGAS=tugas), capture_output=True)
            os.remove(tugas)
            st = r.stdout.decode('cp1252', 'replace').strip()
            t = re.sub(r'\n{3,}', '\n\n', rtf_ke_teks(open(out, 'rb').read().decode('latin1'))) if os.path.exists(out) else ''
            open(out[:-4] + '.txt', 'w', encoding='utf-8').write(t)
            sisa_t = sorted(set(re.findall(r'#\d{4,5}#', t)))
            galat = 'ERROR' in t or 'Variabel #' in st or not st.startswith('OK')
            hasil.append(dict(kode=kode, perkara=pid, php=st[:200], token_sisa=sisa_t, titik3=t.count('...'), galat=galat))
            print('%s %s: %s | sisa %s | ... %d%s' % (kode, pid, st[:50], sisa_t, t.count('...'), ' GALAT' if galat else ''))
    json.dump(hasil, open(os.path.join(keluar_dir, 'ringkasan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('RINGKAS render=%d' % len(hasil))


if __name__ == '__main__':
    main()
