# -*- coding: utf-8 -*-
"""Jenis HAK-HAK BEKAS ISTRI / KEWAJIBAN BEKAS SUAMI (SIPP 351, Pdt.G, alur 15) - paket abt-w3a-blangko-baru-perkawinan (agen W3a-D, 21 Okt 2026).

Gugatan TERSENDIRI sesudah perceraian: nafkah iddah, maskan, kiswah, mut'ah, nafkah lampau (madliyah), mahar terhutang, dan biaya hadhanah
(Pasal 149 KHI) yang tidak (lengkap) diputus dalam perkara cerainya. Dasar kewenangan: Penjelasan Pasal 49 huruf a angka 13 UU 7/1989 jo.
UU 3/2006 dan UU 50/2009; dasar hak: Pasal 41 huruf c UU 1/1974, Pasal 149, 152, 153, 158-160 KHI; rumusan Kamar Agama (SEMA 3/2018, 2/2019).
Rujukan silang: nafkah anak yang berdiri sendiri = jenis 743 (folder "6c Nafkah Anak"); hak asuh = jenis Penguasaan Anak (349). Blangko ini
hanya memuat biaya hadhanah/nafkah anak bila dituntut bersama hak bekas istri, memakai ulang isian nafkah anak yang sudah ada (9740, 9741, 9746, 9747).

Pakai ulang variabel lama (tidak digandakan): 9711 nafkah madliyah, 9712 nafkah iddah, 9713 mut'ah, 9714 dasar kemampuan Tergugat/kebutuhan hidup,
9740/9741 nafkah anak per bulan dan kenaikan, 9746/9747 nafkah lampau anak, 9302/9304/9759 sebutan, identitas anak dan kedudukan Penggugat.

Isian jumlah memakai bentuk "Rp4.500.000,00 (3 bulan x Rp1.500.000,00)": angka sesudah kata "Rp" yang PERTAMA dibaca kueri jumlah (3760-3762).

Jalankan: python jenis_hak_bekas_istri.py   -> menulis semua RTF jenis ini dan mencetak ringkasan.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import w3a_lib as L  # noqa: E402
from variabel_def import V  # noqa: E402

J = L.JENIS['hak-bekas-istri']

# ---------------------------------------------------------------------------------------------------------------------
# Pembangun SQL kecil (MariaDB 5.5): tiap fragmen isian dibaca langsung dari abt_data_teks (kosong bila belum ada), sama pola 9740-9758
# ---------------------------------------------------------------------------------------------------------------------
PID = "'#perkara_id#'"


def I(n):
    """Ekspresi SQL isian petugas no_var=n (disanitasi; kosong bila belum pernah diisi)."""
    return ("TRIM(TRAILING ';' FROM TRIM(IFNULL(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var = %d "
            "AND perkara_id = %s LIMIT 1) USING utf8), '\\\\', '/'), '\"', '&quot;'), '''', '&#39;'), '')))" % (n, PID))


# petitum perkara (huruf kecil) - untuk tanda "dituntut"
PET = "LOWER(IFNULL((SELECT petitum FROM perkara WHERE perkara_id = %s), ''))" % PID


def lit(teks):
    """Literal SQL (tanda petik tunggal) - teks tidak boleh memuat tanda petik tunggal (pakai &#39;)."""
    assert "'" not in teks, teks
    return "'" + teks + "'"


def cc(*bagian):
    """CONCAT dari bagian: str yang diawali '@' = ekspresi SQL mentah; str lain = literal."""
    p = []
    for b in bagian:
        p.append(b[1:] if b.startswith('@') else lit(b))
    return 'CONCAT(' + ', '.join(p) + ')'


def jika(kond, maka, lain="''"):
    return 'IF(%s, %s, %s)' % (kond, maka, lain)


def kosong(x):
    return "%s = ''" % x


def ada(x):
    return "%s <> ''" % x


# Pembaca jumlah rupiah: angka sesudah 'Rp' pertama ("Rp4.500.000,00 (...)" -> 4500000); 0 bila tak ada 'Rp'
def AMT(x):
    s = "TRIM(TRIM(LEADING '.' FROM TRIM(SUBSTRING(%s, LOCATE('Rp', %s) + 2))))" % (x, x)
    return "IF(LOCATE('Rp', %s) = 0, 0, CAST(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(%s, ' ', 1), ',', 1), '.', '') AS UNSIGNED))" % (x, s)


# komponen uang hak bekas istri: (kode huruf, nomor isian, nama, kata untuk daftar)
KOMP = [
    ('i', 9712, 'nafkah iddah'),
    ('k', 3751, 'maskan'),
    ('s', 3752, 'kiswah'),
    ('t', 9713, 'mut&#39;ah'),
    ('m', 9711, 'nafkah madliyah'),
    ('h', 3753, 'mahar yang masih terhutang'),
]


def q_isian():
    """Subkueri: kolom i,k,s,t,m,h (komponen uang), a (nafkah anak/bulan), an (kenaikan), al (jangka lampau anak), aj (jumlah lampau anak), w (waktu bayar),
    sita (3754), du (dukhul 3745), nu (nusyuz 3746), pu (3747), sd (3748), ii (masa iddah 3743), ik (keadaan iddah 3744), tp (tanggal putus 3742),
    cr (cara putus 3741), pc (putusan cerai 3740), kp (fakta kepatutan 3749), bt (bantahan 3750), ds (dasar kemampuan 9714), tl (alasan ditolak 3755)."""
    kol = [('i', 9712), ('k', 3751), ('s', 3752), ('t', 9713), ('m', 9711), ('h', 3753), ('a', 9740), ('an', 9741), ('al', 9746), ('aj', 9747),
           ('w', 3756), ('sita', 3754), ('du', 3745), ('nu', 3746), ('pu', 3747), ('sd', 3748), ('ii', 3743), ('ik', 3744), ('tp', 3742),
           ('cr', 3741), ('pc', 3740), ('kp', 3749), ('bt', 3750), ('ds', 9714), ('tl', 3755)]
    s = ', '.join('%s AS %s' % (I(n), a) for a, n in kol)
    pet = ", ".join([
        "IF(%s REGEXP 'iddah|idah', 1, 0) AS pi" % PET,
        "IF(%s REGEXP 'maskan|tempat tinggal|tempat kediaman|tempat berteduh', 1, 0) AS pk" % PET,
        "IF(%s REGEXP 'kiswah|pakaian|sandang', 1, 0) AS ps" % PET,
        "IF(%s REGEXP 'mut[^a-z]{0,6}ah', 1, 0) AS pt" % PET,
        "IF(%s REGEXP 'madli|madhi|mahdhi|lampau|yang lalu|tidak diberikan nafkah|tidak memberi nafkah', 1, 0) AS pm" % PET,
        "IF(%s REGEXP 'mahar|mas kawin|maskawin', 1, 0) AS ph" % PET,
        "IF(%s REGEXP 'nafkah[^;]{0,60}anak|anak[^;]{0,60}nafkah|biaya[^;]{0,40}hadh?anah|hadh?anah[^;]{0,40}biaya|biaya[^;]{0,40}anak', 1, 0) AS pa" % PET,
    ])
    return 'SELECT %s, %s' % (s, pet)


def q_jumlah(dari):
    """Subkueri jumlah uang: tambah kolom ni,nk,ns,nt,nm,nh (angka per komponen) dan tt (jumlah), nuang (banyak komponen berangka), nada (banyak komponen terisi)."""
    kol = []
    for a, _, _ in KOMP:
        kol.append('%s AS n%s' % (AMT('c.' + a), a))
    return ("SELECT d.*, (d.ni + d.nk + d.ns + d.nt + d.nm + d.nh) AS tt, "
            "((d.ni > 0) + (d.nk > 0) + (d.ns > 0) + (d.nt > 0) + (d.nm > 0) + (d.nh > 0)) AS nuang, "
            "((d.i <> '') + (d.k <> '') + (d.s <> '') + (d.t <> '') + (d.m <> '') + (d.h <> '')) AS nada "
            "FROM (SELECT c.*, %s FROM (%s) c) d" % (', '.join(kol), dari))


SATUAN = "'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'"


def tiga(x):
    """Terbilang bilangan 0-999 (ekspresi SQL) dengan akhiran spasi."""
    r = '(%s DIV 100)' % x
    s = '(%s MOD 100)' % x
    return ("CONCAT(IF(%(r)s = 0, '', IF(%(r)s = 1, 'seratus ', CONCAT(ELT(%(r)s, %(S)s), ' ratus '))), "
            "IF(%(s)s = 0, '', IF(%(s)s < 10, CONCAT(ELT(%(s)s, %(S)s), ' '), IF(%(s)s = 10, 'sepuluh ', IF(%(s)s = 11, 'sebelas ', "
            "IF(%(s)s < 20, CONCAT(ELT(%(s)s - 10, %(S)s), ' belas '), CONCAT(ELT((%(s)s DIV 10) - 1, 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'), ' puluh ', "
            "IF((%(s)s MOD 10) = 0, '', CONCAT(ELT(%(s)s MOD 10, %(S)s), ' ')))))))))" % dict(r=r, s=s, S=SATUAN))


def terbilang_sql(tt):
    """Ekspresi terbilang untuk kolom bilangan bulat `tt` (<1 triliun) pada tabel turunan z yang memuat tt, gb, gj, gr, gs."""
    return ("TRIM(CONCAT(IF(z.gb = 0, '', CONCAT(%s, 'miliar ')), IF(z.gj = 0, '', CONCAT(%s, 'juta ')), IF(z.gr = 0, '', IF(z.gr = 1, 'seribu ', CONCAT(%s, 'ribu '))), %s))"
            % (tiga('z.gb'), tiga('z.gj'), tiga('z.gr'), tiga('z.gs')))


def q_terbilang(dari):
    return ("SELECT y.*, ((y.tt DIV 1000000000) MOD 1000) AS gb, ((y.tt DIV 1000000) MOD 1000) AS gj, ((y.tt DIV 1000) MOD 1000) AS gr, (y.tt MOD 1000) AS gs "
            "FROM (%s) y" % dari)


def rp(tt):
    return "CONCAT('Rp', REPLACE(FORMAT(%s, 0), ',', '.'), ',00')" % tt


def daftar_dan(pasangan, kosong="''"):
    """Daftar 'a, b dan c' dari pasangan (kondisi SQL, nama): hanya yang kondisinya benar; pemisah dihitung dari urutan (tanpa REPLACE/SUBSTRING_INDEX,
    yang rapuh di MariaDB 5.5). Bila tak satu pun benar = `kosong`."""
    total = ' + '.join('(%s)' % k for k, _ in pasangan)
    bagian = []
    for n, (k, nama) in enumerate(pasangan):
        pos = ' + '.join('(%s)' % kk for kk, _ in pasangan[:n + 1])
        bagian.append("IF(%s, CONCAT(IF((%s) = 1, '', IF((%s) = (%s), ' dan ', ', ')), %s), '')" % (k, pos, pos, total, lit(nama)))
    return "IF((%s) = 0, %s, CONCAT(%s))" % (total, kosong, ', '.join(bagian))


def pasangan_komponen(c, dengan_anak=True):
    p = [("%s.%s <> ''" % (c, a), nama) for a, _, nama in KOMP]
    if dengan_anak:
        p.append(("(%s.a <> '' OR %s.aj <> '')" % (c, c), 'biaya hadhanah anak'))
    return p


def _b(teks):
    """Awal paragraf baru dalam keluaran SQL: ABT memakai <br>."""
    return teks


# ---------------------------------------------------------------------------------------------------------------------
# VARIABEL ISIAN (data_teks) - jatah 3740-3789. Nama <= 200 huruf; penjelasan panjang ada di RAMAH.
# ---------------------------------------------------------------------------------------------------------------------
V(3740, 'HAK BEKAS ISTRI: PUTUSAN PERCERAIAN DAN AKTA CERAI - ISIAN satu frasa tanpa titik akhir (nomor, tanggal, berkekuatan hukum tetap, akta cerai)', 'data_teks')
V(3741, 'HAK BEKAS ISTRI: CARA PERKAWINAN PUTUS - PILIH cerai talak atau cerai gugat (menentukan syarat mut\'ah dan dasar nafkah iddah)', 'data_teks',
  default='cerai talak\ncerai gugat')
V(3742, 'HAK BEKAS ISTRI: TANGGAL PERKAWINAN PUTUS - ISIAN tanggal ikrar talak atau putusan cerai gugat berkekuatan hukum tetap (Pasal 153 ayat (4) KHI)', 'data_teks')
V(3743, 'HAK BEKAS ISTRI: MASA IDDAH - PILIH menurut Pasal 153 ayat (2) dan (3) KHI', 'data_teks',
  default='3 (tiga) kali suci dengan sekurang-kurangnya 90 (sembilan puluh) hari\n90 (sembilan puluh) hari karena tidak haid\nsampai melahirkan karena dalam keadaan hamil\ntidak ada masa iddah karena qobla al dukhul')
V(3744, 'HAK BEKAS ISTRI: KEADAAN MASA IDDAH SAAT GUGATAN DIAJUKAN - PILIH masih berjalan atau telah berakhir', 'data_teks',
  default='masih berjalan\ntelah berakhir')
V(3745, 'HAK BEKAS ISTRI: FAKTA DUKHUL - PILIH kalimat sesudah kata "Bahwa" (qobla al dukhul = belum bergaul sebagai suami istri)', 'data_teks',
  default='selama menjadi suami istri #0046# dan #0047# telah bergaul sebagaimana layaknya suami istri (bada al dukhul)\nantara #0046# dan #0047# belum pernah terjadi hubungan sebagaimana layaknya suami istri (qobla al dukhul)')
V(3746, 'HAK BEKAS ISTRI: FAKTA NUSYUZ - PILIH kalimat sesudah kata "Bahwa" (nusyuz menggugurkan nafkah iddah, maskan, kiswah; Pasal 149 huruf b, 152 KHI)', 'data_teks',
  default='dalam perkara ini tidak ditemukan bukti bahwa #0046# berbuat nusyuz\n#0046# terbukti berbuat nusyuz sehingga tidak berhak atas nafkah iddah, maskan dan kiswah')
V(3747, 'HAK BEKAS ISTRI: FAKTA HAK ITU SUDAH DIPUTUS DALAM PERKARA CERAI? - PILIH kalimat sesudah kata "Bahwa" (ne bis in idem, Pasal 1917 KUHPerdata)', 'data_teks',
  default=('hak-hak bekas istri yang dituntut dalam perkara ini belum pernah dituntut dan belum pernah diputus dalam perkara perceraian #0046# dan #0047#\n'
           'hak-hak bekas istri yang dituntut dalam perkara ini pernah dituntut dalam perkara perceraian #0046# dan #0047# tetapi tidak dipertimbangkan sehingga belum diputus\n'
           'hak-hak bekas istri yang dituntut dalam perkara ini telah diputus dalam perkara perceraian #0046# dan #0047#'))
V(3748, 'HAK BEKAS ISTRI: HAK YANG SUDAH DIPUTUS DALAM PERKARA CERAI - ISIAN jenis hak dan nomor putusan (hanya bila 3747 memilih telah diputus); kosong = tidak ada', 'data_teks')
V(3749, 'HAK BEKAS ISTRI: FAKTA KEPATUTAN BESARAN - ISIAN kalimat sesudah kata "Bahwa" (lama perkawinan, keadaan Penggugat, penghasilan Tergugat; Pasal 160 KHI)', 'data_teks')
V(3750, 'HAK BEKAS ISTRI: BANTAHAN/EKSEPSI TERGUGAT DAN TANGGAPAN MAJELIS - ISIAN kalimat sesudah "Menimbang, bahwa" (mis. daluwarsa, sudah dibayar); kosong = tidak ada', 'data_teks')
V(3751, 'HAK BEKAS ISTRI: MASKAN (TEMPAT TINGGAL) SELAMA IDDAH - ISIAN jumlah dan rincian, mis. Rp1.500.000,00 (3 bulan x Rp500.000,00); kosong = tidak dikabulkan', 'data_teks')
V(3752, 'HAK BEKAS ISTRI: KISWAH (PAKAIAN) SELAMA IDDAH - ISIAN jumlah dan rincian, mis. Rp900.000,00 (3 bulan x Rp300.000,00); kosong = tidak dikabulkan', 'data_teks')
V(3753, 'HAK BEKAS ISTRI: MAHAR YANG MASIH TERHUTANG - ISIAN jumlah atau bentuk (separuh bila qobla al dukhul), mis. Rp5.000.000,00; kosong = tidak ada', 'data_teks')
V(3754, 'HAK BEKAS ISTRI: SITA JAMINAN ATAS HARTA TERGUGAT UNTUK BIAYA HADHANAH ANAK - ISIAN objek dirinci dan nomor/tanggal berita acara sita; kosong = tanpa sita', 'data_teks')
V(3755, 'HAK BEKAS ISTRI (KABUL SEBAGIAN/TOLAK): ALASAN PETITUM DITOLAK - ISIAN kalimat sesudah "Menimbang, bahwa"', 'data_teks')
V(3756, 'HAK BEKAS ISTRI: WAKTU PEMBAYARAN - PILIH atau ketik kalimat lanjutan "dilakukan ..."; kosong = tidak ditentukan', 'data_teks',
  default='segera setelah putusan ini berkekuatan hukum tetap\npaling lambat 30 (tiga puluh) hari sejak putusan ini berkekuatan hukum tetap')
V(3757, 'HAK BEKAS ISTRI: ALAT BUKTI SURAT #0046# - ISIAN (daftar bukti P.1 dst.; ubah sesuai bukti yang diajukan)', 'data_teks',
  default=('Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama #4048#, NIK #0335# tanggal #8870#, yang dikeluarkan oleh Pemerintah #9277#, Provinsi #9278#, '
           'bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.1;\n'
           'Fotokopi Kutipan Akta Nikah, Nomor #1004# tanggal #1012#, yang dikeluarkan oleh #1005#, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, '
           'serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.2;\n'
           'Fotokopi Kutipan Akta Cerai dan salinan putusan perceraian #3740#, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, '
           'serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu oleh #4004# diberi tanda P.3;'))
V(3758, 'HAK BEKAS ISTRI: ALAT BUKTI SURAT #0047# - ISIAN (daftar bukti T.1 dst.; ubah sesuai bukti yang diajukan)', 'data_teks',
  default=('Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama #0047#, NIK #0337# tanggal #8871#, yang dikeluarkan oleh Pemerintah #9279#, Provinsi #9560#, '
           'bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda T.1 serta diberi tanggal dan paraf oleh #4004#;\n'
           'Fotokopi Kutipan Akta Nikah, Nomor #1004# tanggal #1012#, yang dikeluarkan oleh #1005#, bukti surat tersebut telah diberi meterai cukup, di-nazegelen, '
           'serta telah dicocokkan dengan aslinya yang ternyata sesuai, lalu diberi tanda T.2 serta diberi tanggal dan paraf oleh #4004#;'))

# ---------------------------------------------------------------------------------------------------------------------
# VARIABEL OTOMATIS (data_sql) 3760-3779. Sumber bersama `z`: semua isian + angka per komponen (tt jumlah, nuang, nada).
# ---------------------------------------------------------------------------------------------------------------------
_JML = q_jumlah(q_isian())
TAL = "z.cr LIKE '%talak%'"
GUG = "z.cr LIKE '%gugat%'"
QOB = "(z.du LIKE '%qobla%' OR z.ii LIKE '%qobla%')"
NUS = "(z.nu LIKE '%terbukti berbuat nusyuz%' AND z.nu NOT LIKE '%tidak ditemukan%')"
SDP = "z.pu LIKE '%telah diputus%'"
ANAK = "(z.a <> '' OR z.aj <> '')"
SEMA3_2018 = ('Rumusan Hukum Kamar Agama Surat Edaran Mahkamah Agung Nomor 3 Tahun 2018 (Hukum Keluarga huruf c) yang mengakomodir Peraturan Mahkamah Agung Nomor 3 Tahun 2017 '
              'tentang Pedoman Mengadili Perkara Perempuan Berhadapan dengan Hukum')


def W(cond, *p):
    return "IF(%s, %s, '')" % (cond, cc(*p))


def dari_z(ekspr):
    return "SELECT %s AS data FROM (%s) z" % (ekspr, _JML)


V(3760, 'HAK BEKAS ISTRI: JUMLAH UANG SELURUH HAK (OTOMATIS: angka sesudah Rp pertama pada isian 9712, 3751, 3752, 9713, 9711, 3753; angka tanpa titik; kosong bila tidak ada)', 'data_sql',
  "SELECT IF(x.tt = 0, '', x.tt) AS data FROM (%s) x" % _JML)
V(3761, 'HAK BEKAS ISTRI: JUMLAH UANG SELURUH HAK DALAM RUPIAH (OTOMATIS dari isian jumlah; mis. Rp12.500.000,00; kosong bila tidak ada)', 'data_sql',
  "SELECT IF(x.tt = 0, '', %s) AS data FROM (%s) x" % (rp('x.tt'), _JML))
V(3762, 'HAK BEKAS ISTRI: TERBILANG JUMLAH UANG SELURUH HAK (OTOMATIS; mis. dua belas juta lima ratus ribu rupiah; kosong bila tidak ada)', 'data_sql',
  "SELECT IF(z.tt = 0, '', CONCAT(%s, ' rupiah')) AS data FROM (%s) z" % (terbilang_sql('z.tt'), q_terbilang(_JML)))
V(3763, 'HAK BEKAS ISTRI: DAFTAR HAK YANG DIKABULKAN (OTOMATIS dari isian jumlah hak dan biaya hadhanah; kosong bila tidak ada)', 'data_sql',
  "SELECT %s AS data FROM (%s) x" % (daftar_dan(pasangan_komponen('x')), q_isian()))
_PETP = [("x.pi = 1", 'nafkah iddah'), ("x.pk = 1", 'maskan'), ("x.ps = 1", 'kiswah'), ("x.pt = 1", 'mut&#39;ah'), ("x.pm = 1", 'nafkah madliyah'),
         ("x.ph = 1", 'mahar yang masih terhutang'), ("x.pa = 1", 'biaya hadhanah anak')]
V(3764, 'HAK BEKAS ISTRI: DAFTAR HAK YANG DITUNTUT (OTOMATIS dari petitum SIPP; bila tidak terbaca = hak-hak bekas istri)', 'data_sql',
  "SELECT %s AS data FROM (%s) x" % (daftar_dan(_PETP, lit('hak-hak bekas istri')), q_isian()))

# 3765 PERTIMBANGAN DASAR HUKUM dan ne bis in idem (selalu tercetak; tanpa <br> di depan)
_DASAR = ('Menimbang, bahwa berdasarkan fakta hukum tersebut, perkawinan #0046# dan #0047# telah putus karena perceraian dan berdasarkan Pasal 41 huruf c '
          'Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, Pengadilan dapat mewajibkan kepada bekas suami untuk memberikan biaya penghidupan dan/atau '
          'menentukan sesuatu kewajiban bagi bekas isteri; kewajiban bekas suami tersebut dirinci dalam Pasal 149 Kompilasi Hukum Islam, yaitu memberikan '
          'mut&#39;ah yang layak kepada bekas istrinya baik berupa uang atau benda kecuali bekas istri tersebut qobla al dukhul, memberi nafkah, maskan dan kiswah '
          'kepada bekas istri selama dalam iddah kecuali bekas istri telah dijatuhi talak ba&#39;in atau nusyuz dan dalam keadaan tidak hamil, melunasi mahar yang '
          'masih terhutang seluruhnya dan separuh apabila qobla al dukhul, serta memberikan biaya hadhanah untuk anak-anaknya yang belum mencapai umur 21 tahun;')
V(3765, 'PERTIMBANGAN HAK BEKAS ISTRI: DASAR HUKUM DAN NE BIS IN IDEM (OTOMATIS dari isian 3740, 3747, 3748; selalu tercetak)', 'data_sql',
  dari_z(cc(_DASAR, '<br>',
            '@IF(%s, %s, %s)' % (
                SDP,
                cc('Menimbang, bahwa terhadap ', "@IF(z.sd = '', 'hak-hak bekas istri yang dituntut', z.sd)", ' telah diputus dalam perkara perceraian',
                   "@IF(z.pc = '', '', CONCAT(' sebagaimana ', z.pc))",
                   ', sedangkan soal yang dituntut, dasar tuntutan, serta pihak-pihak dalam perkara a quo sama dengan perkara yang telah diputus tersebut, sehingga sesuai '
                   'Pasal 1917 Kitab Undang-Undang Hukum Perdata kekuatan putusan yang telah berkekuatan hukum tetap itu mengikat dan tuntutan yang sama tidak dapat '
                   'diperiksa dan diputus kembali (nebis in idem);'),
                cc('Menimbang, bahwa hak-hak bekas istri yang dituntut dalam perkara a quo belum diputus dalam perkara perceraian ',
                   "@IF(z.pc = '', '', CONCAT('sebagaimana ', z.pc, ' '))",
                   'sehingga tuntutan tersebut bukan perkara yang telah diputus (bukan nebis in idem sebagaimana Pasal 1917 Kitab Undang-Undang Hukum Perdata) dan '
                   '#0046# berhak menuntutnya dalam gugatan tersendiri;')))))

# 3766 NAFKAH IDDAH, MASKAN, KISWAH
_PI = [("z.i <> ''", 'nafkah iddah'), ("z.k <> ''", 'maskan'), ("z.s <> ''", 'kiswah')]
V(3766, 'PERTIMBANGAN HAK BEKAS ISTRI: NAFKAH IDDAH, MASKAN, KISWAH (OTOMATIS dari isian 9712, 3751, 3752, 3741-3746; kosong bila ketiganya tidak terisi)', 'data_sql',
  dari_z(W("(z.i <> '' OR z.k <> '' OR z.s <> '')",
           '<br>Menimbang, bahwa #0046# menuntut agar #0047# dihukum membayar ', '@' + daftar_dan(_PI),
           ' selama masa iddah; berdasarkan Pasal 149 huruf b Kompilasi Hukum Islam bekas suami wajib memberi nafkah, maskan dan kiswah kepada bekas istri selama dalam iddah, '
           'kecuali bekas istri telah dijatuhi talak ba&#39;in atau nusyuz dan dalam keadaan tidak hamil, dan menurut Pasal 152 Kompilasi Hukum Islam bekas istri berhak mendapat '
           'nafkah iddah dari bekas suaminya kecuali bila ia nusyuz',
           '@IF(%s, %s, %s)' % (GUG, lit('; terhadap perkawinan yang putus karena cerai gugat, ' + SEMA3_2018 + ' menentukan bahwa istri dalam perkara cerai gugat dapat diberikan nafkah iddah sepanjang tidak terbukti nusyuz'), "''"),
           ';<br>Menimbang, bahwa berdasarkan fakta hukum tersebut, #3772#;',
           '@IF(%s, %s, %s)' % (NUS,
                                lit('<br>Menimbang, bahwa oleh karena #0046# terbukti berbuat nusyuz, berdasarkan Pasal 149 huruf b dan Pasal 152 Kompilasi Hukum Islam #0046# tidak berhak atas nafkah iddah, maskan dan kiswah [PERIKSA: isian jumlah nafkah iddah, maskan atau kiswah terisi padahal Penggugat terbukti nusyuz];'),
                                "IF(z.nu = '', '<br>[PERIKSA: pilih isian fakta nusyuz (3746)]', '<br>Menimbang, bahwa dalam perkara ini tidak ditemukan bukti bahwa #0046# berbuat nusyuz, sehingga #0046# berhak atas nafkah selama masa iddah sebagaimana Pasal 152 Kompilasi Hukum Islam;')"),
           '@IF(%s, %s, %s)' % (QOB, lit('<br>Menimbang, bahwa [PERIKSA: antara #0046# dan #0047# qobla al dukhul; menurut Pasal 153 ayat (3) Kompilasi Hukum Islam tidak ada waktu tunggu bagi janda yang qobla al dukhul sehingga nafkah iddah, maskan dan kiswah tidak dapat dikabulkan];'), "''"),
           '@IF(z.ik LIKE \'%%berakhir%%\', %s, %s)' % (lit('<br>Menimbang, bahwa oleh karena masa iddah telah berakhir tetapi kewajiban nafkah iddah, maskan dan kiswah belum dipenuhi #0047#, #0046# tetap dapat menuntutnya kepada #0047# dalam gugatan ini;'), "''"))))

# 3767 MUT'AH
V(3767, 'PERTIMBANGAN HAK BEKAS ISTRI: MUT\'AH (OTOMATIS dari isian 9713, 3741, 3745, 3746; kosong bila mut\'ah tidak diisi)', 'data_sql',
  dari_z(W("z.t <> ''",
           '<br>Menimbang, bahwa #0046# menuntut mut&#39;ah; berdasarkan Pasal 149 huruf a Kompilasi Hukum Islam bekas suami wajib memberikan mut&#39;ah yang layak kepada bekas istrinya, '
           'baik berupa uang atau benda, kecuali bekas istri tersebut qobla al dukhul, dan menurut Pasal 158 Kompilasi Hukum Islam mut&#39;ah wajib diberikan oleh bekas suami dengan syarat '
           'belum ditetapkan mahar bagi istri ba&#39;da al dukhul dan perceraian itu atas kehendak suami, sedangkan menurut Pasal 159 Kompilasi Hukum Islam mut&#39;ah sunnat diberikan '
           'tanpa syarat tersebut;',
           '@IF(%s, %s, IF(%s, CONCAT(%s, IF(%s, %s, IF(z.nu = \'\', \';\', %s))), \'\'))' % (
               TAL,
               lit('<br>Menimbang, bahwa oleh karena perkawinan #0046# dan #0047# putus karena cerai talak, yaitu perceraian atas kehendak #0047#, syarat sebagaimana Pasal 158 huruf b Kompilasi Hukum Islam terpenuhi;'),
               GUG,
               lit('<br>Menimbang, bahwa meskipun perkawinan #0046# dan #0047# putus karena cerai gugat, ' + SEMA3_2018 + ' menentukan bahwa istri dalam perkara cerai gugat dapat diberikan mut&#39;ah sepanjang tidak terbukti nusyuz'),
               NUS, lit('; [PERIKSA: Penggugat terbukti nusyuz tetapi mut&#39;ah dikabulkan];'),
               lit(', dan dalam perkara ini tidak ditemukan bukti bahwa #0046# berbuat nusyuz;')),
           '@IF(%s, %s, %s)' % (QOB, lit('<br>Menimbang, bahwa [PERIKSA: antara #0046# dan #0047# qobla al dukhul; menurut Pasal 149 huruf a Kompilasi Hukum Islam mut&#39;ah tidak wajib diberikan kepada bekas istri yang qobla al dukhul];'), "''"),
           '<br>Menimbang, bahwa menurut Pasal 160 Kompilasi Hukum Islam besarnya mut&#39;ah disesuaikan dengan kepatutan dan kemampuan suami, dengan memperhatikan antara lain lamanya masa perkawinan dan penghasilan suami sebagaimana Rumusan Hukum Kamar Agama Mahkamah Agung Tahun 2012;')))

# 3768 NAFKAH MADLIYAH
V(3768, 'PERTIMBANGAN HAK BEKAS ISTRI: NAFKAH MADLIYAH/LAMPAU ISTRI (OTOMATIS dari isian 9711; kosong bila tidak diisi)', 'data_sql',
  dari_z(W("z.m <> ''",
           '<br>Menimbang, bahwa #0046# menuntut nafkah lampau (nafkah madliyah) yang tidak diberikan #0047# selama masih menjadi suami istri sebesar ', '@z.m',
           '; berdasarkan Pasal 34 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan suami wajib melindungi isterinya dan memberikan segala sesuatu keperluan hidup berumah tangga '
           'sesuai dengan kemampuannya, sehingga nafkah yang dilalaikan oleh #0047# selama perkawinan dapat dituntut oleh #0046# sebagai bagian dari biaya penghidupan yang dapat diwajibkan '
           'Pengadilan kepada bekas suami menurut Pasal 41 huruf c Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan;',
           '<br>Menimbang, bahwa berdasarkan bukti dan keterangan saksi-saksi yang diajukan #0046#, terbukti bahwa #0047# melalaikan kewajiban memberi nafkah kepada #0046# selama perkawinan, '
           'sedangkan #0047# bekerja sebagai #0104# #5271#, sehingga #0047# patut dihukum membayar nafkah madliyah kepada #0046#;')))

# 3769 MAHAR TERHUTANG
V(3769, 'PERTIMBANGAN HAK BEKAS ISTRI: MAHAR YANG MASIH TERHUTANG (OTOMATIS dari isian 3753 dan 3745; kosong bila mahar tidak diisi)', 'data_sql',
  dari_z(W("z.h <> ''",
           '<br>Menimbang, bahwa #0046# menuntut agar #0047# melunasi mahar yang masih terhutang berupa ', '@z.h',
           '; berdasarkan Pasal 149 huruf c Kompilasi Hukum Islam bekas suami wajib melunasi mahar yang masih terhutang seluruhnya, dan separuh apabila qobla al dukhul',
           '@IF(%s, %s, \'\')' % (QOB, lit(', dan oleh karena antara #0046# dan #0047# qobla al dukhul maka mahar yang wajib dilunasi hanya separuh')),
           '; berdasarkan bukti dan keterangan saksi-saksi terbukti bahwa mahar tersebut belum dilunasi oleh #0047#, sehingga #0047# patut dihukum melunasinya;')))

# 3770 BIAYA HADHANAH / NAFKAH ANAK
V(3770, 'PERTIMBANGAN HAK BEKAS ISTRI: BIAYA HADHANAH/NAFKAH ANAK (OTOMATIS dari isian 9740, 9741, 9746, 9747; kosong bila tidak diisi)', 'data_sql',
  dari_z(W(ANAK,
           '<br>Menimbang, bahwa #0046# juga menuntut agar #0047# dihukum membayar biaya hadhanah #9302# tersebut yang bernama #9304#; berdasarkan Pasal 149 huruf d Kompilasi Hukum Islam '
           'bekas suami wajib memberikan biaya hadhanah untuk anak-anaknya yang belum mencapai umur 21 tahun, dan berdasarkan Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang '
           'Perkawinan jo. Pasal 156 huruf d Kompilasi Hukum Islam bapak bertanggung jawab atas semua biaya pemeliharaan dan pendidikan yang diperlukan anak menurut kemampuannya;',
           '@IF(z.a <> \'\', CONCAT(\'<br>Menimbang, bahwa #8554# berpendapat patut dan layak #0047# dihukum membayar biaya hadhanah #9302# tersebut sebesar \', z.a, \' setiap bulan\', '
           'IF(z.an <> \'\', CONCAT(\', dengan kenaikan sebesar \', z.an, \' setiap tahun\'), \'\'), \', sampai #9302# tersebut dewasa atau mampu berdiri sendiri (berumur 21 (dua puluh satu) tahun);\'), \'\')',
           '@IF(z.aj <> \'\', CONCAT(\'<br>Menimbang, bahwa mengenai nafkah lampau #9302# tersebut\', IF(z.al <> \'\', CONCAT(\' \', z.al), \'\'), \' sejumlah \', z.aj, \', menurut Surat Edaran '
           'Mahkamah Agung Nomor 2 Tahun 2019 (Rumusan Hukum Kamar Agama, Hukum Keluarga huruf a) nafkah lampau (nafkah madliyah) anak yang dilalaikan oleh ayahnya dapat diajukan gugatan '
           'oleh ibunya atau orang yang secara nyata mengasuh anak tersebut, sehingga #8554# berpendapat patut dan layak #0047# dihukum membayarnya kepada #0046# selaku #9759#;\'), \'\')')))

# 3771 BESARAN DAN KEPATUTAN
_BES = ("CONCAT_WS(', ', IF(z.i <> '', CONCAT('nafkah iddah sebesar ', z.i), NULL), IF(z.k <> '', CONCAT('maskan sebesar ', z.k), NULL), IF(z.s <> '', CONCAT('kiswah sebesar ', z.s), NULL), "
        "IF(z.t <> '', CONCAT('mut&#39;ah berupa ', z.t), NULL), IF(z.m <> '', CONCAT('nafkah madliyah sebesar ', z.m), NULL), IF(z.h <> '', CONCAT('mahar terhutang berupa ', z.h), NULL))")
V(3771, 'PERTIMBANGAN HAK BEKAS ISTRI: BESARAN DAN KEPATUTAN (OTOMATIS dari isian 9714, 3749 dan jumlah hak; kosong bila tidak ada hak berjumlah)', 'data_sql',
  dari_z(W("z.nada > 0",
           '<br>Menimbang, bahwa untuk menentukan besarnya hak-hak tersebut, #8554# mempertimbangkan rasa keadilan dan kepatutan dengan menggali fakta kemampuan ekonomi #0047# dan fakta kebutuhan dasar hidup #0046#',
           "@IF(z.ds <> '', CONCAT(', yaitu ', z.ds), '')",
           ' sebagaimana Rumusan Hukum Kamar Agama Surat Edaran Mahkamah Agung Nomor 3 Tahun 2018 (Hukum Keluarga huruf b), serta memperhatikan fakta hukum tersebut di atas mengenai pekerjaan dan penghasilan #0047#',
           "@IF(z.kp <> '', ', lamanya perkawinan dan keadaan para pihak', '')",
           ';<br>Menimbang, bahwa berdasarkan pertimbangan tersebut, #8554# berpendapat ', '@' + _BES,
           ' patut dan layak dibebankan kepada #0047#',
           "@IF(z.tt > 0 AND z.nuang >= 2, ', sehingga seluruhnya berjumlah #3761# (#3762#)', '')", ' sebagaimana tersebut dalam amar putusan;')))

# 3773 AMAR PEMBAYARAN
V(3773, 'AMAR HAK BEKAS ISTRI: BUTIR-BUTIR HAK YANG DIBAYAR (OTOMATIS dari isian 9712, 3751, 3752, 9713, 9711, 3753, 9740, 9741, 9746, 9747; satu baris per hak)', 'data_sql',
  dari_z("CONCAT(IF(z.i <> '', CONCAT('<br>    - nafkah iddah selama masa iddah sebesar ', z.i, ';'), ''), "
         "IF(z.k <> '', CONCAT('<br>    - maskan (tempat tinggal) selama masa iddah sebesar ', z.k, ';'), ''), "
         "IF(z.s <> '', CONCAT('<br>    - kiswah (pakaian) selama masa iddah sebesar ', z.s, ';'), ''), "
         "IF(z.t <> '', CONCAT('<br>    - mut&#39;ah berupa ', z.t, ';'), ''), "
         "IF(z.m <> '', CONCAT('<br>    - nafkah lampau (nafkah madliyah) sebesar ', z.m, ';'), ''), "
         "IF(z.h <> '', CONCAT('<br>    - mahar yang masih terhutang berupa ', z.h, ';'), ''), "
         "IF(z.a <> '', CONCAT('<br>    - biaya hadhanah #9302# yang bernama #9304# sebesar ', z.a, ' setiap bulan', IF(z.an <> '', CONCAT(', dengan kenaikan sebesar ', z.an, ' setiap tahun'), ''), "
         "', sampai #9302# tersebut dewasa atau mampu berdiri sendiri (berumur 21 (dua puluh satu) tahun), yang diserahkan kepada #0046# selaku #9759#;'), ''), "
         "IF(z.aj <> '', CONCAT('<br>    - nafkah lampau #9302# tersebut', IF(z.al <> '', CONCAT(' ', z.al), ''), ' sejumlah ', z.aj, ';'), ''), "
         "IF(z.nada = 0 AND z.a = '' AND z.aj = '', '<br>    - hak bekas istri belum diisi - isi variabel 9712, 9713, 9711, 3751, 3752, 3753 atau 9740;', ''))"))

# 3774 AMAR JUMLAH, WAKTU PEMBAYARAN
V(3774, 'AMAR HAK BEKAS ISTRI: JUMLAH SELURUHNYA DAN WAKTU PEMBAYARAN (OTOMATIS dari jumlah hak dan isian 3756; kosong bila tidak ada)', 'data_sql',
  dari_z("CONCAT(IF(z.tt > 0 AND z.nuang >= 2, CONCAT('<br>    - seluruhnya berjumlah #3761# (#3762#)', "
         "IF(z.nuang < z.nada OR " + ANAK + ", CONCAT(', tidak termasuk ', CONCAT_WS(' dan ', IF(z.nuang < z.nada, 'hak yang bukan berupa uang', NULL), IF(" + ANAK + ", 'biaya hadhanah anak', NULL))), ''), ';'), ''), "
         "IF(z.w <> '', CONCAT('<br>    - dengan ketentuan pembayaran tersebut dilakukan ', z.w, ';'), ''))"))

# 3775 BANTAHAN TERGUGAT
V(3775, 'PERTIMBANGAN HAK BEKAS ISTRI: BANTAHAN/EKSEPSI TERGUGAT (OTOMATIS dari isian 3750; kosong bila tidak ada bantahan)', 'data_sql',
  dari_z("IF(z.bt = '', '', CONCAT('<br>Menimbang, bahwa ', z.bt, ';'))"))

# 3776-3779 SITA JAMINAN (hanya untuk biaya hadhanah anak: SEMA 5/2021 Kamar Agama, Hukum Perkawinan huruf a, seperti blangko nafkah anak)
V(3776, 'PERTIMBANGAN HAK BEKAS ISTRI: SITA JAMINAN BILA GUGATAN DIKABULKAN (OTOMATIS dari isian 3754; kosong = tanpa sita)', 'data_sql',
  dari_z(W("z.sita <> ''",
           '<br>Menimbang, bahwa #0046# juga memohon sita jaminan atas harta milik #0047# berupa ', '@z.sita',
           ' sebagai jaminan pemenuhan biaya hadhanah #9302# tersebut; menurut Surat Edaran Mahkamah Agung Nomor 5 Tahun 2021 (Rumusan Hukum Kamar Agama, Hukum Perkawinan huruf a), '
           'untuk memenuhi asas kepentingan terbaik bagi anak dan pelaksanaan Peraturan Mahkamah Agung Nomor 3 Tahun 2017 tentang Pedoman Mengadili Perkara Perempuan Berhadapan dengan Hukum, '
           'terhadap pembebanan nafkah anak dapat dimohonkan penetapan sita terhadap harta milik suami sebagai jaminan pemenuhan nafkah anak, dengan objek jaminan diuraikan secara rinci '
           'dalam posita dan petitum gugatan, sehingga #8554# berpendapat sita jaminan atas objek tersebut patut dinyatakan sah dan berharga;')))
V(3777, 'AMAR HAK BEKAS ISTRI: SITA JAMINAN BILA GUGATAN DIKABULKAN (OTOMATIS dari isian 3754; kosong = tanpa sita)', 'data_sql',
  dari_z(W("z.sita <> ''", '<br>    - dengan jaminan berupa sita jaminan (conservatoir beslag) atas harta milik #0047# berupa ', '@z.sita', ', yang dinyatakan sah dan berharga;')))
V(3778, 'PERTIMBANGAN HAK BEKAS ISTRI: PENGANGKATAN SITA JAMINAN BILA GUGATAN TIDAK DIKABULKAN (OTOMATIS dari isian 3754; kosong = tanpa sita)', 'data_sql',
  dari_z(W("z.sita <> ''",
           '<br>Menimbang, bahwa oleh karena gugatan tidak dikabulkan (ditolak, tidak dapat diterima, dicabut, gugur atau dibatalkan dari pendaftaran), maka sita jaminan (conservatoir beslag) '
           'atas harta milik #0047# berupa ', '@z.sita', ' yang telah diletakkan harus diperintahkan untuk diangkat, sebagaimana Buku II Edisi Revisi 2013 (Pedoman Pelaksanaan Tugas dan '
           'Administrasi Peradilan Agama, bagian Sita Jaminan) yang menentukan sita diperintahkan diangkat bila gugatan ditolak atau dinyatakan tidak dapat diterima;')))
V(3779, 'AMAR HAK BEKAS ISTRI: PENGANGKATAN SITA JAMINAN BILA GUGATAN TIDAK DIKABULKAN (OTOMATIS dari isian 3754; kosong = tanpa sita)', 'data_sql',
  dari_z(W("z.sita <> ''", ', dan memerintahkan agar sita jaminan (conservatoir beslag) atas harta milik #0047# berupa ', '@z.sita', ' diangkat')))

# 3772 - fakta masa iddah (kalimat sesudah "Bahwa"; selalu terisi)
V(3772, 'FAKTA HAK BEKAS ISTRI: MASA IDDAH (OTOMATIS dari isian 3742, 3743, 3744: kalimat sesudah kata "Bahwa")', 'data_sql',
  dari_z(cc('masa iddah #0046# ', "@IF(z.ii = '', 'adalah sebagaimana ditentukan Pasal 153 ayat (2) Kompilasi Hukum Islam', CONCAT('adalah ', z.ii))",
            "@IF(z.tp = '', '', CONCAT(' yang dihitung sejak ', z.tp, ' (Pasal 153 ayat (4) Kompilasi Hukum Islam)'))",
            "@IF(z.ik LIKE '%berakhir%', ' dan masa iddah tersebut telah berakhir pada saat gugatan ini diajukan, sedangkan #0047# belum memenuhi kewajibannya', "
            "IF(z.ik LIKE '%berjalan%', ' dan masa iddah tersebut masih berjalan pada saat gugatan ini diajukan', ''))")))


# ---------------------------------------------------------------------------------------------------------------------
# ISIAN: variabel data_teks yang tidak mungkin terisi otomatis. Satu kode tidak boleh di kedua daftar.
#   manual   = keputusan/penilaian majelis atau fakta persidangan; opsional = tambahan bila ada. 3757 dan 3758 berbawaan (tidak didaftarkan).
# Catatan: 9711, 9712, 9713, 9714, 9740, 9741, 9746, 9747 sudah didaftarkan di portal (isian-metadata.ts) - dipakai ulang, tidak didaftarkan lagi.
# ---------------------------------------------------------------------------------------------------------------------
ISIAN = {
    '3740': ('manual', 'Nomor dan tanggal putusan perceraian serta akta cerai ada di berkas perkara cerai atau bukti surat; diisi dari bukti yang diajukan.'),
    '3741': ('manual', 'Cerai talak atau cerai gugat dibaca dari putusan perceraian; posita menyebutnya bila jelas, selebihnya dipilih dari bukti.'),
    '3742': ('manual', 'Tanggal ikrar talak atau putusan cerai berkekuatan hukum tetap adalah awal masa iddah; diisi dari akta cerai atau putusan perceraian.'),
    '3743': ('manual', 'Masa iddah (haid, tidak haid, hamil, atau tanpa iddah) ditentukan majelis dari keadaan Penggugat; tidak tercatat di SIPP.'),
    '3744': ('manual', 'Apakah masa iddah masih berjalan saat gugatan diajukan dihitung majelis dari tanggal putus dan tanggal pendaftaran perkara.'),
    '3745': ('manual', 'Keadaan dukhul (bada atau qobla al dukhul) diterangkan para pihak dan saksi; posita jarang menyebutnya tegas.'),
    '3746': ('manual', 'Terbukti atau tidaknya nusyuz adalah penilaian majelis atas bukti dan saksi.'),
    '3747': ('manual', 'Apakah hak-hak itu pernah diputus dalam perkara cerai diperiksa majelis dari putusan perceraian; menentukan nebis in idem.'),
    '3749': ('manual', 'Fakta kepatutan besaran (lama perkawinan, keadaan Penggugat, penghasilan Tergugat) adalah temuan majelis dari saksi dan bukti.'),
    '3755': ('manual', 'Alasan sebagian petitum atau seluruh gugatan ditolak adalah pertimbangan majelis.'),
    '3748': ('opsional', 'Hanya bila sebagian hak telah diputus dalam perkara cerai.'),
    '3750': ('opsional', 'Hanya bila Tergugat mengajukan bantahan atau eksepsi yang perlu ditanggapi majelis.'),
    '3751': ('opsional', 'Hanya bila maskan dituntut dan dikabulkan.'),
    '3752': ('opsional', 'Hanya bila kiswah dituntut dan dikabulkan.'),
    '3753': ('opsional', 'Hanya bila mahar terhutang dituntut dan dikabulkan.'),
    '3754': ('opsional', 'Hanya bila ada sita jaminan untuk biaya hadhanah anak.'),
    '3756': ('opsional', 'Waktu pembayaran hanya bila majelis menentukannya dalam amar.'),
}

# Label bahasa mudah untuk popup (format RAMAH di susun.ts blangko-derry). {P}/{T} = sebutan pihak.
RAMAH = {
    '3740': dict(nm='Putusan perceraian dan akta cerai (nomor dan tanggal)', saran='putusan Pengadilan Agama Donggala Nomor 100/Pdt.G/2025/PA.Dgl tanggal 3 Maret 2025 yang telah berkekuatan hukum tetap dan Akta Cerai Nomor 50/AC/2025/PA.Dgl tanggal 20 Maret 2025'),
    '3741': dict(nm='Cara perkawinan putus', pil=['cerai talak', 'cerai gugat'], saran='cerai talak'),
    '3742': dict(nm='Tanggal perkawinan putus (ikrar talak atau putusan cerai berkekuatan hukum tetap)', saran='20 Maret 2025'),
    '3743': dict(nm='Masa iddah {P}', pil=['3 (tiga) kali suci dengan sekurang-kurangnya 90 (sembilan puluh) hari', '90 (sembilan puluh) hari karena tidak haid',
                                          'sampai melahirkan karena dalam keadaan hamil', 'tidak ada masa iddah karena qobla al dukhul']),
    '3744': dict(nm='Masa iddah saat gugatan diajukan', pil=['masih berjalan', 'telah berakhir']),
    '3745': dict(nm='Keadaan dukhul {P} dan {T}', pil=['selama menjadi suami istri #0046# dan #0047# telah bergaul sebagaimana layaknya suami istri (bada al dukhul)',
                                                       'antara #0046# dan #0047# belum pernah terjadi hubungan sebagaimana layaknya suami istri (qobla al dukhul)']),
    '3746': dict(nm='Nusyuz {P}', pil=['dalam perkara ini tidak ditemukan bukti bahwa #0046# berbuat nusyuz', '#0046# terbukti berbuat nusyuz sehingga tidak berhak atas nafkah iddah, maskan dan kiswah']),
    '3747': dict(nm='Apakah hak-hak ini sudah diputus dalam perkara cerai', pil=[
        'hak-hak bekas istri yang dituntut dalam perkara ini belum pernah dituntut dan belum pernah diputus dalam perkara perceraian #0046# dan #0047#',
        'hak-hak bekas istri yang dituntut dalam perkara ini pernah dituntut dalam perkara perceraian #0046# dan #0047# tetapi tidak dipertimbangkan sehingga belum diputus',
        'hak-hak bekas istri yang dituntut dalam perkara ini telah diputus dalam perkara perceraian #0046# dan #0047#']),
    '3748': dict(nm='Hak yang sudah diputus dalam perkara cerai (kosong = tidak ada)', saran='nafkah iddah dan mutah dalam putusan Nomor 100/Pdt.G/2025/PA.Dgl'),
    '3749': dict(nm='Fakta kepatutan besaran: lama perkawinan, keadaan {P}, penghasilan {T}', saran='perkawinan {P} dan {T} berlangsung selama 10 tahun dan {P} tidak bekerja'),
    '3750': dict(nm='Bantahan atau eksepsi {T} dan tanggapan majelis (kosong = tidak ada)', saran='bantahan {T} bahwa tuntutan telah daluwarsa tidak beralasan karena tidak ada ketentuan yang membatasi waktu tuntutan tersebut'),
    '3751': dict(nm='Maskan (tempat tinggal) selama iddah: jumlah dan rincian (kosong = tidak dikabulkan)', saran='Rp1.500.000,00 (3 bulan x Rp500.000,00)'),
    '3752': dict(nm='Kiswah (pakaian) selama iddah: jumlah dan rincian (kosong = tidak dikabulkan)', saran='Rp900.000,00 (3 bulan x Rp300.000,00)'),
    '3753': dict(nm='Mahar yang masih terhutang: jumlah atau bentuk (kosong = tidak ada)', saran='Rp5.000.000,00'),
    '3754': dict(nm='Sita jaminan untuk biaya hadhanah anak: objek dirinci dan nomor serta tanggal berita acara sita (kosong = tanpa sita)'),
    '3755': dict(nm='Alasan petitum atau gugatan ditolak (kalimat sesudah "Menimbang, bahwa")', saran='{P} terbukti nusyuz sehingga tidak berhak atas nafkah iddah, maskan dan kiswah'),
    '3756': dict(nm='Waktu pembayaran (kosong = tidak ditentukan)', pil=['segera setelah putusan ini berkekuatan hukum tetap',
                                                                      'paling lambat 30 (tiga puluh) hari sejak putusan ini berkekuatan hukum tetap']),
    '3757': dict(nm='Alat bukti surat {P} (daftar bukti P.1 dan seterusnya)'),
    '3758': dict(nm='Alat bukti surat {T} (daftar bukti T.1 dan seterusnya)'),
}

# ---------------------------------------------------------------------------------------------------------------------
# PETA: semua blangko putusan/penetapan jenis ini (status, keadaan unik)
# ---------------------------------------------------------------------------------------------------------------------
_KEADAAN = {
    '[01] ': '', '[01a] ': 't-tidak-hadir-setelah-mediasi', '[01b] ': 'verstek', '[02] ': '', '[02b] ': 'verstek', '[03] ': '', '[03b] ': 'verstek',
    '[97] ': '', '[98] ': '', '[98b] ': 'sesudah-jawaban', '[98a] ': '', '[98c] ': '', '[99] ': 'sema-1-2022', '[99a] ': 'kurang-pihak', '[99b] ': 'cacat-formil',
}
BERKAS = [
    '[01] [Kabul] Hak Bekas Istri - Kontradiktoir.rtf',
    '[01a] [Kabul] Hak Bekas Istri - T Tidak Hadir Setelah Mediasi.rtf',
    '[01b] [Kabul Verstek] Hak Bekas Istri.rtf',
    '[02] [Kabul Sebagian] Hak Bekas Istri - Kontradiktoir - Petitum Selebihnya Ditolak.rtf',
    '[02b] [Kabul Sebagian Verstek] Hak Bekas Istri - T Tidak Hadir - Petitum Selebihnya Ditolak.rtf',
    '[03] [Tolak] Hak Bekas Istri - Kontradiktoir - Dalil Tidak Terbukti.rtf',
    '[03b] [Tolak Verstek] Hak Bekas Istri - T Tidak Hadir - Dalil Tidak Terbukti.rtf',
    '[97] [Perdamaian] Hak Bekas Istri - Akta Perdamaian.rtf',
    '[98] [Cabut] Hak Bekas Istri - P & T Hadir Sebelum Jawaban.rtf',
    '[98b] [Cabut] Hak Bekas Istri - Sesudah Jawaban dengan Persetujuan T.rtf',
    '[98a] [Gugur] Hak Bekas Istri - P Tidak Hadir Sidang Pertama.rtf',
    '[98c] [Coret] Hak Bekas Istri - Dibatalkan dari Pendaftaran - Panjar Habis.rtf',
    '[99] [NO] Hak Bekas Istri - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022).rtf',
    '[99a] [NO] Hak Bekas Istri - Kurang Pihak (Plurium Litis Consortium).rtf',
    '[99b] [NO] Hak Bekas Istri - Gugatan Kabur (Obscuur Libel).rtf',
]
_CATATAN = {
    '[01] ': 'Dikabulkan seluruhnya; hak yang terisi (nafkah iddah, maskan, kiswah, mutah, madliyah, mahar, biaya hadhanah) tercetak di amar.',
    '[02] ': 'Dikabulkan sebagian; hak yang dikosongkan tidak tercetak dan petitum selebihnya ditolak (alasan di isian 3755).',
    '[03] ': 'Ditolak; alasan di isian 3755 (mis. nusyuz, telah diputus dalam perkara cerai).',
    '[99b] ': 'Gugatan kabur (obscuur libel); uraian di variabel 9651.',
}
PETA = []
for _b in BERKAS:
    _k = _b.split(']')[0] + '] '
    PETA.append(L.meta(J, _b, _KEADAAN[_k], _CATATAN.get(_k, '')))


def bangun():
    """Menulis semua RTF jenis ini (idempoten): 15 putusan ke folder putusan, 38 BAS ke folder BAS. Mengembalikan (jumlah putusan, jumlah BAS)."""
    import w3aD_susun as S
    p = S.bangun_putusan()
    b = S.bangun_bas()
    return len(p), len(b)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    n_p, n_b = bangun()
    from variabel_def import VAR
    mine = [v for v in VAR if 3740 <= v['no'] <= 3789]
    print('hak-bekas-istri: putusan %d, BAS %d, variabel baru %d (data_teks %d, data_sql %d), ISIAN %d, RAMAH %d, PETA %d' % (
        n_p, n_b, len(mine), sum(1 for v in mine if v['tipe'] != 'data_sql'), sum(1 for v in mine if v['tipe'] == 'data_sql'), len(ISIAN), len(RAMAH), len(PETA)))
