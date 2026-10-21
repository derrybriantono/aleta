# -*- coding: utf-8 -*-
"""Definisi isi paket x10-audit-ringan-21okt (temuan RINGAN R1-R11 audit variabel ABT 21 Okt 2026 + R11/6150 + dua BAS P Kuasa).
Semua teks ASCII. Keadaan dasar = server 21 Okt malam (sesudah x1-x7; abt_variabel 2.480 baris). Paket ini tidak membuat variabel baru:
hanya mengubah kolom sql_query/default_data baris yang sudah ada (tiap baris dijaga sidik jari seluruh barisnya)."""

MODIFIER = 'admin'
MODIFIED = '2026-10-21 00:00:00'

BARU = []   # tidak ada variabel baru (rentang 3550-3599 tidak dipakai)

UBAH = {}


def ubah(no, fungsi, butir):
    assert no not in UBAH, no
    UBAH[no] = dict(fungsi=fungsi, butir=butir)


def ganti(kolom, lama, baru, harap=1):
    """Ganti potongan bytes di kolom teks; jumlah kemunculan `lama` harus persis `harap`."""
    lama = lama.encode('ascii') if isinstance(lama, str) else lama
    baru = baru.encode('ascii') if isinstance(baru, str) else baru

    def f(r):
        b = r[kolom]
        assert b is not None and b.count(lama) == harap, (kolom, lama, None if b is None else b.count(lama), harap)
        return {kolom: b.replace(lama, baru)}
    return f


def beberapa(*fungsi):
    def f(r):
        out = {}
        for g in fungsi:
            out.update(g(dict(r, **out)))
        return out
    return f


def ganti_semua(kolom, nilai_lama, nilai_baru):
    """Ganti seluruh isi kolom; isi lama harus persis nilai_lama (bytes)."""
    def f(r):
        assert r[kolom] == nilai_lama, (kolom, r[kolom][:60] if r[kolom] else None)
        return {kolom: nilai_baru}
    return f


# ---------------------------------------------------------------- R3 #0143 Total Biaya Perkara: #0243# tidak ada (sita kini dalam #0242#)
# "0#0243#" dihitung 0, jadi angka total TIDAK berubah; rujukan mati dibuang agar nomor 0243 kelak tidak menyusup ke total.
ubah(143, ganti('sql_query', b'    0#0243# +\r\n', b''), 'R3')

# ---------------------------------------------------------------- R4 jurusita/PP: hasil pasti walau ada dua baris aktif urutan 1
# Nama jurusita (0018/6031) dan alasan (0213): baris dengan id terkecil (= baris pertama alami; x2 mengukur 10.186/10.186 perkara sama).
_ID = b'where a.aktif="Y" and a.urutan=1 and a.perkara_id=#perkara_id#'
for _no in (18, 6031):
    ubah(_no, ganti('sql_query', _ID, _ID + b'\r\norder by a.id\r\nlimit 1'), 'R4')
ubah(213, ganti('sql_query', b'where aktif="Y" and urutan=1 and perkara_id=#perkara_id#',
                b'where aktif="Y" and urutan=1 and perkara_id=#perkara_id#\r\norder by id\r\nlimit 1'), 'R4')
# Alasan penggantian PP (0212): dari baris PP yang sama dengan #0015# (aktif urutan 1, penunjukan paling baru)
ubah(212, ganti('sql_query', b'where aktif="Y" and urutan=1 and perkara_id=#perkara_id#',
                b'where aktif="Y" and urutan=1 and perkara_id=#perkara_id#\r\norder by tanggal_penetapan desc, id\r\nlimit 1'), 'R4')

# ---------------------------------------------------------------- R5 #1076/#1077 Tgl Relaas: v_pihak_perkara (UNION pihak1/pihak2, lambat) -> tabel langsung (hasil sama)
ubah(1076, beberapa(ganti('sql_query', b'join v_pihak_perkara b', b'join perkara_pihak1 b'),
                    ganti('sql_query', b'b.urutan=1 and b.pihak_ke=1 and', b'b.urutan=1 and')), 'R5')
ubah(1077, beberapa(ganti('sql_query', b'join v_pihak_perkara b', b'join perkara_pihak2 b'),
                    ganti('sql_query', b'b.urutan=1 and b.pihak_ke=2 and', b'b.urutan=1 and')), 'R5')

# ---------------------------------------------------------------- R6 gaya kueri: "limit 3,2" -> "limit 3,1"; #0357 tanpa ORDER BY
for _no in (6144, 6145, 6146, 6147, 6148, 6151):
    ubah(_no, ganti('sql_query', b'limit 3,2', b'limit 3,1'), 'R6')
