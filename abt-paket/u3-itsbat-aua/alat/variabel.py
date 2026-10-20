# -*- coding: utf-8 -*-
"""Variabel BARU paket u3-itsbat-aua (agen U3, 20 Okt 2026): nomor 4300-4399. Satu sumber untuk bangun_sql.py dan uji.

Jenis: data_teks (isian / pilihan majelis; default_data = daftar pilihan, satu per baris) dan data_sql (hanya SELECT,
MariaDB 5.5: tanpa REGEXP_SUBSTR/JSON/WITH). Kueri berjalan di basis SIPP; isian ABT dibaca lewat aps_badilag.abt_data_teks
(sama dengan paket abt-pengumuman-itsbat). Penanda #NNNN# di dalam teks keluaran dikembangkan ABT sesudah kueri.
Teks memakai <br> untuk pemisah paragraf dan <i> untuk huruf miring (seperti variabel 8601/8185).
Aturan: tidak ada kata ALETA, tidak ada garis miring terbalik, tanda kutip tunggal dilindungi lewat lit().
"""
import re

ME = "'"


def lit(s):
    """Literal SQL satu baris; kutip tunggal digandakan."""
    assert '\\' not in s and '\n' not in s, s[:60]
    return ME + s.replace(ME, ME + ME) + ME


def isian(no, tabel='abt_data_teks'):
    return "(SELECT TRIM(t.data) FROM aps_badilag.%s t WHERE t.no_var=%d AND t.perkara_id='#perkara_id#' LIMIT 1)" % (tabel, no)


def isian_atau_titik(no):
    return "IFNULL(NULLIF(%s,''),'...')" % isian(no)


TAHUN_NIKAH = ("COALESCE((SELECT CAST(RIGHT(TRIM(t.data),4) AS UNSIGNED) FROM aps_badilag.abt_data_teks t WHERE t.no_var=5197 "
               "AND t.perkara_id='#perkara_id#' AND RIGHT(TRIM(t.data),4) REGEXP '^[0-9]{4}$' LIMIT 1),"
               "(SELECT YEAR(d.tgl_menikah) FROM perkara_data_itsbat d WHERE d.perkara_id='#perkara_id#' AND d.tgl_menikah>'1900-01-01' LIMIT 1))")

DUA_PEMOHON = "((SELECT COUNT(*) FROM perkara_pihak1 x WHERE x.perkara_id='#perkara_id#')>=2)"


MARKA = {'@PRIA@': "IF(%s,'#0046# I','mempelai laki-laki')", '@WAN@': "IF(%s,'#0046# II','mempelai perempuan')"}


def _literal_marka(s):
    """Literal dengan penanda @PRIA@/@WAN@ -> ekspresi IF atas jumlah Pemohon."""
    bagian = re.split(r'(@PRIA@|@WAN@)', s)
    out = []
    for b in bagian:
        if not b:
            continue
        out.append(MARKA[b] % DUA_PEMOHON if b in MARKA else lit(b))
    return out


def cat(*bagian):
    """CONCAT dari potongan: str biasa = literal (boleh memuat @PRIA@/@WAN@), tuple ('sql', teks) = ekspresi SQL mentah."""
    out = []
    for b in bagian:
        if isinstance(b, tuple):
            out.append(b[1])
        else:
            out.extend(_literal_marka(b))
    return 'CONCAT(' + ','.join(out) + ')'


def sql(e):
    return ('sql', e)


# ----------------------------------------------------------------------------------------------------------------------
# 4303 - dasar itsbat nikah menurut Pasal 7 ayat (3) KHI (tiga paragraf)
# ----------------------------------------------------------------------------------------------------------------------
PEN49 = ('Menimbang, bahwa menurut penjelasan Pasal 49 huruf a angka 22 Undang-Undang Nomor 3 Tahun 2006 tentang Perubahan Atas '
         'Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama, perkawinan yang dapat diitsbatkan hanya perkawinan yang terjadi '
         'sebelum berlakunya Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan')
