# -*- coding: utf-8 -*-
"""
Variabel ABT 4833-4847: WASIAT (365), HIBAH (366), WAKAF (367) dan EKONOMI SYARIAH (370) - gugatan kabul.
Blangko jenis ini sudah punya mesin "pokok tuntutan" (9475 dst. wasiat, 9791 dst. hibah, 9820 dst. wakaf, 9340 dst. ekonomi syariah) untuk amar pokok;
paket ini menambah bagian yang belum ada: analisis bukti surat, tuntutan lain menurut petitum (Turut Tergugat, sita, uang paksa, serta merta,
dan khusus ekonomi syariah denda/ganti rugi, jaminan, pembatalan akad), amar bernomor dan nomor butir biaya.
Keputusan hakim tetap isian PILIH (4815 sebagian/seluruhnya, 4783-4785 sita/uang paksa/serta merta, 4842-4844 khusus ekonomi syariah).
"""
from sqlkit import lit, konteks, kode_pilihan, alasan, periksa, gabung, isi_mentah
from variabel_hb import KEPUTUSAN_SITA, KEPUTUSAN_AT, L, p_sita, p_uang_paksa, p_serta_merta, p_turut, opsional
from buktikit import analisis_bukti

ISIAN_L = [4815, 4783, 4784, 4785, 4842, 4843, 4844]

# kata benda objek menurut jenis perkara
OBJEK = "CASE c.jn WHEN 365 THEN 'objek wasiat' WHEN 366 THEN 'objek hibah' WHEN 367 THEN 'harta benda wakaf' ELSE 'objek sengketa' END"


def keputusan_es(kol):
    """A dikabulkan, T ditolak, K belum dipilih."""
    return "CASE WHEN LOWER(TRIM(%s)) = '' THEN 'K' WHEN LOWER(TRIM(%s)) REGEXP 'tolak' THEN 'T' WHEN LOWER(TRIM(%s)) REGEXP 'kabul' THEN 'A' ELSE 'K' END" % (kol, kol, kol)


def ctx():
    w = konteks(ISIAN_L)
    a = (
        "SELECT w.*, "
        "IF(w.pet REGEXP 'sita|beslag' OR w.sela > 0, 1, 0) AS tsita, "
        "IF(w.pet REGEXP 'uang paksa|dwangsom', 1, 0) AS tuang, "
        "IF(w.pet REGEXP 'serta merta|serta-merta|uitvoerbaar|bij voorraad', 1, 0) AS tserta, "
        "IF(w.pet REGEXP 'turut tergugat' OR w.ntt > 0, 1, 0) AS ttt, "
        "IF(w.jn = 370 AND w.pet REGEXP 'denda|ganti rugi|ta.?widh|ta.?zir|kerugian|margin', 1, 0) AS tden, "
        "IF(w.jn = 370 AND w.pet REGEXP 'jaminan|agunan|hak tanggungan|fidusia|gadai|lelang|rahn', 1, 0) AS tjam, "
        "IF(w.jn = 370 AND w.pet REGEXP 'batal|fasakh', 1, 0) AS tbat, "
        "%s AS dsita, %s AS duang, %s AS dserta, %s AS dden, %s AS djam, %s AS dbat, %s AS dmain, "
        "IF(w.jn = 370, 2, 1) AS pk "
        "FROM %s"
        % (KEPUTUSAN_SITA, KEPUTUSAN_AT("w.i4784"), KEPUTUSAN_AT("w.i4785"), keputusan_es("w.i4842"), keputusan_es("w.i4843"), keputusan_es("w.i4844"), kode_pilihan("w.i4815"), w)
    )
    # sebagian: ekonomi syariah bawaan sebagian (bunyi lama "untuk sebagian"); wasiat/hibah/wakaf bawaan seluruhnya
    b = "SELECT a.*, IF(a.dmain = 'S' OR (a.dmain = 'K' AND a.jn = 370), 1, 0) AS sebagian FROM (%s) a" % a
    return "(%s) c" % b


