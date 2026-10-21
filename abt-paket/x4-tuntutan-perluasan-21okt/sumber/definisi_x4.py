# -*- coding: utf-8 -*-
"""Definisi isi paket x4-tuntutan-perluasan-21okt (21 Okt 2026): isian dan isi putusan mengikuti tuntutan posita/petitum
untuk SEMUA kelompok blangko Derry selain cerai biasa (yang sudah oleh x3).

Kelompok:
  1. Hak Bekas Istri (jenis 351, 3760-3779): pola petitum 3764 (daftar hak yang dituntut) tidak lagi menyala atas nama pihak /
     alamat KUA "tempat tinggal" / "biaya pakaian" anak; isian PILIH yang tersimpan sebagai DAFTAR pilihan bawaan dianggap kosong;
     pemicu baru 3401-3408 (satu per hak) dengan pola yang SAMA PERSIS dengan 3764 untuk layar Blangko Derry.
  2. Varian cerai (u2): bawaan DAFTAR pilihan keputusan 4100-4105 / waktu bayar 4109 yang tersimpan lewat jendela ABT lama tidak
     lagi dibaca sebagai "tidak dapat diterima" / "tidak disyaratkan" (25 variabel u2); bagian akibat cerai yang BELUM tercetak pada
     varian (Mut'ah Iddah, [01a] CT ex officio, CG kumulasi nafkah istri, folder 1d kumulasi hak asuh, CG [01a] qabla dukhul) =
     variabel baru 3410-3421 dari penyusun paket u2 yang sama (tanpa menggandakan iddah/mut'ah/hak asuh/nafkah anak yang sudah
     ditulis tetap di varian itu) + tambalan RTF (sumber/rtf_def.py).
  3. Kebendaan (4788-4847): pola sita (Rosita, Masita, "posita"), utang, jaminan ("sita jaminan" bukan agunan), batal (Batalipu)
     berdiri sendiri; pemicu baru 3440 utang bersama.
  4. Anak: pemicu tuntutan tambahan baru 3430-3435 (penyerahan anak, kenaikan nafkah, biaya pendidikan/kesehatan, pemotongan
     penghasilan, nafkah lampau anak, sita jaminan nafkah anak) untuk layar Blangko Derry (bagian otomatisnya sudah bersyarat isian).

Semua teks ASCII, tanpa kata nama aplikasi. Hanya SELECT. Pola: sumber/pola_x4.py (satu sumber, diukur alat/ukur_pola.py)."""
import os
import sys

AKAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AKAR)
sys.path.insert(0, os.path.join(AKAR, '..', '..', 'u2-putusan-cerai-lengkap', 'sumber'))
import importlib.util  # noqa: E402
import pola_x4 as P  # noqa: E402
import susun_variabel as U2  # noqa: E402  (penyusun paket u2, tidak diubah)

_s = importlib.util.spec_from_file_location('x3_def', os.path.join(AKAR, '..', '..', 'x3-tuntutan-sinkron-21okt', 'sumber', 'variabel_def.py'))
X3 = importlib.util.module_from_spec(_s)
_s.loader.exec_module(X3)  # pola paket x3 (tidak diubah)

MODIFIER = 'admin'
MODIFIED = '2026-10-21 00:00:00'


def ganti(s, lama, baru, n=1):
    c = s.count(lama)
    assert c == n or (n == 0 and c > 0), ('potongan tidak tepat', lama[:70], c, n)
    return s.replace(lama, baru)


# =====================================================================================================================
# Kelompok 2a: penjaga DAFTAR pilihan bawaan pada isian keputusan u2 (dipakai untuk UBAH 25 variabel u2 DAN variabel baru 3410-3421)
# Jendela ABT lama mengisi kotak isian dengan default_data (5 pilihan berbaris) dan menyimpannya bila petugas menekan Simpan tanpa
# memilih. Tanpa penjaga: 'tidak dapat diterima' (pilihan ke-4) dicocokkan lebih dulu -> putusan mencetak "tuntutan ... tidak dapat
# diterima" untuk tuntutan yang tidak diminta; waktu bayar 4109 berbaris -> 'tidak disyaratkan'.
# =====================================================================================================================
KOL_KEP = ['r_h', 'r_n', 'r_i', 'r_m', 'r_d', 'r_b']


def jaga_daftar(s):
    for k in KOL_KEP:
        s = ganti(s, "CASE WHEN LOWER(TRIM(w.%s))='' THEN 'K'" % k,
                  "CASE WHEN LOWER(TRIM(w.%s))='' OR LOWER(w.%s) LIKE '%%seluruhnya%%sebagian%%' THEN 'K'" % (k, k), n=0)  # varian paksa: 2x
    s = ganti(s, "IF(w.r_byr <> '', LOWER(w.r_byr),", "IF(w.r_byr <> '' AND LOWER(w.r_byr) NOT LIKE '%ikrar%akta cerai%', LOWER(w.r_byr),")
    return s


