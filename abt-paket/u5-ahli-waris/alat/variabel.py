# -*- coding: utf-8 -*-
"""
Definisi variabel ABT baru 4500-4599 untuk penetapan ahli waris / P3HP (agen U5, 20 Okt 2026).

Hanya variabel DERRY: tidak ada kata "Aleta" di nama, kueri, maupun teks keluaran.
Semua teks ASCII (tidak bergantung charset klien). Variabel isian = data_teks; variabel otomatis = data_sql
(membaca isian lewat aps_badilag.abt_data_teks seperti 9768-9770).

Setiap variabel: dict(no, nama, tipe, sql, default).
"""

PERKARA = "#perkara_id#"


def isi(no, ganti_baris=True, ujung_titik_koma=True):
    """Ungkapan SQL yang membaca isian petugas variabel `no`: bersih, aman untuk disisipkan ke teks.
    Persis pola 9768: CONVERT utf8, garis miring terbalik -> '/', petik ganda dan tunggal -> entitas."""
    e = (
        "REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var = %d "
        "AND perkara_id = '%s' LIMIT 1) USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;')" % (no, PERKARA)
    )
    if ganti_baris:
        e = "REPLACE(REPLACE(%s, CHAR(13), ' '), CHAR(10), ' ')" % e
    e = "TRIM(IFNULL(%s, ''))" % e
    if ujung_titik_koma:
        e = "TRIM(TRAILING ';' FROM %s)" % e
    return e


def turunan(kolom, isi_sql):
    """SELECT ... FROM (SELECT <isian> AS kolom, ...) x - kolom: daftar (nama, no)."""
    return "FROM (SELECT %s) x" % ", ".join("%s AS %s" % (isi(no), nama) for nama, no in kolom)


def v_sql(no, nama, kolom, ungkapan):
    sql = "SELECT %s AS data FROM (SELECT %s) x" % (
        ungkapan,
        ", ".join("%s AS %s" % (isi(n), k) for k, n in kolom),
    )
    return dict(no=no, nama=nama, tipe="data_sql", sql=sql, default=None)


def v_teks(no, nama, default=None):
    return dict(no=no, nama=nama, tipe="data_teks", sql=None, default=default)


def q(s):
    """Literal string SQL aman (petik tunggal digandakan)."""
    return "'" + s.replace("'", "''") + "'"


def cat(*bagian):
    return "CONCAT(" + ", ".join(bagian) + ")"


# nama pasangan pewaris untuk kalimat: isian 8610, lalu 9701, lalu sebutan umum
PASANGAN = "IF(pas8610 <> '', pas8610, IF(pas9701 <> '', pas9701, 'pasangan Pewaris'))"

VARIABEL = []

# ---------------------------------------------------------------- tujuan permohonan
VARIABEL.append(
    v_teks(
        4500,
        "TUJUAN PERMOHONAN AHLI WARIS - ISIAN (frasa sesudah kata untuk, tanpa titik akhir, mis. mengurus balik nama sebidang tanah; kosong = otomatis dari pencairan dana 9700)",
    )
)
VARIABEL.append(
    v_sql(
        4501,
        "TUJUAN PERMOHONAN PENETAPAN AHLI WARIS (OTOMATIS: isian 4500, lalu pencairan dana 9700, lalu mengurus harta peninggalan; dipakai sesudah kata untuk)",
        [("t", 4500), ("d", 9700)],
        "CASE WHEN t <> '' THEN t WHEN d <> '' THEN CONCAT('mengurus pencairan ', d) "
        "ELSE 'mengurus harta peninggalan #2026# #1025#' END",
    )
)

