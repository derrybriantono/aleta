# -*- coding: utf-8 -*-
"""Render blangko Court Calendar BARU dan bagian court calendar di BAS 2 / BAS 3 ASLI (ALUR 04) dengan renderer php56 ABT asli atas perkara cerai nyata
(sipp_donggala, baca saja), lalu bandingkan isinya: setiap baris court calendar di BAS harus ADA (urutan sama) di blangko baru, dan baris tambahan blangko baru
hanya yang dikenal (judul, 'Dalam perkara', identitas pihak, blok tanda tangan Panitera Pengganti).
Salinan renderer milik sendiri: D:/Aplikasi/aleta/tmp/cc/abt-salinan (DB aps_badilag_ccrender -> abt_variabel dari aps_badilag_cc).
pakai: python render_banding.py <folder rtf blangko baru> <folder ALUR 04 asli> perkara_id [perkara_id ...]  -> ringkasan; hasil teks ke D:/Aplikasi/aleta/tmp/cc/out (memuat data perkara, TIDAK masuk repo)"""
import json
import os
import re
import subprocess
import sys

SALINAN = r'D:\Aplikasi\aleta\tmp\cc\abt-salinan'
PHP = r'D:\sipp-server\php56\php.exe'
TMP = r'D:\Aplikasi\aleta\tmp'
OUT = r'D:\Aplikasi\aleta\tmp\cc\out'
os.makedirs(OUT, exist_ok=True)


def rtf_teks(s):
    s = re.sub(r'\\u(-?\d+)\??', lambda m: chr(int(m.group(1)) % 65536), s)
    s = re.sub(r"\\'([0-9a-f]{2})", lambda m: bytes.fromhex(m.group(1)).decode('cp1252', 'replace'), s)
    s = re.sub(r'\\(par[d]?|line|row|cell)\b', '\n', s)
    s = re.sub(r'\\tab\b', '\t', s)
    # buang kepala (font/warna/gaya) agar nama gaya tidak ikut jadi teks
    i = s.find('BERITA ACARA')
    s = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', s)
    s = re.sub(r'[{}]', '', s)
    return s


def render(rtf_bytes, pid, sidang=''):
    sem = os.path.join(SALINAN, '_blangko_abt', '_uji_cc.rtf')
    open(sem, 'wb').write(rtf_bytes)
    out = os.path.join(OUT, '_keluar_%s.rtf' % pid)
    tugas = os.path.join(OUT, '_tugas.json')
    json.dump({'perkara_id': int(pid), 'rtf': '_blangko_abt/_uji_cc.rtf', 'keluar': out, 'sidang': sidang}, open(tugas, 'w'))
    env = dict(os.environ, TMP=TMP, TEMP=TMP, UJI_T_TUGAS=tugas)
    if os.path.exists(out):
        os.remove(out)
    r = subprocess.run([PHP, '-d', 'memory_limit=1024M', 'index.php', 'uji_t', 'render'], cwd=SALINAN, env=env, capture_output=True, timeout=900)
    if not os.path.exists(out):
        raise RuntimeError('render gagal: ' + r.stdout.decode('cp1252', 'replace')[:300] + r.stderr.decode('cp1252', 'replace')[:300])
    raw = open(out, 'rb').read()
    os.remove(out)
    return raw


def baris(raw):
    # badan saja: sesudah stylesheet RTF; ambil teks, pecah baris, rapikan spasi
    t = rtf_teks(raw.decode('latin1'))
    hasil = []
    for b in t.split('\n'):
        b = re.sub(r'\s+', ' ', b).strip()
        if b:
            hasil.append(b)
    return hasil


def potong(b, awal, akhir):
    i = next(k for k, x in enumerate(b) if x.startswith(awal))
    j = next(k for k, x in enumerate(b) if k > i and x.startswith(akhir))
    return b[i:j]


