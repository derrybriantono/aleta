# -*- coding: utf-8 -*-
"""Isi variabel paket ABT prodeo-panggilan-29okt (teks SQL ASCII, MariaDB 5.5: tanpa CTE/window/REGEXP_REPLACE).

Variabel BARU (11120-11199) dan UBAHAN atas variabel Derry 8505, 3992, 8508, 8547, 8600 (dibaca dari basis server, diganti per potongan).
Penanda perkara prodeo = perkara.prodeo = 1 (sama dengan 8505, 8507, 8527, 7095, 11112, 5802)."""
import re

PRODEO = "IFNULL((SELECT prodeo FROM perkara WHERE perkara_id = '#perkara_id#'), 0) = 1"
TERB = "aps_badilag.isian_rtf_terbilang('%s')"
# tampilan ABT untuk #0143# di RTF: number_format bila nilai memuat '0.00', selain itu apa adanya (Abt_model::data_variabel_detil)
VERZET_ADA = "'#3992#' REGEXP '^[0-9]+$'"  # biaya verzet sudah berangka (isian atau SIPP)
F0143 = "IF(LOCATE('0.00', '#0143#') > 0, REPLACE(FORMAT('#0143#', 0), ',', '.'), '#0143#')"


def daftar_tanggal(tabel):
    """Semua tanggal relaas (berbeda, urut) pihak di <tabel> sampai putusan, bukan sidang ikrar: 'A' / 'A dan B' / 'A, B, dan C'."""
    return (
        "SELECT IF(x.n = 0, '...', IF(x.n = 1, x.s, CONCAT(SUBSTRING_INDEX(x.s, ', ', x.n - 1), IF(x.n = 2, ' dan ', ', dan '), "
        "SUBSTRING_INDEX(x.s, ', ', -1)))) AS data\n"
        "FROM (SELECT COUNT(*) AS n, GROUP_CONCAT(aps_badilag.isian_rtf_tanggal(d.t) ORDER BY d.t SEPARATOR ', ') AS s\n"
        "  FROM (SELECT DISTINCT DATE(r.tanggal_relaas) AS t\n"
        "    FROM perkara_pelaksanaan_relaas r\n"
        "    JOIN %s p ON p.perkara_id = r.perkara_id AND p.pihak_id = r.pihak_id\n"
        "    JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id\n"
        "    WHERE r.perkara_id = '#perkara_id#' AND r.tanggal_relaas > '1000-01-01' AND IFNULL(j.ikrar_talak, 'T') <> 'Y'\n"
        "      AND r.tanggal_relaas <= IFNULL((SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu WHERE pu.perkara_id = '#perkara_id#' AND pu.tanggal_putusan > '1000-01-01'), '9999-12-31')\n"
        "  ) d\n"
        ") x" % tabel)


def cermin(v, titik):
    """Pos rincian biaya: perkara prodeo = 0, selain itu persis #v# (titik=True: kosong -> tanpa baris = '...' seperti aslinya)."""
    q = "SELECT IF(%s, '0', '#%s#') AS data" % (PRODEO, v)
    if titik:
        q = "SELECT t.d AS data FROM (%s) t WHERE t.d <> ''" % q.replace(" AS data", " AS d")
    return q


def amar_bebas(awal, angka, terb="#0143#"):
    """Amar biaya tertulis langsung di blangko: prodeo = teks prodeo #8505#; selain itu kalimat yang sama + terbilang dalam kurung."""
    return ('SELECT IF(%s, "#8505#", CONCAT("%s", %s, ",00 (", %s, " rupiah)")) AS data'
            % (PRODEO, awal, angka, TERB % terb))