def pola_x3(s):
    """Pola pembaca petitum paket x3 (nafkah iddah, mut'ah, madliyah) - variabel baru harus sama dengan 4140-4145 sesudah x3."""
    for lama, baru in X3.RX:
        s = ganti(s, lama, baru)
    return s


def ubah_u2(b):
    s = b.decode('latin1')
    assert s.count(X3.RX[0][1]) == 1, 'variabel u2 belum berisi pola x3 (pasang x3 dulu)'
    return jaga_daftar(s).encode('latin1')


NO_U2 = list(range(4110, 4120)) + list(range(4130, 4135)) + [4138, 4139] + list(range(4140, 4147)) + [4150]

# =====================================================================================================================
# Kelompok 1: Hak Bekas Istri 3760-3779
# =====================================================================================================================
HBI_PET = "LOWER(IFNULL((SELECT petitum FROM perkara WHERE perkara_id = '#perkara_id#'), ''))"
HBI_FLAG = ['pi', 'pk', 'ps', 'pt', 'pm', 'ph', 'pa']
# isian PILIH hak bekas istri yang default_data-nya berbaris (cara putus, masa iddah, keadaan iddah, dukhul, nusyuz, ne bis in idem, waktu bayar)
HBI_PILIH = [3741, 3743, 3744, 3745, 3746, 3747, 3756]
SUB = "(SELECT data FROM aps_badilag.abt_data_teks WHERE no_var = %d AND perkara_id = '#perkara_id#' LIMIT 1)"
SUB_JAGA = "(SELECT IF(LOCATE(CHAR(10), data) > 0, NULL, data) FROM aps_badilag.abt_data_teks WHERE no_var = %d AND perkara_id = '#perkara_id#' LIMIT 1)"


def ubah_hbi(b):
    s = b.decode('latin1')
    for f in HBI_FLAG:
        s = ganti(s, "%s REGEXP '%s', 1, 0) AS %s" % (HBI_PET, P.HBI_LAMA[f], f), "%s REGEXP '%s', 1, 0) AS %s" % (HBI_PET, P.HBI_BARU[f], f))
    for no in HBI_PILIH:
        s = ganti(s, SUB % no, SUB_JAGA % no)
    return s.encode('latin1')


NO_HBI = list(range(3760, 3780))

# =====================================================================================================================
# Kelompok 3: kebendaan 4788-4847
# =====================================================================================================================


def ubah_keb(b):
    s = b.decode('latin1')
    for f in ('tsita', 'tutang', 'tjam', 'tbat'):
        lama = "REGEXP '%s'" % P.KEB_LAMA[f]
        if lama in s:
            s = ganti(s, lama, "REGEXP '%s'" % P.KEB_BARU[f])
    return s.encode('latin1')


def no_keb(server):
    out = []
    for n in range(4780, 4860):
        v = server.get(n)
        if v and v['sql'] and any(("REGEXP '%s'" % P.KEB_LAMA[f]).encode('latin1') in v['sql'] for f in P.KEB_LAMA):
            out.append(n)
    return out


# =====================================================================================================================
# Variabel BARU
# =====================================================================================================================
BARU = []


def baru(no, nama, sql, butir, kelompok):
    BARU.append(dict(no=no, nama=nama, tipe='data_sql', tabel=None, kolom=None, urutan=None, sql=sql, default=None, butir=butir, kelompok=kelompok))


# ---- kelompok 1: pemicu hak bekas istri (pola = 3764 sesudah paket) --------------------------------------------------
HBI_PEMICU = [
    (3401, 'pi', 'NAFKAH IDDAH'), (3402, 'pk', 'MASKAN (TEMPAT TINGGAL) SELAMA IDDAH'), (3403, 'ps', 'KISWAH (PAKAIAN) SELAMA IDDAH'),
    (3404, 'pt', "MUT'AH"), (3405, 'pm', 'NAFKAH LAMPAU (MADLIYAH)'), (3406, 'ph', 'MAHAR YANG MASIH TERHUTANG'),
    (3407, 'pa', 'BIAYA HADHANAH ATAU NAFKAH ANAK'),
]
for no, f, nm in HBI_PEMICU:
    baru(no, 'PEMICU HAK BEKAS ISTRI: PETITUM MENUNTUT %s (OTOMATIS dari petitum SIPP; "ya" bila menuntut; pola sama dengan 3764)' % nm,
         "SELECT IF(%s REGEXP '%s', 'ya', '') AS data" % (HBI_PET, P.HBI_BARU[f]), 'pemicu layar ' + nm.lower(), 1)
