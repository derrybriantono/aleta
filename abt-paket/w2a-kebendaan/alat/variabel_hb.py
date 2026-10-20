# -*- coding: utf-8 -*-
"""
Variabel ABT 4780-4809: HARTA BERSAMA (gugatan, jenis perkara 348) - keputusan majelis per tuntutan, pertimbangan dan amar.
Pola sama dengan paket U2 (cerai): tuntutan DIKENALI dari petitum SIPP, keputusan tetap isian PILIH hakim,
tuntutan terbaca tanpa keputusan = kalimat [PERIKSA: ...]; tanpa tuntutan dan tanpa pilihan = bunyi lama blangko.
"""
import json, os
from sqlkit import lit, konteks, kode_pilihan, alasan, sebelum_titik_dua, bersih_html, periksa, gabung, PERKARA

ISIAN_HB = [4780, 4781, 4782, 4783, 4784, 4785, 4786, 4787, 8730]

# ------------------------------------------------------------------ konteks HB
KEPUTUSAN_SITA = (
    "CASE WHEN LOWER(TRIM(w.i4783)) = '' THEN 'K' WHEN LOWER(TRIM(w.i4783)) REGEXP 'tolak|tidak sah' THEN 'T' "
    "WHEN LOWER(TRIM(w.i4783)) REGEXP 'sah|kabul|berharga' THEN 'A' ELSE 'K' END"
)
KEPUTUSAN_AT = lambda col: (
    "CASE WHEN LOWER(TRIM(%s)) = '' THEN 'K' WHEN LOWER(TRIM(%s)) REGEXP 'tolak' THEN 'T' WHEN LOWER(TRIM(%s)) REGEXP 'kabul' THEN 'A' ELSE 'K' END" % (col, col, col)
)
FRAKSI_BUKAN_SEPERDUA = (
    "(w.pet REGEXP '(^|[^0-9])(1/3|2/3|1/4|3/4|1/5|2/5|3/5|4/5|1/6|5/6|1/8|3/8|5/8|7/8)([^0-9]|$)' OR w.pet REGEXP '[0-9]+ ?%')"
)


def ctx(mode):
    """Tabel turunan c. mode: 'V' verstek (awal amar: T tidak hadir + mengabulkan dengan verstek), 'K' kontradiktoir tanpa konvensi,
    'KK' konvensi-rekonvensi (sita dianggap ada, bawaan 'untuk sebagian')."""
    w = konteks(ISIAN_HB)
    sita_bawaan = "1" if mode == "KK" else "0"
    sebagian_bawaan = "1" if mode == "KK" else "0"
    a = (
        "SELECT w.*, "
        "IF(w.pet REGEXP 'sita|beslag' OR w.sela > 0 OR %s = 1, 1, 0) AS tsita, "
        "IF(w.pet REGEXP 'uang paksa|dwangsom', 1, 0) AS tuang, "
        "IF(w.pet REGEXP 'serta merta|serta-merta|uitvoerbaar|bij voorraad', 1, 0) AS tserta, "
        "IF(%s, 1, 0) AS tbag, "
        "IF(w.pet REGEXP 'turut tergugat' OR w.ntt > 0, 1, 0) AS ttt, "
        "IF(w.pet REGEXP 'hutang|utang' OR w.i4786 <> '', 1, 0) AS tutang, "
        "%s AS dsita, %s AS duang, %s AS dserta, %s AS dmain, "
        "%s AS bag_stmt, %s AS bag_alasan, "
        "IF(w.i4782 = '' OR LOWER(%s) REGEXP 'seperdua|1/2|setengah|separuh', 1, 0) AS bag_setengah, "
        "IF(w.i4781 <> '', 1, 0) AS ada_tidak_terbukti, "
        "IF(w.jn = 348, 1, 0) AS hb "
        "FROM %s" % (sita_bawaan, FRAKSI_BUKAN_SEPERDUA, ("IF(%s = 'K', 'A', %s)" % (KEPUTUSAN_SITA, KEPUTUSAN_SITA)) if mode == "KK" else KEPUTUSAN_SITA, KEPUTUSAN_AT("w.i4784"), KEPUTUSAN_AT("w.i4785"), kode_pilihan("w.i4780"),
                     sebelum_titik_dua("w.i4782"), alasan("w.i4782"), sebelum_titik_dua("w.i4782"), w)
    )
    b = (
        "SELECT a.*, "
        "IF(a.dmain = 'S' OR a.ada_tidak_terbukti = 1 OR (a.dmain = 'K' AND %s = 1), 1, 0) AS sebagian, "
        "IF(a.tbag = 1 AND a.i4782 = '', 1, 0) AS bag_belum, "
        "IF(a.dsita = 'A', 1, 0) AS sita_sah "
        "FROM (%s) a" % (sebagian_bawaan, a)
    )
    return "(%s) c" % b


def L(t):
    return lit(t)


BAWAAN = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "salinan-server-21okt", "bawaan-variabel.json"), encoding="utf-8"))


def isi(col, no):
    """Isian bersih; kosong -> teks bawaan variabel di server (disalin ke salinan-server-21okt/bawaan-variabel.json), bukan token:
    token di dalam kueri diganti ABT secara tekstual SEBELUM kueri jalan, jadi nilai isian bertanda petik ganda dapat merusak kueri."""
    bawaan = BAWAAN.get(str(no), {}).get("default") or "..."
    return "IF(c.%s <> '', c.%s, %s)" % (col, col, lit(bawaan))


def kalimat(*bagian):
    return "CONCAT(%s)" % ", ".join(bagian)


# ------------------------------------------------------------------ pemicu (menyalakan isian di layar)
def pemicu(nama_kol):
    return "SELECT IF(c.%s = 1, 'ya', '') AS data FROM %s" % (nama_kol, ctx("K"))


