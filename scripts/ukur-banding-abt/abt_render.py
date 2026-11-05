# -*- coding: utf-8 -*-
"""Sisi ABT pengukur banding Tahap 4: nilai tiap #NNNN# menurut renderer php56 ABT ASLI (salinan milik sendiri).
HANYA ABT salinan (sipp_vs + aps_badilag_vs) yang terlibat; render ABT menulis urutan sidang ke salinan itu, bukan ke SIPP sungguhan.
pakai: python abt_render.py <kode,kode,...|@berkas> <perkara_id> <keluar.json>   (env UJI_ABT_DIR, UJI_PHP, TMP)
Keluar memuat data perkara -> simpan di luar repo."""
import json, os, re, subprocess, sys
SINI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SINI, '..', '..', 'abt-paket', 'bas-tanya-jawab-29okt', 'sumber'))
from rtf2txt import rtf_ke_teks  # noqa: E402

ABT = os.environ.get('UJI_ABT_DIR', r'D:\Aplikasi\aleta\tmp\vs30\abt')
PHP = os.environ.get('UJI_PHP', r'D:\sipp-server\php56\php.exe')
TMP = os.environ.get('TMP', r'D:\Aplikasi\aleta\tmp')
B = chr(92)


def dokumen(kode):
    return ('{' + B + 'rtf1' + B + 'ansi' + B + 'ansicpg1252' + B + 'deff0{' + B + 'fonttbl{' + B + 'f0 Times New Roman;}}' + chr(10)
            + ''.join(B + 'pard @@%s@@ #%s#' % (k, k) + B + 'par' + chr(10) for k in kode) + B + 'pard @@AKHIR@@' + B + 'par}')


def pisah(raw, kode):
    tx = rtf_ke_teks(raw.decode('latin1'))
    bag = re.split(r'@@(\d{3,5}|AKHIR)@@', tx)
    nilai = {bag[i]: bag[i + 1] for i in range(1, len(bag) - 1, 2)}
    return {k: nilai.get(k, '') for k in kode}


def main():
    if sys.argv[1] == '--dari-rtf':
        # sisi mesin ALETA: RTF hasil isiRtf (berkas) diubah dengan pengubah yang SAMA seperti keluaran ABT
        rtf, kode, keluar = sys.argv[2:5]
        kode = [k.strip() for k in re.split(r'[,\s]+', open(kode, encoding='utf-8').read()) if k.strip()]
        json.dump({'nilai': pisah(open(rtf, 'rb').read(), kode)}, open(keluar, 'w', encoding='utf-8'), ensure_ascii=False)
        return
    kode, pid, keluar = sys.argv[1:4]
    kode = open(kode[1:], encoding='utf-8').read().strip() if kode.startswith('@') else kode
    kode = [k.strip() for k in re.split(r'[,\s]+', kode) if k.strip()]
    os.makedirs(os.path.join(ABT, '_blangko_abt'), exist_ok=True)
    rel = '_blangko_abt/_uji_t4_%s.rtf' % pid
    out = os.path.join(TMP, 'uji_t4_keluar_%s.rtf' % pid)
    tugas = os.path.join(TMP, 'uji_t4_tugas_%s.json' % pid)
    rtf = ('{' + B + 'rtf1' + B + 'ansi' + B + 'ansicpg1252' + B + 'deff0{' + B + 'fonttbl{' + B + 'f0 Times New Roman;}}\n'
           + ''.join(B + 'pard @@%s@@ #%s#' % (k, k) + B + 'par\n' for k in kode) + B + 'pard @@AKHIR@@' + B + 'par}')
    open(os.path.join(ABT, rel.replace('/', os.sep)), 'wb').write(rtf.encode('latin1'))
    json.dump({'perkara_id': int(pid), 'rtf': rel, 'keluar': out, 'sidang': ''}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    if os.path.exists(out):
        os.remove(out)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=ABT, env=env, capture_output=True, timeout=3000)
    if not os.path.exists(out):
        raise SystemExit('render gagal: ' + r.stdout.decode('cp1252', 'replace')[-300:] + r.stderr.decode('cp1252', 'replace')[-300:])
    raw = open(out, 'rb').read()
    for f in (out, tugas, os.path.join(ABT, rel.replace('/', os.sep))):
        try: os.remove(f)
        except OSError: pass
    json.dump({'perkara': pid, 'info': r.stdout.decode('cp1252', 'replace').strip()[:120], 'nilai': pisah(raw, kode)},
              open(keluar, 'w', encoding='utf-8'), ensure_ascii=False)
    print(pid, 'OK', r.stdout.decode('cp1252', 'replace').strip()[:100], flush=True)


if __name__ == '__main__':
    main()