# ---------------------------------------------------------------- anak angkat (Pasal 171 huruf h, 171 huruf c, 209)
VARIABEL.append(
    v_teks(
        4502,
        "ANAK ANGKAT PEWARIS - ISIAN (nama lengkap dengan bin atau binti; kosong = Pewaris tidak mempunyai anak angkat)",
    )
)
VARIABEL.append(
    v_sql(
        4503,
        "ANAK ANGKAT PEWARIS - KALIMAT KETERANGAN SAKSI DAN FAKTA (OTOMATIS dari isian 4502: tidak mempunyai anak angkat / mempunyai anak angkat bernama ...)",
        [("a", 4502)],
        "IF(a = '', 'tidak mempunyai anak angkat', CONCAT('mempunyai anak angkat bernama ', a))",
    )
)
VARIABEL.append(
    v_teks(
        4505,
        "ANAK ANGKAT - PILIHAN HAKIM (ketik 1 bila anak angkat dinyatakan berhak atas wasiat wajibah dalam amar; kosong = hanya dipertimbangkan, tidak diamarkan)",
    )
)
VARIABEL.append(
    v_sql(
        4504,
        "ANAK ANGKAT - PERTIMBANGAN (OTOMATIS: hanya bila isian 4502 terisi; Pasal 171 huruf h dan c, Pasal 209 ayat (2) KHI; amar menurut pilihan 4505)",
        [("a", 4502), ("p", 4505)],
        "IF(a = '', '', CONCAT("
        "'<br>Menimbang, bahwa Pewaris mempunyai anak angkat bernama ', a, '; anak angkat adalah anak yang dalam hal pemeliharaan untuk hidupnya sehari-hari, "
        "biaya pendidikan dan sebagainya beralih tanggung jawabnya dari orang tua asal kepada orang tua angkatnya berdasarkan putusan Pengadilan sebagaimana "
        "Pasal 171 huruf h Kompilasi Hukum Islam, sedangkan ahli waris menurut Pasal 171 huruf c Kompilasi Hukum Islam adalah orang yang mempunyai hubungan darah "
        "atau hubungan perkawinan dengan Pewaris; oleh karena anak angkat tersebut tidak mempunyai hubungan darah atau hubungan perkawinan dengan Pewaris, "
        "maka anak angkat tersebut bukan ahli waris Pewaris dan tidak ditetapkan sebagai ahli waris;"
        "<br>Menimbang, bahwa Pasal 209 ayat (2) Kompilasi Hukum Islam mengatur bahwa terhadap anak angkat yang tidak menerima wasiat diberi wasiat wajibah "
        "sebanyak-banyaknya 1/3 dari harta warisan orang tua angkatnya;', "
        "IF(p = '1', '<br>Menimbang, bahwa berdasarkan ketentuan tersebut #8554# menyatakan anak angkat Pewaris tersebut berhak atas wasiat wajibah "
        "sebanyak-banyaknya 1/3 (satu pertiga) dari harta warisan Pewaris, sedangkan besarnya ditentukan pada saat harta warisan dibagi;', "
        "'<br>Menimbang, bahwa oleh karena permohonan ini terbatas pada penetapan ahli waris, hak anak angkat tersebut atas wasiat wajibah tidak ditetapkan dalam penetapan ini;')))",
    )
)
VARIABEL.append(
    v_sql(
        4506,
        "ANAK ANGKAT - AMAR (OTOMATIS: hanya bila isian 4502 terisi dan pilihan hakim 4505 = 1)",
        [("a", 4502), ("p", 4505)],
        "IF(a <> '' AND p = '1', CONCAT('<br>Menyatakan anak angkat Pewaris bernama ', a, ' berhak atas wasiat wajibah sebanyak-banyaknya 1/3 (satu pertiga) dari harta warisan Pewaris;'), '')",
    )
)