# ------------------------------------------------------------------ pertimbangan
def p_tidak_terbukti(kata="harta bersama #0046# dan #7037#", petitum="penetapan dan pembagian harta bersama", kol="i4781", flag="ada_tidak_terbukti"):
    return (
        "IF(c.%s = 0, '', CONCAT(%s, c.%s, %s))"
        % (
            flag,
            L("Menimbang, bahwa terhadap objek yang didalilkan berupa: "),
            kol,
            L(", tidak terbukti sebagai %s, sehingga petitum %s sepanjang mengenai objek tersebut tidak beralasan hukum dan patut ditolak;" % (kata, petitum)),
        )
    )


def p_sita(mode="K", kata="harta bersama #0046# dan #7037#"):
    sela = "IF(c.sela > 0, CONCAT(%s, '#0218#'), '')" % L(" berdasarkan Putusan Sela tanggal ")
    marital = "IF(c.pet REGEXP 'marital', %s, %s)" % (L("sita marital (maritale beslag)"), L("sita jaminan (conservatoir beslag)"))
    if mode == "KK":
        sah = L("Menimbang, bahwa oleh karena objek yang telah diletakkan sita jaminan berdasarkan Putusan Sela tanggal #0218# terbukti sebagai harta bersama #0046# dan #0047#, maka sita jaminan (conservatoir beslag) tersebut patut dinyatakan sah dan berharga;")
        return (
            "CASE WHEN c.dsita = 'T' THEN CONCAT(%s, IF(c.i4783 <> '' AND LOCATE(':', c.i4783) > 0, %s, %s), %s) ELSE %s END"
            % (
                L("Menimbang, bahwa terhadap permohonan sita jaminan yang diajukan #0046#, #8554# berpendapat "),
                alasan("c.i4783"),
                L(periksa("tulis alasan setelah titik dua pada isian keputusan sita jaminan")),
                L(", sehingga permohonan sita jaminan tersebut tidak beralasan hukum dan patut ditolak;"),
                sah,
            )
        )
    return (
        "CASE WHEN c.tsita = 0 THEN '' "
        "WHEN c.dsita = 'K' THEN %s "
        "WHEN c.dsita = 'T' THEN CONCAT(%s, IF(c.i4783 <> '' AND LOCATE(':', c.i4783) > 0, %s, %s), %s) "
        "ELSE CONCAT(%s, %s, %s, %s, %s, %s) END"
        % (
            L(periksa("petitum menuntut sita jaminan; pilih keputusan majelis pada isian keputusan sita jaminan")),
            L("Menimbang, bahwa terhadap permohonan sita jaminan yang diajukan #0046#, #8554# berpendapat "),
            alasan("c.i4783"),
            L(periksa("tulis alasan setelah titik dua pada isian keputusan sita jaminan")),
            L(", sehingga permohonan sita jaminan tersebut tidak beralasan hukum dan patut ditolak;"),
            L("Menimbang, bahwa terhadap objek sengketa telah diletakkan "),
            marital,
            sela,
            L(" sesuai ketentuan Pasal 261 ayat (1) RBg jo. Pasal 95 Kompilasi Hukum Islam, dan oleh karena objek tersebut terbukti sebagai "),
            L("%s, maka " % kata),
            kalimat(L("sita tersebut patut dinyatakan sah dan berharga;")),
        )
    )


def p_bagian(mode="K"):
    """Pengganti paragraf bagian 'seperdua': bila isian bagian kosong atau seperdua -> bunyi lama persis; selain itu bagian menurut isian."""
    lama = (
        "Menimbang, bahwa menurut fakta persidangan, tidak ada fakta hukum yang menunjukkan bahwa antara #0046# dan #7037# pernah mengadakan perjanjian perkawinan "
        "yang mengatur bagian harta bersama masing-masing pihak, dan #8554# menilai dalam perkara a quo tidak ada fakta yang mendorong dilakukannya penyimpangan dari norma dasar "
        "Pasal 35 Undang-Undang Nomor 1 tahun 1974 jo. Pasal 97 Kompilasi Hukum Islam, sehingga pembagian harta bersama antara #0046# dan #7037# adalah masing-masing berhak seperdua (1/2) dari harta bersama tersebut;"
    )
    baru = kalimat(
        L("Menimbang, bahwa Pasal 97 Kompilasi Hukum Islam menentukan bahwa janda atau duda cerai hidup masing-masing berhak seperdua dari harta bersama sepanjang tidak ditentukan lain dalam perjanjian perkawinan; "
          "dalam perkara a quo #8554# menilai terdapat fakta yang mendorong dilakukannya penyimpangan dari norma dasar tersebut, yaitu "),
        "IF(c.bag_alasan <> '', c.bag_alasan, %s)" % L(periksa("tulis alasan penyimpangan bagian setelah titik dua pada isian keputusan bagian harta bersama")),
        L(", sehingga pembagian harta bersama antara #0046# dan #7037# ditetapkan: "),
        "c.bag_stmt",
        L(" dari harta bersama tersebut;"),
    )
    if mode == "KK":
        lama = (
            "Menimbang, bahwa menurut fakta persidangan, tidak ada fakta hukum yang menunjukkan bahwa antara #0046# dan #0047# pernah mengadakan perjanjian perkawinan pada waktu sebelum atau selama dalam ikatan perkawinan yang mengatur bagian harta bersama masing-masing pihak. "
            "Dengan demikian, ketentuan pembagian harta bersama masing-masing #0046# dan #0047# dalam perkara a quo dikembalikan kepada norma dasarnya sebagaimana telah dipertimbangkan sebelumnya. "
            "#8554# menilai pembagian harta bersama dalam perkara a quo tidak melihat atau tidak bertolak dari pihak mana harta tersebut dihasilkan. Pertimbangan tersebut didasarkan pada norma Pasal 35 Undang-Undang Nomor 1 tahun 1974 tentang Perkawinan sebagaimana diubah dengan Undang-Undang Nomor 16 tahun 2019 "
            "(selanjutnya disebut UU Nomor 1 tahun 1974) jo. Pasal 97 Kompilasi Hukum Islam (KHI) yang menegaskan status harta bersama dan pembagiannya tidak melihat siapa yang menghasilkan harta tersebut. "
            "Dalam beberapa kasus, ketentuan dasar tersebut bisa saja disimpangi dengan pertimbangan adanya fakta yang mendorong penyimpangan. Sementara #8554# menilai dalam perkara a quo tidak ada fakta yang mendorong dilakukannya penyimpangan;"
            "<br>Menimbang, bahwa berdasarkan pertimbangan tersebut, #8554# menyimpulkan pembagian harta bersama antara #0046# dan #0047#, adalah masing-masing berhak seperdua (1/2) dari harta bersama yang telah ditetapkan sebagaimana akan dicantumkan pada bagian diktum putusan ini;"
        )
    marker = L(periksa("petitum menuntut bagian selain seperdua; isi keputusan bagian harta bersama (seperdua atau bagian lain beserta alasan)"))
    return "IF(c.bag_belum = 1, %s, IF(c.bag_setengah = 1, %s, %s))" % (marker, L(lama), baru)