Q = {
    'e': 'Perkawinan yang dilakukan oleh mereka yang tidak mempunyai halangan perkawinan menurut Undang-Undang Nomor 1 Tahun 1974',
    'd': 'Adanya perkawinan yang terjadi sebelum berlakunya Undang-Undang No. 1 Tahun 1974',
    'a': 'Adanya perkawinan dalam rangka penyelesaian perceraian',
    'b': 'Hilangnya Akta Nikah',
    'c': 'Adanya keraguan tentang sah atau tidaknya salah satu syarat perkawinan',
}
P1 = {
    'e': [PEN49 + ', sementara perkawinan yang dilaksanakan #7036# terjadi pada #5197#. Jika berpegang pada ketentuan di atas, maka perkawinan #7036# '
          'tidak dapat diitsbatkan karena bertentangan dengan bunyi penjelasan pasal dimaksud disebabkan perkawinan #7036# dilaksanakan setelah berlakunya '
          'Undang-Undang Nomor 1 Tahun 1974. Namun Kompilasi Hukum Islam memberikan kelonggaran terhadap perkawinan yang dilaksanakan setelah berlakunya '
          'Undang-Undang Nomor 1 Tahun 1974, selama perkawinan yang dilakukan tidak mempunyai halangan perkawinan menurut Undang-Undang Nomor 1 Tahun 1974 '
          '(vide : Pasal 7 ayat (3) huruf e Kompilasi Hukum Islam), serta berdasarkan Surat Edaran Mahkamah Agung Republik Indonesia Nomor 7 Tahun 2012 '
          'tentang Rumusan Hukum Hasil Rapat Pleno Kamar Mahkamah Agung Sebagai Pedoman Pelaksanaan Tugas Bagi Pengadilan yang menyatakan bahwa pada '
          'prinsipnya nikah sirri dapat diisbatkan sepanjang tidak melanggar Undang-Undang, karenanya maka perkawinan itu dapat diitsbatkan;'],
    'd': [PEN49 + ', sedangkan perkawinan #7036# dilaksanakan pada #5197#, yaitu sebelum berlakunya Undang-Undang Nomor 1 Tahun 1974. Dengan demikian perkawinan '
          '#7036# termasuk perkawinan yang dapat diitsbatkan sebagaimana ditentukan penjelasan pasal dimaksud jo. Pasal 7 ayat (3) huruf d Kompilasi Hukum Islam;'],
    'a': ['Menimbang, bahwa Pasal 7 ayat (3) huruf a Kompilasi Hukum Islam membuka kemungkinan itsbat nikah dalam rangka penyelesaian perceraian; bahwa '
          'berdasarkan fakta persidangan #0053# itsbat nikah ini diajukan #7036# dalam rangka penyelesaian perceraian, sehingga perkawinan #7036# yang '
          'dilaksanakan pada #5197# termasuk perkawinan yang dapat diitsbatkan sebagaimana dimaksud ketentuan tersebut;'],
}
P2 = ('Menimbang, bahwa dalam Kompilasi Hukum Islam, untuk mengabulkan #0053# itsbat nikah yang diajukan ke Pengadilan, Undang-Undang membatasi hanya '
      'berkenaan dengan hal-hal yang disebutkan dalam Pasal 7 ayat (3) huruf a sampai dengan huruf e Kompilasi Hukum Islam. Oleh karena pada pertimbangan '
      'sebelumnya telah dinyatakan terbukti #7036# tidak mempunyai halangan atau larangan menikah menurut hukum Islam dan Undang-Undang yang berlaku, '
      'maka #8554# berkesimpulan #0053# itsbat nikah yang diajukan #7036# adalah beralasan;')
P3 = ('Menimbang, bahwa berdasarkan segenap pertimbangan-pertimbangan tersebut di atas, #8554# bersepakat #0053# #7036# patut dikabulkan karena telah '
      'memenuhi unsur yang terkandung dalam Pasal 7 ayat (3) huruf %s Kompilasi Hukum Islam, yakni ' + '"%s";')


