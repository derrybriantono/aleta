# -*- coding: utf-8 -*-
"""
Variabel ABT 4815-4831: KEWARISAN (gugatan waris, jenis perkara 364) - ahli waris terstruktur (faraid KHI), harta bersama pewaris dengan pasangan,
utang/wasiat/biaya jenazah, tirkah yang tidak terbukti, penguasaan, amar bernomor, bukti surat.
Memakai ulang isian HB 4783-4785 (sita/uang paksa/serta merta) dan pemicu 4788/4790/4791 (membaca petitum, tidak bergantung jenis).
"""
import json, os
from sqlkit import lit, konteks, kode_pilihan, alasan, sebelum_titik_dua, periksa, gabung
from variabel_hb import kutipan_bas
from variabel_hb import (
    KEPUTUSAN_SITA, KEPUTUSAN_AT, L, isi, kalimat, p_sita, p_uang_paksa, p_serta_merta, p_turut, p_tidak_terbukti, opsional, terbilang_kecil, fakta_tidak_terbukti,
)
from buktikit import analisis_bukti

ISIAN_W = [4815, 4816, 4817, 4818, 4819, 4783, 4784, 4785, 8717, 8718, 8719]
KATA = "harta peninggalan (tirkah) #2026# #1025#"
SALINAN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "salinan-server-21okt")
STRUKTUR = (9701, 9702, 9703, 9704, 9718, 9762, 9763, 9764, 9765, 9766, 9767)


def baca(no):
    return open(os.path.join(SALINAN, "%d.sql" % no), encoding="utf-8").read().strip()


def ctx(mode):
    """mode V verstek / K kontradiktoir."""
    w = konteks(ISIAN_W)
    a = (
        "SELECT w.*, "
        "IF(w.pet REGEXP 'sita|beslag' OR w.sela > 0, 1, 0) AS tsita, "
        "IF(w.pet REGEXP 'uang paksa|dwangsom', 1, 0) AS tuang, "
        "IF(w.pet REGEXP 'serta merta|serta-merta|uitvoerbaar|bij voorraad', 1, 0) AS tserta, "
        "IF(w.pet REGEXP 'turut tergugat' OR w.ntt > 0, 1, 0) AS ttt, "
        "%s AS dsita, %s AS duang, %s AS dserta, %s AS dmain, "
        "IF(w.i4816 <> '', 1, 0) AS ada_tidak_terbukti, "
        "IF(w.i4818 <> '', 1, 0) AS hbp, IF(w.i4819 <> '', 1, 0) AS utang, "
        "IF(LOWER(w.i4817) REGEXP 'tidak ada|tidak dikuasai|tanpa penguasa|belum dikuasai', 0, 1) AS serah, "
        "IF(w.i4817 <> '' AND LOWER(w.i4817) NOT REGEXP 'tidak ada|tidak dikuasai|tanpa penguasa|belum dikuasai', w.i4817, '#7037#') AS siapa "
        "FROM %s"
        % (KEPUTUSAN_SITA.replace("w.i4783", "w.i4783"), KEPUTUSAN_AT("w.i4784"), KEPUTUSAN_AT("w.i4785"), kode_pilihan("w.i4815"), w)
    )
    b = "SELECT a.*, IF(a.dmain = 'A', 0, 1) AS sebagian FROM (%s) a" % a
    return "(%s) c" % b


def bungkus(ekspresi, mode="K"):
    return "SELECT IF(IFNULL(t.d, '') = '', '', CONCAT(t.d, '{}')) AS data FROM (SELECT %s AS d FROM %s) t" % (ekspresi, ctx(mode))