def p_utang():
    return (
        "IF(c.i4786 = '', '', CONCAT(%s, c.i4786, %s))"
        % (
            L("Menimbang, bahwa selain harta bersama, selama perkawinan #0046# dan #7037# timbul pula utang berupa: "),
            L(", yang berdasarkan fakta persidangan dipergunakan untuk kepentingan keluarga, sehingga sesuai Pasal 93 ayat (2) Kompilasi Hukum Islam menjadi tanggungan harta bersama dan harus dilunasi lebih dahulu sebelum harta bersama dibagi;"),
        )
    )


def p_turut(kata="harta bersama"):
    return (
        "IF(c.ttt = 0, '', CONCAT(%s, IF(c.ntt > 1, 'Para Turut', 'Turut'), %s, IF(c.ntt > 1, 'Para Turut', 'Turut'), %s))"
        % (
            L("Menimbang, bahwa "),
            L(" #0047# ditarik sebagai pihak dalam perkara ini agar tunduk dan patuh pada putusan mengenai status %s; oleh karena itu " % kata),
            L(" #0047# patut dihukum untuk tunduk dan patuh pada putusan ini;"),
        )
    )


def p_uang_paksa(kata="harta bersama"):
    return (
        "CASE WHEN c.tuang = 0 THEN '' "
        "WHEN c.duang = 'K' THEN %s "
        "WHEN c.duang = 'T' THEN %s "
        "ELSE CONCAT(%s, IF(c.i4784 <> '' AND LOCATE(':', c.i4784) > 0, %s, %s), %s) END"
        % (
            L(periksa("petitum menuntut uang paksa (dwangsom); pilih keputusan majelis pada isian keputusan uang paksa")),
            L("Menimbang, bahwa terhadap tuntutan uang paksa (dwangsom), berdasarkan putusan Mahkamah Agung No. 307K/Sip/1976, tertanggal 7 Desember 1976, tuntutan uang paksa harus ditolak dalam hal putusan dapat dilaksanakan dengan eksekusi riil jika putusan tersebut mempunyai kekuatan yang pasti; "
              "oleh karena putusan mengenai %s dalam perkara a quo dapat dilaksanakan dengan eksekusi riil, maka tuntutan uang paksa (dwangsom) tidak beralasan hukum dan patut ditolak;" % kata),
            L("Menimbang, bahwa terhadap tuntutan uang paksa (dwangsom), #8554# berpendapat tuntutan tersebut beralasan hukum, yaitu sejumlah "),
            alasan("c.i4784"),
            L(periksa("tulis jumlah uang paksa setelah titik dua pada isian keputusan uang paksa")),
            L(" setiap hari lalai menjalankan isi putusan, sehingga patut dikabulkan;"),
        )
    )


def p_serta_merta():
    return (
        "CASE WHEN c.tserta = 0 THEN '' "
        "WHEN c.dserta = 'K' THEN %s "
        "WHEN c.dserta = 'T' THEN %s "
        "ELSE CONCAT(%s, IF(c.i4785 <> '' AND LOCATE(':', c.i4785) > 0, %s, %s), %s) END"
        % (
            L(periksa("petitum menuntut putusan serta merta; pilih keputusan majelis pada isian keputusan putusan serta merta")),
            L("Menimbang, bahwa terhadap petitum putusan serta merta, #8554# merujuk Surat Edaran Mahkamah Agung Nomor 3 Tahun 2000 jo. Nomor 4 Tahun 2001 yang mensyaratkan antara lain gugatan didasarkan pada bukti otentik dan adanya jaminan yang nilainya sama dengan nilai objek eksekusi, "
              "sedangkan dalam perkara a quo syarat-syarat tersebut tidak terpenuhi, sehingga petitum tersebut patut ditolak;"),
            L("Menimbang, bahwa terhadap petitum putusan serta merta, #8554# merujuk Surat Edaran Mahkamah Agung Nomor 3 Tahun 2000 jo. Nomor 4 Tahun 2001 dan berpendapat syarat-syaratnya terpenuhi, yaitu "),
            alasan("c.i4785"),
            L(periksa("tulis alasan setelah titik dua pada isian keputusan putusan serta merta")),
            L(", sehingga petitum tersebut patut dikabulkan;"),
        )
    )