def subsekuens(kecil, besar):
    """True bila 'kecil' muncul berurutan di 'besar'; kembalikan juga baris kecil yang tidak ketemu."""
    pos = 0
    hilang = []
    for x in kecil:
        try:
            pos = besar.index(x, pos) + 1
        except ValueError:
            hilang.append(x)
    return not hilang, hilang


def norm(x):
    return x.replace('(APABILA ADA REKONVENSI)', '').strip().rstrip(';.').strip()


def main():
    baru, asli = sys.argv[1], sys.argv[2]
    pids = sys.argv[3:]
    f1 = 'Court Calendar - Penetapan Jadwal Persidangan.rtf'
    f2 = 'Court Calendar - Perubahan Jadwal Persidangan (Gugatan Rekonvensi).rtf'
    s2 = '[2] BAS 2 P & T Hadir - Laporan Mediasi dan Pemeriksaan Pokok Perkara.rtf'
    s3 = '[3] BAS 3 P & T Hadir - Jawaban (dan Gugatan Rekonvensi bila ada).rtf'
    isi = {k: open(os.path.join(d, n), 'rb').read() for k, (d, n) in {'b1': (baru, f1), 'b2': (baru, f2), 's2': (asli, s2), 's3': (asli, s3)}.items()}
    ringkas = []
    for pid in pids:
        t = {k: baris(render(v, pid)) for k, v in isi.items()}
        for k, v in t.items():
            open(os.path.join(OUT, '%s-%s.txt' % (k, pid)), 'w', encoding='utf-8').write('\n'.join(v))
        # bagian court calendar di BAS 2: dari 'PENETAPAN' sampai 'Kemudian ... ditunda'; BAS 3: dari 'Selanjutnya ... rekonvensi' sampai 'Kemudian ... ditunda'
        i = next(k for k, x in enumerate(t['s2']) if x == 'PENETAPAN')
        j = next(k for k, x in enumerate(t['s2']) if k > i and x.startswith('Kemudian') and 'ditunda' in x)
        c2 = t['s2'][i + 1:j]
        i3 = next(k for k, x in enumerate(t['s3']) if x.startswith('Selanjutnya') and 'rekonvensi' in x)
        j3 = next(k for k, x in enumerate(t['s3']) if k > i3 + 1 and x.startswith('Kemudian') and 'ditunda' in x)
        c3 = t['s3'][i3:j3]
        n1 = [norm(x) for x in t['b1']]
        n2 = [norm(x) for x in t['b2']]
        ok1, h1 = subsekuens([norm(x) for x in c2 if not re.match(r'^Nomor ', x)], n1)
        ok2, h2 = subsekuens([norm(x) for x in c3], n2)
        # baris tambahan blangko baru (tidak ada di bagian BAS): daftar singkat
        tambah1 = [x for x in t['b1'] if norm(x) not in set(norm(y) for y in c2)]
        tambah2 = [x for x in t['b2'] if norm(x) not in set(norm(y) for y in c3)]
        ringkas.append({'perkara': pid, 'b1_baris': len(t['b1']), 'bas2_bagian': len(c2), 'b1_semua_baris_bas_ada': ok1, 'b1_hilang': h1, 'b1_tambahan': len(tambah1),
                        'b2_baris': len(t['b2']), 'bas3_bagian': len(c3), 'b2_semua_baris_bas_ada': ok2, 'b2_hilang': h2, 'b2_tambahan': len(tambah2)})
        print(pid, 'b1 %d baris | bagian BAS2 %d baris -> %s %s | tambahan %d' % (len(t['b1']), len(c2), 'SAMA' if ok1 else 'BEDA', h1[:3], len(tambah1)),
              '|| b2 %d baris | bagian BAS3 %d -> %s %s | tambahan %d' % (len(t['b2']), len(c3), 'SAMA' if ok2 else 'BEDA', h2[:3], len(tambah2)))
    json.dump(ringkas, open(os.path.join(OUT, 'ringkasan.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
