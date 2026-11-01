# -*- coding: utf-8 -*-
"""Banding isian_rtf_butir dengan isian_rtf_penanda LAMA vs BARU atas masukan nyata.

pakai: python banding_penanda.py <basis ABT dengan fungsi LAMA> <basis ABT dengan fungsi BARU> <basis SIPP> <keluaran.txt>

Perubahan fungsi hanya bekerja bila SATU BARIS diawali angka lalu spasi lalu titik/kurung tutup ("1 .", "2 )") - jadi masukan tanpa pola itu
PASTI sama persis (dibuktikan dari kodenya) dan tidak perlu dijalankan. Yang dijalankan: SEMUA masukan nyata yang memuat pola itu (posita dan petitum
SIPP seluruh perkara, mode html; isian teks tersimpan, mode teks), ditambah contoh acak 300 masukan tanpa pola sebagai penjaga.
Lolos bila: masukan tanpa pola -> keluaran sama; masukan berpola -> hanya paragraf berpenanda yang berubah, teks tampak sama persis (hanya
antara penanda dan isi: spasi -> tab).
"""
import re
import sys

sys.path.insert(0, 'D:/Aplikasi/aleta/tmp/w155')
from fn import sql  # noqa: E402

LAMA, BARU, SIPP, KELUAR = sys.argv[1:5]
POLA = "[[:cntrl:][:space:]>][0-9]{1,3}[[:space:]]+[.)]"
BS = chr(92)


def tampak(rtf):
    t = re.sub(r'\\par ?', '\n', rtf)
    t = re.sub(r'\\pard[^ ]* ?', '', t)
    t = re.sub(r"\\'([0-9a-f]{2})", lambda m: chr(int(m.group(1), 16)), t)
    t = re.sub(r'\\tab ?', ' ', t)
    t = re.sub(r'\\[a-z]+-?\d* ?', '', t)
    return re.sub(r'\s+', ' ', t).strip()


sumber = [
    ('posita SIPP', "SELECT p.perkara_id AS k, p.posita AS m, 'html' AS md FROM %s.perkara p WHERE p.posita IS NOT NULL AND p.posita <> ''" % SIPP, 'posita'),
    ('petitum SIPP', "SELECT p.perkara_id AS k, p.petitum AS m, 'html' AS md FROM %s.perkara p WHERE p.petitum IS NOT NULL AND p.petitum <> ''" % SIPP, 'petitum'),
    ('isian teks tersimpan', "SELECT CONCAT(t.no_var, '/', t.perkara_id) AS k, t.data AS m, 'teks' AS md FROM %s.abt_data_teks t WHERE t.data IS NOT NULL" % LAMA, 'data'),
]
lap = []
for nama, q, kol in sumber:
    asal = "(%s)" % q
    berpola = sql(LAMA, "SELECT x.k FROM %s x WHERE x.m REGEXP '%s'" % (asal, POLA)).split('\n')
    berpola = [k for k in berpola if k]
    total = int(sql(LAMA, "SELECT COUNT(*) FROM %s x" % asal))
    hasil = {}
    for db in (LAMA, BARU):
        out = sql(LAMA, "SELECT x.k, HEX(%s.isian_rtf_butir(x.m, x.md, 426)) FROM %s x WHERE x.m REGEXP '%s' OR MOD(CRC32(x.k), %d) = 0" % (db, asal, POLA, max(1, total // 300)))
        hasil[db] = dict(l.split('\t') for l in out.split('\n') if l)
    a, b = hasil[LAMA], hasil[BARU]
    sama = sum(1 for k in a if a[k] == b.get(k))
    beda = [k for k in a if a[k] != b.get(k)]
    tampak_sama = 0
    tampak_beda = []
    for k in beda:
        ta = tampak(bytes.fromhex(a[k]).decode('latin1'))
        tb = tampak(bytes.fromhex(b[k]).decode('latin1'))
        if ta == tb:
            tampak_sama += 1
        else:
            tampak_beda.append(k)
    lap.append('== %s: %d masukan, %d berpola (dijalankan semua) + contoh acak tanpa pola; dijalankan %d | sama persis %d | berubah %d (teks tampak sama %d, teks tampak beda %d)'
               % (nama, total, len(berpola), len(a), sama, len(beda), tampak_sama, len(tampak_beda)))
    for k in beda[:40]:
        lap.append('   berubah: %s%s' % (k, '  <-- TEKS TAMPAK BEDA' if k in tampak_beda else ''))
    tanpa_pola_beda = [k for k in beda if k not in set(berpola)]
    lap.append('   berubah tanpa pola (harus 0): %d' % len(tanpa_pola_beda))
open(KELUAR, 'w', encoding='utf-8', newline='\n').write('\n'.join(lap) + '\n')
print('\n'.join(lap))