def p_lain_lengkap():
    return gabung(p_tidak_terbukti(), p_sita(), p_utang(), p_turut(), p_uang_paksa(), p_serta_merta())


# ------------------------------------------------------------------ amar
def terbilang_kecil(ekspresi_angka):
    return "ELT(%s, 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas', 'dua belas', 'tiga belas')" % ekspresi_angka


def amar_blok(mode):
    """(isi amar bernomor, ekspresi nomor butir biaya). Nomor dihitung dari butir aktif; rujukan 'diktum nomor' mengikuti.
    mode V: awal amar 'Menyatakan T tidak hadir' + 'dengan verstek'; K: kontradiktoir; KK: 'Dalam Konvensi' (bunyi blangko Konvensi Rekonvensi)."""
    base = 1
    items = []
    if mode == "V":
        items.append(("tdk", "1"))
    items.append(("kab", "1"))
    items.append(("sita", "IF(c.tsita = 1 AND (c.dsita = 'A'%s), 1, 0)" % (" OR c.dsita = 'K'" if mode == "KK" else "")))
    items.append(("objek", "1"))
    items.append(("bagian", "1"))
    items.append(("utang", "IF(c.i4786 <> '', 1, 0)"))
    items.append(("serah", "1"))
    items.append(("turut", "IF(c.ttt = 1, 1, 0)"))
    items.append(("uang", "IF(c.tuang = 1 AND c.duang = 'A', 1, 0)"))
    items.append(("serta", "IF(c.tserta = 1 AND c.dserta = 'A', 1, 0)"))
    items.append(("tolak", "IF(c.sebagian = 1, 1, 0)"))
    kode = [k for k, _ in items]
    flag = dict(items)

    def nomor(k):
        i = kode.index(k)
        antar = " + ".join(flag[j] for j in kode[:i]) or "0"
        return "(%d + %s)" % (base, antar)

    def n(k):
        return "CAST(%s AS CHAR)" % nomor(k)

    def nk(k):
        """Nomor dengan terbilang: '3 (tiga)' (bunyi Konvensi Rekonvensi)."""
        return "CONCAT(CAST(%s AS CHAR), ' (', %s, ')')" % (nomor(k), terbilang_kecil(nomor(k)))

    objek_isi = isi("i8730", 8730)
    teks = {}
    teks["tdk"] = L("Menyatakan #7037# yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;")
    akhir_kab = L(" dengan verstek;") if mode == "V" else L(";")
    teks["kab"] = "CONCAT(%s, IF(c.sebagian = 1, %s, ''), %s)" % (L("Mengabulkan #0053# #0046#"), L(" untuk sebagian"), akhir_kab)
    teks["sita"] = (
        "CONCAT(%s, IF(c.pet REGEXP 'marital', %s, %s), IF(c.sela > 0, CONCAT(%s, '#0218#'), ''), %s)"
        % (L("Menyatakan sah dan berharga "), L("sita marital (maritale beslag)"), L("sita jaminan (conservatoir beslag)"), L(" berdasarkan Putusan Sela tanggal "), L(" yang telah diletakkan atas objek sengketa;"))
    )
    if mode == "KK":
        teks["objek"] = "CONCAT(%s, %s, %s)" % (L("Menetapkan harta berupa: "), objek_isi, L(" adalah harta bersama #0046# dan #0047# yang belum dibagi;"))
        teks["bagian"] = (
            "IF(c.bag_belum = 1, %s, IF(c.bag_setengah = 1, CONCAT(%s, %s, %s), CONCAT(%s, %s, %s, c.bag_stmt, %s)))"
            % (
                L(periksa("isi keputusan bagian harta bersama")),
                L("Menetapkan #0046# dan #0047# masing-masing berhak mendapat seperdua (1/2) bagian dari harta bersama sebagaimana tersebut pada diktum angka "),
                nk("objek"),
                L(";"),
                L("Menetapkan bagian #0046# dan #0047# atas harta bersama sebagaimana tersebut pada diktum angka "),
                nk("objek"),
                L(", yaitu "),
                L(";"),
            )
        )
        teks["serah"] = (
            "CONCAT(%s, %s, %s, %s, %s)"
            % (
                L("Menghukum #0046# dan #0047# atau siapa saja yang menguasai harta bersama sebagaimana tersebut pada diktum angka "),
                nk("objek"),
                L(" untuk menyerahkannya dalam keadaan kosong dan tanpa beban apa pun, kemudian membaginya kepada #0046# dan #0047# sesuai bagian masing-masing sebagaimana diktum angka "),
                nk("bagian"),
                L(", dan apabila tidak dapat dibagi secara natura, maka dijual lelang melalui kantor lelang negara dan hasilnya dibagi sesuai bagian masing-masing;"),
            )
        )
        teks["tolak"] = L("Menolak gugatan #0046# selain dan selebihnya;")
    else:
        teks["objek"] = "CONCAT(%s, %s, %s)" % (L("Menetapkan harta-harta sebagai berikut: "), objek_isi, L(" adalah harta bersama #0046# dan #7037# yang belum terbagi;"))
        teks["bagian"] = (
            "IF(c.bag_belum = 1, %s, IF(c.bag_setengah = 1, CONCAT(%s, %s, %s), CONCAT(%s, %s, %s, c.bag_stmt, %s)))"
            % (
                L(periksa("isi keputusan bagian harta bersama")),
                L("Menetapkan #0046# dan #7037# masing-masing berhak 1/2 (seperdua) dari harta bersama sebagaimana disebutkan pada diktum putusan nomor "),
                n("objek"),
                L(";"),
                L("Menetapkan bagian #0046# dan #7037# atas harta bersama sebagaimana disebutkan pada diktum putusan nomor "),
                n("objek"),
                L(", yaitu "),
                L(";"),
            )
        )
        teks["serah"] = (
            "CONCAT(%s, %s, %s)"
            % (
                L("Menghukum #0046# atau #7037# atau siapapun yang menguasai obyek harta bersama pada diktum putusan nomor "),
                n("objek"),
                L(" di atas untuk menyerahkannya kepada #0046# dan #7037# dalam keadaan kosong dan membaginya sesuai bagian harta bersama masing-masing serta apabila tidak dapat dibagi secara natura, maka dibagi secara lelang melalui kantor lelang negara;"),
            )
        )
        teks["tolak"] = L("Menolak #0053# #0046# selain dan selebihnya;")
    teks["utang"] = "CONCAT(%s, c.i4786, %s)" % (L("Menetapkan utang bersama berupa: "), L(" dilunasi lebih dahulu dari harta bersama sebelum harta bersama dibagi;"))
    teks["turut"] = "CONCAT(%s, IF(c.ntt > 1, 'Para Turut', 'Turut'), %s)" % (L("Menghukum "), L(" #0047# untuk tunduk dan patuh pada putusan ini;"))
    teks["uang"] = (
        "CONCAT(%s, IF(LOCATE(':', c.i4784) > 0, %s, %s), %s)"
        % (L("Menghukum #7037# untuk membayar uang paksa (dwangsom) sejumlah "), alasan("c.i4784"), L(periksa("jumlah uang paksa")), L(" setiap hari lalai menjalankan isi putusan ini;"))
    )
    teks["serta"] = L("Menyatakan putusan ini dapat dijalankan lebih dahulu (uitvoerbaar bij voorraad) meskipun ada upaya hukum;")

    bagian = []
    for k in kode:
        bagian.append("IF(%s = 1, CONCAT(%s, %s, %s), NULL)" % (flag[k], n(k), L(".   "), teks[k]))
    isi_amar = "CONCAT_WS('<br>', %s)" % ", ".join(bagian)
    total = " + ".join(flag[k] for k in kode)
    nomor_biaya = "CAST(%d + %s AS CHAR)" % (base, total)
    return isi_amar, nomor_biaya


