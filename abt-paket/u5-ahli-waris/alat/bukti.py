# -*- coding: utf-8 -*-
"""Variabel 4530: analisis bukti surat dari daftar alat bukti PAW (variabel 8132), dikelompokkan menurut jenis surat.

Satu derived table membelah daftar per baris (maks 40 baris), memberi kelas dan kode bukti; pivot dengan GROUP_CONCAT
(<= 40 kode, jauh di bawah group_concat_max_len 1024); satu kalimat Menimbang per kelas yang ada.
Daftar kosong = bunyi bawaan lama (KTP, KK, bukti surat lainnya) agar blangko lama tidak berubah.
"""
from variabel import PERKARA, v_sql

MAKS = 90

RAW = (
    "REPLACE(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var = 8132 AND perkara_id = '" + PERKARA + "' LIMIT 1) USING utf8), "
    "CHAR(13), ''), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;')"
)

# kelas -> kata kunci pada 90 huruf pertama baris (huruf kecil). Urutan menentukan prioritas.
KELAS = [
    (4, ["akta cerai", "putusan perceraian", "akta perceraian"]),
    (3, ["akta nikah", "buku nikah", "surat nikah", "keterangan nikah", "keterangan menikah", "pernah menikah"]),
    (5, ["akta kematian", "keterangan kematian", "keterangan meninggal", "surat kematian", "akta meninggal", "surat meninggal"]),
    (6, ["akta kelahiran", "keterangan lahir", "kenal lahir", "surat kelahiran", "akta lahir", "akta pengangkatan"]),
    (2, ["kartu keluarga", "kartu kartu keluarga", "susunan keluarga"]),
    (1, ["kartu tanda penduduk", "ktp"]),
    (7, ["silsila", "silisil", "ahli waris", "kewarisan", "surat pernyataan", "raja muda"]),
    (8, ["taspen", "bpjs", "tabungan", "sertipikat", "sertifikat", "polis", "pensiun", "kenaikan pangkat", "pegawai negeri", "surat keputusan", "paspor", "kartu peserta", "deposito", "asuransi", "kartu tenaga", "rekening", "tabum", "riwayat tanah", "kepemilikan", "tanah milik", "pergi haji", "porsi haji"]),
]

KALIMAT = {
    1: "bukti {L} (Fotokopi Kartu Tanda Penduduk) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, merupakan akta autentik yang memenuhi syarat formal dan materiil serta mempunyai kekuatan pembuktian yang sempurna dan mengikat (volledig bidende bewijskracht); berdasarkan bukti tersebut telah terbukti identitas dan tempat tinggal #7036# di wilayah #8011# sehingga #8008# secara relatif berwenang untuk memeriksa dan mengadili perkara a quo",
    2: "bukti {L} (Fotokopi Kartu Keluarga) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, yang menerangkan susunan keluarga #1025# dan hubungan #7036# dengan #1025#, bukti tersebut merupakan alat bukti otentik sehingga bukti tersebut telah memenuhi syarat formal dan materiil, serta mempunyai kekuatan pembuktian yang sempurna dan mengikat (volledig bidende bewijskracht)",
    3: "bukti {L} (Kutipan Akta Nikah) merupakan akta autentik yang telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, yang menerangkan adanya perkawinan yang sah antara Pewaris dengan pasangannya, relevan dengan dalil yang hendak dibuktikan oleh #7036#, serta mempunyai kekuatan pembuktian yang sempurna dan mengikat (volledig bidende bewijskracht)",
    4: "bukti {L} (Akta Cerai) merupakan akta autentik yang telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, yang menerangkan putusnya perkawinan karena perceraian, relevan dengan dalil yang hendak dibuktikan oleh #7036#, serta mempunyai kekuatan pembuktian yang sempurna dan mengikat (volledig bidende bewijskracht)",
    5: "bukti {L} (Akta Kematian atau Surat Keterangan Kematian) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, yang menerangkan telah meninggal dunianya orang yang disebut di dalamnya, termasuk Pewaris, relevan dengan dalil yang hendak dibuktikan oleh #7036#, sehingga bukti tersebut telah memenuhi syarat formal dan materiil serta mempunyai kekuatan pembuktian yang sempurna dan mengikat (volledig bidende bewijskracht)",
    6: "bukti {L} (Akta Kelahiran atau Surat Keterangan Lahir) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, yang menerangkan hubungan anak dengan orang tuanya, relevan dengan dalil yang hendak dibuktikan oleh #7036#, sehingga bukti tersebut telah memenuhi syarat formal dan materiil serta mempunyai kekuatan pembuktian yang sempurna dan mengikat (volledig bidende bewijskracht)",
    7: "bukti {L} (surat keterangan atau pernyataan silsilah dan ahli waris) telah bermeterai cukup dan cocok dengan aslinya, isi bukti tersebut menjelaskan silsilah keluarga #2026# #1025# sebagai Pewaris dan para ahli warisnya serta relevan dengan dalil-dalil yang hendak dibuktikan oleh #7036#, namun #8554# berpendapat bukti tersebut merupakan bukti permulaan yang dikuatkan oleh bukti surat lain dan keterangan saksi-saksi",
    8: "bukti {L} (surat-surat yang berkaitan dengan harta peninggalan dan hak Pewaris) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, relevan dengan dalil #7036# tentang harta peninggalan Pewaris dan tujuan permohonan ini",
    9: "bukti {L} telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, serta relevan dengan dalil yang hendak dibuktikan oleh #7036#",
}