# ------------------------------------------------------------------ pembungkus ahli waris terstruktur (faraid KHI) -> bawaan isian
def pembungkus_struktur(no_sumber, no_isian):
    cek = "EXISTS(SELECT 1 FROM aps_badilag.abt_data_teks WHERE perkara_id = '#perkara_id#' AND no_var IN (%s) AND TRIM(IFNULL(data, '')) <> '')" % ", ".join(str(n) for n in STRUKTUR)
    bawaan = (
        "IFNULL(NULLIF(TRIM(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var = %d AND perkara_id = '#perkara_id#' LIMIT 1) USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;')), ''), %s)"
        % (no_isian, lit(_bawaan(no_isian)))
    )
    return "SELECT IF(%s, (SELECT z.data FROM (%s) z), %s) AS data" % (cek, baca(no_sumber), bawaan)


def _bawaan(no):
    d = json.load(open(os.path.join(SALINAN, "bawaan-variabel.json"), encoding="utf-8"))
    return "DATA_TIDAK_ADA"


def pembungkus_pertimbangan():
    cek = "EXISTS(SELECT 1 FROM aps_badilag.abt_data_teks WHERE perkara_id = '#perkara_id#' AND no_var IN (%s) AND TRIM(IFNULL(data, '')) <> '')" % ", ".join(str(n) for n in STRUKTUR)
    return "SELECT IF(%s, CONCAT('<br>', (SELECT z.data FROM (%s) z)), '') AS data" % (cek, baca(9769))


# ------------------------------------------------------------------ pertimbangan
def p_hbp():
    return (
        "IF(c.hbp = 0, '', CONCAT(%s, c.i4818, %s))"
        % (
            L("Menimbang, bahwa di antara harta yang ditinggalkan terdapat harta bersama #2026# #1025# dengan pasangannya berupa: "),
            L(", dan berdasarkan Pasal 96 ayat (1) Kompilasi Hukum Islam apabila terjadi cerai mati maka separuh harta bersama menjadi hak pasangan yang hidup lebih lama, sehingga hanya separuh bagian lainnya yang menjadi harta peninggalan (tirkah) pewaris yang dibagi kepada ahli waris;"),
        )
    )


def p_utang_wasiat():
    return (
        "IF(c.utang = 0, '', CONCAT(%s, c.i4819, %s))"
        % (
            L("Menimbang, bahwa berdasarkan Pasal 171 huruf e Kompilasi Hukum Islam harta warisan adalah harta bawaan ditambah bagian dari harta bersama setelah digunakan untuk keperluan pewaris selama sakit sampai meninggalnya, biaya pengurusan jenazah (tajhiz), pembayaran hutang dan pemberian untuk kerabat; dalam perkara ini diterangkan bahwa: "),
            L("; oleh karena itu hal tersebut harus diperhitungkan lebih dahulu sebelum harta peninggalan dibagi kepada ahli waris, sesuai Pasal 175 ayat (1) dan ayat (2) Kompilasi Hukum Islam;"),
        )
    )


def p_lain():
    return gabung(
        p_hbp(),
        p_utang_wasiat(),
        p_tidak_terbukti(kata=KATA, petitum="penetapan harta peninggalan", kol="i4816", flag="ada_tidak_terbukti"),
        p_sita("K", kata=KATA),
        p_turut("harta peninggalan"),
        p_uang_paksa("harta peninggalan"),
        p_serta_merta(),
    )