def v4303():
    huruf = ("COALESCE((SELECT SUBSTRING(LOWER(t.data),LOCATE('huruf ',LOWER(t.data))+6,1) FROM aps_badilag.abt_data_teks t WHERE t.no_var=4300 "
             "AND t.perkara_id='#perkara_id#' AND LOCATE('huruf ',LOWER(t.data))>0 LIMIT 1),"
             "(SELECT IF(y.th<=1973,'d','e') FROM (SELECT %s AS th) y WHERE y.th IS NOT NULL AND y.th>1800),'e')" % TAHUN_NIKAH)
    # huruf b dan c memakai isian titik-titik (4302 / 4301)
    pb = ('Menimbang, bahwa Pasal 7 ayat (3) huruf b Kompilasi Hukum Islam membuka kemungkinan itsbat nikah karena hilangnya akta nikah; bahwa berdasarkan fakta '
          'persidangan perkawinan #7036# yang dilaksanakan pada #5197# pernah dicatat dan akta nikahnya hilang ')
    pc = ('Menimbang, bahwa Pasal 7 ayat (3) huruf c Kompilasi Hukum Islam membuka kemungkinan itsbat nikah karena adanya keraguan tentang sah atau tidaknya salah '
          'satu syarat perkawinan; bahwa berdasarkan fakta persidangan keraguan itu timbul karena ')
    cabang = ["WHEN %s THEN %s" % (lit('e'), cat(P1['e'][0] + '<br>', P2 + '<br>', P3 % ('e', Q['e']))),
              "WHEN %s THEN %s" % (lit('d'), cat(P1['d'][0] + '<br>', P2 + '<br>', P3 % ('d', Q['d']))),
              "WHEN %s THEN %s" % (lit('a'), cat(P1['a'][0] + '<br>', P2 + '<br>', P3 % ('a', Q['a']))),
              "WHEN %s THEN %s" % (lit('b'), cat(pb, sql(isian_atau_titik(4302)), ', sehingga perkawinan itu termasuk perkawinan yang dapat diitsbatkan;<br>', P2 + '<br>', P3 % ('b', Q['b']))),
              "WHEN %s THEN %s" % (lit('c'), cat(pc, sql(isian_atau_titik(4301)), ', sehingga perkawinan itu termasuk perkawinan yang dapat diitsbatkan;<br>', P2 + '<br>', P3 % ('c', Q['c'])))]
    return "SELECT CASE h.k %s ELSE '' END AS data FROM (SELECT %s AS k) h" % (' '.join(cabang), huruf)


# ----------------------------------------------------------------------------------------------------------------------
# 4306 - kedudukan hukum pemohon menurut Pasal 7 ayat (4) KHI
# ----------------------------------------------------------------------------------------------------------------------
def v4306():
    pil = isian(4305)
    dua = ('Menimbang, bahwa berdasarkan surat #0053#nya, para #0046# adalah suami istri yang menikah berdasarkan hukum Islam, namun belum tercatat di Kantor Urusan '
           'Agama. Oleh karena itu, berdasarkan Pasal 7 ayat (4) Kompilasi Hukum Islam, para #0046# memiliki legal standing (kepentingan hukum) untuk mengajukan '
           '#0053# pengesahan nikah a quo (legitima persona standi in judicio);')
    satu = ('Menimbang, bahwa berdasarkan surat #0053#nya, #0046# adalah pasangan dari #2026# #1025# yang menikah berdasarkan hukum Islam, namun belum tercatat di '
            'Kantor Urusan Agama. Oleh karena itu, berdasarkan Pasal 7 ayat (4) Kompilasi Hukum Islam, #0046# sebagai suami atau istri memiliki legal standing '
            '(kepentingan hukum) untuk mengajukan #0053# pengesahan nikah a quo (legitima persona standi in judicio);')
    anak = ('Menimbang, bahwa berdasarkan surat #0053#nya, #7036# adalah anak dari suami istri yang pernikahannya dimohonkan pengesahan, yang menikah berdasarkan '
            'hukum Islam namun belum tercatat di Kantor Urusan Agama. Oleh karena itu, berdasarkan Pasal 7 ayat (4) Kompilasi Hukum Islam yang menyebut anak-anak '
            'mereka sebagai pihak yang berhak mengajukan itsbat nikah, #7036# memiliki legal standing (kepentingan hukum) untuk mengajukan #0053# pengesahan nikah '
            'a quo (legitima persona standi in judicio);')
    wali = ('Menimbang, bahwa berdasarkan surat #0053#nya, #7036# adalah wali nikah dari perkawinan yang dimohonkan pengesahan, yang berlangsung berdasarkan hukum '
            'Islam namun belum tercatat di Kantor Urusan Agama. Oleh karena itu, berdasarkan Pasal 7 ayat (4) Kompilasi Hukum Islam yang menyebut wali nikah sebagai '
            'pihak yang berhak mengajukan itsbat nikah, #7036# memiliki legal standing (kepentingan hukum) untuk mengajukan #0053# pengesahan nikah a quo '
            '(legitima persona standi in judicio);')
    pihak = ('Menimbang, bahwa berdasarkan surat #0053#nya, #7036# adalah pihak yang berkepentingan dengan perkawinan yang dimohonkan pengesahan, yang berlangsung '
             'berdasarkan hukum Islam namun belum tercatat di Kantor Urusan Agama. Oleh karena itu, berdasarkan Pasal 7 ayat (4) Kompilasi Hukum Islam yang menyebut '
             'pihak-pihak yang berkepentingan dengan perkawinan itu sebagai pihak yang berhak mengajukan itsbat nikah, #7036# memiliki legal standing (kepentingan '
             'hukum) untuk mengajukan #0053# pengesahan nikah a quo (legitima persona standi in judicio);')
    return ("SELECT CASE WHEN %s LIKE '%%anak%%' THEN %s WHEN %s LIKE '%%wali%%' THEN %s WHEN %s LIKE '%%berkepentingan%%' THEN %s "
            "WHEN %s THEN %s ELSE %s END AS data" % (pil, lit(anak), pil, lit(wali), pil, lit(pihak), DUA_PEMOHON, lit(dua), lit(satu)))


