# -*- coding: utf-8 -*-
"""
Perkakas pembangun kueri variabel ABT paket w2a-kebendaan (agen W2a, 21 Okt 2026).

Prinsip (sama dengan paket U2 / U5):
  - Semua teks ASCII (tanpa huruf beraksen; paket dipasang dengan --default-character-set=latin1).
  - Isian petugas dibaca dari aps_badilag.abt_data_teks lewat satu tabel turunan `i` (satu baris), dibersihkan:
    garis miring terbalik -> '/', petik ganda dan tunggal -> entitas, supaya aman disisipkan ke teks.
  - Keputusan hakim = isian PILIH (dikabulkan seluruhnya / sebagian / ditolak / tidak dapat diterima); kueri hanya MENGENALI tuntutan
    dari petitum SIPP. Tuntutan terbaca tanpa keputusan = kalimat [PERIKSA: ...] (terdeteksi sebagai sisa blangko), bukan putusan mesin.
  - Tanpa tuntutan dan tanpa pilihan: keluaran KOSONG (atau persis bunyi bawaan blangko lama) -> blangko lama tampil sama.
  - Keluaran berakhir dengan grup RTF kosong '{}' bila tidak kosong, supaya ujung paragraf RTF tidak rusak (pola U2).
"""
import re

PERKARA = "#perkara_id#"


def lit(teks):
    """Literal string SQL berpetik ganda; garis miring terbalik dan petik ganda di-escape."""
    return '"' + teks.replace("\\", "\\\\").replace('"', '\\"') + '"'


def bersih_html(ungkapan):
    """Ungkapan SQL yang membuang tag sederhana dan ganti baris -> spasi, huruf kecil."""
    e = ungkapan
    for a in ("<strong>", "</strong>", "<em>", "</em>", "&nbsp;"):
        e = "REPLACE(%s, %s, %s)" % (e, lit(a), lit("" if a != "&nbsp;" else " "))
    e = "REPLACE(REPLACE(%s, CHAR(10), ' '), CHAR(13), ' ')" % e
    return "LOWER(%s)" % e


def isi_mentah(no):
    """Ungkapan skalar isian petugas no (bersih, aman). Dipakai langsung di kueri ringan."""
    return (
        "TRIM(IFNULL(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var = %d "
        "AND perkara_id = '%s' LIMIT 1) USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;'), ''))" % (no, PERKARA)
    )


def pivot_isian(nomor):
    """Tabel turunan satu baris i(iNNNN ...) untuk daftar nomor isian."""
    kolom = ", ".join(
        "IFNULL(MAX(CASE WHEN d.no_var = %d THEN d.data END), '') AS i%d" % (n, n) for n in nomor
    )
    dalam = (
        "SELECT no_var, IFNULL(REPLACE(REPLACE(REPLACE(CONVERT(data USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;'), '') AS data "
        "FROM aps_badilag.abt_data_teks WHERE perkara_id = '%s' AND no_var IN (%s)" % (PERKARA, ", ".join(str(n) for n in nomor))
    )
    return "SELECT %s FROM (%s) d" % (kolom, dalam)


