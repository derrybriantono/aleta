# -*- coding: utf-8 -*-
"""Penyusun variabel ABT paket U2 (putusan cerai gugat / cerai talak / kumulasi / ikrar), nomor 4100-4299.

Hasil: data/variabel.json  = [{no, nama, tipe, default, sql}]  (sql berisi nama basis data NYATA aps_badilag.)

ATURAN YANG DIJAGA
- Semua teks dalam SQL ASCII murni (tidak ada kutip lengkung, huruf Arab, atau garis miring terbalik): ABT membaca
  teks literal sesuai karakter klien; yang non-ASCII bisa rusak. Kutip ganda di teks ditulis &quot;.
- Tanpa kata aplikasi ini di keluaran maupun nama variabel.
- Isian petugas dibaca dengan pola pengaman yang sama dengan variabel Derry lain (garis miring terbalik -> /, kutip -> entitas).
- Keputusan hakim = pilihan pada isian data_teks; mesin hanya menyusun kalimat dari pilihan itu. Pilihan kosong sedangkan
  petitum menuntut = kalimat [PERIKSA: ...] (terdeteksi sebagai sisa blangko), BUKAN putusan otomatis.
- Dasar hukum hanya yang sudah dipakai blangko Derry (UU 1/1974 jo. 16/2019, UU 7/1989 jo. 3/2006 jo. 50/2009, KHI,
  PP 9/1975, SEMA 1/2017, 3/2015, 3/2018, 1/2022, PERMA 3/2017, 1/2016, UU 23/2002 jo. 35/2014, RBg).
"""
import json, os, re, sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = 'aps_badilag'

# ----------------------------------------------------------------------------------------------------------------------
# Primitif SQL
# ----------------------------------------------------------------------------------------------------------------------


def T(n, db=DB):
    """Isian data_teks bersih (nol bila tidak ada)."""
    return ("IFNULL(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM %s.abt_data_teks WHERE no_var=%d AND perkara_id='#perkara_id#' LIMIT 1) "
            "USING utf8),'\\\\','/'),'\"','&quot;'),'''','&#39;'),'')") % (db, n)


def lit(s):
    assert '"' not in s and '\\' not in s, s
    assert all(ord(ch) < 128 for ch in s), [ch for ch in s if ord(ch) >= 128]
    s = re.sub(r';[ ]+(?=[A-Za-z0-9])', ';', s)  # ABT menambah satu spasi sesudah tiap titik koma
    return '"' + s + '"'


def tpl(teks):
    """'Menimbang {I} ... {ai_t}' -> CONCAT("Menimbang ", c.I, " ... ", c.ai_t). Kurung kurawal = kolom tabel turunan c."""
    bag = re.split(r'(\{[a-zA-Z0-9_]+\})', teks)
    out = []
    for b in bag:
        if not b:
            continue
        if b.startswith('{') and b.endswith('}'):
            out.append('c.' + b[1:-1])
        else:
            out.append(lit(b))
    return 'CONCAT(' + ', '.join(out) + ')' if len(out) > 1 else (out[0] if out else '""')


def JIKA(cond, a, b='""'):
    return 'IF(%s, %s, %s)' % (cond, a, b)


def GABUNG(*xs):
    return 'CONCAT(' + ', '.join(xs) + ')'


def CLS(col):
    lc = 'LOWER(TRIM(%s))' % col
    return ("CASE WHEN {l}='' THEN 'K' WHEN {l} REGEXP 'tidak dapat diterima|niet ontvankelijk' THEN 'N' WHEN {l} REGEXP 'tolak' THEN 'T' "
            "WHEN {l} REGEXP 'sebagian' THEN 'S' WHEN {l} REGEXP 'ex officio|karena jabatan' THEN 'X' WHEN {l} REGEXP 'kabul|seluruh' THEN 'A' ELSE 'K' END").format(l=lc)


def ALASAN(col):
    return "IF(LOCATE(':', %s) > 0, TRIM(SUBSTRING(%s, LOCATE(':', %s) + 1)), '')" % (col, col, col)


PET = ("LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(IFNULL(p.petitum,''), ' ', IFNULL((SELECT GROUP_CONCAT(r.isi_petitum SEPARATOR ' ') FROM perkara_rekonvensi r WHERE r.perkara_id = p.perkara_id),'')),"
       "'<strong>',''),'</strong>',''),'<em>',''),'</em>',''),'&nbsp;',' '),CHAR(10),' '),CHAR(13),' '))")

RE_H = ('hadhanah|hadlanah|hadanah|hak asuh|hak pengasuhan|kuasa asuh|hak pemeliharaan|pemeliharaan anak|pengasuhan anak|asuhan anak|'
        'di bawah (asuhan|pemeliharaan)|berada (di bawah|dalam) (asuhan|pemeliharaan|hadhanah)')
RE_N = 'nafkah[^;]{0,60}anak|anak[^;]{0,60}nafkah|biaya (hidup|pemeliharaan|pendidikan|kebutuhan)[^;]{0,60}anak|biaya anak'
RE_I = 'iddah|idah'
RE_M = 'mut[^a-z]{0,4}ah'
RE_D = 'madli|madhi|mahdhi|lampau|yang lalu|terhutang'
RE_B = 'harta bersama|harta gono|gono.?gini'

# Nomor isian (data_teks) dan isian lama yang dibaca ulang
N_KEP_H, N_KEP_N, N_KEP_I, N_KEP_M, N_KEP_D, N_KEP_B = 4100, 4101, 4102, 4103, 4104, 4105
N_MUM, N_KMP, N_ANAK_DIDENGAR, N_BAYAR = 4106, 4107, 4108, 4109


def _paksa(cls, paksa):
    """Varian blangko Mut'ah Iddah: pilihan kosong dianggap ex officio (X) karena blangkonya sendiri memutuskan mut'ah dan iddah."""
    return "IF((%s) = 'K', 'X', (%s))" % (cls, cls) if paksa else cls


