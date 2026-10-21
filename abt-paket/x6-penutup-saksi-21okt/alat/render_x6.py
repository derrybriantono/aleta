# -*- coding: utf-8 -*-
"""Render blangko Derry memakai renderer php56 ABT ASLI (Abt_model::variabel_library lewat Uji_t) atas basis uji x6:
aps_badilag_x6render (views) -> aps_badilag_x6r.abt_variabel (kueri 9259-9265 dialihkan ke fungsi x6r) dan
aps_badilag_x6r.abt_keterangan_saksi (baris saksi SINTETIS perkara 7326, bukan data nyata). Tidak menulis ke basis aps_badilag laptop.
pakai: python render_x6.py <label> [putusan|bas]   (label dipakai untuk nama berkas keluaran di D:/Aplikasi/aleta/tmp/w30/render/out)"""
import json, os, re, subprocess, sys

SALINAN = r'D:\Aplikasi\aleta\tmp\w30\render\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
RTF = r'D:\Aplikasi\aleta\tmp\tuntutan24\rtf-server\derry_briantono'
KELUAR = r'D:\Aplikasi\aleta\tmp\w30\render\out'
BLANGKO = {
    'putusan': (RTF + r'\1 Perceraian CG\[01] [Kabul Verstek] Cerai (Format Lengkap).rtf', 7326, ''),
    'bas': (RTF + r'\1 Perceraian CG - BAS\BAS ALUR 02 [2] BAS 2 P Hadir & T Tidak Hadir - Saksi dan Putusan Verstek (2 Saksi).rtf', 7326, '3'),
}


def render(rtf_berkas, pid, sidang=''):
    sem = os.path.join(SALINAN, '_blangko_abt', '_uji_x6_sementara.rtf')
    open(sem, 'wb').write(open(rtf_berkas, 'rb').read())
    os.makedirs(KELUAR, exist_ok=True)
    out = os.path.join(KELUAR, '_keluar_%d.rtf' % pid)
    tugas = os.path.join(KELUAR, '_tugas.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_x6_sementara.rtf', 'keluar': out, 'sidang': sidang}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=env, capture_output=True, timeout=900)
    st = r.stdout.decode('cp1252', 'replace').strip()
    os.remove(sem)
    if not os.path.exists(out):
        raise SystemExit('render gagal: ' + st + r.stderr.decode('cp1252', 'replace')[:300])
    data = open(out, 'rb').read().decode('latin1')
    os.remove(out)
    return st, data


if __name__ == '__main__':
    label = sys.argv[1]
    jenis = sys.argv[2] if len(sys.argv) > 2 else 'putusan'
    berkas, pid, sidang = BLANGKO[jenis]
    st, data = render(berkas, pid, sidang)
    os.makedirs(KELUAR, exist_ok=True)
    tujuan = os.path.join(KELUAR, '%s-%s.rtf' % (label, jenis))
    open(tujuan, 'wb').write(data.encode('latin1'))
    print(st, '->', tujuan, len(data))