def konteks(nomor_isian, ekstra=""):
    """Tabel turunan w: jn (jenis), pet (petitum + rekonvensi, kecil/bersih), pos (posita, kecil/bersih), ntt (jumlah Turut Tergugat),
    sela (ada putusan sela sita), isian TRIM(iN) sebagai iN. `ekstra` = kolom tambahan (tanpa koma di depan)."""
    pet = bersih_html(
        "CONCAT(IFNULL(p.petitum, ''), ' ', IFNULL((SELECT GROUP_CONCAT(r.isi_petitum SEPARATOR ' ') FROM perkara_rekonvensi r WHERE r.perkara_id = p.perkara_id), ''))"
    )
    pos = bersih_html("IFNULL(p.posita, '')")
    cols = ", ".join("i.i%d AS i%d" % (n, n) for n in nomor_isian)
    x = (
        "SELECT p.jenis_perkara_id AS jn, %s AS pet, %s AS pos, "
        "(SELECT COUNT(*) FROM perkara_pihak4 t WHERE t.perkara_id = p.perkara_id) AS ntt, "
        "(SELECT COUNT(*) FROM perkara_putusan_sela s WHERE s.perkara_id = p.perkara_id AND (IFNULL(s.amar_sela, '') LIKE '%%sita%%' OR IFNULL(s.amar_sela, '') LIKE '%%beslag%%')) AS sela, "
        "%s%s FROM perkara p JOIN (%s) i ON 1 = 1 WHERE p.perkara_id = '%s'"
        % (pet, pos, cols, (", " + ekstra) if ekstra else "", pivot_isian(nomor_isian), PERKARA)
    )
    return "(%s) w" % x


def kode_pilihan(ungkapan):
    """A seluruh, S sebagian, T tolak, N tidak dapat diterima, X lain-lain (pilihan khusus), K kosong (belum dipilih)."""
    u = "LOWER(TRIM(%s))" % ungkapan
    return (
        "CASE WHEN %s = '' THEN 'K' WHEN %s REGEXP 'tidak dapat diterima|niet ontvankelijk' THEN 'N' WHEN %s REGEXP 'tolak' THEN 'T' "
        "WHEN %s REGEXP 'sebagian' THEN 'S' WHEN %s REGEXP 'kabul|seluruh' THEN 'A' ELSE 'K' END" % (u, u, u, u, u)
    )


def alasan(ungkapan):
    """Teks sesudah titik dua pertama (alasan), kosong bila tidak ada."""
    return "IF(LOCATE(':', %s) > 0, TRIM(SUBSTRING(%s, LOCATE(':', %s) + 1)), '')" % (ungkapan, ungkapan, ungkapan)


def sebelum_titik_dua(ungkapan):
    return "IF(LOCATE(':', %s) > 0, TRIM(SUBSTRING_INDEX(%s, ':', 1)), TRIM(%s))" % (ungkapan, ungkapan, ungkapan)


def periksa(pesan):
    """Kalimat penanda sisa blangko (terdeteksi sebagai sisa isian; menahan unggah)."""
    return "[PERIKSA: %s]" % pesan


def bungkus(ungkapan_d, ctx_sql, tambahan_kolom=""):
    """Bentuk akhir variabel: SELECT IF(kosong,'',CONCAT(d,'{}')) AS data FROM (SELECT <d> AS d FROM <ctx> c) t.
    `ungkapan_d` memakai alias c.<kolom>; `ctx_sql` = SELECT yang menghasilkan kolom c (boleh berupa tabel turunan berbentuk '(...) w')."""
    return "SELECT IF(IFNULL(t.d, '') = '', '', CONCAT(t.d, '{}')) AS data FROM (SELECT %s AS d FROM %s) t" % (ungkapan_d, ctx_sql)


def gabung(*bagian):
    """CONCAT_WS('<br>') yang melewati NULL/kosong: bagian kosong tidak meninggalkan baris kosong."""
    return "CONCAT_WS('<br>', %s)" % ", ".join("NULLIF(%s, '')" % b for b in bagian)


def daftar_baris_ke_kalimat(ungkapan):
    """Mengubah isian berbaris (pemisah ganti baris atau <br> atau titik koma) menjadi satu kalimat daftar '1. a; 2. b' apa adanya (tanpa mengubah isi)."""
    return "REPLACE(REPLACE(%s, CHAR(10), '<br>'), CHAR(13), '')" % ungkapan


def periksa_ascii(teks, nama):
    try:
        teks.encode("ascii")
    except UnicodeEncodeError as e:
        raise AssertionError("%s: bukan ASCII: %r" % (nama, teks[max(0, e.start - 30): e.end + 30]))
    return teks


if __name__ == "__main__":
    print(konteks([4781, 4782])[:300])