def amar_variabel(mode):
    isi, _ = amar_blok(mode)
    # penjaga: butir 'tolak' hanya bila sebagian
    return "SELECT IF(IFNULL(t.d, '') = '', '', CONCAT(t.d, '{}')) AS data FROM (SELECT %s AS d FROM %s) t" % (isi, ctx(mode))


def nomor_variabel(mode):
    _, nb = amar_blok(mode)
    return "SELECT %s AS data FROM %s" % (nb, ctx(mode))


# ------------------------------------------------------------------ per objek (isian 4787) dan analisis bukti
from buktikit import baris_ke_kalimat, analisis_bukti


def _medan():
    nf = "(LENGTH(b.t) - LENGTH(REPLACE(b.t, '|', '')) + 1)"
    objek = "TRIM(SUBSTRING_INDEX(b.t, '|', 1))"
    pos = "IF(%s >= 2, TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(b.t, '|', 2), '|', -1)), '')" % nf
    sikap = "IF(%s >= 3, LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(b.t, '|', 3), '|', -1))), '')" % nf
    ket = "IF(%s >= 4, TRIM(SUBSTRING_INDEX(b.t, '|', -1)), '')" % nf
    kelas = "CASE WHEN %s REGEXP 'klausul' THEN 'K' WHEN %s REGEXP 'bantah|sangkal|tolak|tidak diakui|membantah' THEN 'B' WHEN %s REGEXP 'akui|benar|setuju|murni' THEN 'A' ELSE '?' END" % (sikap, sikap, sikap)
    return objek, pos, ket, kelas


def jawab_per_objek():
    objek, pos, ket, kelas = _medan()
    psi = "IF(%s <> '', CONCAT(' (posita ', %s, ')'), '')" % (pos, pos)
    awal = lit("-   Bahwa terhadap objek ")
    ekspr = (
        "CASE %s "
        "WHEN 'A' THEN CONCAT(%s, %s, %s, %s) "
        "WHEN 'K' THEN CONCAT(%s, %s, %s, %s, IF(%s <> '', %s, %s), %s) "
        "WHEN 'B' THEN CONCAT(%s, %s, %s, %s, IF(%s <> '', %s, %s), ';') "
        "ELSE CONCAT(%s, %s, %s) END"
        % (
            kelas,
            awal, objek, psi, lit(", #0047# mengakui bahwa objek tersebut diperoleh selama perkawinan #0046# dan #0047#, sehingga merupakan pengakuan murni yang mempunyai kekuatan pembuktian sempurna dan mengikat (vide Pasal 311 RBg jo. Pasal 1925 Kitab Undang-Undang Hukum Perdata);"),
            awal, objek, psi, lit(", #0047# mengakui objek tersebut dengan keterangan tambahan bahwa "), ket, ket, lit(periksa("tulis klausul pengakuan Tergugat")), lit(", sehingga merupakan pengakuan berklausul yang tidak dapat dipisah-pisahkan dan masih harus dibuktikan lebih lanjut (vide Pasal 313 RBg jo. Pasal 1924 Kitab Undang-Undang Hukum Perdata);"),
            awal, objek, psi, lit(", #0047# membantah dengan alasan "), ket, ket, lit(periksa("tulis alasan bantahan Tergugat")),
            lit("-   "), lit(periksa("tulis sikap Tergugat atas objek ")), objek,
        )
    )
    luar, gabung_l = baris_ke_kalimat(4787, ekspr)
    isi = "IF(p.jml = 0, %s, CONCAT_WS('<br>', %s))" % (lit(periksa("isi rincian sikap Tergugat per objek pada isian harta bersama: sikap Tergugat per objek")), gabung_l)
    return "SELECT CONCAT(%s, '{}') AS data FROM (%s) p" % (isi, luar)