baru(3408, 'PEMICU HAK BEKAS ISTRI: PETITUM MENUNTUT SITA JAMINAN (OTOMATIS dari petitum SIPP; "ya" bila menuntut sita)',
     "SELECT IF(%s REGEXP '%s', 'ya', '') AS data" % (HBI_PET, P.KEB_BARU['tsita']), 'pemicu layar sita jaminan hak bekas istri', 1)

# ---- kelompok 2: bagian akibat cerai yang belum tercetak pada varian ------------------------------------------------
T = U2


def amar_madliyah_saja():
    """Amar nafkah madliyah sendiri (varian yang iddah dan mut'ah-nya sudah tertulis tetap): sama dengan butir madliyah 4132."""
    m = U2.GABUNG(U2.lit('-   Nafkah madliyah '), U2.JIKA("c.ad_a <> ''", 'c.ad_a', U2.lit('[PERIKSA: isi nafkah madliyah]')))
    waktu = ("CASE WHEN c.byr REGEXP 'tidak' THEN '' WHEN c.byr REGEXP 'akta cerai' THEN CONCAT(' sebelum ', c.S, ' mengambil akta cerai') "
             "WHEN c.byr REGEXP 'ikrar' THEN CONCAT(' sesaat sebelum ', c.S, ' mengucapkan ikrar talak') ELSE '' END")
    garis = "CHAR(92, 108, 105, 110, 101, 32)"
    return ("CONCAT(IF(c.cd IN ('A','S'), CONCAT('Menghukum ', c.S, ' untuk membayar kepada ', c.I, " + waktu + ", ':', " + garis + ", " + m + ", ';<br>'), ''), "
            "IF(c.cd = 'N', 'Menyatakan tuntutan mengenai nafkah madliyah tidak dapat diterima;<br>', ''))")


def selebihnya(kol):
    kon = ' OR '.join("c.%s IN ('T','S')" % k for k in kol)
    return "IF((" + kon + "), CONCAT('Menolak #0053# ', c.I, ' selain dan selebihnya;<br>'), '')"


def akibat_bagian():
    """amar_akibat u2 dipecah menjadi dua paragraf (Menghukum...; Menyatakan ... tidak dapat diterima) untuk amar bernomor tetap."""
    a = U2.amar_akibat()
    k = a.index(", IF((c.ci = 'N' OR c.cm = 'N' OR c.cd = 'N')")
    return a[len('CONCAT('):k], a[k + 2:-1]


def sel(ekspr, paksa=False):
    return jaga_daftar(pola_x3(U2.SEL(ekspr, paksa=paksa, br=True)))


def bernomor(bagian, mulai):
    """Amar pada blangko yang nomor butirnya ditulis TETAP (bukan daftar otomatis Word): bagian (tiap bagian satu paragraf berakhir <br>
    atau kosong) diberi nomor mulai..; keluaran diakhiri nomor butir berikutnya + titik (diikuti \\tab #8505# di blangko). '.   ' (titik
    + 3 spasi) diubah ABT menjadi titik + TAB."""
    kol = ['p%d' % i for i in range(len(bagian))]
    dalam = 'SELECT ' + ', '.join('%s AS %s' % (b, k) for b, k in zip(bagian, kol)) + ' FROM ' + U2.tabel_turunan()
    isi = []
    for i, k in enumerate(kol):
        sebelum = ' + '.join(["(t.%s <> '')" % x for x in kol[:i]]) or '0'
        isi.append("IF(t.%s <> '', CONCAT(%d + %s, '.   ', t.%s), '')" % (k, mulai, sebelum, k))
    akhir = "CONCAT(%d + %s, '.')" % (mulai, ' + '.join(["(t.%s <> '')" % x for x in kol]))
    return jaga_daftar(pola_x3('SELECT CONCAT(%s, %s) AS data FROM (%s) t' % (', '.join(isi), akhir, dalam)))


P_H, P_N, P_I, P_M, P_D, P_B, P_W = (U2.pert_hadhanah(), U2.pert_nafkah_anak(), U2.pert_iddah(), U2.pert_mutah(), U2.pert_madliyah(),
                                     U2.pert_harta(), U2.pert_bayar())
A_H, A_N, A_K, A_B = U2.amar_hadhanah(), U2.amar_nafkah_anak(), U2.amar_akibat(), U2.amar_harta()
A_KM, A_KN = akibat_bagian()
SEL_HNDB = selebihnya(['ch', 'cn', 'cd', 'cb'])
SEL_SEMUA = U2.amar_selebihnya()