def tabel_turunan(db=DB, paksa=False):
    """Tabel turunan c: satu baris, semua bahan yang dipakai pertimbangan dan amar. Isian dibaca SEKALI lewat tabel pivot i."""
    nomor = (N_KEP_H, N_KEP_N, N_KEP_I, N_KEP_M, N_KEP_D, N_KEP_B, N_MUM, N_KMP, N_ANAK_DIDENGAR, N_BAYAR,
             6054, 9712, 6055, 9713, 7120, 9711, 9740, 6071, 6072, 9741, 9050, 9715, 2004, 8503, 9944, 246, 8730)
    pivot = ", ".join("IFNULL(MAX(CASE WHEN d.no_var = %d THEN d.data END), '') AS i%d" % (n, n) for n in nomor)
    pv = ("(SELECT %s FROM (SELECT no_var, IFNULL(REPLACE(REPLACE(REPLACE(CONVERT(data USING utf8),'\\\\','/'),'\"','&quot;'),'''','&#39;'),'') AS data "
          "FROM %s.abt_data_teks WHERE perkara_id = '#perkara_id#' AND no_var IN (%s)) d) i") % (pivot, db, ", ".join(str(n) for n in nomor))
    dalam = ("SELECT p.jenis_perkara_id AS jn, %s AS pet, "
             "(SELECT COUNT(*) FROM perkara_kumulasi k WHERE k.perkara_id = p.perkara_id AND k.jenis_perkara_id = 349) AS kh, "
             "(SELECT COUNT(*) FROM perkara_kumulasi k WHERE k.perkara_id = p.perkara_id AND k.jenis_perkara_id = 348) AS kbh, "
             "(SELECT COUNT(*) FROM perkara_rekonvensi r WHERE r.perkara_id = p.perkara_id) AS rk, "
             "TRIM(i.i4100) AS r_h, TRIM(i.i4101) AS r_n, TRIM(i.i4102) AS r_i, TRIM(i.i4103) AS r_m, TRIM(i.i4104) AS r_d, TRIM(i.i4105) AS r_b, "
             "TRIM(i.i4106) AS r_mum, TRIM(i.i4107) AS r_kmp, TRIM(i.i4108) AS r_did, TRIM(i.i4109) AS r_byr, "
             "COALESCE(NULLIF(TRIM(i.i6054),''), NULLIF(TRIM(i.i9712),''), '') AS v_ai, "
             "COALESCE(NULLIF(TRIM(i.i6055),''), NULLIF(TRIM(i.i9713),''), '') AS v_am, "
             "COALESCE(NULLIF(TRIM(i.i7120),''), NULLIF(TRIM(i.i9711),''), '') AS v_ad, "
             "COALESCE(NULLIF(TRIM(i.i9740),''), NULLIF(TRIM(i.i6071),''), NULLIF(TRIM(i.i6072),''), '') AS v_an, "
             "COALESCE(NULLIF(TRIM(i.i9741),''), NULLIF(TRIM(i.i9050),''), '') AS v_ak, "
             "TRIM(i.i9715) AS v_9715, TRIM(i.i2004) AS v_2004, TRIM(i.i8503) AS v_8503, TRIM(i.i9944) AS v_9944, "
             "TRIM(i.i246) AS v_246, TRIM(i.i8730) AS v_8730 "
             "FROM perkara p JOIN %s ON 1 = 1 WHERE p.perkara_id = '#perkara_id#'") % (PET, pv)
    luar = (
        "SELECT w.*, IF(w.jn = 346, \"#0046#\", \"#0047#\") AS S, IF(w.jn = 346, \"#0047#\", \"#0046#\") AS I, "
        "IF(w.jn = 346, \"#0100#\", \"#0104#\") AS kerja_s, "
        "IF(w.jn = 346, 1, 0) AS ct, "
        "IF(w.pet REGEXP '%(h)s' OR w.kh > 0, 1, 0) AS th, IF(w.pet REGEXP '%(n)s', 1, 0) AS tn, IF(w.pet REGEXP '%(i)s', 1, 0) AS ti, "
        "IF(w.pet REGEXP '%(m)s', 1, 0) AS tm, IF(w.pet REGEXP '%(d)s', 1, 0) AS td, IF(w.pet REGEXP '%(b)s' OR w.kbh > 0, 1, 0) AS tb, "
        "%(ch)s AS ch, %(cn)s AS cn, %(ci)s AS ci, %(cm)s AS cm, %(cd)s AS cd, %(cb)s AS cb, "
        "%(ah)s AS al_h, %(an)s AS al_n, %(ai)s AS al_i, %(am)s AS al_m, %(ad)s AS al_d, %(ab)s AS al_b, "
        "IF(LOWER(w.r_h) REGEXP 'ayah|bapak|suami', IF(w.jn = 346, \"#0046#\", \"#0047#\"), IF(w.jn = 346, \"#0047#\", \"#0046#\")) AS hold, "
        "IF(LOWER(w.r_h) REGEXP 'ayah|bapak|suami', IF(w.jn = 346, \"#0047#\", \"#0046#\"), IF(w.jn = 346, \"#0046#\", \"#0047#\")) AS other, "
        "IF(LOWER(w.r_h) REGEXP 'ayah|bapak|suami', 'ayah kandung', 'ibu kandung') AS hub_hold, "
        "IF(LOWER(w.r_h) REGEXP 'ayah|bapak|suami', 'ibu kandung', 'ayah kandung') AS hub_other, "
        "IF(LOWER(w.r_mum) REGEXP 'mumayyiz' AND LOWER(w.r_mum) NOT REGEXP 'belum', 1, 0) AS mm, "
        "IF(w.v_ai = '', '', IF(w.v_ai REGEXP '^[Rr]p', CONCAT('sejumlah ', w.v_ai), w.v_ai)) AS ai_a, "
        "IF(w.v_am = '', '', IF(w.v_am REGEXP '^(berupa|sejumlah|sebesar|uang|emas|barang)', IF(w.v_am REGEXP '^(uang|emas|barang)', CONCAT('berupa ', w.v_am), w.v_am), IF(w.v_am REGEXP '^[Rr]p', CONCAT('berupa uang sejumlah ', w.v_am), CONCAT('berupa ', w.v_am)))) AS am_a, "
        "IF(w.v_ad = '', '', IF(w.v_ad REGEXP '^[Rr]p', CONCAT('sejumlah ', w.v_ad), w.v_ad)) AS ad_a, "
        "IF(w.v_an = '', '', IF(w.v_an REGEXP '^[Rr]p', CONCAT('sebesar ', w.v_an, ' setiap bulan'), w.v_an)) AS an_a, "
        "w.v_ak AS ak_a, "
        "IF(w.r_kmp <> '', w.r_kmp, CONCAT('bahwa ', IF(w.jn = 346, \"#0046#\", \"#0047#\"), ' bekerja sebagai ', IF(w.jn = 346, \"#0100#\", \"#0104#\"))) AS kmp, "
        "IF(w.r_byr <> '', LOWER(w.r_byr), IF(w.jn = 346, 'sebelum ikrar talak', IF(LOWER(w.v_9715) = 'ya', 'sebelum akta cerai', ''))) AS byr, "
        "IF(w.v_2004 <> '', w.v_2004, '') AS asuh_now "
        "FROM (%(dalam)s) w"
    ) % dict(
        h=RE_H, n=RE_N, i=RE_I, m=RE_M, d=RE_D, b=RE_B,
        ch=CLS('w.r_h'), cn=CLS('w.r_n'), ci=_paksa(CLS('w.r_i'), paksa), cm=_paksa(CLS('w.r_m'), paksa), cd=CLS('w.r_d'), cb=CLS('w.r_b'),
        ah=ALASAN('w.r_h'), an=ALASAN('w.r_n'), ai=ALASAN('w.r_i'), am=ALASAN('w.r_m'), ad=ALASAN('w.r_d'), ab=ALASAN('w.r_b'),
        dalam=dalam)
    return '(' + luar + ') c'


def SEL(ekspr, db=DB, paksa=False):
    return 'SELECT %s AS data FROM %s' % (ekspr, tabel_turunan(db, paksa))


def PERIKSA(teks):
    return lit('[PERIKSA: ' + teks + ']<br>')


# ----------------------------------------------------------------------------------------------------------------------
# Kutipan dasar hukum (diangkat dari blangko Derry yang sudah ada)
# ----------------------------------------------------------------------------------------------------------------------
P41C = ('ketentuan Pasal 41 huruf c Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019 '
        'menyebutkan bahwa Pengadilan dapat mewajibkan kepada bekas suami untuk memberikan biaya penghidupan dan/atau menentukan suatu kewajiban bagi bekas istri')
SEMA_1_2017 = ('hasil rumusan Kamar Agama dalam Surat Edaran Mahkamah Agung (SEMA) Nomor 1 Tahun 2017 tentang Pemberlakuan Rumusan Hasil Rapat Pleno Kamar '
               'Mahkamah Agung Tahun 2017 Sebagai Pedoman Pelaksanaan Tugas Bagi Pengadilan pada huruf C angka 1, dalam rangka pelaksanaan Peraturan Mahkamah Agung '
               '(PERMA) Nomor 3 Tahun 2017 tentang Pedoman Mengadili Perkara Perempuan Berhadapan dengan Hukum untuk memberi perlindungan hukum bagi hak-hak perempuan '
               'pasca perceraian')


def blok(*bagian):
    """Gabungan potongan CONCAT yang boleh kosong."""
    return GABUNG(*bagian)


# ----------------------------------------------------------------------------------------------------------------------
# PERTIMBANGAN per tuntutan. Setiap fungsi -> ekspresi SQL (string) yang bernilai teks atau ''.
# Kolom c.* lihat tabel_turunan().
# ----------------------------------------------------------------------------------------------------------------------