# ---------------------------------------------------------------- wasiat (Pasal 171 huruf f, 175 ayat (1) huruf c, 195)
VARIABEL.append(
    v_teks(
        4507,
        "WASIAT PEWARIS - ISIAN (uraian singkat: penerima dan bendanya; kosong = Pewaris tidak meninggalkan wasiat)",
    )
)
VARIABEL.append(
    v_sql(
        4508,
        "WASIAT PEWARIS - KALIMAT KETERANGAN SAKSI DAN FAKTA (OTOMATIS dari isian 4507: tidak meninggalkan wasiat apa pun / meninggalkan wasiat berupa ...)",
        [("w", 4507)],
        "IF(w = '', 'tidak meninggalkan wasiat apa pun', CONCAT('meninggalkan wasiat berupa ', w))",
    )
)
VARIABEL.append(
    v_sql(
        4509,
        "WASIAT PEWARIS - PERTIMBANGAN (OTOMATIS: hanya bila isian 4507 terisi; Pasal 171 huruf f, 175 ayat (1) huruf c, 195 ayat (2) dan (3) KHI)",
        [("w", 4507)],
        "IF(w = '', '', CONCAT("
        "'<br>Menimbang, bahwa Pewaris meninggalkan wasiat berupa ', w, '; wasiat adalah pemberian suatu benda dari pewaris kepada orang lain atau lembaga yang akan berlaku "
        "setelah pewaris meninggal dunia sebagaimana Pasal 171 huruf f Kompilasi Hukum Islam, dan berdasarkan Pasal 195 ayat (2) Kompilasi Hukum Islam wasiat hanya "
        "diperbolehkan sebanyak-banyaknya sepertiga dari harta warisan kecuali apabila semua ahli waris menyetujui, sedangkan menurut Pasal 195 ayat (3) wasiat kepada "
        "ahli waris hanya berlaku bila disetujui oleh semua ahli waris;"
        "<br>Menimbang, bahwa Pasal 175 ayat (1) huruf c Kompilasi Hukum Islam mewajibkan ahli waris menyelesaikan wasiat Pewaris; oleh karena permohonan ini terbatas pada "
        "penetapan ahli waris, sah tidaknya dan besarnya wasiat tersebut tidak dinilai dalam penetapan ini, dan adanya wasiat tersebut tidak menghalangi para ahli waris "
        "untuk ditetapkan sebagai ahli waris;'))",
    )
)

# ---------------------------------------------------------------- ahli waris / kerabat yang tidak beragama Islam (Pasal 171 huruf c)
VARIABEL.append(
    v_teks(
        4510,
        "KERABAT PEWARIS YANG TIDAK BERAGAMA ISLAM - ISIAN (nama dan hubungannya, mis. Budi bin Ali (anak kandung Pewaris); beberapa orang dipisah titik koma; kosong = semua ahli waris beragama Islam)",
    )
)
VARIABEL.append(
    v_sql(
        4511,
        "AGAMA AHLI WARIS - KALIMAT KETERANGAN SAKSI DAN FAKTA (OTOMATIS dari isian 4510: seluruh ahli waris beragama Islam; bila ada kerabat tidak beragama Islam disebut)",
        [("n", 4510)],
        "IF(n = '', 'seluruh ahli waris tersebut beragama Islam hingga saat ini', "
        "CONCAT('seluruh ahli waris tersebut beragama Islam hingga saat ini, sedangkan ', n, ' tidak beragama Islam'))",
    )
)
VARIABEL.append(
    v_sql(
        4512,
        "AGAMA AHLI WARIS - PERTIMBANGAN (OTOMATIS: hanya bila isian 4510 terisi; Pasal 171 huruf c KHI, kerabat beda agama tidak ditetapkan sebagai ahli waris)",
        [("n", 4510)],
        "IF(n = '', '', CONCAT("
        "'<br>Menimbang, bahwa menurut keterangan saksi-saksi ', n, ' tidak beragama Islam, sedangkan Pasal 171 huruf c Kompilasi Hukum Islam menentukan bahwa ahli waris adalah "
        "orang yang pada saat pewaris meninggal dunia beragama Islam; dengan demikian yang bersangkutan tidak memenuhi syarat sebagai ahli waris Pewaris dan tidak ditetapkan "
        "sebagai ahli waris dalam penetapan ini;'))",
    )
)