# bunyi bawaan lama ([01c]) bila daftar 8132 kosong
BAWAAN = (
    "Menimbang, bahwa bukti P.1 (Fotokopi Kartu Tanda Penduduk #7036#) telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, berdasarkan bukti tersebut telah terbukti #7036# bertempat tinggal di wilayah #8011# sehingga #8008# secara relatif berwenang untuk memeriksa dan mengadili perkara a quo;"
    "<br>Menimbang, bahwa bukti P.2 (Fotokopi Kartu Keluarga atas nama #1025#) telah bermeterai cukup, di-nazegelen, yang menerangkan susunan keluarga #1025# dan hubungan #7036# dengan #1025#, bukti tersebut merupakan alat bukti otentik sehingga bukti tersebut telah memenuhi syarat formal dan materiil, serta mempunyai kekuatan pembuktian yang sempurna dan mengikat (volledig bidende bewijskracht);"
    "<br>Menimbang, bahwa bukti-bukti surat lainnya yang diajukan #7036# berupa kutipan akta nikah, kutipan akta kematian, kutipan akta kelahiran, surat keterangan silsilah dan surat-surat lain sebagaimana diuraikan dalam duduk perkara telah bermeterai cukup, di-nazegelen dan cocok dengan aslinya, merupakan akta autentik yang telah memenuhi syarat formal dan materiil serta mempunyai kekuatan pembuktian yang sempurna dan mengikat (volledig bidende bewijskracht) dan relevan dengan dalil yang hendak dibuktikan oleh #7036#; surat pernyataan silsilah merupakan bukti permulaan yang dikuatkan oleh bukti surat lain dan keterangan saksi-saksi;"
)


def _q(s):
    return "'" + s.replace("'", "''") + "'"


def _kelas():
    when = []
    for no, kunci in KELAS:
        kond = " OR ".join("LOWER(LEFT(b.t, 90)) LIKE '%%%s%%'" % k for k in kunci)
        when.append("WHEN %s THEN %d" % (kond, no))
    return "CASE " + " ".join(when) + " ELSE 9 END"


def bangun():
    nums = "SELECT 1 AS n" + "".join(" UNION ALL SELECT %d" % i for i in range(2, MAKS + 1))
    # belah baris: nums x r dengan syarat n <= jumlah baris
    belah = (
        "SELECT nums.n AS n, TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(r.raw, CHAR(10), nums.n), CHAR(10), -1)) AS t "
        "FROM (SELECT %s AS raw) r JOIN (%s) nums ON nums.n <= LENGTH(r.raw) - LENGTH(REPLACE(r.raw, CHAR(10), '')) + 1" % (RAW, nums)
    )
    label = (
        "IF(LOCATE('(P.', b.t) > 0 AND LOCATE(')', SUBSTRING_INDEX(b.t, '(P.', -1)) > 0, "
        "CONCAT('P.', TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(b.t, '(P.', -1), ')', 1))), CONCAT('P.', b.n))"
    )
    pivot_kolom = ", ".join(
        "GROUP_CONCAT(IF(c.kl = %d, c.lb, NULL) ORDER BY c.n SEPARATOR ', ') AS k%d" % (k, k) for k in range(1, 10)
    )
    dalam = "SELECT b.n AS n, %s AS kl, %s AS lb FROM (%s) b WHERE b.t <> ''" % (_kelas(), label, belah)
    pivot = "SELECT COUNT(*) AS jml, %s FROM (%s) c" % (pivot_kolom, dalam)

    def rapi(k):
        return (
            "IF(LOCATE(', ', p.{k}) = 0, p.{k}, CONCAT(SUBSTRING(p.{k}, 1, CHAR_LENGTH(p.{k}) - CHAR_LENGTH(SUBSTRING_INDEX(p.{k}, ', ', -1)) - 2), ' dan ', SUBSTRING_INDEX(p.{k}, ', ', -1)))"
        ).format(k=k)

    butir = []
    for k in range(1, 10):
        awal, akhir = KALIMAT[k].split("{L}")
        butir.append(
            "IF(p.k%d IS NULL, NULL, CONCAT('Menimbang, bahwa %s', %s, '%s;'))"
            % (k, awal.replace("'", "''"), rapi("k%d" % k), akhir.replace("'", "''"))
        )
    ungkapan = "IF(p.jml = 0, %s, CONCAT_WS('<br>', %s))" % (_q(BAWAAN), ", ".join(butir))
    sql = "SELECT %s AS data FROM (%s) p" % (ungkapan, pivot)
    return dict(
        no=4530,
        nama="ANALISIS BUKTI SURAT PEMOHON (OTOMATIS dari daftar alat bukti PAW 8132: dikelompokkan menurut jenis surat; daftar kosong = bunyi bawaan KTP dan Kartu Keluarga)",
        tipe="data_sql",
        sql=sql,
        default=None,
    )