def pert_hadhanah():
    awal_ab = tpl('Menimbang, bahwa selain perceraian, dalam perkara ini dituntut pula agar #5114# {S} dan {I} yang bernama #8602# ditetapkan berada di bawah pemeliharaan (hadhanah) {hold}. '
                  'Tuntutan mengenai penguasaan anak tersebut dapat diajukan bersama-sama dengan perkara perceraian sebagaimana ketentuan Pasal 86 ayat (1) Undang-Undang Nomor 7 Tahun 1989 '
                  'tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, oleh karena itu #8554# '
                  'akan mempertimbangkannya bersama-sama dengan pokok perkara perceraian;<br>')
    awal_x = tpl('Menimbang, bahwa meskipun tidak ada tuntutan mengenai hak asuh, perkara ini menyangkut #5114# {S} dan {I} yang bernama #8602#; berdasarkan Pasal 41 huruf a Undang-Undang Nomor 1 Tahun 1974 '
                 'tentang Perkawinan sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019, baik ibu atau bapak tetap berkewajiban memelihara dan mendidik anak-anaknya semata-mata berdasarkan '
                 'kepentingan anak, dan bilamana ada perselisihan mengenai penguasaan anak, Pengadilan memberi keputusannya, sehingga #8554# secara ex officio mempertimbangkan penetapan pemeliharaan (hadhanah) '
                 '#5114# tersebut;<br>')
    fakta_belum = tpl('Menimbang, bahwa berdasarkan bukti surat dan keterangan saksi-saksi yang saling bersesuaian, telah terbukti bahwa dari perkawinan {S} dan {I} telah lahir #5114# yang bernama #8602#, '
                      'yang hingga kini belum berumur 12 (dua belas) tahun atau belum mumayyiz, dan sejak {S} dan {I} berpisah tempat tinggal, #5114# tersebut berada dalam asuhan dan pemeliharaan ')
    fakta_belum = GABUNG(fakta_belum, JIKA("c.asuh_now <> ''", 'c.asuh_now', 'c.hold'), lit(' serta terpelihara dengan baik;<br>'))
    dasar_belum = tpl('Menimbang, bahwa Pasal 105 huruf a Kompilasi Hukum Islam menentukan pemeliharaan anak yang belum mumayyiz atau belum berumur 12 tahun adalah hak ibunya, dan Pasal 156 huruf a '
                      'Kompilasi Hukum Islam menentukan anak yang belum mumayyiz berhak mendapatkan hadhanah dari ibunya, kecuali bila ibunya telah meninggal dunia;<br>')
    fakta_mm = tpl('Menimbang, bahwa berdasarkan bukti surat dan keterangan saksi-saksi yang saling bersesuaian, telah terbukti bahwa dari perkawinan {S} dan {I} telah lahir #5114# yang bernama #8602#, '
                   'yang telah mumayyiz atau telah berumur 12 (dua belas) tahun atau lebih, dan hingga kini berada dalam asuhan ')
    fakta_mm = GABUNG(fakta_mm, JIKA("c.asuh_now <> ''", 'c.asuh_now', 'c.hold'), lit(';<br>'))
    dasar_mm = tpl('Menimbang, bahwa Pasal 105 huruf b Kompilasi Hukum Islam menentukan pemeliharaan anak yang sudah mumayyiz diserahkan kepada anak untuk memilih di antara ayah atau ibunya sebagai '
                   'pemegang hak pemeliharaannya, dan Pasal 156 huruf b Kompilasi Hukum Islam menentukan anak yang sudah mumayyiz berhak memilih untuk mendapatkan hadhanah dari ayah atau ibunya, '
                   'oleh karena itu #8554# mendengar pendapat anak tersebut di persidangan;<br>')
    didengar = GABUNG(JIKA("c.r_did <> ''", GABUNG(lit('Menimbang, bahwa berdasarkan hasil mendengar pendapat anak di persidangan, '), 'c.r_did', lit(';<br>')),
                           PERIKSA('isi hasil mendengar pendapat anak yang mumayyiz (isian pendapat anak mumayyiz)')))
    terbaik = tpl('Menimbang, bahwa dalam menetapkan pemeliharaan anak, yang paling utama dipertimbangkan adalah kepentingan terbaik bagi anak (the best interest of the child) sebagaimana dimaksud '
                  'Pasal 2 huruf b dan Pasal 14 ayat (1) Undang-Undang Nomor 23 Tahun 2002 tentang Perlindungan Anak sebagaimana telah diubah dengan Undang-Undang Nomor 35 Tahun 2014, '
                  'dan tidak ternyata adanya keadaan yang menjadikan {hold} selaku {hub_hold} tidak layak memegang hak hadhanah;<br>')
    akses = tpl('Menimbang, bahwa berdasarkan Surat Edaran Mahkamah Agung Nomor 1 Tahun 2017 tentang Pemberlakuan Rumusan Hasil Rapat Pleno Kamar Mahkamah Agung Tahun 2017 sebagai Pedoman Pelaksanaan Tugas '
                'bagi Pengadilan, Rumusan Hukum Kamar Agama, dalam amar penetapan hak asuh anak (hadhanah) harus dicantumkan kewajiban pemegang hak hadhanah memberi akses kepada orang tua yang tidak '
                'memegang hak hadhanah untuk bertemu dengan anaknya, dan tidak memberi akses tersebut dapat dijadikan alasan untuk mengajukan gugatan pencabutan hak hadhanah;<br>')
    kabul = tpl('Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, tuntutan mengenai hak asuh anak beralasan hukum dan patut dikabulkan dengan menetapkan #5114# tersebut berada di bawah '
                'pemeliharaan (hadhanah) {hold} selaku {hub_hold}nya, dengan kewajiban {hold} memberikan akses kepada {other} selaku {hub_other}nya untuk bertemu, mencurahkan kasih sayang, '
                'dan ikut serta dalam pengasuhan #5114# tersebut;<br>')
    kabul_x = tpl('Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #8554# menetapkan secara ex officio #5114# tersebut berada di bawah pemeliharaan (hadhanah) {hold} selaku {hub_hold}nya, '
                  'dengan kewajiban {hold} memberikan akses kepada {other} selaku {hub_other}nya untuk bertemu, mencurahkan kasih sayang, dan ikut serta dalam pengasuhan #5114# tersebut;<br>')
    sebagian = tpl('Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, tuntutan mengenai hak asuh anak patut dikabulkan sebagian, yaitu menetapkan anak tersebut berada di bawah '
                   'pemeliharaan (hadhanah) {hold} selaku {hub_hold}nya, dengan kewajiban {hold} memberikan akses kepada {other} untuk bertemu dan mencurahkan kasih sayang, sedangkan selebihnya ditolak;<br>')
    fakta_dasar = JIKA('c.mm = 1', GABUNG(fakta_mm, dasar_mm, didengar), GABUNG(fakta_belum, dasar_belum))
    tolak = GABUNG(tpl('Menimbang, bahwa terhadap tuntutan mengenai hak asuh anak, #8554# berpendapat bahwa '), JIKA("c.al_h <> ''", 'c.al_h',
                    lit('[PERIKSA: tulis alasan penolakan hak asuh setelah titik dua pada isian keputusan hak asuh]')), tpl(', sehingga tuntutan tersebut patut ditolak;<br>'))
    noo = GABUNG(tpl('Menimbang, bahwa tuntutan mengenai hak asuh anak tidak dapat diterima (niet ontvankelijk verklaard) karena '), JIKA("c.al_h <> ''", 'c.al_h',
                  lit('[PERIKSA: tulis alasan setelah titik dua pada isian keputusan hak asuh]')), lit(';<br>'))
    return ("CASE WHEN c.ch = 'K' AND c.th = 0 THEN '' "
            "WHEN c.ch = 'K' THEN " + PERIKSA('petitum menuntut hak asuh anak (hadhanah); pilih keputusan majelis pada isian keputusan hak asuh') + " "
            "WHEN c.ch = 'T' THEN " + tolak + " "
            "WHEN c.ch = 'N' THEN " + noo + " "
            "WHEN c.ch = 'X' THEN " + GABUNG(awal_x, fakta_dasar, terbaik, akses, kabul_x) + " "
            "WHEN c.ch = 'S' THEN " + GABUNG(JIKA('c.th = 1', awal_ab, awal_x), fakta_dasar, terbaik, akses, sebagian) + " "
            "ELSE " + GABUNG(JIKA('c.th = 1', awal_ab, awal_x), fakta_dasar, terbaik, akses, kabul) + " END")