# ----------------------------------------------------------------------------------------------------------------------
# 4307 - batas usia perkawinan (hanya bila dapat ditentukan; selain itu kosong)
# ----------------------------------------------------------------------------------------------------------------------
def v4307():
    th = TAHUN_NIKAH
    u1 = "CAST(%s AS UNSIGNED)" % isian(7211)
    u2 = "CAST(%s AS UNSIGNED)" % isian(7212)
    # perkawinan sesudah 2019: 19 tahun bagi pria dan wanita; sebelum 2019: pria 19, wanita 16 (Pasal 7 ayat (1) UU 1/1974 sebelum diubah)
    def kal(y, akhir):
        return cat('Menimbang, bahwa mengenai batas usia perkawinan, pada saat menikah @PRIA@ berumur ', sql('y.a1'), ' tahun dan @WAN@ berumur ', sql('y.a2'),
                   ' tahun, sehingga ' + akhir)
    baru = kal('y', 'keduanya telah mencapai umur sembilan belas tahun sebagaimana ditentukan Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan '
                    'sebagaimana telah diubah dengan Undang-Undang Nomor 16 Tahun 2019;')
    lama = kal('y', 'keduanya telah mencapai batas umur minimum sebagaimana ditentukan Pasal 7 ayat (1) Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan '
                    'sebelum diubah dengan Undang-Undang Nomor 16 Tahun 2019 (sembilan belas tahun bagi pria dan enam belas tahun bagi wanita);')
    return ("SELECT CASE WHEN y.th IS NULL OR y.a1=0 OR y.a2=0 THEN '' "
            "WHEN y.th>=2020 AND y.a1>=19 AND y.a2>=19 THEN %s "
            "WHEN y.th<=2018 AND y.a1>=19 AND y.a2>=16 THEN %s ELSE '' END AS data "
            "FROM (SELECT %s AS th, IFNULL(%s,0) AS a1, IFNULL(%s,0) AS a2) y" % (baru, lama, th, u1, u2))