ubah(357, ganti('sql_query', b'where a.saksi_pihak_ke=2 and a.perkara_id=#perkara_id#\r\nlimit 0,1',
                b'where a.saksi_pihak_ke=2 and a.perkara_id=#perkara_id#\r\norder by a.urutan\r\nlimit 0,1'), 'R6')

# ---------------------------------------------------------------- R7 ejaan baku
ubah(7178, beberapa(ganti('default_data', b'diluar batas antar', b'di luar batas antar'),
                    ganti('default_data', b'berada ditempat', b'berada di tempat')), 'R7')
ubah(228, ganti('default_data', b'berada diluar kota', b'berada di luar kota'), 'R7')
for _no in (317, 328):
    ubah(_no, beberapa(ganti('sql_query', b'Undang-undang Nomor', b'Undang-Undang Nomor'),
                       ganti('sql_query', b'tahun 1974', b'Tahun 1974', harap=2)), 'R7')

# ---------------------------------------------------------------- R8 nama pejabat dan wilayah satker tertanam di bawaan popup -> netral
ubah(1149, ganti_semua('default_data', b'Dwi Anugerah, S.H.I., M.H.', b'........'), 'R8')
ubah(3333, ganti_semua('default_data', b'Banawa, Kabupaten Donggala\r\nBiromaru, Kabupaten Sigi', b'Kecamatan ..., Kabupaten ...'), 'R8')

# ---------------------------------------------------------------- R2 nama sama isi beda: samakan logika
# #8146/#8147 (huruf besar) = #0046#/#0047# : Izin Poligami (jenis 341) adalah permohonan (PEMOHON/TERMOHON)
ubah(8146, ganti('sql_query', b'jenis_perkara_id=346 then "PEMOHON"', b'jenis_perkara_id=346 or jenis_perkara_id=341 then "PEMOHON"'), 'R2')
ubah(8147, ganti('sql_query', b'jenis_perkara_id=346 then "TERMOHON"', b'jenis_perkara_id=346 or jenis_perkara_id=341 then "TERMOHON"'), 'R2')
# #7713 = #7113# : duplik rekonvensi dikecualikan
ubah(7713, ganti('sql_query', b"'%duplik%'\r\n  AND perkara_id", b"'%duplik%'\r\n  AND rencana_agenda NOT LIKE '%Duplik Rekonvensi%'\r\n  AND perkara_id"), 'R2')

# ---------------------------------------------------------------- R11 logika kueri keliru (0 blangko)
# #6150 Hbgn. Saksi 4 P: saksi_pihak_ke=4 tidak pernah ada -> sama dengan #8923# (saksi keempat Penggugat/Pemohon, order by urutan limit 3,1)
ubah(6150, ganti('sql_query', b'saksi_pihak_ke=4 and urutan=1 and perkara_id=#perkara_id#',
                 b'saksi_pihak_ke=1 and perkara_id=#perkara_id# order by urutan limit 3,1'), 'R11')
# #7123/#7124 Hari Perbaikan: agenda "perbaikan" (bukan replik/kesimpulan); operator OR/AND diberi kurung
_AG = b"(rencana_agenda LIKE '%perbaikan%' AND rencana_agenda NOT LIKE '%rekonvensi%')"
_AG2 = b"(rencana_agenda LIKE '%perbaikan%' AND rencana_agenda NOT LIKE '%rekonvensi%')"


def _s7123(r):
    s = r['sql_query']
    a = s.index(b'WHERE \r\n  perkara_id = #perkara_id#\r\n  AND rencana_agenda LIKE')
    b = s.index(b'UNION ALL')
    c = s.index(b'WHERE NOT EXISTS')
    baru = (s[:a] + b"WHERE \r\n  perkara_id = #perkara_id#\r\n  AND " + _AG + b"\r\n\r\n" + s[b:c] +
            b"WHERE NOT EXISTS (\r\n  SELECT 1\r\n  FROM perkara_court_calendar\r\n  WHERE \r\n    perkara_id = #perkara_id#\r\n    AND " + _AG2 + b"\r\n);\r\n")
    return {'sql_query': baru}


def _s7124(r):
    s = r['sql_query']
    a = s.index(b'WHERE \r\n  perkara_id = #perkara_id#\r\n  AND rencana_agenda LIKE')
    b = s.index(b'UNION ALL')
    c = s.index(b'WHERE NOT EXISTS')
    baru = (s[:a] + b"WHERE \r\n  perkara_id = #perkara_id#\r\n  AND " + _AG + b"\r\n\r\n" + s[b:c] +
            b"WHERE NOT EXISTS (\r\n  SELECT 1\r\n  FROM perkara_court_calendar\r\n  WHERE \r\n    perkara_id = #perkara_id#\r\n    AND " + _AG2 + b"\r\n);\r\n")
    return {'sql_query': baru}


ubah(7123, _s7123, 'R11')
ubah(7124, _s7124, 'R11')
