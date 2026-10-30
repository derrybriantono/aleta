# -*- coding: utf-8 -*-
"""Variabel BARU paket relaas-penetapan-30okt (blok 11200-11219, semula kosong). TIDAK ada variabel lama yang diubah:
variabel lama yang keliru (7100 7108 7109 7006 7008 9564 9565; 7100/7108/7109 juga dipakai salinan blangko di luar derry_briantono,
7006/7008 terkunci) dibiarkan, blangko Derry dialihkan ke nomor baru. Isi variabel pengganti DITURUNKAN dari kueri lama dengan
penggantian yang diperiksa (tiap penggantian harus ditemukan tepat sekali), jadi kalimat lain tetap sama persis.
Kueri MariaDB 5.5: tanpa REGEXP_REPLACE / fungsi jendela / CTE.
pakai: buat(asal) -> {no: (nama, sql)}; asal = {no_var lama: sql_query lama} dari basis ABT keadaan server."""

ASAL_DIPAKAI = (7100, 7108, 7109, 7006, 7008, 9564, 9565)

BULAN = ("ELT(MONTH({d}),'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober',"
         "'November','Desember')")


def ganti(s, lama, baru, kali=1):
    n = s.count(lama)
    assert n == kali, 'penggantian %r ditemukan %d kali (harus %d)' % (lama[:70], n, kali)
    return s.replace(lama, baru)


def tgl(d):
    return "CONCAT(DATE_FORMAT({d},'%d'),' ',{b},' ',YEAR({d}))".format(d=d, b=BULAN.format(d=d))


def penerima(sisi):
    """relaas untuk pihak sisi itu ATAU kuasanya (relaas kepada kuasa dicatat SIPP dengan pihak_id = perkara_pengacara.pengacara_id)."""
    return ("(r.pihak_id IN (SELECT a.pihak_id FROM perkara_pihak{s} a WHERE a.perkara_id = '#perkara_id#') "
            "OR r.pihak_id IN (SELECT k.pengacara_id FROM perkara_pengacara k WHERE k.perkara_id = '#perkara_id#' AND k.pihak_ke = {s}))"
            ).format(s=sisi)


def relaas_tanggal(sisi):
    return ("SELECT IFNULL((SELECT {t} FROM perkara_pelaksanaan_relaas r "
            "JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id AND j.perkara_id = r.perkara_id "
            "WHERE r.perkara_id = '#perkara_id#' AND j.urutan = '#0050#' AND r.tanggal_relaas > '1900-01-01' AND {p} "
            "ORDER BY r.tanggal_relaas DESC, r.id DESC LIMIT 1), '..............................') AS data"
            ).format(t=tgl('r.tanggal_relaas'), p=penerima(sisi))


def judul(x, n=4):
    """Huruf awal tiap kata besar (sampai n kata; kata bertanda hubung: tiap bagian). x = ungkapan SQL."""
    def tc(w):
        return ("IF(LOCATE('-', {w}) > 0, CONCAT(UPPER(LEFT(SUBSTRING_INDEX({w}, '-', 1), 1)), LOWER(SUBSTRING(SUBSTRING_INDEX({w}, '-', 1), 2)), "
                "'-', UPPER(LEFT(SUBSTRING_INDEX({w}, '-', -1), 1)), LOWER(SUBSTRING(SUBSTRING_INDEX({w}, '-', -1), 2))), "
                "CONCAT(UPPER(LEFT({w}, 1)), LOWER(SUBSTRING({w}, 2))))").format(w=w)
    jumlah = "(CHAR_LENGTH({x}) - CHAR_LENGTH(REPLACE({x}, ' ', '')) + 1)".format(x=x)
    bagian = []
    for i in range(1, n + 1):
        w = "SUBSTRING_INDEX(SUBSTRING_INDEX({x}, ' ', {i}), ' ', -1)".format(x=x, i=i)
        bagian.append("IF({j} >= {i}, {tc}, NULL)".format(j=jumlah, i=i, tc=tc(w)))
    return "CONCAT_WS(' ', " + ", ".join(bagian) + ")"


KOTA_DELEGASI = "TRIM(SUBSTRING(TRIM(d.pn_tujuan_text), 18))"
DELEGASI = ("SELECT IFNULL((SELECT {isi} FROM delegasi_keluar d WHERE d.perkara_id = '#perkara_id#' "
            "AND TRIM(d.pn_tujuan_text) LIKE 'PENGADILAN AGAMA %' AND CHAR_LENGTH(TRIM(d.pn_tujuan_text)) > 17 "
            "ORDER BY d.tgl_delegasi DESC, d.id DESC LIMIT 1), '{kosong}') AS data")

KUASA = "EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id = '#perkara_id#' AND k.pihak_ke = {s} AND k.aktif = 'Y')"
BANYAK = "(SELECT COUNT(*) FROM perkara_pihak{s} WHERE perkara_id = '#perkara_id#') > 1"