def beban_per_objek():
    objek, pos, ket, kelas = _medan()
    psi = "IF(%s <> '', CONCAT(' (posita ', %s, ')'), '')" % (pos, pos)
    ekspr = (
        "IF(%s IN ('K', 'B', '?'), CONCAT(%s, %s, %s, %s), NULL)"
        % (kelas, lit("-   Apakah objek "), objek, psi, lit(" diperoleh selama masa perkawinan #0046# dan #0047# dan bukan merupakan harta bawaan, hadiah atau warisan salah satu pihak?"))
    )
    luar, gabung_l = baris_ke_kalimat(4787, ekspr)
    isi = "IF(p.jml = 0, %s, IF(CONCAT_WS('<br>', %s) = '', %s, CONCAT_WS('<br>', %s)))" % (
        lit(periksa("isi rincian sikap Tergugat per objek pada isian harta bersama: beban pembuktian per objek")),
        gabung_l,
        lit("-   Tidak ada dalil yang perlu dibuktikan lebih lanjut karena seluruh objek diakui secara murni oleh #0047#"),
        gabung_l,
    )
    return "SELECT CONCAT(%s, '{}') AS data FROM (%s) p" % (isi, luar)


KELAS_BUKTI = [
    (1, ["kartu tanda penduduk", "ktp"]),
    (2, ["kartu keluarga"]),
    (3, ["akta nikah", "buku nikah", "kutipan akta nikah"]),
    (4, ["akta cerai", "putusan"]),
    (8, ["foto ", "foto-", "foto,", "tangkapan layar", "screenshot", "video", "rekaman"]),
    (6, ["bpkb", "stnk", "kendaraan", "faktur"]),
    (5, ["sertifikat", "sertipikat", "hak milik", "hak guna", "akta jual beli", "ajb", "girik", "sppt", "pbb", "imb", "sporadik", "tanah", "rumah"]),
    (7, ["rekening", "tabungan", "deposito", "slip gaji", "kwitansi", "kuitansi", "kuintansi", "surat utang", "perjanjian kredit", "bank"]),
]
AKTA = "telah bermeterai cukup, di-nazegelen, dan cocok dengan aslinya, "
KUAT = "merupakan akta otentik yang mempunyai kekuatan pembuktian sempurna dan mengikat (volledig bidende bewijskracht) sesuai Pasal 285 RBg jo. Pasal 1868 Kitab Undang-Undang Hukum Perdata"
KALIMAT_BUKTI = {
    1: "bukti {L} (Kartu Tanda Penduduk) " + AKTA + KUAT + ", yang membuktikan identitas dan tempat tinggal para pihak",
    2: "bukti {L} (Kartu Keluarga) " + AKTA + KUAT + ", yang membuktikan susunan keluarga dan tempat tinggal para pihak",
    3: "bukti {L} (Kutipan Akta Nikah) " + AKTA + KUAT + ", yang membuktikan adanya perkawinan yang sah antara #0046# dan #0047# sehingga masa perkawinan dihitung sejak tanggal perkawinan tersebut",
    4: "bukti {L} (akta cerai atau putusan perceraian) " + AKTA + KUAT + ", yang membuktikan bahwa perkawinan #0046# dan #0047# telah putus karena perceraian yang berkekuatan hukum tetap, sehingga harta bersama dapat dibagi sesuai Pasal 37 Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 97 Kompilasi Hukum Islam",
    5: "bukti {L} (surat-surat hak atas tanah dan bangunan) " + AKTA + "yang membuktikan nama yang tercatat sebagai pemegang hak, letak, luas dan waktu perolehan objek; nama yang tercatat dalam bukti tersebut tidak menentukan status objek sebagai harta bersama, sebab status harta ditentukan oleh waktu dan cara perolehannya sebagaimana Pasal 35 ayat (1) Undang-Undang Nomor 1 Tahun 1974, sehingga bukti tersebut dinilai bersama keterangan saksi dan alat bukti lainnya",
    6: "bukti {L} (surat-surat kendaraan bermotor) " + AKTA + "yang membuktikan identitas kendaraan dan nama yang tercatat; nama yang tercatat dalam bukti tersebut tidak menentukan status kendaraan sebagai harta bersama, sebab status harta ditentukan oleh waktu dan cara perolehannya sebagaimana Pasal 35 ayat (1) Undang-Undang Nomor 1 Tahun 1974, sehingga bukti tersebut dinilai bersama keterangan saksi dan alat bukti lainnya",
    7: "bukti {L} (surat-surat keuangan, perbankan atau tanda pembayaran) " + AKTA + "yang merupakan surat di bawah tangan atau bukti dari lembaga keuangan, kekuatan pembuktiannya bergantung pada pengakuan pihak lawan dan persesuaiannya dengan alat bukti lain sebagaimana Pasal 288 RBg, serta relevan dengan dalil perolehan dan nilai objek",
    8: "bukti {L} (foto, tangkapan layar atau rekaman) merupakan bukti elektronik yang sah sepanjang memenuhi syarat formil dan materiil sebagaimana Pasal 5 dan Pasal 6 Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik sebagaimana telah diubah terakhir dengan Undang-Undang Nomor 1 Tahun 2024, sehingga nilai pembuktiannya dipertimbangkan bersama alat bukti lainnya",
    99: "bukti {L} " + AKTA + "serta relevan dengan dalil yang hendak dibuktikan oleh #0046# dan #0047#",
}


def analisis_p():
    return analisis_bukti(9955, KELAS_BUKTI, KALIMAT_BUKTI, "P.", br=True)


def analisis_t():
    return analisis_bukti(9911, KELAS_BUKTI, KALIMAT_BUKTI, "T.", br=True)