# ----------------------------------------------------------------------------------------------------------------------
# 4308 - wali nikah (kelompok wali nasab / wali hakim)
# ----------------------------------------------------------------------------------------------------------------------
def v4308():
    s = isian(1046)
    alasan = isian(1357)
    awal = 'Menimbang, bahwa mengenai wali nikah, berdasarkan keterangan saksi-saksi yang menjadi wali nikah @WAN@ adalah #1046# bernama #1217#'
    syarat = (' yang seorang laki-laki beragama Islam, sudah dewasa, dan sehat akal pada waktu menikahkan sebagaimana syarat wali nikah dalam Pasal 20 ayat (1) '
              'Kompilasi Hukum Islam, sehingga rukun wali nikah sebagaimana dimaksud Pasal 19 dan Pasal 14 Kompilasi Hukum Islam telah terpenuhi;')
    nasab1 = awal + ', yaitu wali nasab dari kelompok kerabat laki-laki garis lurus ke atas yang menurut Pasal 21 ayat (1) Kompilasi Hukum Islam berada pada urutan pertama,' + syarat
    nasab2 = awal + ', yaitu wali nasab dari kelompok saudara laki-laki kandung atau seayah beserta keturunan laki-laki mereka sebagaimana Pasal 21 ayat (1) Kompilasi Hukum Islam, sedangkan wali nasab dari kelompok yang lebih dekat tidak dapat menjadi wali '
    nasab3 = awal + ', yaitu wali nasab dari kelompok paman sebagaimana Pasal 21 ayat (1) Kompilasi Hukum Islam, sedangkan wali nasab dari kelompok yang lebih dekat tidak dapat menjadi wali '
    hakim = ('Menimbang, bahwa mengenai wali nikah, berdasarkan keterangan saksi-saksi yang menikahkan @WAN@ adalah wali hakim, yang menurut Pasal 23 ayat (1) '
             'Kompilasi Hukum Islam baru dapat bertindak apabila wali nasab tidak ada, tidak mungkin menghadirkannya, tidak diketahui tempat tinggalnya, gaib, adlal, '
             'atau enggan; bahwa wali nasab tidak menikahkan ')
    lain = awal + ', yang kedudukannya dalam urutan wali nasab menurut Pasal 21 ayat (1) Kompilasi Hukum Islam adalah ..., sedangkan wali nasab yang lebih dekat tidak dapat menjadi wali '
    sebab = "IFNULL(NULLIF(TRIM(LEADING ',' FROM %s),''),'...')" % alasan
    sisa = (', sehingga hak menjadi wali bergeser kepada wali nasab berikutnya menurut Pasal 22 Kompilasi Hukum Islam, dan wali tersebut seorang laki-laki beragama Islam, '
            'sudah dewasa, dan sehat akal pada waktu menikahkan sebagaimana Pasal 20 ayat (1) Kompilasi Hukum Islam, sehingga rukun wali nikah telah terpenuhi;')
    lw = "LOWER(%s)" % s
    return ("SELECT CASE "
            "WHEN %(lw)s LIKE '%%hakim%%' THEN %(hakim)s "
            "WHEN %(lw)s LIKE '%%ayah%%' AND %(lw)s NOT LIKE '%%saudara ayah%%' AND %(lw)s NOT LIKE '%%paman%%' THEN %(n1)s "
            "WHEN %(lw)s LIKE '%%kakek%%' THEN %(n1)s "
            "WHEN %(lw)s LIKE '%%saudara%%' OR %(lw)s LIKE '%%kakak%%' OR %(lw)s LIKE '%%adik%%' THEN %(n2)s "
            "WHEN %(lw)s LIKE '%%paman%%' THEN %(n3)s "
            "ELSE %(lain)s END AS data"
            % dict(lw=lw, hakim=cat(hakim, sql(sebab), ';'), n1=cat(nasab1), n2=cat(nasab2, sql(sebab), sisa),
                   n3=cat(nasab3, sql(sebab), sisa), lain=cat(lain, sql(sebab), sisa)))