BARU = [
    (11120, "TANGGAL SEMUA RELAAS PANGGILAN #0046# s.d. putusan (OTOMATIS SIPP perkara_pelaksanaan_relaas: tanggal berbeda urut, A / A dan B / A, B, dan C; bukan sidang ikrar; ... bila belum ada)",
     daftar_tanggal("perkara_pihak1")),
    (11121, "TANGGAL SEMUA RELAAS PANGGILAN #0047# s.d. putusan (OTOMATIS SIPP perkara_pelaksanaan_relaas: tanggal berbeda urut, A / A dan B / A, B, dan C; bukan sidang ikrar; ... bila belum ada)",
     daftar_tanggal("perkara_pihak2")),
    (11122, "AMAR BIAYA PERKARA LENGKAP (OTOMATIS: prodeo = #8505# tanpa nominal dan terbilang; selain itu #8505# (terbilang rupiah))",
     'SELECT IF(%s, "#8505#", CONCAT("#8505#", " (", %s, " rupiah)")) AS data' % (PRODEO, TERB % "#0143#")),
    (11123, "RINCIAN BIAYA: TERBILANG JUMLAH DALAM KURUNG (OTOMATIS: prodeo = nihil; selain itu terbilang #0143# rupiah)",
     "SELECT IF(%s, 'nihil', CONCAT(%s, ' rupiah')) AS data" % (PRODEO, TERB % "#0143#")),
    (11124, "RINCIAN BIAYA IKRAR: TERBILANG JUMLAH DALAM KURUNG (OTOMATIS: prodeo atau biaya nol = nihil; selain itu terbilang #1101# rupiah)",
     "SELECT IF(%s OR '#1101#' + 0 = 0, 'nihil', CONCAT(%s, ' rupiah')) AS data" % (PRODEO, TERB % "#1101#")),
]
CERMIN = [  # (nomor baru, variabel asal, kosong -> '...'?)
    (11130, "0279", True), (11131, "6060", True), (11132, "6074", False), (11133, "6063", False), (11134, "8891", False),
    (11135, "0312", False), (11136, "0281", False), (11137, "5223", False), (11138, "0242", False), (11139, "0244", False),
    (11140, "0143", False), (11141, "1090", True), (11142, "1164", True), (11143, "1101", False),
]
for n, v, t in CERMIN:
    BARU.append((n, "RINCIAN BIAYA: #%s# (OTOMATIS: perkara prodeo = 0; selain itu persis #%s#)" % (v, v), cermin(v, t)))
# verzet: jumlah rincian dari #3992# sebagai "N.00" (ABT mencetaknya bertitik dengan benar), prodeo 0; belum ada angka = titik-titik
BARU.append((11144, "RINCIAN BIAYA VERZET: JUMLAH (OTOMATIS: prodeo = 0; selain itu #3992#; belum ada angka = titik-titik)",
             "SELECT IF(%s, '0', IF(%s, CONCAT('#3992#', '.00'), '........')) AS data" % (PRODEO, VERZET_ADA)))
BARU.append((11145, "RINCIAN BIAYA VERZET: TERBILANG JUMLAH DALAM KURUNG (OTOMATIS: prodeo atau biaya nol = nihil; selain itu terbilang #3992# rupiah)",
             "SELECT IF(%s OR '#3992#' = '0', 'nihil', CONCAT(IF(%s, %s, '...'), ' rupiah')) AS data" % (PRODEO, VERZET_ADA, TERB % "#3992#")))


# isian kesepakatan perdamaian (data_teks) dibaca langsung dari kolomnya, tidak disisipkan sebagai teks ke dalam kueri
ISIAN_9354 = ("IFNULL((SELECT CONVERT(data USING utf8) FROM aps_badilag.abt_data_teks WHERE no_var = 9354 AND perkara_id = '#perkara_id#' LIMIT 1), "
              "'DATA_TIDAK_ADA')")