baru(3410, "PERTIMBANGAN AKIBAT CERAI LAIN PADA VARIAN MUT'AH IDDAH (OTOMATIS: hak asuh, nafkah anak, madliyah, harta bersama menurut petitum dan keputusan 4100, 4101, 4104, 4105)",
     sel(U2.GABUNG(P_H, P_N, P_D, P_B)), "pertimbangan tuntutan lain varian Mut'ah Iddah", 2)
baru(3411, "AMAR AKIBAT CERAI LAIN PADA VARIAN MUT'AH IDDAH (OTOMATIS: hak asuh, nafkah anak, harta bersama, menolak selebihnya; sesudah 4139)",
     sel(U2.GABUNG(A_H, A_N, A_B, SEL_SEMUA), paksa=True), "amar tuntutan lain varian Mut'ah Iddah", 2)
baru(3412, "PERTIMBANGAN AKIBAT CERAI LAIN PADA CT EX OFFICIO MUT'AH IDDAH NAFKAH ANAK (OTOMATIS: hak asuh, madliyah, harta bersama menurut petitum dan keputusan)",
     sel(U2.GABUNG(P_H, P_D, P_B)), 'pertimbangan tuntutan lain CT [01a] ex officio', 2)
baru(3413, "AMAR AKIBAT CERAI LAIN PADA CT EX OFFICIO MUT'AH IDDAH NAFKAH ANAK (OTOMATIS: hak asuh, madliyah, harta bersama, menolak selebihnya)",
     sel(U2.GABUNG(A_H, amar_madliyah_saja(), A_B, SEL_HNDB), paksa=True), 'amar tuntutan lain CT [01a] ex officio', 2)
baru(3414, 'PERTIMBANGAN AKIBAT CERAI LAIN PADA CG KUMULASI NAFKAH ISTRI (OTOMATIS: hak asuh, nafkah anak, harta bersama menurut petitum dan keputusan)',
     sel(U2.GABUNG(P_H, P_N, P_B)), 'pertimbangan tuntutan lain CG kumulasi nafkah istri', 2)
baru(3415, 'AMAR AKIBAT CERAI LAIN PADA CG KUMULASI NAFKAH ISTRI (OTOMATIS: hak asuh, nafkah anak, harta bersama, menolak selebihnya)',
     sel(U2.GABUNG(A_H, A_N, A_B, selebihnya(['ch', 'cn', 'cb']))), 'amar tuntutan lain CG kumulasi nafkah istri', 2)
baru(3416, "PERTIMBANGAN AKIBAT CERAI LAIN PADA CG KUMULASI HAK ASUH (OTOMATIS: nafkah anak, iddah, mut'ah, madliyah, harta bersama, waktu bayar)",
     sel(U2.GABUNG(P_N, P_I, P_M, P_D, P_B, P_W)), 'pertimbangan tuntutan lain 1d hak asuh', 2)
baru(3417, "AMAR AKIBAT CERAI LAIN PADA CG KUMULASI HAK ASUH (OTOMATIS: nafkah anak, nafkah istri, harta bersama, menolak selebihnya; daftar bernomor otomatis)",
     sel(U2.GABUNG(A_N, A_K, A_B, selebihnya(['cn', 'ci', 'cm', 'cd', 'cb']))), 'amar tuntutan lain 1d hak asuh (daftar otomatis)', 2)
baru(3418, "PERTIMBANGAN AKIBAT CERAI LAIN PADA CG KUMULASI HAK ASUH DAN NAFKAH ANAK (OTOMATIS: iddah, mut'ah, madliyah, harta bersama, waktu bayar)",
     sel(U2.GABUNG(P_I, P_M, P_D, P_B, P_W)), 'pertimbangan tuntutan lain 1d hak asuh + nafkah anak', 2)
baru(3419, 'AMAR AKIBAT CERAI LAIN PADA CG KUMULASI HAK ASUH DAN NAFKAH ANAK (OTOMATIS: nafkah istri, harta bersama, menolak selebihnya; daftar bernomor otomatis)',
     sel(U2.GABUNG(A_K, A_B, selebihnya(['ci', 'cm', 'cd', 'cb']))), 'amar tuntutan lain 1d hak asuh + nafkah anak (daftar otomatis)', 2)
baru(3420, 'AMAR AKIBAT CERAI LAIN PADA CG KUMULASI HAK ASUH, NOMOR TETAP MULAI 4 (OTOMATIS: butir bernomor; diakhiri nomor butir biaya perkara)',
     bernomor([A_N, A_KM, A_KN, A_B, selebihnya(['cn', 'ci', 'cm', 'cd', 'cb'])], 4), 'amar tuntutan lain 1d hak asuh (nomor tetap 4)', 2)