# ----------------------------------------------------------------------------------------------------------------------
# AUA
# ----------------------------------------------------------------------------------------------------------------------
def v4312():
    """Nama anak dan tanggal lahir dari SIPP perkara_anak_pihak: "A (lahir 21 Februari 2008), B (...) dan C (...)"; kosong bila tak ada."""
    bln = "ELT(MONTH(a.tanggal_lahir),'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember')"
    item = ("CONCAT(TRIM(a.nama_anak),IF(a.tanggal_lahir>'1900-01-01',CONCAT(' (lahir pada tanggal ',DAY(a.tanggal_lahir),' ',%s,' ',YEAR(a.tanggal_lahir),')'),''))" % bln)
    return ("SELECT IFNULL((SELECT CASE WHEN COUNT(*)=0 THEN NULL WHEN COUNT(*)=1 THEN MAX(%s) "
            "ELSE CONCAT(REPLACE(SUBSTRING_INDEX(GROUP_CONCAT(%s ORDER BY a.id SEPARATOR '|'),'|',COUNT(*)-1),'|',', '), ' dan ', SUBSTRING_INDEX(GROUP_CONCAT(%s ORDER BY a.id SEPARATOR '|'),'|',-1)) END "
            "FROM perkara_anak_pihak a WHERE a.perkara_id='#perkara_id#' AND TRIM(IFNULL(a.nama_anak,''))<>''),'...') AS data" % (item, item, item))


BULAN_NO = [('januari', 1), ('februari', 2), ('pebruari', 2), ('maret', 3), ('april', 4), ('mei', 5), ('juni', 6), ('juli', 7), ('agustus', 8),
            ('september', 9), ('oktober', 10), ('november', 11), ('nopember', 11), ('desember', 12)]


def tgl_nikah_date():
    """Tanggal akad (DATE) dari isian 5197 berbentuk "[hari,] 28 Desember 2018" atau dari SIPP perkara_data_itsbat; NULL bila tak terbaca."""
    m = "LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(z.x,' ',-2),' ',1))"
    nomor = "CASE " + m + " " + " ".join("WHEN %s THEN %d" % (lit(n), i) for n, i in BULAN_NO) + " END"
    d = "SUBSTRING_INDEX(SUBSTRING_INDEX(z.x,' ',-3),' ',1)"
    th = "SUBSTRING_INDEX(z.x,' ',-1)"
    dari_isian = ("(SELECT STR_TO_DATE(CONCAT(%s,'-',%s,'-',%s),'%%d-%%m-%%Y') "
                  "FROM (SELECT TRIM(t.data) AS x FROM aps_badilag.abt_data_teks t WHERE t.no_var=5197 AND t.perkara_id='#perkara_id#' LIMIT 1) z "
                  "WHERE %s REGEXP '^[0-9]{4}$' AND %s REGEXP '^[0-9]{1,2}$')" % (d, nomor, th, th, d))
    dari_sipp = "(SELECT d.tgl_menikah FROM perkara_data_itsbat d WHERE d.perkara_id='#perkara_id#' AND d.tgl_menikah>'1900-01-01' LIMIT 1)"
    return "COALESCE(%s,%s)" % (dari_isian, dari_sipp)


def v4313():
    """Jarak akad nikah dengan kelahiran anak pertama (SIPP): kalimat jarak diawali koma (", yaitu ..."); kosong bila tak dapat dihitung."""
    return ("SELECT CASE WHEN y.nikah IS NULL OR y.lahir IS NULL THEN '' "
            "WHEN y.lahir<y.nikah THEN '' "
            "WHEN TIMESTAMPDIFF(MONTH,y.nikah,y.lahir)<6 THEN ', yaitu kurang dari enam bulan setelah akad nikah' "
            "ELSE ', yaitu lebih dari enam bulan setelah akad nikah' END AS data "
            "FROM (SELECT %s AS nikah, "
            "(SELECT MIN(a.tanggal_lahir) FROM perkara_anak_pihak a WHERE a.perkara_id='#perkara_id#' AND a.tanggal_lahir>'1900-01-01') AS lahir) y" % tgl_nikah_date())


VAR = []


def V(no, nama, tipe, q=None, default=None):
    VAR.append(dict(no=no, nama=nama, tipe=tipe, sql=q, default=default))


V(4300, 'ITSBAT: DASAR PASAL 7 AYAT (3) KHI - PILIHAN MAJELIS (isian: pilih huruf; kosong = otomatis: huruf d bila nikah sebelum 1974, selain itu huruf e)',
  'data_teks', default='huruf e (tidak ada halangan perkawinan menurut UU 1/1974)\nhuruf d (perkawinan terjadi sebelum berlakunya UU 1/1974)\nhuruf a (dalam rangka penyelesaian perceraian)\nhuruf b (hilangnya akta nikah)\nhuruf c (keraguan sah atau tidaknya syarat perkawinan)')
