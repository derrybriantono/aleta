# -*- coding: utf-8 -*-
"""Render AMPLOP relaas (6 blangko 8.x + amplop surat tercatat) SEBELUM dan SESUDAH paket x5 dengan renderer php56 ABT ASLI (Abt_model::variabel_library
lewat pengendali uji Uji_t) atas salinan ABT laptop (database aps_badilag_x5render -> aps_badilag_x5 dengan paket terpasang, SIPP = sipp_donggala).
SEBELUM = RTF asli server; SESUDAH = RTF yang disunting paket (folder blangko-uji hasil uji_lokal.sh). Hasil lengkap memuat nama dan alamat pihak:
hanya ke D:/Aplikasi/aleta/tmp/w28-layar (bukan repo); ringkasan tanpa data pribadi ke hasil/render-amplop.json.
Yang diperiksa: alamat penerima di amplop berakhir ", Kode Pos NNNNN" bila kode pos pasti, tidak ada penanda #NNNN# tersisa, "..." tidak muncul di tempat alamat.
pakai: python render_amplop.py <perkara_id> [perkara_id ...]"""
import json
import os
import re
import subprocess
import sys

BS = chr(92)
SALINAN = r'D:\Aplikasi\aleta\tmp\w28\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
LAMA = r'D:\Aplikasi\aleta\tmp\w28\rtf-server'
BARU = r'D:\Aplikasi\aleta\tmp\w28\blangko-uji\derry_briantono\98 Relaas'
KELUAR = r'D:\Aplikasi\aleta\tmp\w28-layar'
RINGKAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'render-amplop.json')

BERKAS = [
    '[JS] 8.1.1. Amplop Relaas Panggilan Sidang P.rtf',
    '[JS] 8.1.2. Amplop Relaas Panggilan Sidang T.rtf',
    '[JS] 8.2.1. Amplop Relaas Pemberitahuan Putusan P.rtf',
    '[JS] 8.2.2. Amplop Relaas Pemberitahuan Putusan T.rtf',
    '[JS] 8.3.1. Amplop Relaas Panggilan Ikrar Talak P.rtf',
    '[JS] 8.3.2. Amplop Relaas Panggilan Ikrar Talak T.rtf',
    '[JS] --AMPLOP PANGGILAN SURAT TERCATAT--.rtf',
]


def render(rtf_berkas, pid):
    sem = os.path.join(SALINAN, '_blangko_abt', '_uji_x5_sementara.rtf')
    open(sem, 'wb').write(open(rtf_berkas, 'rb').read())
    out = os.path.join(TMP, 'w28', '_keluar_%s.rtf' % pid)
    tugas = os.path.join(TMP, 'w28', '_tugas.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_x5_sementara.rtf', 'keluar': out, 'sidang': ''}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=env, capture_output=True, timeout=900)
    st = r.stdout.decode('cp1252', 'replace').strip()
    os.remove(sem)
    if not os.path.exists(out):
        raise SystemExit('render gagal: ' + st + r.stderr.decode('cp1252', 'replace')[:300])
    data = open(out, 'rb').read()
    os.remove(out)
    return st, data


def teks(rtf_bytes):
    t = rtf_bytes.decode('latin1')
    t = re.sub(re.escape(BS) + "'([0-9a-f]{2})", lambda m: chr(int(m.group(1), 16)), t)
    t = re.sub(re.escape(BS) + '(par|line|cell|row)(?![a-zA-Z])', '\n', t)
    t = re.sub(re.escape(BS) + '[a-zA-Z]+-?[0-9]* ?', '', t)
    t = re.sub(r'[{}]', '', t)
    return re.sub(r'\n+', '\n', t)


def main():
    os.makedirs(KELUAR, exist_ok=True)
    ring = {}
    pilih = [int(x) for x in os.environ.get('BERKAS_IDX', '0,1,2,3,4,5,6').split(',')]
    labs = os.environ.get('LAB', 'sebelum,sesudah').split(',')
    for pid in sys.argv[1:]:
        for nama in [BERKAS[i] for i in pilih]:
            kode = re.sub(r'[^0-9A-Za-z]+', '_', nama.replace('.rtf', ''))[:30]
            for lab, akar in [x for x in (('sebelum', LAMA), ('sesudah', BARU)) if x[0] in labs]:
                st, data = render(os.path.join(akar, nama), pid)
                open(os.path.join(KELUAR, 'amplop-%s-%s-%s.rtf' % (pid, kode, lab)), 'wb').write(data)
                t = teks(data)
                kp = re.findall(r'Kode Pos (\d{5})', t)
                ring.setdefault(pid, {}).setdefault(nama, {})[lab] = dict(
                    status=st[:50], kode_pos_tercetak=kp, penanda_sisa=sorted(set(re.findall(r'#\d{3,5}#', t))),
                    titik_tiga=t.count('...'), panjang=len(data))
                print(pid, nama[:40], lab, st[:30], kp, flush=True)
    json.dump(ring, open(RINGKAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