def fakta_tidak_terbukti(kata="harta bersama #0046# dan #0047#", isian=4781):
    luar, gabung_l = baris_ke_kalimat(isian, "CONCAT(%s, b.t, %s)" % (lit("-   Bahwa objek "), lit(" tidak terbukti sebagai %s;" % kata)))
    return "SELECT IF(IFNULL(CONCAT_WS('<br>', %s), '') = '', '', CONCAT('<br>', CONCAT_WS('<br>', %s), '{}')) AS data FROM (%s) p" % (gabung_l, gabung_l, luar)


def opsional(kueri):
    """Blok opsional: bila ada isinya diawali <br> (disambung ke ujung paragraf di depannya), bila kosong tidak meninggalkan baris kosong."""
    assert "CONCAT(t.d, '{}')" in kueri
    return kueri.replace("CONCAT(t.d, '{}')", "CONCAT('<br>', t.d, '{}')")


def dengan_judul(judul, ekspresi):
    return "IF(%s = '', '', CONCAT(%s, '<strong>%s</strong><br>', %s))" % (ekspresi, "", judul, ekspresi)


def semua_kk():
    return {
        4809: ("HARTA BERSAMA: FAKTA OBJEK YANG TIDAK TERBUKTI (OTOMATIS dari isian 4781: satu butir per objek; kosong bila semua objek terbukti)", fakta_tidak_terbukti()),
    }


