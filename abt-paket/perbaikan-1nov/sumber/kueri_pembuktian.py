# -*- coding: utf-8 -*-
"""Kueri baru variabel pembuktian (2111/7119 Penggugat, 2112/7121 Tergugat) yang memakai aturan TUNDAAN (keputusan 89-B2/73, 1 Nov 2026).

Kembaran SQL dari alat/tahapPembuktianService-ddf15a3a.js (bot, commit ddf15a3a): sisi sidang pembuktian ditentukan DULU dari
alasan ditunda sidang SEBELUMNYA ("pembuktian Tergugat" -> Tergugat; "pembuktian lanjutan Penggugat"/"saksi Penggugat" -> Penggugat;
"Penggugat dan Tergugat" -> keduanya); tundaan tanpa sebutan pihak -> aturan tahap keputusan 52 (paket pembuktian-urut-1nov).
Agenda umum/kosong yang tundaan sebelumnya pembuktian berpihak dianggap sidang pembuktian (kecuali agenda tahap lain).

Ringan di MariaDB/MySQL 5.5: sidang sebelumnya dicari SEKALI per baris lewat LEFT JOIN (satu pencarian berindeks perkara_id), bukan
subkueri yang diulang tiap pemakaian; pemeriksaan murah (regex pada kolom baris itu sendiri) ditaruh lebih dulu daripada yang mencari
sidang lain; hanya MariaDB 5.5 POSIX (tanpa \\b, tanpa REGEXP_REPLACE).
"""
import os
import re

SINI = os.path.dirname(os.path.abspath(__file__))
SERVIS = os.path.join(SINI, '..', 'alat', 'tahapPembuktianService-ddf15a3a.js')
SP = '[[:space:]]'


def baca_pola():
    """POSIX (objek POSIX) + RE_TAHAP_LAIN + RE_PIHAK_GANDA dari salinan bot ddf15a3a. SATU sumber pola."""
    import json
    import subprocess
    POSIX = json.loads(subprocess.run(['node', '-e', 'process.stdout.write(JSON.stringify(require(process.argv[1]).POSIX))', os.path.abspath(SERVIS)],
                                      capture_output=True, check=True).stdout.decode('utf-8'))
    teks = open(SERVIS, encoding='utf-8').read()
    for nama in ('RE_TAHAP_LAIN', 'RE_PIHAK_GANDA'):
        m = re.search(r'const ' + nama + r' = /(.*?)/;', teks)
        assert m, nama
        POSIX[nama] = m.group(1).replace('\\s', SP)
    for k, v in POSIX.items():
        assert "'" not in v and '\\' not in v, k
    return POSIX


POSIX = baca_pola()

# ---------------------------------------------------------------- bagian-bagian (alias sidang s, sidang sebelumnya h) -----------
A = lambda x: "LOWER(IFNULL(%s.agenda,''))" % x
D = lambda x: "LOWER(IFNULL(%s.alasan_ditunda,''))" % x
K = lambda x: "LOWER(IFNULL(%s.keterangan,''))" % x
BUKTI = lambda t: "(%s LIKE '%%bukti%%' OR %s LIKE '%%saksi%%')" % (t, t)
RX = lambda t, nama: "(%s REGEXP '%s')" % (t, POSIX[nama])
SEBELUM = lambda a, b: "(%s.tanggal_sidang < %s.tanggal_sidang OR (%s.tanggal_sidang = %s.tanggal_sidang AND %s.id < %s.id))" % (a, b, a, b, a, b)
SETELAH = lambda a, b: SEBELUM(b, a)

# Sidang tepat SEBELUM s (urutan tanggal_sidang, id - sama dengan daftar bot): satu pencarian per baris.
PREV = lambda s, x: ("(SELECT %s.id FROM perkara_jadwal_sidang %s WHERE %s.perkara_id = %s.perkara_id AND %s ORDER BY %s.tanggal_sidang DESC, %s.id DESC LIMIT 1)"
                     % (x, x, x, s, SEBELUM(x, s), x, x))
GABUNG_PREV = lambda s, h, x: "LEFT JOIN perkara_jadwal_sidang %s ON %s.id = %s" % (h, h, PREV(s, x))
GABUNG_PREV_DALAM = lambda s, h, x: "JOIN perkara_jadwal_sidang %s ON %s.id = %s" % (h, h, PREV(s, x))