# ------------------------------------------------------------------ amar
def amar_blok(mode):
    items = []
    if mode == "V":
        items.append(("tdk", "1"))
    items += [
        ("kab", "1"),
        ("sita", "IF(c.tsita = 1 AND c.dsita = 'A', 1, 0)"),
        ("mati", "1"),
        ("ahli", "1"),
        ("hbp", "IF(c.hbp = 1, 1, 0)"),
        ("tirkah", "1"),
        ("utang", "IF(c.utang = 1, 1, 0)"),
        ("bagian", "1"),
        ("serah", "IF(c.serah = 1, 1, 0)"),
        ("turut", "IF(c.ttt = 1, 1, 0)"),
        ("uang", "IF(c.tuang = 1 AND c.duang = 'A', 1, 0)"),
        ("serta", "IF(c.tserta = 1 AND c.dserta = 'A', 1, 0)"),
        ("tolak", "IF(c.sebagian = 1, 1, 0)"),
    ]
    kode = [k for k, _ in items]
    flag = dict(items)

    def nomor(k):
        i = kode.index(k)
        antar = " + ".join(flag[j] for j in kode[:i]) or "0"
        return "(1 + %s)" % antar

    def n(k):
        return "CAST(%s AS CHAR)" % nomor(k)

    teks = {
        "tdk": L("Menyatakan #7037# yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;"),
        "kab": "CONCAT(%s, IF(c.sebagian = 1, %s, ''), %s)" % (L("Mengabulkan #0053# #0046#"), L(" untuk sebagian"), L(" dengan verstek;") if mode == "V" else L(";")),
        "sita": "CONCAT(%s, IF(c.pet REGEXP 'marital', %s, %s), IF(c.sela > 0, CONCAT(%s, IF(TRIM('#0218#') = '', 'DATA_TIDAK_ADA', '#0218#')), ''), %s)"
        % (L("Menyatakan sah dan berharga "), L("sita marital (maritale beslag)"), L("sita jaminan (conservatoir beslag)"), L(" berdasarkan Putusan Sela tanggal "), L(" yang telah diletakkan atas harta peninggalan;")),
        "mati": L("Menetapkan #2026# #1025# telah meninggal dunia pada tanggal #1246# di #1509#;"),
        "ahli": L("Menetapkan ahli waris dari #2026# #1025# adalah: #4821#;"),
        "hbp": "CONCAT(%s, c.i4818, %s)" % (L("Menetapkan harta bersama #2026# #1025# dengan pasangannya berupa: "), L(", yang separuh bagiannya merupakan hak pasangan yang hidup lebih lama dan separuh bagian lainnya merupakan harta peninggalan (tirkah);")),
        "tirkah": "CONCAT(%s, %s, %s)" % (L("Menetapkan harta peninggalan (tirkah) #2026# #1025# berupa: "), isi("i8718", 8718), L(";")),
        "utang": "CONCAT(%s, c.i4819, %s)" % (L("Menetapkan bahwa sebelum harta peninggalan dibagi, terlebih dahulu diperhitungkan: "), L(";")),
        "bagian": "CONCAT(%s, %s, %s)" % (L("Menetapkan bagian masing-masing ahli waris atas harta peninggalan tersebut: "), isi("i8719", 8719), L(";")),
        "serah": "CONCAT(%s, c.siapa, %s)" % (L("Menghukum "), L(" untuk menyerahkan harta peninggalan tersebut kepada ahli waris sesuai bagiannya masing-masing sebagaimana tersebut di atas;")),
        "turut": "CONCAT(%s, IF(c.ntt > 1, 'Para Turut', 'Turut'), %s)" % (L("Menghukum "), L(" #0047# untuk tunduk dan patuh pada putusan ini;")),
        "uang": "CONCAT(%s, IF(LOCATE(':', c.i4784) > 0, %s, %s), %s)"
        % (L("Menghukum #7037# untuk membayar uang paksa (dwangsom) sejumlah "), alasan("c.i4784"), L(periksa("jumlah uang paksa")), L(" setiap hari lalai menjalankan isi putusan ini;")),
        "serta": L("Menyatakan putusan ini dapat dijalankan lebih dahulu (uitvoerbaar bij voorraad) meskipun ada upaya hukum;"),
        "tolak": L("Menolak #0053# #0046# selain dan selebihnya;"),
    }
    bagian = ["IF(%s = 1, CONCAT(%s, %s, %s), NULL)" % (flag[k], n(k), L(".   "), teks[k]) for k in kode]
    isi_amar = "CONCAT_WS('<br>', %s)" % ", ".join(bagian)
    nomor_biaya = "CAST(1 + %s AS CHAR)" % " + ".join(flag[k] for k in kode)
    return isi_amar, nomor_biaya