def varian(nomor, kalimat):
    """Variabel amar biaya untuk satu bentuk kalimat yang tertulis langsung di blangko (lihat tambal_rtf.POLA_VARIAN)."""
    m = re.search(r"#(0143|8504|1101|3993)#,00 \(#(0155|2050|3994)# ", kalimat)
    awal = kalimat[:m.start()]
    assert '"' not in awal and "'" not in awal and "\\" not in awal, kalimat
    # #0143#/#1101# dicetak seperti ABT (number_format bila memuat '0.00'); #8504#/#3993# sudah bertitik -> apa adanya
    # (dulu ABT memformat ulang "290.000" menjadi "290" karena tampak seperti angka desimal)
    angka = "'#%s#'" % m.group(1) if m.group(1) in ("8504", "3993") else F0143.replace("0143", m.group(1))
    terb = {"0155": "#0143#", "2050": "#1101#", "3994": "#3992#"}[m.group(2)]
    q = amar_bebas(awal, angka, terb)
    if m.group(2) == "3994":  # verzet tanpa angka: terbilang "..." seperti #3994# dulu
        q = q.replace(TERB % terb, "IF(%s, %s, '...')" % (VERZET_ADA, TERB % terb))
    # 30 Okt (pengguna, asas tiada biaya tiada perkara): biaya NOL tetap dibebankan, "sejumlah Rp0,00 ( rupiah)" tidak disebut
    # (ikrar #1101# dan verzet #3992# bisa nol; #0143#/#8504# selalu memuat redaksi dan meterai)
    nol = {"1101": "'#1101#' + 0 = 0", "3993": "'#3992#' = '0'"}.get(m.group(1))
    if nol:
        tanpa = re.sub(r"\s*sejumlah Rp\.?\s*$", "", awal)
        assert tanpa != awal, kalimat
        q = q.replace(', "#8505#", CONCAT(', ', "#8505#", IF(%s, CONCAT("%s"), CONCAT(' % (nol, tanpa), 1)
        assert q.endswith(" rupiah)\")) AS data"), q
        q = q[: -len(" AS data")] + ") AS data"
    if m.group(1) == "1101":
        # 30 Okt (pengguna, butir 4): penetapan ikrar memakai bunyi yang SAMA dengan amar ikrar yang ditulis ke SIPP dan
        # dikutip BAS ikrar (#2063#): "Membebankan biaya perkara kepada Pemohon sejumlah Rp<angka>,00 (<terbilang> rupiah)";
        # biaya 0 tanpa "sejumlah"; prodeo = #8505# (DIPA). Kalimat lama blangko ("... untuk membayar biaya penetapan ini") diganti.
        awal = "Membebankan biaya perkara kepada #0046# sejumlah Rp"
        q = ('SELECT IF(%s, "#8505#", IF(%s, CONCAT("Membebankan biaya perkara kepada #0046#"), CONCAT("%s", %s, ",00 (", %s, " rupiah)"))) AS data'
             % (PRODEO, nol, awal, angka, TERB % terb))
    if m.group(1) == "3993":
        # verzet: teks prodeo ditulis langsung (= cabang prodeo #8505#) supaya kueri tidak menghitung #8505# -> #0143# -> #5223#;
        # perkara verzet punya DUA baris meterai dan #5223# (subkueri satu baris) GALAT -> seluruh cetakan ABT berhenti
        q = q.replace('"#8505#"', '"Membebankan biaya perkara kepada DIPA #8008# Tahun #0191#"', 1)
    if "#9354#" in awal:
        q = q.replace("#9354#", '", ' + ISIAN_9354 + ', "')
    # sebutan di kalimat (#0046#, #7036#, #7037#, ...): tanpa nilai dulu tercetak "..." (DATA_TIDAK_ADA), bukan hilang
    for t in sorted(set(re.findall(r"#(\d{4})#", awal)) - {"9354"}):
        q = q.replace("#%s#" % t, "\", IF('#%s#' = '', 'DATA_TIDAK_ADA', '#%s#'), \"" % (t, t))
    pendek = re.sub(r"\s+", " ", re.sub(r"Membebankan|Menghukum|untuk membayar biaya perkara|sejumlah Rp\.?", "", awal)).strip(" .")
    kata = "MENGHUKUM" if awal.startswith("Menghukum") else "PENETAPAN IKRAR" if m.group(1) == "1101" else "MEMBEBANKAN"
    nama = ("AMAR BIAYA TERTULIS %s [%s] (OTOMATIS: prodeo = #8505#; selain itu kalimat blangko + #%s# dan terbilang)" % (kata, pendek[:80], m.group(1)))
    return (nomor, nama, q)


# UBAHAN variabel Derry: (nomor, [(potongan lama, potongan baru, jumlah kemunculan)])
UBAH = {
    # 30 Okt (pengguna): amar prodeo "Membebankan biaya perkara kepada DIPA <satker> Tahun <tahun pendaftaran>"
    8505: [('THEN "Membebankan biaya perkara kepada negara, melalui DIPA #8008# Tahun #0191#"',
            'THEN "Membebankan biaya perkara kepada DIPA #8008# Tahun #0191#"', 1)],
    # 30 Okt (pengguna): biaya verzet otomatis - isian #3991# tetap didahulukan; kosong = pengeluaran SIPP sejak pendaftaran perlawanan
    # (perkara_verzet.tanggal_pendaftaran_verzet; semua jenis biaya keluar kecuali pengembalian sisa panjar)
    3992: [(") AS data", ") AS d) i", 1),
           ("SELECT IF(", "SELECT IF(i.d <> '', i.d, IFNULL((SELECT CAST(SUM(b.jumlah) AS UNSIGNED) FROM perkara_biaya b "
            "JOIN jenis_biaya jb ON jb.id = b.jenis_biaya_id JOIN perkara_verzet v ON v.perkara_id = b.perkara_id "
            "WHERE b.perkara_id = '#perkara_id#' AND jb.jenis_transaksi = -1 AND b.jenis_biaya_id <> 151 "
            "AND v.tanggal_pendaftaran_verzet > '1000-01-01' AND b.tanggal_transaksi >= v.tanggal_pendaftaran_verzet), '')) AS data FROM (SELECT IF(", 1)],
    8508: [("tanggal #1077# dan tanggal #0120#", "tanggal #11121#", 1)],
    8547: [("pada tanggal #1076# dan tanggal #0118#", "pada tanggal #11120#", 2),
           ("pada tanggal #1077# dan tanggal #0120#", "pada tanggal #11121#", 1)],
}
# 8600 diganti utuh (dulu paling banyak 4 tanggal, "A, B dan C"): kini semua tanggal lewat #11120#.
GANTI_UTUH = {
    8600: "SELECT IF('#11120#' = '...', '', CONCAT(', pada tanggal ', '#11120#')) AS data",
}