def pert_nafkah_anak():
    awal = tpl('Menimbang, bahwa dalam perkara ini dituntut pula agar {S} dihukum membayar nafkah #5114# tersebut. Berdasarkan Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 45 ayat (2) '
               'Undang-Undang yang sama dan Pasal 149 huruf d serta Pasal 156 huruf d dan huruf f Kompilasi Hukum Islam, semua biaya pemeliharaan dan pendidikan anak menjadi tanggung jawab ayah '
               'menurut kemampuannya, sekurang-kurangnya sampai anak tersebut dewasa dan dapat mengurus diri sendiri (21 tahun), meskipun perkawinan kedua orang tuanya telah putus karena perceraian;<br>')
    awal_x = tpl('Menimbang, bahwa meskipun tidak ada tuntutan nafkah anak, berdasarkan Pasal 41 huruf b Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 45 ayat (2) Undang-Undang yang sama '
                 'dan Pasal 149 huruf d serta Pasal 156 huruf d dan huruf f Kompilasi Hukum Islam, semua biaya pemeliharaan dan pendidikan anak menjadi tanggung jawab ayah menurut kemampuannya, '
                 'sekurang-kurangnya sampai anak tersebut dewasa dan dapat mengurus diri sendiri (21 tahun), sehingga #8554# secara ex officio mempertimbangkan nafkah #5114# tersebut;<br>')
    kemampuan = GABUNG(tpl('Menimbang, bahwa berdasarkan fakta di persidangan, '), 'c.kmp', tpl(', maka dengan mempertimbangkan kebutuhan #5114# tersebut serta kemampuan {S}, #8554# berpendapat patut dan layak '
                        '{S} dihukum membayar nafkah #5114# tersebut melalui {I} '), JIKA("c.an_a <> ''", 'c.an_a', lit('[PERIKSA: isi jumlah nafkah anak setiap bulan]')),
                       tpl(', di luar biaya pendidikan dan kesehatan, sampai #5114# tersebut dewasa atau berumur 21 (dua puluh satu) tahun;<br>'))
    sema = GABUNG(tpl('Menimbang, bahwa berdasarkan Surat Edaran Mahkamah Agung Nomor 3 Tahun 2015 tentang Pemberlakuan Rumusan Hasil Rapat Pleno Kamar Mahkamah Agung Tahun 2015 sebagai Pedoman Pelaksanaan Tugas '
                      'bagi Pengadilan, Rumusan Hukum Kamar Agama, amar mengenai pembebanan nafkah anak hendaknya diikuti dengan penambahan 10% sampai dengan 20% per tahun dari jumlah yang ditetapkan, '
                      'di luar biaya pendidikan dan kesehatan, oleh karena itu untuk mengantisipasi kenaikan kebutuhan hidup anak, nafkah #5114# tersebut ditetapkan bertambah sebesar '),
                  JIKA("c.ak_a <> ''", 'c.ak_a', lit('[PERIKSA: isi kenaikan nafkah anak per tahun, 10% s.d. 20%]')), lit(' setiap tahun;<br>'))
    kabul = tpl('Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, tuntutan mengenai nafkah anak patut dikabulkan sebagaimana tersebut dalam amar putusan ini;<br>')
    sebagian = tpl('Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, tuntutan mengenai nafkah anak patut dikabulkan sebagian sebagaimana tersebut dalam amar putusan ini, sedangkan selebihnya ditolak;<br>')
    tolak = GABUNG(tpl('Menimbang, bahwa terhadap tuntutan mengenai nafkah anak, #8554# berpendapat bahwa '), JIKA("c.al_n <> ''", 'c.al_n',
                    lit('[PERIKSA: tulis alasan penolakan nafkah anak setelah titik dua pada isian keputusan nafkah anak]')), tpl(', sehingga tuntutan tersebut patut ditolak;<br>'))
    noo = GABUNG(tpl('Menimbang, bahwa tuntutan mengenai nafkah anak tidak dapat diterima (niet ontvankelijk verklaard) karena '), JIKA("c.al_n <> ''", 'c.al_n',
                  lit('[PERIKSA: tulis alasan setelah titik dua pada isian keputusan nafkah anak]')), lit(';<br>'))
    isi = lambda a, penutup: GABUNG(a, kemampuan, sema, penutup)
    return ("CASE WHEN c.cn = 'K' AND c.tn = 0 THEN '' "
            "WHEN c.cn = 'K' THEN " + PERIKSA('petitum menuntut nafkah anak; pilih keputusan majelis pada isian keputusan nafkah anak') + " "
            "WHEN c.cn = 'T' THEN " + tolak + " WHEN c.cn = 'N' THEN " + noo + " "
            "WHEN c.cn = 'X' THEN " + isi(awal_x, kabul) + " WHEN c.cn = 'S' THEN " + isi(JIKA('c.tn = 1', awal, awal_x), sebagian) + " "
            "ELSE " + isi(JIKA('c.tn = 1', awal, awal_x), kabul) + " END")


def _nafkah_istri_pembuka(jenis):
    """Dasar umum nafkah iddah / mut'ah / madliyah pada CT dan CG (nusyuz)."""
    return None


def pert_iddah():
    dasar = tpl('Menimbang, bahwa ' + P41C + '; demikian pula Pasal 149 huruf b Kompilasi Hukum Islam menyebutkan bahwa bilamana perkawinan putus karena talak, maka bekas suami wajib memberi nafkah, maskan dan kiswah '
                'kepada bekas istri selama dalam iddah, kecuali bekas istri telah dijatuhi talak ba&#39;in atau nusyuz dan dalam keadaan tidak hamil;<br>')
    syar = tpl('Menimbang, bahwa dalil syar&#39;i dalam firman Allah surat at-Thalaq ayat 7 menyatakan bahwa hendaklah orang yang mampu memberikan nafkah menurut kemampuannya, dan barang siapa yang disempitkan rizkinya '
               'hendaklah memberi nafkah dari harta yang diberikan Allah kepadanya, Allah tidak memikulkan beban kepada seseorang melainkan sekedar apa yang Allah berikan kepadanya;<br>')
    nusyuz = tpl('Menimbang, bahwa dalam perkara ini tidak ditemukan bukti bahwa {I} berbuat nusyuz, sehingga {I} berhak atas nafkah selama masa iddah, sebagaimana Rumusan Kamar Agama Surat Edaran Mahkamah Agung '
                 'Nomor 3 Tahun 2018 tentang Pemberlakuan Rumusan Hasil Rapat Pleno Kamar Mahkamah Agung Tahun 2018 Sebagai Pedoman Pelaksanaan Tugas Bagi Pengadilan jo. Pasal 152 Kompilasi Hukum Islam;<br>')
    nilai = GABUNG(tpl('Menimbang, bahwa untuk menentukan besarnya nafkah iddah, #8554# mempertimbangkan rasa keadilan dan kepatutan dengan menggali kemampuan ekonomi {S} serta kebutuhan dasar hidup {I}, '
                       'yaitu '), 'c.kmp', tpl('; kebutuhan dasar {I} yang diceraikan dalam keadaan tidak hamil meliputi biaya hidup selama masa iddah (3 bulan atau 90 hari);<br>'))
    jumlah = lambda kata: GABUNG(tpl('Menimbang, bahwa berdasarkan pertimbangan tersebut, ' + kata + ' nafkah iddah yang wajib dibayarkan oleh {S} kepada {I} adalah '),
                                 JIKA("c.ai_a <> ''", GABUNG('c.ai_a', JIKA("c.ai_a REGEXP 'bulan'", lit(''), lit(' selama masa iddah 3 (tiga) bulan'))),
                                      lit('[PERIKSA: isi jumlah nafkah iddah dan rincian per bulan, mis. Rp4.500.000,00 (3 bulan x Rp1.500.000,00)]')), lit(';<br>'))
    awal = tpl('Menimbang, bahwa dalam perkara ini dituntut pula nafkah iddah dari {S} kepada {I}, sehingga #8554# mempertimbangkannya sebagai berikut;<br>')
    awal_x = tpl('Menimbang, bahwa meskipun {I} tidak mengajukan tuntutan nafkah iddah, talak yang dijatuhkan menimbulkan kewajiban {S} menanggung nafkah selama masa iddah bagi {I}, sehingga #8554# '
                 'mempertimbangkannya secara ex officio (vide Pasal 149 Kompilasi Hukum Islam) sebagai berikut;<br>')
    inti = lambda a, kata: GABUNG(a, dasar, syar, nusyuz, nilai, jumlah(kata))
    tolak = GABUNG(tpl('Menimbang, bahwa terhadap tuntutan nafkah iddah, #8554# berpendapat bahwa '), JIKA("c.al_i <> ''", 'c.al_i',
                    lit('[PERIKSA: tulis alasan penolakan nafkah iddah setelah titik dua pada isian keputusan nafkah iddah, mis. istri terbukti nusyuz]')), tpl(', sehingga tuntutan tersebut patut ditolak;<br>'))
    noo = GABUNG(tpl('Menimbang, bahwa tuntutan nafkah iddah tidak dapat diterima (niet ontvankelijk verklaard) karena '), JIKA("c.al_i <> ''", 'c.al_i',
                  lit('[PERIKSA: tulis alasan setelah titik dua pada isian keputusan nafkah iddah]')), lit(';<br>'))
    return ("CASE WHEN c.ci = 'K' AND c.ti = 0 THEN '' "
            "WHEN c.ci = 'K' THEN " + PERIKSA('petitum menuntut nafkah iddah; pilih keputusan majelis pada isian keputusan nafkah iddah') + " "
            "WHEN c.ci = 'T' THEN " + tolak + " WHEN c.ci = 'N' THEN " + noo + " "
            "WHEN c.ci = 'X' THEN " + inti(awal_x, 'maka') + " WHEN c.ci = 'S' THEN " + inti(JIKA('c.ti = 1', awal, awal_x), 'maka tuntutan dikabulkan sebagian, dan') + " "
            "ELSE " + inti(JIKA('c.ti = 1', awal, awal_x), 'maka') + " END")