# ---------------------------------------------------------------- keadaan perkawinan pewaris saat meninggal
VARIABEL.append(
    v_teks(
        4513,
        "KEADAAN PERKAWINAN PEWARIS - PILIHAN HAKIM (1 = berpisah tetapi belum bercerai, pasangan tetap ahli waris; 2 = sudah bercerai sebelum Pewaris meninggal; kosong = berlangsung sampai meninggal)",
    )
)
VARIABEL.append(
    v_sql(
        4514,
        "KEADAAN PERKAWINAN PEWARIS - PERTIMBANGAN (OTOMATIS: hanya bila pilihan 4513 = 1 atau 2; Pasal 171 huruf c KHI; nama pasangan dari 8610, lalu 9701)",
        [("k", 4513), ("pas8610", 8610), ("pas9701", 9701)],
        "CASE WHEN k = '1' THEN CONCAT("
        "'<br>Menimbang, bahwa semasa hidupnya Pewaris dan ', " + PASANGAN + ", ' telah berpisah tempat tinggal, tetapi perkawinan keduanya belum putus karena perceraian "
        "maupun kematian sampai Pewaris meninggal dunia; dengan demikian pada saat Pewaris meninggal dunia masih ada hubungan perkawinan antara Pewaris dengan ', " + PASANGAN + ", "
        "' sebagaimana dimaksud Pasal 171 huruf c Kompilasi Hukum Islam, sehingga yang bersangkutan tetap termasuk ahli waris Pewaris;') "
        "WHEN k = '2' THEN CONCAT("
        "'<br>Menimbang, bahwa Pewaris pernah menikah dengan ', " + PASANGAN + ", ', tetapi perkawinan keduanya telah putus karena perceraian sebelum Pewaris meninggal dunia; "
        "dengan demikian pada saat Pewaris meninggal dunia tidak ada lagi hubungan perkawinan antara Pewaris dengan ', " + PASANGAN + ", "
        "', sehingga berdasarkan Pasal 171 huruf c Kompilasi Hukum Islam yang bersangkutan tidak termasuk ahli waris Pewaris;') "
        "ELSE '' END",
    )
)

# ---------------------------------------------------------------- bagian ahli waris (P3HP): keputusan hakim
VARIABEL.append(
    v_teks(
        4515,
        "BAGIAN MASING-MASING AHLI WARIS (P3HP) - ISIAN HAKIM (mis. Janda 1/8; anak laki-laki dan anak perempuan menerima sisa dengan perbandingan 2 : 1; kosong = bagian tidak ditetapkan dalam amar)",
    )
)
VARIABEL.append(
    v_sql(
        4516,
        "BAGIAN MASING-MASING AHLI WARIS (P3HP) - AMAR (OTOMATIS: hanya bila isian 4515 terisi)",
        [("b", 4515)],
        "IF(b = '', '', CONCAT('<br>Menetapkan bagian masing-masing ahli waris tersebut atas harta warisan Pewaris sebagai berikut: ', b, ';'))",
    )
)
VARIABEL.append(
    v_sql(
        4517,
        "BAGIAN MASING-MASING AHLI WARIS (P3HP) - PERTIMBANGAN (OTOMATIS: hanya bila isian 4515 terisi)",
        [("b", 4515)],
        "IF(b = '', '', CONCAT('<br>Menimbang, bahwa untuk kepastian hukum dalam pembagian harta warisan Pewaris, berdasarkan pertimbangan tentang bagian ahli waris di atas "
        "#8554# menetapkan bagian masing-masing ahli waris atas harta warisan Pewaris sebagai berikut: ', b, ';'))",
    )
)