# ------------------------------------------------------------------ keputusan ekonomi syariah (denda, jaminan, pembatalan)
def p_keputusan(kol, d, t, label, marker_pesan):
    """Pertimbangan satu tuntutan khusus: belum dipilih -> kalimat periksa; ditolak -> alasan setelah titik dua; dikabulkan -> rumusan amar setelah titik dua."""
    return (
        "CASE WHEN c.%s = 0 THEN '' WHEN c.%s = 'K' THEN %s "
        "WHEN c.%s = 'T' THEN CONCAT(%s, IF(LOCATE(':', c.%s) > 0, %s, %s), %s) "
        "ELSE CONCAT(%s, IF(LOCATE(':', c.%s) > 0, %s, %s), %s) END"
        % (
            t, d, L(periksa(marker_pesan)),
            d, L("Menimbang, bahwa terhadap tuntutan mengenai %s, #8554# berpendapat " % label), kol, alasan("c." + kol), L(periksa("tulis alasan penolakan setelah titik dua pada isian keputusan")),
            L(", sehingga tuntutan tersebut tidak beralasan hukum dan patut ditolak;"),
            L("Menimbang, bahwa terhadap tuntutan mengenai %s, berdasarkan alat bukti dan fakta persidangan tuntutan tersebut beralasan hukum dan patut dikabulkan sebagaimana akan dicantumkan dalam amar putusan, yaitu " % label),
            kol, alasan("c." + kol), L(periksa("tulis rumusan amar setelah titik dua pada isian keputusan")),
            L(";"),
        )
    )


def p_denda():
    return p_keputusan("i4842", "dden", "tden", "pembayaran denda, ganti rugi atau ta'widh", "petitum menuntut denda atau ganti rugi; pilih keputusan majelis pada isian keputusan denda dan ganti rugi")


def p_jaminan():
    return p_keputusan("i4843", "djam", "tjam", "jaminan atau agunan", "petitum menuntut penyelesaian jaminan atau agunan; pilih keputusan majelis pada isian keputusan jaminan")


def p_batal():
    return p_keputusan("i4844", "dbat", "tbat", "pembatalan akad", "petitum menuntut pembatalan akad; pilih keputusan majelis pada isian keputusan pembatalan akad")


def p_lain():
    return gabung(
        p_denda(), p_jaminan(), p_batal(),
        p_turut("objek sengketa"),
        p_sita("K", kata="objek sengketa"),
        p_uang_paksa("objek sengketa"),
        p_serta_merta(),
    )


# ------------------------------------------------------------------ amar
def extras(mode):
    """Butir amar tambahan sesudah butir pokok. mode V/K menentukan nomor awal. Mengembalikan (isi, nomor_biaya)."""
    awal = "(%s + c.pk)" % ("3" if mode == "V" else "2")
    items = [
        ("den", "IF(c.tden = 1 AND c.dden = 'A', 1, 0)"),
        ("jam", "IF(c.tjam = 1 AND c.djam = 'A', 1, 0)"),
        ("bat", "IF(c.tbat = 1 AND c.dbat = 'A', 1, 0)"),
        ("turut", "IF(c.ttt = 1, 1, 0)"),
        ("sita", "IF(c.tsita = 1 AND c.dsita = 'A', 1, 0)"),
        ("uang", "IF(c.tuang = 1 AND c.duang = 'A', 1, 0)"),
        ("serta", "IF(c.tserta = 1 AND c.dserta = 'A', 1, 0)"),
        ("tolak", "IF(c.sebagian = 1, 1, 0)"),
    ]
    kode = [k for k, _ in items]
    flag = dict(items)

    def n(k):
        i = kode.index(k)
        antar = " + ".join(flag[j] for j in kode[:i]) or "0"
        return "CAST(%s + %s AS CHAR)" % (awal, antar)

    teks = {
        "den": "SUBSTRING(c.i4842, LOCATE(':', c.i4842) + 1)",
        "jam": "SUBSTRING(c.i4843, LOCATE(':', c.i4843) + 1)",
        "bat": "SUBSTRING(c.i4844, LOCATE(':', c.i4844) + 1)",
        "turut": "CONCAT(%s, IF(c.ntt > 1, 'Para Turut', 'Turut'), %s)" % (L("Menghukum "), L(" #0047# untuk tunduk dan patuh pada putusan ini;")),
        "sita": "CONCAT(%s, IF(c.pet REGEXP 'marital', %s, %s), IF(c.sela > 0, CONCAT(%s, IF(TRIM('#0218#') = '', 'DATA_TIDAK_ADA', '#0218#')), ''), %s)"
        % (L("Menyatakan sah dan berharga "), L("sita marital (maritale beslag)"), L("sita jaminan (conservatoir beslag)"), L(" berdasarkan Putusan Sela tanggal "), L(" yang telah diletakkan atas objek sengketa;")),
        "uang": "CONCAT(%s, IF(LOCATE(':', c.i4784) > 0, %s, %s), %s)"
        % (L("Menghukum #7037# untuk membayar uang paksa (dwangsom) sejumlah "), alasan("c.i4784"), L(periksa("jumlah uang paksa")), L(" setiap hari lalai menjalankan isi putusan ini;")),
        "serta": L("Menyatakan putusan ini dapat dijalankan lebih dahulu (uitvoerbaar bij voorraad) meskipun ada upaya hukum;"),
        "tolak": L("Menolak #0053# #0046# selain dan selebihnya;"),
    }
    # rumusan amar dari isian ekonomi syariah: diberi titik koma di ujung bila belum ada
    for k in ("den", "jam", "bat"):
        teks[k] = "CONCAT(TRIM(%s), IF(RIGHT(TRIM(%s), 1) = ';', '', ';'))" % (teks[k], teks[k])
    bagian = ["IF(%s = 1, CONCAT(%s, %s, %s), NULL)" % (flag[k], n(k), L(".   "), teks[k]) for k in kode]
    isi = "CONCAT_WS('<br>', %s)" % ", ".join(bagian)
    total = " + ".join(flag[k] for k in kode)
    return isi, "CAST(%s + %s AS CHAR)" % (awal, total)