TUNDA_T = lambda h: RX(D(h), 'T')                                              # tundaan sebelumnya menyebut pembuktian Tergugat
GANDA = lambda h: "(%s REGEXP '%s')" % (D(h), POSIX['RE_PIHAK_GANDA'])         # "Penggugat dan Tergugat" (bukan tanda Penggugat saja)
TUNDA_P = lambda h: "(%s AND NOT %s)" % (RX(D(h), 'P'), GANDA(h))               # menyebut Penggugat saja
TAHAP_LAIN = lambda s: "(%s REGEXP '%s')" % (A(s), POSIX['RE_TAHAP_LAIN'])
# Sidang pembuktian: agenda menyebut bukti/saksi, ATAU agenda bukan tahap lain dan tundaan sebelumnya pembuktian berpihak.
BUKTI2 = lambda s, h: "(%s OR (NOT %s AND (%s OR %s)))" % (BUKTI(A(s)), TAHAP_LAIN(s), TUNDA_T(h), TUNDA_P(h))

# Tanda "Penggugat selesai" pada alasan ditunda / keterangan (kembaran tandaTeks), SAMA dengan paket pembuktian-urut-1nov.
TANDA = lambda t: ("(%s OR %s OR (%s LIKE '%%kesimpulan%%' AND NOT %s) OR (%s AND NOT (%s REGEXP 'belum[[:space:]]+cukup')))"
                   % (RX(t, 'T_MULAI'), RX(t, 'T'), t, BUKTI(t), RX(t, 'CUKUP'), t))

# Pembuktian sudah MULAI pada/ sebelum sidang i: ada sidang pembuktian k yang bukan sesudah i (agenda dulu, tundaan sesudahnya).
MULAI = lambda i: ("(EXISTS (SELECT 1 FROM perkara_jadwal_sidang k WHERE k.perkara_id = %s.perkara_id AND %s AND NOT %s)"
                   " OR EXISTS (SELECT 1 FROM perkara_jadwal_sidang k %s WHERE k.perkara_id = %s.perkara_id AND NOT %s"
                   " AND NOT %s AND (%s OR %s)))"
                   % (i, BUKTI(A('k')), SEBELUM(i, 'k'), GABUNG_PREV_DALAM('k', 'hk', 'z'), i, SEBELUM(i, 'k'),
                      TAHAP_LAIN('k'), TUNDA_T('hk'), TUNDA_P('hk')))
# Pemicu "Penggugat selesai" pada sidang i (i punya sidang sebelumnya hi): sisi T/PT (agenda Tergugat atau tundaan Tergugat saja),
# agenda kesimpulan (bukan sidang pembuktian), atau tanda pada alasan ditunda / keterangan i.
PEMICU = lambda i, hi: ("((%s AND (%s OR (%s AND NOT %s))) OR (NOT %s AND %s LIKE '%%kesimpulan%%') OR %s OR %s)"
                        % (BUKTI2(i, hi), RX(A(i), 'T'), TUNDA_T(hi), TUNDA_P(hi), BUKTI2(i, hi), A(i), TANDA(D(i)), TANDA(K(i))))
SELESAI = lambda j: ("EXISTS (SELECT 1 FROM perkara_jadwal_sidang i %s WHERE i.perkara_id = %s.perkara_id AND %s AND %s AND %s)"
                     % (GABUNG_PREV('i', 'hi', 'y'), j, SEBELUM('i', j), PEMICU('i', 'hi'), MULAI('i')))
GUGATAN = lambda j: "EXISTS (SELECT 1 FROM perkara pk WHERE pk.perkara_id = %s.perkara_id AND pk.nomor_perkara LIKE '%%Pdt.G%%')" % j


def sisi_penggugat(j='j', h='h'):
    tonly_p = "(%s AND NOT %s)" % (TUNDA_P(h), TUNDA_T(h))
    sama = "(%s = %s)" % (TUNDA_T(h), TUNDA_P(h))     # tundaan tak berpihak jelas (tak ada atau keduanya) -> aturan keputusan 52
    return ("(%s AND (%s OR (NOT %s AND ((%s AND %s) OR %s OR (%s AND (NOT %s OR NOT %s))))))"
            % (BUKTI2(j, h), RX(A(j), 'P'), RX(A(j), 'T'), TUNDA_T(h), GANDA(h), tonly_p, sama, GUGATAN(j), SELESAI(j)))