# ---------------------------------------------------------------- harta bersama (Pasal 96 ayat (1), 171 huruf e)
VARIABEL.append(
    v_teks(
        4520,
        "HARTA PENINGGALAN YANG DIPEROLEH SELAMA PERKAWINAN (HARTA BERSAMA) - ISIAN (uraian harta; kosong = tidak ada pertimbangan harta bersama)",
    )
)
VARIABEL.append(
    v_sql(
        4521,
        "HARTA BERSAMA - PERTIMBANGAN (OTOMATIS: hanya bila isian 4520 terisi dan pasangan Pewaris yang masih hidup diisi pada 9701; Pasal 96 ayat (1) dan 171 huruf e KHI)",
        [("h", 4520), ("pas9701", 9701)],
        "IF(h = '' OR pas9701 = '', '', CONCAT("
        "'<br>Menimbang, bahwa harta peninggalan berupa ', h, ' diperoleh Pewaris selama perkawinan dengan ', pas9701, ' sehingga merupakan harta bersama; berdasarkan Pasal 96 ayat (1) "
        "Kompilasi Hukum Islam apabila terjadi cerai mati, separoh harta bersama menjadi hak pasangan yang hidup lebih lama, sedangkan menurut Pasal 171 huruf e Kompilasi Hukum Islam "
        "harta warisan adalah harta bawaan ditambah bagian dari harta bersama; dengan demikian yang menjadi harta warisan Pewaris dari harta bersama tersebut hanyalah separohnya;'))",
    )
)

# ---------------------------------------------------------------- pembatasan penggunaan penetapan (pilihan hakim)
VARIABEL.append(
    v_teks(
        4534,
        "PEMBATASAN PENGGUNAAN PENETAPAN - PILIHAN HAKIM (ketik 1 bila penetapan hanya boleh dipakai untuk tujuan permohonan pada isian 4501; kosong = tanpa pembatasan)",
    )
)
VARIABEL.append(
    v_sql(
        4535,
        "PEMBATASAN PENGGUNAAN PENETAPAN - AMAR (OTOMATIS: hanya bila pilihan 4534 = 1; tujuan dari 4501)",
        [("p", 4534)],
        "IF(p = '1', '<br>Menetapkan penetapan ini digunakan hanya sebatas untuk #4501#;', '')",
    )
)

# ---------------------------------------------------------------- kematian pewaris: petitum menyatakan meninggal dunia
# Dijaga petitum SIPP: hanya bila petitum memuat butir "Menyatakan ... meninggal"
_PETITUM_MATI = "(SELECT LOWER(petitum) FROM perkara WHERE perkara_id = '" + PERKARA + "' LIMIT 1)"
_ADA_MATI = "(" + _PETITUM_MATI + " REGEXP 'menyatakan[^;]{0,200}(meninggal|wafat)')"
_ISLAM_DI_PETITUM = "(" + _PETITUM_MATI + " REGEXP 'menyatakan[^;]{0,250}beragama islam')"
VARIABEL.append(
    v_sql(
        4531,
        "KEMATIAN PEWARIS - AMAR (OTOMATIS: hanya bila petitum SIPP memuat butir Menyatakan ... meninggal dunia; tanggal 1246, tempat 1509, sebab 1247)",
        [("tmp", 1509), ("sebab", 1247)],
        "IF(" + _ADA_MATI + " = 1, CONCAT('<br>Menyatakan bahwa #1025# telah meninggal dunia pada tanggal #1246#', IF(tmp <> '', ' di #1509#', ''), "
        "IF(sebab <> '', ' karena #1247#', ''), IF(" + _ISLAM_DI_PETITUM + " = 1, ' dalam keadaan beragama Islam', ''), ';'), '')",
    )
)
VARIABEL.append(
    v_sql(
        4532,
        "KEMATIAN PEWARIS - PERTIMBANGAN (OTOMATIS: hanya bila petitum SIPP memuat butir Menyatakan ... meninggal dunia)",
        [("tmp", 1509)],
        "IF(" + _ADA_MATI + " = 1, CONCAT('<br>Menimbang, bahwa #7036# juga memohon agar dinyatakan #1025# telah meninggal dunia pada tanggal #1246#', "
        "IF(tmp <> '', ' di #1509#', ''), IF(" + _ISLAM_DI_PETITUM + " = 1, ' dalam keadaan beragama Islam', ''), "
        "'; berdasarkan bukti surat dan keterangan para saksi peristiwa tersebut telah terbukti, sehingga permohonan tersebut dapat dikabulkan;'), '')",
    )
)


