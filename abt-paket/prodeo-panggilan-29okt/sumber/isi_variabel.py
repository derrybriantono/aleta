# -*- coding: utf-8 -*-
"""Isi variabel paket ABT prodeo-panggilan-29okt (teks SQL ASCII, MariaDB 5.5: tanpa CTE/window/REGEXP_REPLACE).

Variabel BARU (11120-11143) dan UBAHAN atas variabel Derry 8508, 8547, 8600 (dibaca dari basis server, diganti per potongan).
Penanda perkara prodeo = perkara.prodeo = 1 (sama dengan 8505, 8507, 8527, 7095, 11112, 5802)."""
import re

PRODEO = "IFNULL((SELECT prodeo FROM perkara WHERE perkara_id = '#perkara_id#'), 0) = 1"
TERB = "aps_badilag.isian_rtf_terbilang('%s')"
# tampilan ABT untuk #0143# di RTF: number_format bila nilai memuat '0.00', selain itu apa adanya (Abt_model::data_variabel_detil)
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
    (11124, "RINCIAN BIAYA IKRAR: TERBILANG JUMLAH DALAM KURUNG (OTOMATIS: prodeo = nihil; selain itu terbilang #1101# rupiah)",
     "SELECT IF(%s, 'nihil', CONCAT(%s, ' rupiah')) AS data" % (PRODEO, TERB % "#1101#")),
]
CERMIN = [  # (nomor baru, variabel asal, kosong -> '...'?)
    (11130, "0279", True), (11131, "6060", True), (11132, "6074", False), (11133, "6063", False), (11134, "8891", False),
    (11135, "0312", False), (11136, "0281", False), (11137, "5223", False), (11138, "0242", False), (11139, "0244", False),
    (11140, "0143", False), (11141, "1090", True), (11142, "1164", True), (11143, "1101", False),
]
for n, v, t in CERMIN:
    BARU.append((n, "RINCIAN BIAYA: #%s# (OTOMATIS: perkara prodeo = 0; selain itu persis #%s#)" % (v, v), cermin(v, t)))


def varian(nomor, kalimat):
    """Variabel amar biaya untuk satu bentuk kalimat yang tertulis langsung di blangko (lihat tambal_rtf.POLA_VARIAN)."""
    m = re.search(r"#(0143|8504|1101)#,00 \(#(0155|2050)# ", kalimat)
    awal = kalimat[:m.start()]
    assert '"' not in awal and "'" not in awal and "\\" not in awal, kalimat
    # #0143#/#1101# dicetak seperti ABT (number_format bila memuat '0.00'); #8504# sudah bertitik -> apa adanya
    angka = "'#8504#'" if m.group(1) == "8504" else F0143.replace("0143", m.group(1))
    terb = "#0143#" if m.group(2) == "0155" else "#1101#"
    pendek = re.sub(r"\s+", " ", awal.replace("Membebankan", "").replace("untuk membayar biaya perkara", "").replace("sejumlah Rp", "")).strip(" .")
    nama = ("AMAR BIAYA TERTULIS [%s] (OTOMATIS: prodeo = #8505#; selain itu kalimat blangko + #%s# dan terbilang)" % (pendek[:90], m.group(1)))
    return (nomor, nama, amar_bebas(awal, angka, terb))


# UBAHAN variabel Derry: (nomor, [(potongan lama, potongan baru, jumlah kemunculan)])
UBAH = {
    8508: [("tanggal #1077# dan tanggal #0120#", "tanggal #11121#", 1)],
    8547: [("pada tanggal #1076# dan tanggal #0118#", "pada tanggal #11120#", 2),
           ("pada tanggal #1077# dan tanggal #0120#", "pada tanggal #11121#", 1)],
}
# 8600 diganti utuh (dulu paling banyak 4 tanggal, "A, B dan C"): kini semua tanggal lewat #11120#.
GANTI_UTUH = {
    8600: "SELECT IF('#11120#' = '...', '', CONCAT(', pada tanggal ', '#11120#')) AS data",
}