def pert_mutah():
    dasar = tpl('Menimbang, bahwa ' + P41C + '; selanjutnya Pasal 149 huruf a Kompilasi Hukum Islam menyebutkan bahwa bilamana perkawinan putus karena talak, maka bekas suami wajib memberikan mut&#39;ah yang layak '
                'kepada bekas istrinya, baik berupa uang atau benda, kecuali bekas istri tersebut qobla al-dukhul;<br>')
    syar = tpl('Menimbang, bahwa #8554# perlu mengetengahkan firman Allah surat al-Ahzab ayat 49 yang artinya senangkanlah hati mereka dengan pemberian dan lepaskanlah mereka secara baik, serta surat al-Baqarah ayat 241 '
               'yang artinya kepada wanita-wanita yang diceraikan hendaklah diberi oleh suaminya mut&#39;ah sebagai suatu kewajiban bagi orang-orang yang takwa;<br>')
    hak = tpl('Menimbang, bahwa mut&#39;ah merupakan sarana yang disediakan Islam bagi suami istri yang akan bercerai sebagai obat pelipur lara bagi istri yang ditalak serta media untuk tetap menyambung silaturahim; '
              'dalam perkara ini antara {S} dengan {I} telah kumpul (ba&#39;da dukhul), sehingga {I} berhak atas mut&#39;ah dari {S}, dan menurut Pasal 160 Kompilasi Hukum Islam besarnya mut&#39;ah disesuaikan '
              'dengan kepatutan dan kemampuan suami;<br>')
    nilai = GABUNG(tpl('Menimbang, bahwa kemampuan {S} dinilai tidak semata-mata dari kesanggupan saat ini, melainkan juga potensi kesanggupan yang masih dapat diupayakan, yaitu '), 'c.kmp',
                   tpl(', serta lamanya perkawinan {S} dan {I} yang telah berlangsung #7777# lamanya;<br>'))
    jumlah = lambda kata: GABUNG(tpl('Menimbang, bahwa berdasarkan asas kemampuan suami, kepatutan dan kelayakan tersebut, ' + kata + ' mut&#39;ah yang wajib diberikan oleh {S} kepada {I} adalah '),
                                 JIKA("c.am_a <> ''", 'c.am_a', lit('[PERIKSA: isi bentuk dan jumlah mut&#39;ah]')), lit(';<br>'))
    awal = tpl('Menimbang, bahwa dalam perkara ini dituntut pula mut&#39;ah dari {S} kepada {I}, sehingga #8554# mempertimbangkannya sebagai berikut;<br>')
    awal_x = tpl('Menimbang, bahwa meskipun {I} tidak mengajukan tuntutan mut&#39;ah, perceraian dengan talak menimbulkan kewajiban {S} memberikan mut&#39;ah kepada {I}, sehingga #8554# '
                 'mempertimbangkannya secara ex officio (vide Pasal 149 Kompilasi Hukum Islam) sebagai berikut;<br>')
    inti = lambda a, kata: GABUNG(a, dasar, syar, hak, nilai, jumlah(kata))
    tolak = GABUNG(tpl('Menimbang, bahwa terhadap tuntutan mut&#39;ah, #8554# berpendapat bahwa '), JIKA("c.al_m <> ''", 'c.al_m',
                    lit('[PERIKSA: tulis alasan penolakan mut&#39;ah setelah titik dua pada isian keputusan mut&#39;ah, mis. istri qobla al-dukhul]')), tpl(', sehingga tuntutan tersebut patut ditolak;<br>'))
    noo = GABUNG(tpl('Menimbang, bahwa tuntutan mut&#39;ah tidak dapat diterima (niet ontvankelijk verklaard) karena '), JIKA("c.al_m <> ''", 'c.al_m',
                  lit('[PERIKSA: tulis alasan setelah titik dua pada isian keputusan mut&#39;ah]')), lit(';<br>'))
    return ("CASE WHEN c.cm = 'K' AND c.tm = 0 THEN '' "
            "WHEN c.cm = 'K' THEN " + PERIKSA('petitum menuntut mut&#39;ah; pilih keputusan majelis pada isian keputusan mut&#39;ah') + " "
            "WHEN c.cm = 'T' THEN " + tolak + " WHEN c.cm = 'N' THEN " + noo + " "
            "WHEN c.cm = 'X' THEN " + inti(awal_x, 'maka') + " WHEN c.cm = 'S' THEN " + inti(JIKA('c.tm = 1', awal, awal_x), 'maka tuntutan dikabulkan sebagian, dan') + " "
            "ELSE " + inti(JIKA('c.tm = 1', awal, awal_x), 'maka') + " END")


def pert_madliyah():
    awal = tpl('Menimbang, bahwa dalam perkara ini dituntut pula nafkah madliyah (nafkah lampau) dari {S} kepada {I}, yang akan dipertimbangkan sebagai berikut;<br>')
    dasar = tpl('Menimbang, bahwa pemberian nafkah terhadap seorang istri merupakan kewajiban seorang suami sepanjang istri tersebut tidak berlaku nusyuz sebagaimana diatur dalam Pasal 34 ayat (1) '
                'Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019 jo. Pasal 80 Kompilasi Hukum Islam, dan jika kewajiban tersebut tidak '
                'dilaksanakan menjadi hutang yang dapat dituntut oleh istri walaupun telah terjadi perceraian;<br>')
    fakta = tpl('Menimbang, bahwa berdasarkan pemeriksaan di persidangan tidak ada bukti yang menunjukkan {I} sebagai istri yang nusyuz, dan terbukti {S} dan {I} berpisah tempat tinggal sejak #0246# sehingga {S} tidak '
                'memberikan nafkah kepada {I} selama masa tersebut;<br>')
    jumlah = GABUNG(tpl('Menimbang, bahwa ukuran kelayakan nafkah lampau (madliyah) mengacu pada kemampuan {S} dan kebutuhan dasar {I}, yaitu '), 'c.kmp', tpl(', dengan demikian nafkah lampau (madliyah) yang layak dibebankan kepada {S} adalah '),
                    JIKA("c.ad_a <> ''", 'c.ad_a', lit('[PERIKSA: isi jangka waktu dan jumlah nafkah madliyah, mis. Rp6.000.000,00 (12 bulan x Rp500.000,00)]')), lit(';<br>'))
    tolak = GABUNG(tpl('Menimbang, bahwa terhadap tuntutan nafkah madliyah, #8554# berpendapat bahwa '), JIKA("c.al_d <> ''", 'c.al_d',
                    lit('[PERIKSA: tulis alasan penolakan nafkah madliyah setelah titik dua pada isian keputusan nafkah madliyah]')), tpl(', sehingga tuntutan tersebut patut ditolak;<br>'))
    noo = GABUNG(tpl('Menimbang, bahwa tuntutan nafkah madliyah tidak dapat diterima (niet ontvankelijk verklaard) karena '), JIKA("c.al_d <> ''", 'c.al_d',
                  lit('[PERIKSA: tulis alasan setelah titik dua pada isian keputusan nafkah madliyah]')), lit(';<br>'))
    inti = GABUNG(awal, dasar, fakta, jumlah)
    return ("CASE WHEN c.cd = 'K' AND c.td = 0 THEN '' "
            "WHEN c.cd = 'K' THEN " + PERIKSA('petitum menuntut nafkah madliyah; pilih keputusan majelis pada isian keputusan nafkah madliyah') + " "
            "WHEN c.cd = 'T' THEN " + tolak + " WHEN c.cd = 'N' THEN " + noo + " ELSE " + inti + " END")