def cara_pbt(sisi, pihak, domisili):
    """Pemberitahuan putusan perkara e-Court: domisili elektronik (pihak/kuasanya) bila terdaftar, selain itu surat tercatat."""
    return ('SELECT IF(LOCATE(\'@\', "{d}") > 1, CONCAT("Pemberitahuan isi putusan ini saya kirimkan secara elektronik melalui domisili '
            'elektronik ", IF({k}, "Kuasa Hukum {p}", "{p}"), " yang telah terdaftar, yaitu {d};"), "Pemberitahuan isi putusan ini saya '
            'laksanakan melalui Surat Tercatat untuk selanjutnya disampaikan ke tempat tinggal/kediaman {p};") AS data'
            ).format(d=domisili, k=KUASA.format(s=sisi), p=pihak)


SURAT_TERCATAT = "<li>Pemberitahuan isi putusan ini saya laksanakan melalui Surat Tercatat untuk selanjutnya disampaikan ke tempat tinggal/kediaman {p};"
PASAL153 = "sebagaimana telah ditetapkan dalam Pasal 153 ayat (1) RBg;"


def buat(asal):
    v = {}
    v[11200] = ("RELAAS E-COURT: TANGGAL RELAAS #0046# DI BAWAH (OTOMATIS SIPP perkara_pelaksanaan_relaas untuk #0046# atau kuasanya pada "
                "sidang dicetak; belum tercatat = titik-titik; pengganti #0180#)", relaas_tanggal(1))
    v[11201] = ("RELAAS E-COURT: TANGGAL RELAAS #0047# DI BAWAH (OTOMATIS SIPP perkara_pelaksanaan_relaas untuk #0047# atau kuasanya pada "
                "sidang dicetak; belum tercatat = titik-titik; pengganti #0180#)", relaas_tanggal(2))
    v[11202] = ("DELEGASI: PENGADILAN AGAMA YANG DIMOHONI BANTUAN (OTOMATIS SIPP delegasi_keluar terakhir perkara ini; belum dicatat = "
                "titik-titik; pengganti #1066#)",
                DELEGASI.format(isi="CONCAT('Pengadilan Agama ', " + judul(KOTA_DELEGASI) + ")", kosong='Pengadilan Agama ........................'))
    v[11203] = ("DELEGASI: TEMPAT PENGADILAN AGAMA YANG DIMOHONI BANTUAN, BARIS di (OTOMATIS SIPP delegasi_keluar terakhir; belum dicatat = "
                "titik-titik; pengganti #1167#)", DELEGASI.format(isi=judul(KOTA_DELEGASI), kosong='........................'))
    # 11204 = 7100 + tanggal PHS di depannya: "#1064##7100#" tercetak "...2026yang didaftarkan" (nilai variabel ABT di-trim, jadi
    # spasi tidak bisa diawalkan pada 7100); kini satu variabel "22 September 2026 yang didaftarkan ...;" / "22 September 2026;".
    s = ganti(asal[7100], '"yang didaftarkan secara elektronik melalui Aplikasi <I>E-Court;</i>"',
              'CONCAT(IF("#1064#" = "", "...", "#1064#"), " yang didaftarkan secara elektronik melalui Aplikasi <I>E-Court;</i>")')
    s = ganti(s, 'else\r\n";"', 'else\r\nCONCAT(IF("#1064#" = "", "...", "#1064#"), ";")')
    v[11204] = ("TANGGAL PHS + PENDETEKSI E-COURT DI KEPALA RELAAS (OTOMATIS: #1064# lalu yang didaftarkan secara elektronik ... / titik koma; "
                "pengganti #1064##7100# di blangko Derry)", s)
    # 11214 = sama dengan 11204 untuk panggilan IKRAR: perintah = penetapan hari sidang ikrar (#1099#), bukan PHS pokok (#1064#)
    v[11214] = ("TANGGAL PHS IKRAR + PENDETEKSI E-COURT DI KEPALA RELAAS IKRAR (OTOMATIS: #1099# lalu yang didaftarkan secara elektronik ... / "
                "titik koma; pengganti #1064##7100# di relaas ikrar Derry)", v[11204][1].replace("#1064#", "#1099#"))
    # 11205 = 7108: koma sesudah nama (gugatan), "I" hanya bila #0046# lebih dari satu (gugatan & permohonan)
    s = ganti(asal[7108], '"<strong>#0098#</strong> NIK #0335#', '"<strong>#0098#</strong>, NIK #0335#')
    s = ganti(s, '", sebagai <strong>#0046# I</strong>;")', '", sebagai <strong>#0046#", IF(' + BANYAK.format(s=1) + ', " I", ""), "</strong>;")')
    s = ganti(s, '", sebagai <strong>#0046#</strong>;")', '", sebagai <strong>#0046#", IF(' + BANYAK.format(s=1) + ', " I", ""), "</strong>;")')
    v[11205] = ("IDENTITAS PIHAK RELAAS #0046# (OTOMATIS: koma sesudah nama; I hanya bila #0046# lebih dari satu; pengganti #7108# di blangko Derry)", s)
    # 11206 = 7109: agama #0047# dari SIPP (#0020#), bukan "Islam" tertulis mati; "I" bila #0047# lebih dari satu (gugatan)
    # agama kosong di SIPP (111 perkara) = titik-titik untuk diisi jurusita, bukan tebakan "Islam"
    s = ganti(asal[7109], 'umur #0103# tahun, agama Islam,', 'umur #0103# tahun, agama ", IF("#0020#" = "", "...", "#0020#"), ",')
    s = ganti(s, '", sebagai <strong>#0047#</strong>;")', '", sebagai <strong>#0047#", IF(' + BANYAK.format(s=2) + ', " I", ""), "</strong>;")')
    v[11206] = ("IDENTITAS PIHAK RELAAS #0047# (OTOMATIS: agama dari SIPP #0020#; I bila #0047# lebih dari satu; pengganti #7109# di blangko Derry)", s)
    # 11207 = 7008 (pemberitahuan putusan kepada #0046#): upaya hukum #0046# = banding (verzet hanya hak #0047# yang diputus verstek),
    # dasar Pasal 199 ayat (1) RBg; perkara e-Court: cara #11213#; cabang "#0047# ghaib -> melalui Bupati" dibuang (salah salin dari #0047#).
    s = asal[7008]
    s = ganti(s, '#0046# dapat mengajukan #7007#', '#0046# dapat mengajukan banding', 3)
    s = ganti(s, PASAL153, 'sebagaimana ditentukan dalam Pasal 199 ayat (1) RBg;', 3)
    s = ganti(s, SURAT_TERCATAT.format(p='#0046#'), '<li>#11213#')
    a = s.index("WHEN (SELECT ghaib FROM perkara_pihak2")
    b = s.index('WHEN LOCATE("Gugur"')
    s = s[:a] + s[b:]
    v[11207] = ("RELAAS PEMBERITAHUAN PUTUSAN #0046#: UPAYA HUKUM DAN CARA PENYAMPAIAN (OTOMATIS: banding Pasal 199 ayat (1) RBg; e-Court = "
                "#11213#; pengganti #7008# di blangko Derry)", s)
    # 11208 = 7006 (pemberitahuan putusan kepada #0047#): dasar upaya hukum menurut #7007# (#11211#); perkara e-Court: cara #11212#
    s = asal[7006]
    s = ganti(s, PASAL153, 'sebagaimana ditentukan dalam #11211#;', 3)
    s = ganti(s, SURAT_TERCATAT.format(p='#0047#'), '<li>#11212#')
    v[11208] = ("RELAAS PEMBERITAHUAN PUTUSAN #0047#: UPAYA HUKUM DAN CARA PENYAMPAIAN (OTOMATIS: dasar #11211#, e-Court = #11212#; "
                "pengganti #7006# di blangko Derry)", s)
    # 11209/11210 = 9564/9565 + relaas yang disampaikan kepada KUASA pihak itu
    for baru, lama, sisi in ((11209, 9564, 1), (11210, 9565, 2)):
        s = ganti(asal[lama], "r.pihak_id IN (SELECT a.pihak_id FROM perkara_pihak%d a WHERE a.perkara_id = '#perkara_id#')" % sisi, penerima(sisi))
        v[baru] = ("RELAAS: HARI DAN TANGGAL PELAKSANAAN PANGGILAN #%s# (OTOMATIS SIPP perkara_pelaksanaan_relaas untuk #%s# ATAU KUASANYA "
                   "pada sidang dicetak; belum tercatat = titik-titik; ganti #%04d#)"
                   % ('0046' if sisi == 1 else '0047', '0046' if sisi == 1 else '0047', lama), s)
    v[11211] = ("RELAAS PEMBERITAHUAN PUTUSAN #0047#: DASAR UPAYA HUKUM (OTOMATIS menurut #7007#: verzet = Pasal 153 ayat (1) RBg, "
                "banding = Pasal 199 ayat (1) RBg)",
                'SELECT IF(LOCATE(\'verzet\', "#7007#") > 0, "Pasal 153 ayat (1) RBg", "Pasal 199 ayat (1) RBg") AS data')
    v[11212] = ("RELAAS PEMBERITAHUAN PUTUSAN #0047# E-COURT: CARA PENYAMPAIAN (OTOMATIS: domisili elektronik #8809# bila ada, "
                "selain itu surat tercatat)", cara_pbt(2, '#0047#', '#8809#'))
    v[11213] = ("RELAAS PEMBERITAHUAN PUTUSAN #0046# E-COURT: CARA PENYAMPAIAN (OTOMATIS: domisili elektronik #8808# bila ada, "
                "selain itu surat tercatat)", cara_pbt(1, '#0046#', '#8808#'))
    for no, (nama, q) in v.items():
        assert len(nama) <= 200, (no, len(nama))
        assert 'aleta' not in (nama + q).lower(), no
        assert 'REGEXP_REPLACE' not in q.upper(), no
        assert 'donggala' not in (nama + q).lower() and 'bungku' not in (nama + q).lower(), no
    return v