KELAS_BUKTI = [
    (1, ["kartu tanda penduduk", "ktp"]),
    (2, ["kartu keluarga"]),
    (3, ["akta kematian", "keterangan kematian", "surat kematian", "keterangan meninggal"]),
    (4, ["akta nikah", "buku nikah", "kutipan akta nikah"]),
    (5, ["akta kelahiran", "keterangan lahir", "surat kelahiran"]),
    (6, ["silsilah", "silsila", "keterangan ahli waris", "keterangan waris", "pernyataan ahli waris", "penetapan ahli waris"]),
    (9, ["foto ", "foto-", "foto,", "tangkapan layar", "screenshot", "video", "rekaman"]),
    (8, ["rekening", "tabungan", "deposito", "bpjs", "taspen", "asuransi", "polis", "bank", "kwitansi", "kuitansi"]),
    (7, ["sertifikat", "sertipikat", "hak milik", "akta jual beli", "ajb", "girik", "sppt", "pbb", "bpkb", "stnk", "tanah", "rumah", "kendaraan"]),
]
AKTA = "telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, "
KUAT = "merupakan akta otentik yang mempunyai kekuatan pembuktian sempurna dan mengikat (volledig bidende bewijskracht) sesuai Pasal 285 RBg jo. Pasal 1868 Kitab Undang-Undang Hukum Perdata"
KALIMAT_BUKTI = {
    1: "bukti {L} (Kartu Tanda Penduduk) " + AKTA + KUAT + ", yang membuktikan identitas dan tempat tinggal pihak yang bersangkutan",
    2: "bukti {L} (Kartu Keluarga) " + AKTA + KUAT + ", yang membuktikan susunan keluarga dan hubungan para pihak dengan pewaris",
    3: "bukti {L} (akta atau surat keterangan kematian) " + AKTA + KUAT + ", yang membuktikan telah meninggalnya #2026# #1025# sebagai pewaris sehingga warisan terbuka",
    4: "bukti {L} (Kutipan Akta Nikah) " + AKTA + KUAT + ", yang membuktikan adanya perkawinan yang sah antara pewaris dengan pasangannya",
    5: "bukti {L} (akta atau surat keterangan kelahiran) " + AKTA + KUAT + ", yang membuktikan hubungan nasab anak dengan orang tuanya",
    6: "bukti {L} (surat keterangan atau penetapan tentang ahli waris dan silsilah) " + AKTA + "yang menjelaskan silsilah keluarga pewaris dan para ahli warisnya, sehingga bukti tersebut dinilai bersama keterangan saksi-saksi dan alat bukti lainnya",
    7: "bukti {L} (surat-surat hak atas tanah, bangunan atau kendaraan) " + AKTA + "yang membuktikan nama yang tercatat sebagai pemegang hak, letak dan luas objek; nama yang tercatat dalam bukti tersebut tidak menentukan objek sebagai harta peninggalan pewaris, sehingga bukti tersebut dinilai bersama keterangan saksi dan alat bukti lainnya",
    8: "bukti {L} (surat-surat keuangan, perbankan, jaminan sosial atau tanda pembayaran) " + AKTA + "yang kekuatan pembuktiannya bergantung pada persesuaiannya dengan alat bukti lain sebagaimana Pasal 288 RBg, serta relevan dengan dalil tentang harta peninggalan pewaris",
    9: "bukti {L} (foto, tangkapan layar atau rekaman) merupakan bukti elektronik yang sah sepanjang memenuhi syarat formil dan materiil sebagaimana Pasal 5 dan Pasal 6 Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik sebagaimana telah diubah terakhir dengan Undang-Undang Nomor 1 Tahun 2024, sehingga nilai pembuktiannya dipertimbangkan bersama alat bukti lainnya",
    99: "bukti {L} " + AKTA + "serta relevan dengan dalil yang hendak dibuktikan oleh #0046# dan #0047#",
}