def pert_harta():
    awal = tpl('Menimbang, bahwa dalam perkara ini dituntut pula penetapan harta bersama {S} dan {I}. Tuntutan mengenai harta bersama suami istri dapat diajukan bersama-sama dengan perkara perceraian sebagaimana ketentuan '
               'Pasal 86 ayat (1) Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, '
               'oleh karena itu #8554# mempertimbangkannya bersama-sama dengan pokok perkara perceraian;<br>')
    dasar = GABUNG(tpl('Menimbang, bahwa berdasarkan Pasal 35 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan, harta benda yang diperoleh selama perkawinan menjadi harta bersama, dan menurut Pasal 97 '
                       'Kompilasi Hukum Islam janda atau duda cerai hidup masing-masing berhak seperdua dari harta bersama sepanjang tidak ditentukan lain dalam perjanjian perkawinan; objek harta bersama '
                       'yang terbukti dalam persidangan adalah '), JIKA("c.v_8730 <> ''", 'c.v_8730', lit('[PERIKSA: isi objek harta bersama yang ditetapkan, satu objek per baris]')), lit(';<br>'))
    kabul = tpl('Menimbang, bahwa oleh karena objek tersebut terbukti diperoleh selama perkawinan, maka tuntutan mengenai harta bersama patut dikabulkan sehingga masing-masing {S} dan {I} berhak atas seperdua '
                'bagian dari harta bersama tersebut;<br>')
    sebagian = tpl('Menimbang, bahwa tuntutan mengenai harta bersama patut dikabulkan sebagian, yaitu terhadap objek yang terbukti sebagaimana tersebut di atas, sedangkan selebihnya ditolak;<br>')
    tolak = GABUNG(tpl('Menimbang, bahwa terhadap tuntutan mengenai harta bersama, #8554# berpendapat bahwa '), JIKA("c.al_b <> ''", 'c.al_b',
                    lit('[PERIKSA: tulis alasan penolakan harta bersama setelah titik dua pada isian keputusan harta bersama]')), tpl(', sehingga tuntutan tersebut patut ditolak;<br>'))
    noo = GABUNG(tpl('Menimbang, bahwa tuntutan mengenai harta bersama tidak dapat diterima (niet ontvankelijk verklaard) karena '), JIKA("c.al_b <> ''", 'c.al_b',
                  lit('[PERIKSA: tulis alasan setelah titik dua pada isian keputusan harta bersama]')), lit(';<br>'))
    return ("CASE WHEN c.cb = 'K' AND c.tb = 0 THEN '' "
            "WHEN c.cb = 'K' THEN " + PERIKSA('petitum menuntut harta bersama; pilih keputusan majelis pada isian keputusan harta bersama') + " "
            "WHEN c.cb = 'T' THEN " + tolak + " WHEN c.cb = 'N' THEN " + noo + " WHEN c.cb = 'S' THEN " + GABUNG(awal, dasar, sebagian) + " ELSE " + GABUNG(awal, dasar, kabul) + " END")


def pert_bayar():
    """Waktu pembayaran akibat cerai (nafkah iddah, mut'ah, madliyah): CT sebelum ikrar, CG sebelum akta cerai."""
    ada = "(c.ci IN ('A','S','X') OR c.cm IN ('A','S','X') OR c.cd IN ('A','S'))"
    ct = tpl('Menimbang, bahwa berdasarkan ' + SEMA_1_2017 + ', maka pembayaran kewajiban akibat perceraian, khususnya nafkah iddah, mut&#39;ah, dan nafkah madliyah, dapat dicantumkan dalam amar putusan dengan '
             'kalimat dibayar sebelum pengucapan ikrar talak; dari sisi keadilan, kemanfaatan, dan kepentingan beracara (process doelmatigheid), cara pelaksanaan putusan pemberian izin ikrar talak dengan '
             'memerintahkan pembayaran akibat perceraian sebelum atau selambat-lambatnya pada saat ikrar talak bertujuan agar {S} mendapatkan haknya untuk menjatuhkan talak, dan pada sisi yang lain {I} mendapatkan '
             'hak-haknya pada saat itu juga, oleh karena itu beralasan hukum untuk memerintahkan {S} membayar hak-hak tersebut di atas secara tunai sebelum pengucapan ikrar talak;<br>')
    cg = tpl('Menimbang, bahwa oleh karena pembayaran sebelum {S} mengambil akta cerai telah dinarasikan dalam posita dan petitum gugatan, maka pembayaran hak-hak {I} tersebut di atas diperintahkan dilakukan '
             'sebelum {S} mengambil akta cerai;<br>')
    tidak = tpl('Menimbang, bahwa {I} tidak keberatan hak-haknya tersebut di atas dibayarkan tidak bersamaan dengan pengucapan ikrar talak atau pengambilan akta cerai, sehingga #8554# tidak mensyaratkan '
                'waktu pembayaran tertentu dalam amar putusan ini;<br>')
    return ("CASE WHEN NOT " + ada + " THEN '' WHEN c.byr REGEXP 'tidak' THEN " + tidak + " WHEN c.byr REGEXP 'akta cerai' THEN " + cg + " WHEN c.byr REGEXP 'ikrar' THEN " + ct + " ELSE '' END")


def pert_ikrar():
    """Hanya cerai talak: izin ikrar dan tenggang enam bulan sejak ditetapkan hari sidang ikrar."""
    teks = tpl('Menimbang, bahwa oleh karena permohonan cerai talak dikabulkan, maka #0046# diberi izin untuk mengikrarkan talak di depan sidang #8008#; setelah putusan ini berkekuatan hukum tetap, #8008# '
               'menetapkan hari sidang penyaksian ikrar talak dengan memanggil #0046# dan #0047#; sesuai Pasal 70 ayat (6) Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama sebagaimana telah diubah dengan '
               'Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor 50 Tahun 2009, apabila dalam tenggang waktu 6 (enam) bulan terhitung sejak ditetapkan hari sidang penyaksian ikrar talak '
               '#0046# tidak datang menghadap sendiri atau tidak mengirim wakilnya meskipun telah mendapat panggilan secara sah atau patut, maka gugurlah kekuatan hukum penetapan tersebut dan perceraian tidak '
               'dapat diajukan lagi berdasarkan alasan yang sama;<br>')
    return "IF(c.ct = 1, %s, '')" % teks


def pert_sema():
    """SEMA 1/2022: perselisihan terus-menerus (huruf F) dikabulkan bila terbukti berselisih dan/atau berpisah tempat tinggal minimal 6 bulan."""
    huruf_f = "UPPER(c.v_8503) REGEXP 'F'"
    lama = "LOWER(c.v_9944)"
    kurang = "(%s REGEXP '(^|[^0-9])[1-5] *([(]|bulan)' AND %s NOT REGEXP 'tah')" % (lama, lama)
    sema = tpl('Menimbang, bahwa selanjutnya #8554# perlu mengemukakan ketentuan dalam Surat Edaran Mahkamah Agung (SEMA) Nomor 1 Tahun 2022 tentang Pemberlakuan Rumusan Hasil Rapat Pleno Kamar Mahkamah Agung '
               'Tahun 2022 Sebagai Pedoman Pelaksanaan Tugas Bagi Pengadilan yang mengatur bahwa dalam upaya mempertahankan suatu perkawinan dan memenuhi prinsip mempersukar perceraian maka perkara perceraian '
               'dengan alasan perselisihan dan pertengkaran yang terus menerus dapat dikabulkan jika terbukti suami/isteri berselisih dan bertengkar terus menerus atau telah berpisah tempat tinggal selama minimal '
               '6 (enam) bulan;<br>')
    penerapan = tpl('Menimbang, bahwa berdasarkan fakta yang ditemukan, ternyata #0046# dan #0047# berselisih dan bertengkar semenjak #0222# dan berpisah tempat tinggal sejak #0246# hingga sekarang selama #9944#, '
                    'atau telah melampaui batas minimal 6 (enam) bulan, sehingga ketentuan SEMA Nomor 1 Tahun 2022 tersebut telah terpenuhi;<br>')
    return ("CASE WHEN NOT (" + huruf_f + ") THEN '' "
            "WHEN c.v_9944 = '' AND c.v_246 = '' THEN CONCAT(" + sema + ", " + PERIKSA('isi lama pisah rumah dan sejak kapan pisah rumah agar syarat SEMA 1/2022 (minimal 6 bulan) dapat dinilai') + ") "
            "WHEN " + kurang + " THEN CONCAT(" + sema + ", " + PERIKSA('lama pisah rumah menurut isian kurang dari 6 bulan sehingga belum memenuhi SEMA 1/2022; uraikan alasan pengecualiannya bila ada, atau pertimbangkan blangko Tolak - Kurang 6 Bulan') + ") "
            "ELSE CONCAT(" + sema + ", " + penerapan + ") END")


# ----------------------------------------------------------------------------------------------------------------------
# AMAR
# ----------------------------------------------------------------------------------------------------------------------