baru(3421, 'AMAR AKIBAT CERAI LAIN PADA CG KUMULASI HAK ASUH DAN NAFKAH ANAK, NOMOR TETAP MULAI 5 (OTOMATIS: butir bernomor; diakhiri nomor butir biaya perkara)',
     bernomor([A_KM, A_KN, A_B, selebihnya(['ci', 'cm', 'cd', 'cb'])], 5), 'amar tuntutan lain 1d hak asuh + nafkah anak (nomor tetap 5)', 2)

# ---- kelompok 4: pemicu tuntutan tambahan perkara anak -------------------------------------------------------------------
ANAK_PEMICU = [
    (3430, 'penyerahan', 'PENYERAHAN ANAK KEPADA PEMEGANG HADHANAH'), (3431, 'kenaikan', 'KENAIKAN NAFKAH ANAK SETIAP TAHUN'),
    (3432, 'pendidikan', 'BIAYA PENDIDIKAN DAN KESEHATAN ANAK'), (3433, 'pemotongan', 'PEMOTONGAN LANGSUNG PENGHASILAN'),
    (3434, 'lampau', 'NAFKAH LAMPAU ANAK'), (3435, 'sita', 'SITA JAMINAN NAFKAH ANAK'),
]
for no, f, nm in ANAK_PEMICU:
    baru(no, 'PEMICU ANAK: PETITUM MENUNTUT %s (OTOMATIS dari petitum dan rekonvensi SIPP; "ya" bila menuntut)' % nm,
         "SELECT IF(%s REGEXP '%s', 'ya', '') AS data FROM perkara p WHERE p.perkara_id = '#perkara_id#'" % (U2.PET, P.ANAK[f]), 'pemicu layar ' + nm.lower(), 4)

# ---- kelompok 5: pemicu kelalaian kewajiban suami/istri (jenis 345, gelombang 3) ---------------------------------------
KEL_PEMICU = [
    (3441, 'nafkah', 'NAFKAH'), (3442, 'lampau', 'NAFKAH LAMPAU (MADLIYAH)'), (3443, 'kiswah', 'KISWAH (PAKAIAN)'),
    (3444, 'kediaman', 'TEMPAT KEDIAMAN'), (3445, 'biaya', 'BIAYA RUMAH TANGGA, PERAWATAN ATAU PENGOBATAN'),
    (3446, 'pemotongan', 'PEMOTONGAN LANGSUNG PENGHASILAN'), (3447, 'sita', 'SITA JAMINAN'), (3448, 'paksa', 'UANG PAKSA (DWANGSOM)'),
]
for no, f, nm in KEL_PEMICU:
    baru(no, 'PEMICU KELALAIAN KEWAJIBAN: PETITUM MENUNTUT %s (OTOMATIS dari petitum dan rekonvensi SIPP; "ya" bila menuntut)' % nm,
         "SELECT IF(%s REGEXP '%s', 'ya', '') AS data FROM perkara p WHERE p.perkara_id = '#perkara_id#'" % (U2.PET, P.KELALAIAN[f]), 'pemicu layar ' + nm.lower(), 5)

# ---- kelompok 3: pemicu utang bersama (kebendaan)-----------------------------------------------------------------------
baru(3440, 'PEMICU KEBENDAAN: PETITUM MENYEBUT UTANG BERSAMA (OTOMATIS dari petitum dan rekonvensi SIPP; "ya" bila menyebut utang/hutang/piutang)',
     "SELECT IF(%s REGEXP '%s', 'ya', '') AS data FROM perkara p WHERE p.perkara_id = '#perkara_id#'" % (U2.PET, P.KEB_BARU['tutang']), 'pemicu layar utang bersama', 3)


def susun_ubah(server):
    """(no -> definisi ubah). server = salinan abt_variabel (bytes sql)."""
    U = {}
    for no in NO_U2:
        U[no] = dict(kolom='sql_query', fungsi=ubah_u2, butir='penjaga daftar pilihan bawaan keputusan dan waktu bayar', kelompok=2)
    for no in NO_HBI:
        U[no] = dict(kolom='sql_query', fungsi=ubah_hbi, butir='pola petitum hak bekas istri dan penjaga daftar pilihan bawaan', kelompok=1)
    for no in no_keb(server):
        U[no] = dict(kolom='sql_query', fungsi=ubah_keb, butir='pola sita/utang/jaminan/batal berdiri sendiri', kelompok=3)
    return U