def pembuka(mode):
    sebagian = "IF(c.sebagian = 1, %s, '')" % L(" untuk sebagian")
    if mode == "V":
        return "CONCAT(%s, %s, %s, %s)" % (L("2.   Mengabulkan #0053# #0046#"), sebagian, L(" dengan verstek;"), "''")
    return "CONCAT(%s, %s, %s)" % (L("1.   Mengabulkan #0053# #0046#"), sebagian, L(";"))


# ------------------------------------------------------------------ analisis bukti (isian bukti menurut jenis perkara)
ALUR17 = "(SELECT alur_perkara_id FROM perkara WHERE perkara_id = '#perkara_id#') = 17"  # gugatan sederhana memakai daftar bukti umum 9955 / 9911
RAW_P = (
    "CASE (SELECT jenis_perkara_id FROM perkara WHERE perkara_id = '#perkara_id#') WHEN 365 THEN %s WHEN 366 THEN %s WHEN 367 THEN %s WHEN 370 THEN IF(%s, %s, %s) ELSE '' END"
    % (isi_mentah(9488), isi_mentah(9804), isi_mentah(9834), ALUR17, isi_mentah(9955), isi_mentah(9492))
)
RAW_T = (
    "CASE (SELECT jenis_perkara_id FROM perkara WHERE perkara_id = '#perkara_id#') WHEN 365 THEN %s WHEN 366 THEN %s WHEN 367 THEN %s WHEN 370 THEN IF(%s, %s, %s) ELSE '' END"
    % (isi_mentah(9489), isi_mentah(9805), isi_mentah(9835), ALUR17, isi_mentah(9911), isi_mentah(9493))
)

