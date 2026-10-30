# -*- coding: utf-8 -*-
"""Simulasi seperti pengguna: render blangko utuh (php56 ABT asli, render.py) SEBELUM (RTF dasar + aps_badilag_2810) dan SESUDAH
(RTF tertimpa + aps_badilag_pp29) atas SIPP simulasi sipp_pp29v (simulasi_siapkan.py), lalu tampilkan bagian yang dibaca hakim
(amar biaya, rincian, kalimat panggilan) dan periksa: sisa #nnnn#, DATA_TIDAK_ADA, "nihil" di amar, "( rupiah)", "Rp,00",
"Rp ...,00", spasi ganda, spasi sebelum tanda baca. Teks lengkap ke D:/Aplikasi/aleta/tmp/pp29/simulasi (memuat data perkara,
TIDAK masuk repo); ringkasan hitungan ke ../hasil/simulasi-ringkasan.json.
pakai: python simulasi_render.py <label> <berkas relatif derry_briantono>::<pid>[,<pid>] ..."""
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render  # noqa: E402

# pohon perkiraan server SEBELUM paket (w82 + alamat-ganda, sampul, pihak-urut, court-calendar, ikrar-92; agen BAS) dan pohon uji
# SESUDAH paket terpasang (salinan pohon itu + pasang-satker.sh ABT_LOKAL=1)
DASAR = r'D:\Aplikasi\aleta\tmp\bas29\dasar2\derry_briantono'
TINDIH = []
TIMPA = r'D:\Aplikasi\aleta\tmp\pp29\b2\derry_briantono'
OUT = r'D:\Aplikasi\aleta\tmp\pp29\simulasi'
HASIL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hasil', 'simulasi-ringkasan.json')
sys.stdout.reconfigure(encoding='utf-8')
os.makedirs(OUT, exist_ok=True)
label = sys.argv[1]
tugas = []
for a in sys.argv[2:]:
    b, _, p = a.partition('::')
    tugas += [(b, x) for x in p.split(',')]


def dasar(b):
    for akar in TINDIH:
        if os.path.exists(os.path.join(akar, b)):
            return os.path.join(akar, b)
    return os.path.join(DASAR, b)


def potong(t):
    """Bagian yang dibaca: kalimat amar biaya, blok rincian, kalimat panggilan."""
    t = re.sub(r'[ \t]+', ' ', t)
    out = []
    for m in re.finditer(r'[^\n]*(Membebankan|Menghukum [^\n]*biaya)[^\n]*', t):
        out.append('AMAR   | ' + m.group(0).strip())
    i = t.find('Rincian Biaya')
    if i >= 0:
        blok = t[i:i + 900]
        j = blok.find(')')
        out.append('RINCIAN| ' + ' / '.join(x.strip() for x in blok[: j + 2 if j > 0 else 600].split('\n') if x.strip() and x.strip() not in ('Untuk Salinan', 'Panitera,')))
    for m in re.finditer(r'(relaas\)? (panggilan )?Nomor \S+ (yang dibacakan[^,]*, )?(ia telah dipanggil dengan sah dan patut, )?(pada )?tanggal [^;]{0,160}?(yang (telah )?dibacakan|, dan ketidak))', t):
        out.append('PANGGIL| ' + m.group(1))
    return out


def periksa(t):
    t1 = re.sub(r'[ \t]+', ' ', t)
    amar = '\n'.join(re.findall(r'[^\n]*(?:Membebankan|Menghukum)[^\n]*', t1))
    return {
        'sisa_penanda': len(re.findall(r'#\d{4,5}#', t)),
        'DATA_TIDAK_ADA': t.count('DATA_TIDAK_ADA'),
        'nihil_di_amar': len(re.findall(r'nihil', amar, re.I)),
        'kurung_rupiah_kosong': t1.count('( rupiah)'),
        'Rp_kosong': len(re.findall(r'Rp ?,00|Rp ?\.\.\.,00', t1)),
        'angka_terpotong_8504': len(re.findall(r'Rp\d{1,3},00', t1)),
        'spasi_sebelum_tanda': len(re.findall(r' [,;.](?!\.)', amar)),
        'galat': ('GALAT RENDER' in t) or ('ERROR Variabel' in t),
    }


ring = json.load(io.open(HASIL, encoding='utf-8')) if os.path.exists(HASIL) else {}
for sisi, src, akar in (('sebelum', 'aps_badilag_2810', None), ('sesudah', 'aps_badilag_pp29', TIMPA)):
    render.siapkan(src)
    for b, pid in tugas:
        t = render.render(dasar(b) if akar is None else os.path.join(akar, b), pid)
        nama = '%s-%s-%s-%s.txt' % (label, sisi, pid, re.sub(r'\W+', '_', b)[-40:])
        io.open(os.path.join(OUT, nama), 'w', encoding='utf-8').write(t)
        cek = periksa(t)
        ring['%s | %s | %s | %s' % (label, sisi, b, pid)] = cek
        print('=== [%s] %s | %s | perkara %s' % (label, sisi, b, pid))
        print('    periksa:', cek)
        for x in potong(t):
            print('    ' + x[:420])
json.dump(ring, io.open(HASIL, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