def p_serah():
    """Pengganti paragraf 'bersifat menghukum': bunyi lama bila ada penguasa; bila tidak ada penguasa, penghukuman tidak dikabulkan."""
    return (
        "IF(c.serah = 1, CONCAT(%s, c.siapa, %s, c.siapa, %s), %s)"
        % (
            L("Menimbang, bahwa terhadap petitum yang bersifat menghukum (condemnatoir), oleh karena harta peninggalan tersebut terbukti dikuasai oleh "),
            L(" sedangkan para ahli waris berhak atas bagiannya masing-masing, maka petitum agar "),
            L(" menyerahkan harta peninggalan tersebut kepada ahli waris sesuai bagiannya patut dikabulkan;"),
            L("Menimbang, bahwa oleh karena harta peninggalan tersebut tidak terbukti dikuasai oleh pihak tertentu, maka petitum yang bersifat menghukum untuk menyerahkan harta peninggalan tidak beralasan hukum dan patut ditolak;"),
        )
    )


def semua():
    V = []

    def teks(no, nama):
        V.append(dict(no=no, nama=nama, tipe="data_teks", sql=None, default=None))

    def sql(no, nama, kueri):
        V.append(dict(no=no, nama=nama, tipe="data_sql", sql=kueri, default=None))

    teks(4815, "KEWARISAN: KEPUTUSAN ATAS PETITUM PENETAPAN AHLI WARIS, TIRKAH DAN BAGIAN - PILIH: dikabulkan seluruhnya / sebagian; kosong = sebagian (bunyi blangko lama)")
    teks(4816, "KEWARISAN: OBJEK YANG TIDAK TERBUKTI SEBAGAI HARTA PENINGGALAN - ISIAN (satu per baris; kosong = semua objek terbukti)")
    teks(4817, "KEWARISAN: PIHAK YANG MENGUASAI HARTA PENINGGALAN - ISIAN (mis. Tergugat; tulis tidak ada bila tidak dikuasai pihak mana pun; kosong = Tergugat)")
    teks(4818, "KEWARISAN: HARTA BERSAMA PEWARIS DENGAN PASANGANNYA - ISIAN (objek yang separuhnya hak pasangan yang hidup lebih lama; kosong = tidak ada)")
    teks(4819, "KEWARISAN: UTANG, WASIAT DAN BIAYA PENGURUSAN JENAZAH PEWARIS - ISIAN (diperhitungkan sebelum pembagian; kosong = tidak ada)")
    sql(4820, "KEWARISAN: AHLI WARIS UNTUK FAKTA (OTOMATIS: susunan lengkap dari isian 9701 s.d. 9704, 9718, 9762 s.d. 9767 bila terisi; selain itu isian 8717)", pembungkus_struktur(9768, 8717))
    sql(4821, "KEWARISAN: AHLI WARIS YANG BERHAK UNTUK AMAR (OTOMATIS: dari isian terstruktur 9701 dst. tanpa yang terhalang bila terisi; selain itu isian 8717)", pembungkus_struktur(9770, 8717))
    sql(4822, "KEWARISAN: PERTIMBANGAN BAGIAN AHLI WARIS MENURUT KHI (OTOMATIS: Pasal 176 s.d. 182, 185, 192, 193 bila isian terstruktur 9701 dst. terisi; selain itu kosong)", pembungkus_pertimbangan())
    sql(4823, "KEWARISAN: PERTIMBANGAN HARTA BERSAMA PEWARIS DAN UTANG ATAU WASIAT (OTOMATIS dari isian 4818 dan 4819; Pasal 96 ayat (1), 171 huruf e dan 175 KHI)", opsional(bungkus(gabung(p_hbp(), p_utang_wasiat()))))
    sql(4824, "KEWARISAN: PERTIMBANGAN TUNTUTAN LAIN (OTOMATIS: objek tidak terbukti, sita, Turut Tergugat, uang paksa dan serta merta menurut petitum dan keputusan)", opsional(bungkus(gabung(
        p_tidak_terbukti(kata=KATA, petitum="penetapan harta peninggalan", kol="i4816", flag="ada_tidak_terbukti"),
        p_sita("K", kata=KATA), p_turut("harta peninggalan"), p_uang_paksa("harta peninggalan"), p_serta_merta()))))
    isi_v, nb_v = amar_blok("V")
    isi_k, nb_k = amar_blok("K")
    sql(4825, "KEWARISAN: AMAR PUTUSAN VERSTEK (OTOMATIS: dari keputusan isian 4815 s.d. 4819 dan petitum; satu baris bernomor per butir)", "SELECT IF(IFNULL(t.d, '') = '', '', CONCAT(t.d, '{}')) AS data FROM (SELECT %s AS d FROM %s) t" % (isi_v, ctx("V")))
    sql(4826, "KEWARISAN: NOMOR BUTIR AMAR BIAYA PERKARA PADA PUTUSAN VERSTEK (OTOMATIS: nomor sesudah butir amar 4825)", "SELECT %s AS data FROM %s" % (nb_v, ctx("V")))
    sql(4827, "KEWARISAN: AMAR PUTUSAN KONTRADIKTOR (OTOMATIS: dari keputusan isian 4815 s.d. 4819 dan petitum; satu baris bernomor per butir)", "SELECT IF(IFNULL(t.d, '') = '', '', CONCAT(t.d, '{}')) AS data FROM (SELECT %s AS d FROM %s) t" % (isi_k, ctx("K")))
    sql(4828, "KEWARISAN: NOMOR BUTIR AMAR BIAYA PERKARA PADA PUTUSAN KONTRADIKTOR (OTOMATIS: nomor sesudah butir amar 4827)", "SELECT %s AS data FROM %s" % (nb_k, ctx("K")))
    sql(4829, "KEWARISAN: ANALISIS BUKTI SURAT PENGGUGAT (OTOMATIS dari daftar bukti surat: dikelompokkan menurut jenis surat; daftar kosong = kosong)", analisis_bukti(9955, KELAS_BUKTI, KALIMAT_BUKTI, "P.", br=True))
    sql(4830, "KEWARISAN: ANALISIS BUKTI SURAT TERGUGAT (OTOMATIS dari daftar bukti surat Tergugat: dikelompokkan menurut jenis surat; daftar kosong = kosong)", analisis_bukti(9911, KELAS_BUKTI, KALIMAT_BUKTI, "T.", br=True))
    sql(4831, "KEWARISAN: FAKTA OBJEK YANG TIDAK TERBUKTI (OTOMATIS dari isian 4816: satu butir per objek; kosong bila semua objek terbukti)", fakta_tidak_terbukti(kata=KATA, isian=4816))
    sql(4849, "KEWARISAN: KUTIPAN KETERANGAN SAKSI TENTANG KEMATIAN, AHLI WARIS DAN HARTA (OTOMATIS dari BAS, kueri 4618: nama saksi dan jawaban; kosong bila BAS belum menyimpan keterangan)", kutipan_bas(4618, "Menimbang, bahwa saksi-saksi yang diajukan menerangkan tentang meninggalnya pewaris dan ahli warisnya sebagai berikut: "))
    sql(4832, "KEWARISAN: PERTIMBANGAN PENGHUKUMAN MENYERAHKAN HARTA PENINGGALAN (OTOMATIS: bunyi lama bila ada penguasa menurut isian 4817; tidak dikuasai = ditolak)", bungkus(p_serah()))
    return V


if __name__ == "__main__":
    for v in semua():
        print(v["no"], v["tipe"], len(v["sql"] or ""))