def amar_hadhanah():
    a = tpl('Menetapkan #5114# {S} dan {I} yang bernama #8602# berada di bawah pemeliharaan (hadhanah) {hold} selaku {hub_hold}nya, dengan kewajiban {hold} memberikan akses kepada {other} selaku {hub_other}nya '
            'untuk bertemu, mencurahkan kasih sayang, dan ikut serta dalam pengasuhan #5114# tersebut;<br>')
    noo = tpl('Menyatakan tuntutan mengenai hak asuh anak tidak dapat diterima;<br>')
    return "CASE WHEN c.ch IN ('A','S','X') THEN %s WHEN c.ch = 'N' THEN %s ELSE '' END" % (a, noo)


def amar_nafkah_anak():
    a = GABUNG(tpl('Menghukum {S} untuk membayar nafkah #5114# tersebut melalui {I} '), JIKA("c.an_a <> ''", 'c.an_a', lit('[PERIKSA: isi jumlah nafkah anak setiap bulan]')),
               lit(', di luar biaya pendidikan dan kesehatan'), JIKA("c.ak_a <> ''", GABUNG(lit(', dengan kenaikan sebesar '), 'c.ak_a', lit(' setiap tahun')), lit('')),
               tpl(', sampai #5114# tersebut dewasa atau berumur 21 (dua puluh satu) tahun;<br>'))
    noo = tpl('Menyatakan tuntutan mengenai nafkah anak tidak dapat diterima;<br>')
    return "CASE WHEN c.cn IN ('A','S','X') THEN %s WHEN c.cn = 'N' THEN %s ELSE '' END" % (a, noo)


def amar_akibat():
    """Menghukum S membayar kepada I (nafkah madliyah, nafkah iddah, mut'ah) - satu butir, rincian berbaris '-' seperti amar yang lazim dipakai."""
    m = JIKA("c.cd IN ('A','S')", GABUNG(lit('-   Nafkah madliyah '), JIKA("c.ad_a <> ''", 'c.ad_a', lit('[PERIKSA: isi nafkah madliyah]'))), 'NULL')
    i = JIKA("c.ci IN ('A','S','X')", GABUNG(lit('-   Nafkah iddah '), JIKA("c.ai_a <> ''", GABUNG('c.ai_a', JIKA("c.ai_a REGEXP 'bulan'", lit(''), lit(' selama masa iddah 3 (tiga) bulan'))), lit('[PERIKSA: isi nafkah iddah]'))), 'NULL')
    mt = JIKA("c.cm IN ('A','S','X')", GABUNG(lit('-   Mut&#39;ah '), JIKA("c.am_a <> ''", 'c.am_a', lit('[PERIKSA: isi mut&#39;ah]'))), 'NULL')
    waktu = ("CASE WHEN c.byr REGEXP 'tidak' THEN '' WHEN c.byr REGEXP 'akta cerai' THEN CONCAT(' sebelum ', c.S, ' mengambil akta cerai') "
             "WHEN c.byr REGEXP 'ikrar' THEN CONCAT(' sesaat sebelum ', c.S, ' mengucapkan ikrar talak') ELSE '' END")
    ada = "(c.cd IN ('A','S') OR c.ci IN ('A','S','X') OR c.cm IN ('A','S','X'))"
    noo = "CONCAT_WS(', ', %s, %s, %s)" % (JIKA("c.ci = 'N'", lit('nafkah iddah'), 'NULL'), JIKA("c.cm = 'N'", lit('mut&#39;ah'), 'NULL'), JIKA("c.cd = 'N'", lit('nafkah madliyah'), 'NULL'))
    teks_noo = "IF((c.ci = 'N' OR c.cm = 'N' OR c.cd = 'N'), CONCAT('Menyatakan tuntutan mengenai ', " + noo + ", ' tidak dapat diterima;<br>'), '')"
    return ("CONCAT(IF(" + ada + ", CONCAT('Menghukum ', c.S, ' untuk membayar kepada ', c.I, " + waktu + ", ':<br>', CONCAT_WS(';<br>', " + m + ", " + i + ", " + mt + "), ';<br>'), ''), " + teks_noo + ")")


def amar_harta():
    a = GABUNG(lit('Menetapkan harta bersama '), tpl('{S} dan {I} berupa: '), JIKA("c.v_8730 <> ''", 'c.v_8730', lit('[PERIKSA: isi objek harta bersama]')),
               tpl(' dan menetapkan bagian masing-masing {S} dan {I} seperdua (1/2) dari harta bersama tersebut;<br>'))
    noo = lit('Menyatakan tuntutan mengenai harta bersama tidak dapat diterima;<br>')
    return "CASE WHEN c.cb IN ('A','S') THEN %s WHEN c.cb = 'N' THEN %s ELSE '' END" % (a, noo)


def amar_selebihnya():
    """Menolak selebihnya: bila ada tuntutan yang ditolak atau dikabulkan sebagian."""
    kon = "(c.ch IN ('T','S') OR c.cn IN ('T','S') OR c.ci IN ('T','S') OR c.cm IN ('T','S') OR c.cd IN ('T','S') OR c.cb IN ('T','S'))"
    return "IF(" + kon + ", CONCAT('Menolak #0053# ', c.I, ' selain dan selebihnya;<br>'), '')"


def rincian_ikrar():
    cadangan = lit('-   Nafkah Iddah sebesar Rp.................. (... rupiah) perbulan secara keseluruhan selama ... bulan, sejumlah Rp.................. (... rupiah);<br>'
                   '-   Mut&#39;ah berupa uang sejumlah Rp.................. (... rupiah);<br>'
                   '-   Nafkah anak sebesar Rp.................. (... rupiah) perbulan secara keseluruhan selama ... bulan, sejumlah Rp.................. (... rupiah).')
    butir = "CONCAT_WS(';<br>', %s, %s, %s, %s)" % (
        JIKA("c.ad_a <> ''", GABUNG(lit('-   Nafkah madliyah '), 'c.ad_a'), 'NULL'),
        JIKA("c.ai_a <> ''", GABUNG(lit('-   Nafkah iddah '), 'c.ai_a'), 'NULL'),
        JIKA("c.am_a <> ''", GABUNG(lit('-   Mut&#39;ah '), 'c.am_a'), 'NULL'),
        JIKA("c.an_a <> ''", GABUNG(lit('-   Nafkah anak '), 'c.an_a'), 'NULL'))
    return "IF(c.ai_a = '' AND c.am_a = '' AND c.ad_a = '' AND c.an_a = '', %s, CONCAT(%s, '.'))" % (cadangan, butir)


def amar_semua():
    return GABUNG(amar_hadhanah(), amar_nafkah_anak(), amar_akibat(), amar_harta(), amar_selebihnya())


# ----------------------------------------------------------------------------------------------------------------------
# Katalog variabel
# ----------------------------------------------------------------------------------------------------------------------
PIL_KEP = 'dikabulkan seluruhnya\ndikabulkan sebagian\nditolak\ntidak dapat diterima'
PIL_KEP_X = PIL_KEP + '\ndiberikan secara ex officio (tidak dituntut)'