KELAS_BUKTI = [
    (1, ["kartu tanda penduduk", "ktp"]),
    (2, ["kartu keluarga"]),
    (3, ["akta kematian", "keterangan kematian", "surat kematian"]),
    (4, ["akta nikah", "buku nikah"]),
    (5, ["akta ikrar wakaf", "ikrar wakaf", "aiw", "sertifikat wakaf", "sertipikat wakaf", "nazhir", "nadzir", "wakaf"]),
    (6, ["akta hibah", "surat hibah", "hibah"]),
    (7, ["wasiat"]),
    (8, ["akad", "perjanjian pembiayaan", "perjanjian kredit", "murabahah", "mudharabah", "musyarakah", "ijarah", "qardh", "rahn", "gadai", "pembiayaan", "perjanjian"]),
    (11, ["foto ", "foto-", "foto,", "tangkapan layar", "screenshot", "video", "rekaman"]),
    (9, ["sertifikat", "sertipikat", "hak milik", "akta jual beli", "ajb", "girik", "sppt", "pbb", "bpkb", "stnk", "tanah", "rumah", "kendaraan"]),
    (10, ["rekening", "tabungan", "mutasi", "kwitansi", "kuitansi", "bukti transfer", "bukti pembayaran", "somasi", "teguran", "surat peringatan", "bank"]),
]
AKTA = "telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, "
KUAT = "merupakan akta otentik yang mempunyai kekuatan pembuktian sempurna dan mengikat (volledig bidende bewijskracht) sesuai Pasal 285 RBg jo. Pasal 1868 Kitab Undang-Undang Hukum Perdata"
BAWAH = "merupakan surat di bawah tangan yang kekuatan pembuktiannya bergantung pada pengakuan pihak lawan dan persesuaiannya dengan alat bukti lain sebagaimana Pasal 288 RBg"
KALIMAT_BUKTI = {
    1: "bukti {L} (Kartu Tanda Penduduk) " + AKTA + KUAT + ", yang membuktikan identitas dan tempat tinggal pihak yang bersangkutan",
    2: "bukti {L} (Kartu Keluarga) " + AKTA + KUAT + ", yang membuktikan susunan keluarga dan hubungan para pihak",
    3: "bukti {L} (akta atau surat keterangan kematian) " + AKTA + KUAT + ", yang membuktikan telah meninggalnya orang yang disebut di dalamnya",
    4: "bukti {L} (Kutipan Akta Nikah) " + AKTA + KUAT + ", yang membuktikan adanya perkawinan yang sah",
    5: "bukti {L} (akta ikrar wakaf, sertifikat wakaf atau surat-surat tentang Nazhir dan harta benda wakaf) " + AKTA + "yang membuktikan adanya ikrar wakaf, harta benda wakaf, Nazhir dan peruntukannya, sehingga bukti tersebut dinilai bersama keterangan saksi dan alat bukti lainnya",
    6: "bukti {L} (akta atau surat hibah) " + AKTA + "yang membuktikan adanya penyerahan hibah, objek hibah, penerima hibah dan waktu penyerahannya, sehingga bukti tersebut dinilai bersama keterangan saksi dan alat bukti lainnya",
    7: "bukti {L} (surat wasiat atau akta wasiat) " + AKTA + "yang membuktikan adanya pernyataan wasiat, bentuknya, penerima wasiat dan objek yang diwasiatkan, sehingga bukti tersebut dinilai bersama keterangan saksi dan alat bukti lainnya",
    8: "bukti {L} (akad atau perjanjian pembiayaan berdasarkan prinsip syariah) " + AKTA + "yang membuktikan adanya hubungan hukum akad antara #0046# dan #0047#, isi akad, hak dan kewajiban para pihak, sehingga bukti tersebut dinilai bersama keterangan saksi dan alat bukti lainnya",
    9: "bukti {L} (surat-surat hak atas tanah, bangunan atau kendaraan) " + AKTA + "yang membuktikan nama yang tercatat sebagai pemegang hak, letak dan luas objek, sehingga bukti tersebut dinilai bersama keterangan saksi dan alat bukti lainnya",
    10: "bukti {L} (surat-surat keuangan, perbankan, tanda pembayaran atau teguran) " + AKTA + BAWAH + ", serta relevan dengan dalil tentang pembayaran dan kewajiban",
    11: "bukti {L} (foto, tangkapan layar atau rekaman) merupakan bukti elektronik yang sah sepanjang memenuhi syarat formil dan materiil sebagaimana Pasal 5 dan Pasal 6 Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik sebagaimana telah diubah terakhir dengan Undang-Undang Nomor 1 Tahun 2024, sehingga nilai pembuktiannya dipertimbangkan bersama alat bukti lainnya",
    99: "bukti {L} " + AKTA + "serta relevan dengan dalil yang hendak dibuktikan oleh #0046# dan #0047#",
}


def analisis_dengan_raw(raw, awalan):
    """analisis_bukti membaca satu isian; di sini sumbernya ungkapan CASE menurut jenis perkara. Pecah baris memakai raw."""
    import buktikit

    asli = buktikit.pecah_baris

    def pecah(_no, maks=60):
        nums = "SELECT 1 AS n" + "".join(" UNION ALL SELECT %d" % i for i in range(2, maks + 1))
        r = "REPLACE(REPLACE(REPLACE(REPLACE(%s, '<br>', CHAR(10)), '<BR>', CHAR(10)), CHAR(13), ''), '&nbsp;', ' ')" % raw
        return (
            "SELECT nums.n AS n, TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(r.raw, CHAR(10), nums.n), CHAR(10), -1)) AS t "
            "FROM (SELECT %s AS raw) r JOIN (%s) nums ON nums.n <= LENGTH(r.raw) - LENGTH(REPLACE(r.raw, CHAR(10), '')) + 1" % (r, nums)
        )

    buktikit.pecah_baris = pecah
    try:
        return buktikit.analisis_bukti(0, KELAS_BUKTI, KALIMAT_BUKTI, awalan, br=True)
    finally:
        buktikit.pecah_baris = asli