V(4301, 'ITSBAT HURUF C: KERAGUAN ATAS SYARAT PERKAWINAN (isian: satu klausa tanpa titik akhir)', 'data_teks')
V(4302, 'ITSBAT HURUF B: KETERANGAN HILANGNYA AKTA NIKAH (isian: mis. "karena rumah terbakar pada tahun ...", tanpa titik akhir)', 'data_teks')
V(4303, 'ITSBAT: PERTIMBANGAN DASAR PASAL 7 AYAT (3) KHI (OTOMATIS dari pilihan 4300; kosong = huruf d bila nikah sebelum 1974, selain itu huruf e; tiga paragraf)', 'data_sql', v4303())
V(4305, 'ITSBAT: KEDUDUKAN HUKUM PEMOHON MENURUT PASAL 7 AYAT (4) KHI (isian: pilih; kosong = suami/istri)', 'data_teks',
  default='suami atau istri\nanak dari suami istri itu\nwali nikah\npihak yang berkepentingan dengan perkawinan itu')
V(4306, 'ITSBAT: PERTIMBANGAN KEDUDUKAN HUKUM PEMOHON (OTOMATIS dari pilihan 4305 dan jumlah Pemohon)', 'data_sql', v4306())
V(4307, 'ITSBAT: PERTIMBANGAN BATAS USIA PERKAWINAN (OTOMATIS hanya bila umur 7211/7212 dan tahun nikah memungkinkan; selain itu kosong)', 'data_sql', v4307())
V(4308, 'ITSBAT: PERTIMBANGAN WALI NIKAH (OTOMATIS dari isian Status Wali 1046, Nama 1217, Alasan 1357; titik-titik bila alasan belum diisi)', 'data_sql', v4308())
V(4310, 'AUA: NOMOR DAN TANGGAL PENETAPAN ITSBAT NIKAH ORANG TUA ANAK (isian: mis. "Nomor 12/Pdt.P/2025/PA.Dgl tanggal 3 Maret 2025")', 'data_teks')
V(4311, 'AUA: NAMA LAKI-LAKI YANG MENGAKUI ATAU DIDUGA AYAH BIOLOGIS ANAK (isian)', 'data_teks')
V(4312, 'AUA: NAMA ANAK DAN TANGGAL LAHIRNYA (OTOMATIS dari SIPP perkara_anak_pihak; "A (lahir pada tanggal ...), B (...) dan C (...)"; titik-titik bila SIPP kosong)', 'data_sql', v4312())
V(4313, 'AUA: JARAK AKAD NIKAH DENGAN KELAHIRAN ANAK (OTOMATIS dari SIPP tgl_menikah dan tanggal lahir anak; kosong bila tak dapat dihitung; diawali ", yaitu")', 'data_sql', v4313())
V(4314, 'AUA: HUBUNGAN PERDATA ANAK LUAR PERKAWINAN - PILIHAN MAJELIS (isian: pilih satu)', 'data_teks',
  default='hanya mempunyai hubungan nasab dan hubungan perdata dengan ibunya dan keluarga ibunya\nmempunyai hubungan nasab dan hubungan perdata dengan ibunya dan keluarga ibunya, serta hubungan perdata dengan laki-laki bernama #4311# sebagai ayah biologisnya')
V(4315, 'AUA: STATUS ANAK LAHIR KURANG DARI ENAM BULAN SETELAH AKAD - PILIHAN MAJELIS (isian: pilih satu)', 'data_teks',
  default='anak sah karena dilahirkan dalam perkawinan yang sah\nanak yang dilahirkan di luar perkawinan yang sah dan hanya mempunyai hubungan nasab dengan ibunya dan keluarga ibunya')

for _v in VAR:
    if _v['sql']:
        assert '\\' not in _v['sql'], _v['no']
        assert re.fullmatch(r'SELECT .*', _v['sql'], re.S), _v['no']

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    for v in VAR:
        print(v['no'], v['tipe'], v['nama'][:90], len(v['sql'] or ''))