def katalog():
    V = []

    def tambah(no, nama, tipe, sql=None, default=None):
        V.append(dict(no=no, nama=nama, tipe=tipe, sql=sql, default=default))

    # --- Isian keputusan hakim (pilihan) ----------------------------------------------------------------------------
    tambah(N_KEP_H, 'KEPUTUSAN HAK ASUH ANAK (HADHANAH) #4140# - PILIH: dikabulkan seluruhnya / sebagian / ditolak / tidak dapat diterima; tulis alasan penolakan setelah titik dua; tulis ayah bila hak asuh diberikan kepada ayah', 'data_teks', default=PIL_KEP_X)
    tambah(N_KEP_N, 'KEPUTUSAN NAFKAH ANAK #4141# - PILIH: dikabulkan seluruhnya / sebagian / ditolak / tidak dapat diterima; alasan penolakan setelah titik dua', 'data_teks', default=PIL_KEP_X)
    tambah(N_KEP_I, 'KEPUTUSAN NAFKAH IDDAH - PILIH: dikabulkan seluruhnya / sebagian / ditolak / tidak dapat diterima / ex officio; alasan penolakan setelah titik dua; jumlah di isian Nafkah iddah', 'data_teks', default=PIL_KEP_X)
    tambah(N_KEP_M, "KEPUTUSAN MUT'AH - PILIH: dikabulkan seluruhnya / sebagian / ditolak / tidak dapat diterima / ex officio; alasan penolakan setelah titik dua; jumlah di isian Mut'ah", 'data_teks', default=PIL_KEP_X)
    tambah(N_KEP_D, 'KEPUTUSAN NAFKAH MADLIYAH (LAMPAU) #4144# - PILIH: dikabulkan seluruhnya / sebagian / ditolak / tidak dapat diterima; alasan penolakan setelah titik dua', 'data_teks', default=PIL_KEP)
    tambah(N_KEP_B, 'KEPUTUSAN HARTA BERSAMA #4145# - PILIH: dikabulkan seluruhnya / sebagian / ditolak / tidak dapat diterima; alasan penolakan setelah titik dua', 'data_teks', default=PIL_KEP)
    tambah(N_MUM, 'KEADAAN ANAK #4140# - PILIH: belum mumayyiz (belum 12 tahun) / mumayyiz (12 tahun atau lebih)', 'data_teks',
           default='belum mumayyiz (belum berumur 12 tahun)\nmumayyiz (berumur 12 tahun atau lebih)')
    tambah(N_KMP, 'DASAR KEMAMPUAN PEMBERI NAFKAH (isian: pekerjaan/penghasilan suami dan kebutuhan dasar, tanpa titik akhir, mis. bahwa Tergugat bekerja sebagai petani dengan penghasilan Rp2.000.000,00 setiap bulan; kosong = pekerjaan di SIPP)', 'data_teks')
    tambah(N_ANAK_DIDENGAR, 'PENDAPAT ANAK MUMAYYIZ YANG DIDENGAR DI PERSIDANGAN (isian, tanpa titik akhir, mis. anak memilih tinggal bersama ibunya)', 'data_teks')
    tambah(N_BAYAR, 'WAKTU PEMBAYARAN AKIBAT CERAI - PILIH: sebelum ikrar talak / sebelum akta cerai / tidak disyaratkan (istri tidak keberatan); kosong = cerai talak sebelum ikrar, cerai gugat menurut isian pembayaran sebelum akta cerai', 'data_teks',
           default='sebelum ikrar talak\nsebelum akta cerai\ntidak disyaratkan (istri tidak keberatan)')
    # --- Pemicu (menyalakan isian keputusan di layar) ----------------------------------------------------------------
    for no, flag, nm in ((4140, 'th', 'HAK ASUH ANAK'), (4141, 'tn', 'NAFKAH ANAK'), (4142, 'ti', 'NAFKAH IDDAH'), (4143, 'tm', "MUT'AH"), (4144, 'td', 'NAFKAH MADLIYAH'), (4145, 'tb', 'HARTA BERSAMA')):
        tambah(no, 'PEMICU: PETITUM MENUNTUT %s (OTOMATIS dari petitum/kumulasi SIPP; "ya" bila menuntut)' % nm, 'data_sql', SEL("IF(c.%s = 1, 'ya', '')" % flag))
    tambah(4146, 'TUNTUTAN AKIBAT PERCERAIAN DALAM PETITUM (OTOMATIS dari petitum SIPP: daftar tuntutan yang terbaca; kosong = tidak ada)', 'data_sql',
           SEL("CONCAT_WS(', ', IF(c.th = 1, 'hak asuh anak', NULL), IF(c.tn = 1, 'nafkah anak', NULL), IF(c.ti = 1, 'nafkah iddah', NULL), IF(c.tm = 1, 'mut&#39;ah', NULL), IF(c.td = 1, 'nafkah madliyah', NULL), IF(c.tb = 1, 'harta bersama', NULL))"))
    # --- Pertimbangan --------------------------------------------------------------------------------------------------
    tambah(4110, 'PERTIMBANGAN HAK ASUH ANAK (OTOMATIS dari petitum dan keputusan pada isian 4100; kosong bila tidak dituntut dan tidak dipilih)', 'data_sql', SEL(pert_hadhanah()))
    tambah(4111, 'PERTIMBANGAN NAFKAH ANAK (OTOMATIS dari petitum dan keputusan pada isian 4101)', 'data_sql', SEL(pert_nafkah_anak()))
    tambah(4112, 'PERTIMBANGAN NAFKAH IDDAH (OTOMATIS dari petitum dan keputusan pada isian 4102)', 'data_sql', SEL(pert_iddah()))
    tambah(4113, "PERTIMBANGAN MUT'AH (OTOMATIS dari petitum dan keputusan pada isian 4103)", 'data_sql', SEL(pert_mutah()))
    tambah(4114, 'PERTIMBANGAN NAFKAH MADLIYAH (OTOMATIS dari petitum dan keputusan pada isian 4104)', 'data_sql', SEL(pert_madliyah()))
    tambah(4115, 'PERTIMBANGAN HARTA BERSAMA (OTOMATIS dari petitum dan keputusan pada isian 4105)', 'data_sql', SEL(pert_harta()))
    tambah(4116, 'PERTIMBANGAN WAKTU PEMBAYARAN AKIBAT CERAI (OTOMATIS: cerai talak sebelum ikrar talak, cerai gugat sebelum akta cerai; isian 4109)', 'data_sql', SEL(pert_bayar()))
    tambah(4117, 'PERTIMBANGAN IZIN IKRAR DAN TENGGANG 6 BULAN (OTOMATIS: hanya cerai talak; Pasal 70 ayat (6) UU 7/1989)', 'data_sql', SEL(pert_ikrar()))
    tambah(4118, 'PERTIMBANGAN SEMA 1/2022 (OTOMATIS: hanya alasan huruf F; pisah rumah minimal 6 bulan dinilai dari isian lama pisah)', 'data_sql', SEL(pert_sema()))
    gab = GABUNG(pert_hadhanah(), pert_nafkah_anak(), pert_iddah(), pert_mutah(), pert_madliyah(), pert_harta(), pert_bayar())
    tambah(4119, 'PERTIMBANGAN AKIBAT PERCERAIAN LENGKAP (OTOMATIS: gabungan 4110 s.d. 4116 menurut petitum dan keputusan; kosong bila tidak ada tuntutan)', 'data_sql', SEL(_bungkus(gab)))
    # --- Amar -------------------------------------------------------------------------------------------------------------
    tambah(4130, 'AMAR HAK ASUH ANAK (OTOMATIS dari keputusan isian 4100; mulai dengan baris baru)', 'data_sql', SEL(amar_hadhanah()))
    tambah(4131, 'AMAR NAFKAH ANAK (OTOMATIS dari keputusan isian 4101)', 'data_sql', SEL(amar_nafkah_anak()))
    tambah(4132, "AMAR NAFKAH ISTRI: MADLIYAH, IDDAH, MUT'AH DAN WAKTU PEMBAYARAN (OTOMATIS dari keputusan isian 4102 s.d. 4104)", 'data_sql', SEL(amar_akibat()))
    tambah(4133, 'AMAR HARTA BERSAMA (OTOMATIS dari keputusan isian 4105)', 'data_sql', SEL(amar_harta()))
    tambah(4134, 'AMAR MENOLAK SELAIN DAN SELEBIHNYA (OTOMATIS: bila ada tuntutan akibat perceraian yang ditolak atau dikabulkan sebagian)', 'data_sql', SEL(amar_selebihnya()))
    tambah(4138, 'AMAR AKIBAT PERCERAIAN LENGKAP (OTOMATIS: gabungan 4130 s.d. 4134; satu baris per butir, kosong bila tidak ada)', 'data_sql', SEL(_bungkus(amar_semua())))
    tambah(4139, "AMAR MUT'AH DAN NAFKAH IDDAH SECARA EX OFFICIO (OTOMATIS untuk blangko varian Mut'ah Iddah: isian Nafkah iddah dan Mut'ah, waktu pembayaran isian 4109; mulai dengan baris baru)", 'data_sql', SEL(amar_akibat(), paksa=True))
    tambah(4150, "RINCIAN KEWAJIBAN AKIBAT CERAI YANG DIBAYAR SAAT SIDANG IKRAR (OTOMATIS dari isian putusan nafkah iddah, mut'ah, madliyah, nafkah anak; tidak ada isian = titik-titik bawaan blangko)", 'data_sql', SEL(rincian_ikrar()))
    return V


def _bungkus(ekspr):
    return ekspr


if __name__ == '__main__':
    V = katalog()
    os.makedirs(os.path.join(AKAR, 'data'), exist_ok=True)
    json.dump(V, open(os.path.join(AKAR, 'data', 'variabel.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for v in V:
        print(v['no'], v['tipe'], len(v['sql'] or ''), v['nama'][:60])