def semua():
    V = []

    def teks(no, nama):
        V.append(dict(no=no, nama=nama, tipe="data_teks", sql=None, default=None))

    def sql(no, nama, kueri):
        V.append(dict(no=no, nama=nama, tipe="data_sql", sql=kueri, default=None))

    def kosong_bungkus(ekspresi):
        return "SELECT IF(IFNULL(t.d, '') = '', '', CONCAT(t.d, '{}')) AS data FROM (SELECT %s AS d FROM %s) t" % (ekspresi, ctx())

    sql(4833, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: ANALISIS BUKTI SURAT PENGGUGAT (OTOMATIS dari daftar bukti surat menurut jenis perkara, dikelompokkan menurut jenis surat; kosong bila tidak ada daftar)", analisis_dengan_raw(RAW_P, "P."))
    sql(4834, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: ANALISIS BUKTI SURAT TERGUGAT (OTOMATIS dari daftar bukti surat Tergugat menurut jenis perkara; kosong bila tidak ada daftar)", analisis_dengan_raw(RAW_T, "T."))
    sql(4835, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: PERTIMBANGAN TUNTUTAN LAIN (OTOMATIS menurut petitum dan keputusan: denda, jaminan, pembatalan akad, Turut Tergugat, sita, uang paksa, serta merta)", opsional(kosong_bungkus(p_lain())))
    ik, nk = extras("K")
    iv, nv = extras("V")
    sql(4836, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: BUTIR PEMBUKA AMAR KONTRADIKTOR (OTOMATIS: Mengabulkan, untuk sebagian bila isian 4815 sebagian; ekonomi syariah bawaan sebagian)", kosong_bungkus(pembuka("K")))
    sql(4837, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: BUTIR AMAR TAMBAHAN KONTRADIKTOR (OTOMATIS menurut petitum dan keputusan; diawali baris baru, kosong bila tidak ada)", opsional(kosong_bungkus(ik)))
    sql(4838, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: NOMOR BUTIR AMAR BIAYA PERKARA PADA PUTUSAN KONTRADIKTOR (OTOMATIS: nomor sesudah butir amar 4837)", "SELECT %s AS data FROM %s" % (nk, ctx()))
    sql(4839, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: BUTIR PEMBUKA AMAR VERSTEK (OTOMATIS: Mengabulkan dengan verstek, untuk sebagian bila isian 4815 sebagian; ekonomi syariah bawaan sebagian)", kosong_bungkus(pembuka("V")))
    sql(4840, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: BUTIR AMAR TAMBAHAN VERSTEK (OTOMATIS menurut petitum dan keputusan; diawali baris baru, kosong bila tidak ada)", opsional(kosong_bungkus(iv)))
    sql(4841, "WASIAT, HIBAH, WAKAF, EKONOMI SYARIAH: NOMOR BUTIR AMAR BIAYA PERKARA PADA PUTUSAN VERSTEK (OTOMATIS: nomor sesudah butir amar 4840)", "SELECT %s AS data FROM %s" % (nv, ctx()))
    teks(4842, "EKONOMI SYARIAH: KEPUTUSAN DENDA, GANTI RUGI ATAU TA'WIDH #4845# - PILIH: dikabulkan / ditolak; sesudah titik dua: rumusan amar (dikabulkan) atau alasan (ditolak)")
    teks(4843, "EKONOMI SYARIAH: KEPUTUSAN JAMINAN ATAU AGUNAN #4846# - PILIH: dikabulkan / ditolak; sesudah titik dua: rumusan amar (dikabulkan) atau alasan (ditolak)")
    teks(4844, "EKONOMI SYARIAH: KEPUTUSAN PEMBATALAN AKAD #4847# - PILIH: dikabulkan / ditolak; sesudah titik dua: rumusan amar (dikabulkan) atau alasan (ditolak)")
    sql(4845, "PEMICU: PETITUM EKONOMI SYARIAH MENUNTUT DENDA ATAU GANTI RUGI (OTOMATIS dari petitum SIPP; \"ya\" bila menuntut)", "SELECT IF(c.tden = 1, 'ya', '') AS data FROM %s" % ctx())
    sql(4846, "PEMICU: PETITUM EKONOMI SYARIAH MENUNTUT PENYELESAIAN JAMINAN (OTOMATIS dari petitum SIPP; \"ya\" bila menuntut)", "SELECT IF(c.tjam = 1, 'ya', '') AS data FROM %s" % ctx())
    sql(4847, "PEMICU: PETITUM EKONOMI SYARIAH MENUNTUT PEMBATALAN AKAD (OTOMATIS dari petitum SIPP; \"ya\" bila menuntut)", "SELECT IF(c.tbat = 1, 'ya', '') AS data FROM %s" % ctx())
    return V


if __name__ == "__main__":
    for v in semua():
        print(v["no"], v["tipe"], len(v["sql"] or ""))