def sisi_tergugat(j='j', h='h'):
    tonly_t = "(%s AND NOT %s)" % (TUNDA_T(h), TUNDA_P(h))
    tonly_p = "(%s AND NOT %s)" % (TUNDA_P(h), TUNDA_T(h))
    return ("(%s AND (%s OR (NOT %s AND %s) OR (%s AND (%s OR %s OR (NOT %s AND NOT %s AND NOT %s AND %s)))))"
            % (BUKTI2(j, h), RX(A(j), 'T'), RX(A(j), 'P'), tonly_t, GUGATAN(j), RX(D(j), 'T_MULAI'), RX(K(j), 'T_MULAI'),
               RX(A(j), 'P'), tonly_t, tonly_p, SELESAI(j)))


BARU = {'bukti-p': sisi_penggugat, 'bukti-t': sisi_tergugat}


# ---------------------------------------------------------------- syarat paket pembuktian-urut-1nov (dasar; 2x tiap variabel) -----
def syarat_dasar(jenis):
    """Persis syarat BARU paket pembuktian-urut-1nov (ke-22) - yang kini ada di variabel; diganti paket ini."""
    TANDA_ = lambda t: ("(%s OR %s OR (%s LIKE '%%kesimpulan%%' AND NOT %s) OR (%s AND NOT (%s REGEXP 'belum[[:space:]]+cukup')))"
                        % (RX(t, 'T_MULAI'), RX(t, 'T'), t, BUKTI(t), RX(t, 'CUKUP'), t))
    selesai = ("EXISTS (SELECT 1 FROM perkara_jadwal_sidang i WHERE i.perkara_id = j.perkara_id AND %s"
               " AND EXISTS (SELECT 1 FROM perkara_jadwal_sidang k WHERE k.perkara_id = i.perkara_id AND %s AND NOT %s)"
               " AND ((%s AND %s) OR (NOT %s AND %s LIKE '%%kesimpulan%%') OR %s OR %s))"
               % (SEBELUM('i', 'j'), BUKTI(A('k')), SEBELUM('i', 'k'), BUKTI(A('i')), RX(A('i'), 'T'), BUKTI(A('i')), A('i'),
                  TANDA_(D('i')), TANDA_(K('i'))))
    gugatan = "EXISTS (SELECT 1 FROM perkara pk WHERE pk.perkara_id = j.perkara_id AND pk.nomor_perkara LIKE '%Pdt.G%')"
    if jenis == 'bukti-p':
        return "(%s AND (%s OR (NOT %s AND (NOT %s OR NOT %s))))" % (BUKTI(A('j')), RX(A('j'), 'P'), RX(A('j'), 'T'), gugatan, selesai)
    return ("(%s AND (%s OR (%s AND (%s OR %s OR (NOT %s AND %s)))))"
            % (BUKTI(A('j')), RX(A('j'), 'T'), gugatan, RX(D('j'), 'T_MULAI'), RX(K('j'), 'T_MULAI'), RX(A('j'), 'P'), selesai))


DARI1 = "FROM\r\n  perkara_jadwal_sidang j\r\nWHERE\r\n  j.perkara_id = #perkara_id#\r\n  AND "
DARI2 = "FROM perkara_jadwal_sidang j\r\n  WHERE\r\n    j.perkara_id = #perkara_id#\r\n    AND "


def ubah(teks, jenis):
    """teks variabel sekarang (sesudah 29 paket) -> teks baru. Syarat lama harus ada TEPAT 2x (cabang utama + cabang pelengkap kosong)."""
    lama = syarat_dasar(jenis)
    assert teks.count(DARI1 + lama) == 1, ('cabang utama', teks.count(DARI1 + lama))
    assert teks.count(DARI2 + lama) == 1, ('cabang pelengkap', teks.count(DARI2 + lama))
    bagian = BARU[jenis]()
    join = GABUNG_PREV('j', 'h', 'x')
    baru1 = "FROM\r\n  perkara_jadwal_sidang j\r\n  %s\r\nWHERE\r\n  j.perkara_id = #perkara_id#\r\n  AND " % join + bagian
    baru2 = "FROM perkara_jadwal_sidang j\r\n  %s\r\n  WHERE\r\n    j.perkara_id = #perkara_id#\r\n    AND " % join + bagian
    return teks.replace(DARI1 + lama, baru1).replace(DARI2 + lama, baru2)