# ---------------------------------------------------------------- ahli waris pengganti dari SAUDARA pewaris (Pasal 185 KHI)
# 9762/9763 hanya mengenal anak pewaris yang meninggal lebih dahulu dan cucunya. Pada perkara nyata (91/Pdt.P/2026) saudara pewaris
# yang meninggal lebih dahulu digantikan anaknya (keponakan pewaris). Susunan 9768/9770 tidak diubah: 4543 menyambungkan kalimatnya.
def daftar_orang(x):
    """'A; B; C' -> 'A, B dan C' (pola 9768)."""
    n = "(LENGTH(%s) - LENGTH(REPLACE(%s, ';', '')) + 1)" % (x, x)
    return (
        "IF(LOCATE(';', %s) = 0, %s, CONCAT(REPLACE(SUBSTRING_INDEX(%s, ';', %s - 1), ';', ','), ' dan ', TRIM(SUBSTRING_INDEX(%s, ';', -1))))"
        % (x, x, x, n, x)
    )


VARIABEL.append(
    v_teks(
        4540,
        "AHLI WARIS PENGGANTI SAUDARA - SAUDARA PEWARIS YANG MENINGGAL LEBIH DAHULU (satu nama lengkap dengan bin atau binti; berpasangan dengan 4541; kosong = tidak ada)",
    )
)
VARIABEL.append(
    v_teks(
        4541,
        "AHLI WARIS PENGGANTI SAUDARA - ANAK DARI SAUDARA ITU / KEPONAKAN PEWARIS (nama lengkap dengan bin atau binti; beberapa nama dipisah titik koma; berpasangan dengan 4540)",
    )
)
VARIABEL.append(
    v_sql(
        4543,
        "AHLI WARIS PENGGANTI SAUDARA - KALIMAT SUSUNAN (OTOMATIS dari 4540 dan 4541; disambung sesudah susunan ahli waris 9768 dan 9770; kosong bila tidak ada)",
        [("sd", 4540), ("kp", 4541)],
        "IF(sd = '' OR kp = '', '', CONCAT('; ', " + daftar_orang("kp") + ", IF(LOCATE(';', kp) = 0, ' (anak dari ', ' (anak-anak dari '), sd, "
        "', saudara Pewaris yang telah meninggal dunia lebih dahulu dari Pewaris), selaku ahli waris pengganti'))",
    )
)
VARIABEL.append(
    v_sql(
        4542,
        "AHLI WARIS PENGGANTI SAUDARA - PERTIMBANGAN (OTOMATIS dari 4540 dan 4541; Pasal 185 KHI; besarnya bagian ditentukan tersendiri oleh hakim)",
        [("sd", 4540), ("kp", 4541)],
        "IF(sd = '' OR kp = '', '', CONCAT("
        "'<br>Menimbang, bahwa saudara Pewaris yaitu ', sd, ' telah meninggal dunia lebih dahulu daripada Pewaris dan meninggalkan ', "
        "IF(LOCATE(';', kp) = 0, 'anak yaitu ', 'anak-anak yaitu '), " + daftar_orang("kp") + ", '; berdasarkan Pasal 185 ayat (1) Kompilasi Hukum Islam ahli waris yang meninggal "
        "lebih dahulu daripada pewaris kedudukannya dapat digantikan oleh anaknya, kecuali mereka yang tersebut dalam Pasal 173, dan menurut Pasal 185 ayat (2) bagian ahli waris "
        "pengganti tidak boleh melebihi bagian ahli waris yang sederajat dengan yang diganti; dengan demikian ', " + daftar_orang("kp") + ", ' berkedudukan sebagai ahli waris pengganti dari ', sd, "
        "' dan besarnya bagian ahli waris pengganti tersebut bersama bagian ahli waris lainnya ditentukan tersendiri oleh #8554#;'))",
    )
)