def semua():
    from sqlkit import isi_mentah  # noqa: F401
    V = []

    def teks(no, nama, default=None):
        V.append(dict(no=no, nama=nama, tipe="data_teks", sql=None, default=default))

    def sql(no, nama, kueri):
        V.append(dict(no=no, nama=nama, tipe="data_sql", sql=kueri, default=None))

    teks(4780, "HARTA BERSAMA: KEPUTUSAN ATAS PENETAPAN DAN PEMBAGIAN - PILIH: dikabulkan seluruhnya / sebagian; kosong = seluruhnya bila semua objek terbukti (blangko Konvensi Rekonvensi: sebagian)")
    teks(4781, "HARTA BERSAMA: OBJEK YANG TIDAK TERBUKTI SEBAGAI HARTA BERSAMA - ISIAN (satu per baris; kosong = semua objek terbukti)")
    teks(4782, "HARTA BERSAMA: KEPUTUSAN BAGIAN #4789# - kosong = seperdua (1/2) masing-masing; bila lain tulis bagian, titik dua, alasan (mis. Penggugat 3/4 dan Tergugat 1/4: alasan)")
    teks(4783, "HARTA BERSAMA: KEPUTUSAN SITA JAMINAN #4788# - PILIH: sah dan berharga / ditolak; alasan penolakan setelah titik dua")
    teks(4784, "HARTA BERSAMA: KEPUTUSAN UANG PAKSA #4790# - PILIH: ditolak / dikabulkan; bila dikabulkan tulis jumlah per hari setelah titik dua (dikabulkan: Rp100.000,00)")
    teks(4785, "HARTA BERSAMA: KEPUTUSAN PUTUSAN SERTA MERTA #4791# - PILIH: ditolak / dikabulkan; bila dikabulkan tulis alasan setelah titik dua")
    teks(4786, "HARTA BERSAMA: UTANG BERSAMA PARA PIHAK - ISIAN (utang selama perkawinan untuk kepentingan keluarga: kreditur dan jumlah; kosong = tidak ada)")
    teks(4787, "HARTA BERSAMA: SIKAP TERGUGAT PER OBJEK - ISIAN (satu per baris: objek | nomor posita | diakui / diakui berklausul / dibantah | klausul atau alasan)")

    sql(4788, "PEMICU: PETITUM MENUNTUT SITA JAMINAN (OTOMATIS dari petitum SIPP dan putusan sela sita; \"ya\" bila menuntut)", pemicu("tsita"))
    sql(4789, "PEMICU: PETITUM MENUNTUT BAGIAN SELAIN SEPERDUA (OTOMATIS dari petitum SIPP; \"ya\" bila menyebut pecahan atau persen selain seperdua)", pemicu("tbag"))
    sql(4790, "PEMICU: PETITUM MENUNTUT UANG PAKSA (OTOMATIS dari petitum SIPP; \"ya\" bila menuntut)", pemicu("tuang"))
    sql(4791, "PEMICU: PETITUM MENUNTUT PUTUSAN SERTA MERTA (OTOMATIS dari petitum SIPP; \"ya\" bila menuntut)", pemicu("tserta"))

    def bungkus_ctx(ekspresi, mode="K"):
        return "SELECT IF(IFNULL(t.d, '') = '', '', CONCAT(t.d, '{}')) AS data FROM (SELECT %s AS d FROM %s) t" % (ekspresi, ctx(mode))

    sql(4792, "HARTA BERSAMA: PERTIMBANGAN OBJEK YANG TIDAK TERBUKTI (OTOMATIS dari isian 4781; kosong bila semua objek terbukti)", bungkus_ctx(p_tidak_terbukti()))
    sql(4793, "HARTA BERSAMA: PERTIMBANGAN SITA JAMINAN (OTOMATIS dari petitum dan keputusan isian 4783; tuntutan terbaca tanpa keputusan = kalimat periksa)", bungkus_ctx(p_sita()))
    sql(4794, "HARTA BERSAMA: PERTIMBANGAN BAGIAN PARA PIHAK (OTOMATIS: seperdua menurut Pasal 97 KHI bila isian 4782 kosong; selain itu bagian dan alasan menurut isian)", bungkus_ctx(p_bagian()))
    sql(4795, "HARTA BERSAMA: PERTIMBANGAN UTANG BERSAMA (OTOMATIS dari isian 4786; Pasal 93 ayat (2) KHI)", bungkus_ctx(p_utang()))
    sql(4796, "HARTA BERSAMA: PERTIMBANGAN TURUT TERGUGAT (OTOMATIS: hanya bila petitum atau SIPP mencatat Turut Tergugat)", bungkus_ctx(p_turut()))
    sql(4797, "HARTA BERSAMA: PERTIMBANGAN UANG PAKSA (OTOMATIS dari petitum dan keputusan isian 4784)", bungkus_ctx(p_uang_paksa()))
    sql(4798, "HARTA BERSAMA: PERTIMBANGAN PUTUSAN SERTA MERTA (OTOMATIS dari petitum dan keputusan isian 4785)", bungkus_ctx(p_serta_merta()))
    sql(4799, "HARTA BERSAMA: PERTIMBANGAN TUNTUTAN LAIN LENGKAP (OTOMATIS: gabungan 4792, 4793, 4795, 4796, 4797 dan 4798 menurut petitum dan keputusan; kosong bila tidak ada)", opsional(bungkus_ctx(p_lain_lengkap())))
    sql(4800, "HARTA BERSAMA: AMAR PUTUSAN VERSTEK (OTOMATIS: dari tuntutan dan keputusan isian 4780 s.d. 4786; satu baris bernomor per butir)", amar_variabel("V"))
    sql(4801, "HARTA BERSAMA: NOMOR BUTIR AMAR BIAYA PERKARA PADA PUTUSAN VERSTEK (OTOMATIS: nomor sesudah butir amar 4800)", nomor_variabel("V"))
    sql(4802, "HARTA BERSAMA: AMAR PUTUSAN KONTRADIKTOIR (OTOMATIS: dari tuntutan dan keputusan isian 4780 s.d. 4786; satu baris bernomor per butir)", amar_variabel("K"))
    sql(4803, "HARTA BERSAMA: NOMOR BUTIR AMAR BIAYA PERKARA PADA PUTUSAN KONTRADIKTOIR (OTOMATIS: nomor sesudah butir amar 4802)", nomor_variabel("K"))
    sql(4804, "HARTA BERSAMA: AMAR DALAM KONVENSI (OTOMATIS: dari tuntutan dan keputusan isian 4780 s.d. 4786; sita jaminan dianggap ada pada blangko Konvensi Rekonvensi Sita)", amar_variabel("KK"))
    def bungkus_kk(ekspresi):
        return "SELECT IF(IFNULL(t.d, '') = '', '', CONCAT(t.d, '{}')) AS data FROM (SELECT %s AS d FROM %s) t" % (ekspresi, ctx("KK"))

    sql(4809, "HARTA BERSAMA: FAKTA OBJEK YANG TIDAK TERBUKTI (OTOMATIS dari isian 4781: satu butir per objek; kosong bila semua objek terbukti)", fakta_tidak_terbukti())
    sql(4810, "HARTA BERSAMA: PERTIMBANGAN PETITUM UANG PAKSA DENGAN JUDUL (OTOMATIS: hanya bila petitum menuntut uang paksa; untuk blangko Konvensi Rekonvensi)",
        opsional(bungkus_kk("IF(%s = '', '', CONCAT('<strong>Tentang Petitum Uang Paksa (Dwangsom)</strong><br>', %s))" % (p_uang_paksa(), p_uang_paksa()))))
    sql(4811, "HARTA BERSAMA: PERTIMBANGAN PETITUM SERTA MERTA DENGAN JUDUL (OTOMATIS: hanya bila petitum menuntut putusan serta merta; untuk blangko Konvensi Rekonvensi)",
        opsional(bungkus_kk("IF(%s = '', '', CONCAT('<strong>Tentang Petitum Putusan Serta Merta (Uitvoerbaar bij Voorraad)</strong><br>', %s))" % (p_serta_merta(), p_serta_merta()))))
    sql(4812, "HARTA BERSAMA: PERTIMBANGAN LAIN PADA KONVENSI (OTOMATIS: objek tidak terbukti, utang bersama, Turut Tergugat; untuk blangko Konvensi Rekonvensi)",
        opsional(bungkus_kk(gabung(p_tidak_terbukti(), p_utang(), p_turut()))))
    sql(4813, "HARTA BERSAMA: PERTIMBANGAN BAGIAN PARA PIHAK PADA KONVENSI (OTOMATIS: seperdua menurut bunyi blangko Konvensi Rekonvensi bila isian 4782 kosong)", bungkus_kk(p_bagian("KK")))
    sql(4814, "HARTA BERSAMA: PERTIMBANGAN SITA JAMINAN PADA KONVENSI (OTOMATIS: sah dan berharga bila isian 4783 kosong atau sah; ditolak bila dipilih)", bungkus_kk(p_sita("KK")))
    sql(4805, "HARTA BERSAMA: JAWAB-MENJAWAB PER OBJEK (OTOMATIS dari isian 4787: satu butir per objek, diakui murni / berklausul / dibantah)", jawab_per_objek())
    sql(4806, "HARTA BERSAMA: BEBAN PEMBUKTIAN PER OBJEK (OTOMATIS dari isian 4787: objek yang dibantah atau diakui berklausul)", beban_per_objek())
    sql(4807, "HARTA BERSAMA: ANALISIS BUKTI SURAT PENGGUGAT (OTOMATIS dari daftar bukti surat: dikelompokkan menurut jenis surat; daftar kosong = kosong)", analisis_p())
    sql(4808, "HARTA BERSAMA: ANALISIS BUKTI SURAT TERGUGAT (OTOMATIS dari daftar bukti surat Tergugat: dikelompokkan menurut jenis surat; daftar kosong = kosong)", analisis_t())
    return V


if __name__ == "__main__":
    for v in semua():
        print(v["no"], v["tipe"], len(v["sql"] or ""))
