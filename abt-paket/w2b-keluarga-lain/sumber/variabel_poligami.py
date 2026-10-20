# -*- coding: utf-8 -*-
"""Variabel ABT BARU keluarga PERKAWINAN (izin poligami, pencegahan, pembatalan) - agen W2b-A, jatah nomor 4850-4879.

Izin poligami (4850-4864):
  isian (data_teks, diisi petugas/hakim atau diusulkan pengisi dari permohonan):
    4850 surat persetujuan tertulis istri     4851 alasan keberatan istri      4852 keadaan istri tidak mungkin dimintai persetujuan
    4853 bentuk persetujuan istri             4854 status calon istri          4855 bukti status janda calon istri
    4856 jumlah istri pemohon saat ini
  otomatis (data_sql, hanya SELECT, MariaDB 5.5; baca isian lewat aps_badilag.abt_data_teks):
    4857 bentuk persetujuan (kosong = tertulis maupun lisan)    4858 alasan keberatan (kosong = [PERIKSA])
    4860 pertimbangan calon istri (status, iddah, halangan)
    4861 pertimbangan jumlah istri dan izin Pengadilan           4862 fakta persetujuan istri tidak hadir
    4863 pertimbangan persetujuan istri tidak hadir              4864 amar/izin: kalimat penutup keberatan (Pasal 59 KHI)
Tanpa kata aplikasi; tanpa garis miring terbalik (CHAR(92) bila perlu); teks ASCII (cp1252).
"""
from variabel_def import v


def lit(s):
    assert '\\' not in s and '\n' not in s, s[:60]
    return "'" + s.replace("'", "''") + "'"


def aman(no):
    """Isian ABT nomor `no` yang sudah disanitasi (garis miring, kutip ganda dan tunggal) - pola yang sama dengan variabel 8721."""
    return ("REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var=%d AND perkara_id='#perkara_id#' LIMIT 1) USING utf8),"
            "CHAR(92 USING utf8),'/'),'\"','&quot;'),CHAR(39 USING utf8),'&#39;')" % no)


def isi(no):
    return "TRIM(IFNULL(%s,''))" % aman(no)


# ---------------------------------------------------------------------------------------------------------- isian
v(4850, 'IZIN POLIGAMI: SURAT PERSETUJUAN TERTULIS ISTRI (tanggal dan keterangan singkat, contoh: tanggal 12 Agustus 2026 bermeterai; kosongkan bila tidak ada)', 'data_teks')
v(4851, 'IZIN POLIGAMI: ALASAN KEBERATAN ISTRI (hanya bila Termohon keberatan; diisi dari jawaban atau keterangan Termohon di sidang)', 'data_teks')
v(4852, 'IZIN POLIGAMI: KEADAAN ISTRI TIDAK MUNGKIN DIMINTAI PERSETUJUAN (contoh: menderita gangguan jiwa berat; tidak ada kabar sejak 2023 dan tempat tinggalnya tidak diketahui)', 'data_teks')
v(4853, 'IZIN POLIGAMI: BENTUK PERSETUJUAN ISTRI (pilihan: secara tertulis maupun lisan di persidangan | secara lisan di persidangan | secara tertulis; kosong = tertulis maupun lisan di persidangan)', 'data_teks')
v(4854, 'IZIN POLIGAMI: STATUS CALON ISTRI KEDUA (pilihan: perawan | janda cerai | janda ditinggal mati suami)', 'data_teks')
v(4855, 'IZIN POLIGAMI: BUKTI STATUS JANDA CALON ISTRI KEDUA (contoh: Akta Cerai Nomor 152/AC/2025/PA.Dgl tanggal 3 Maret 2025; atau Surat Keterangan Kematian Nomor ... tanggal ...)', 'data_teks')
v(4856, 'IZIN POLIGAMI: JUMLAH ISTRI PEMOHON SAAT INI (contoh: seorang yaitu Termohon; atau dua orang yaitu Termohon dan Fulanah; kosong = seorang yaitu Termohon)', 'data_teks')

# ---------------------------------------------------------------------------------------------------------- otomatis
v(4857, 'IZIN POLIGAMI: BENTUK PERSETUJUAN ISTRI (OTOMATIS dari isian 4853; kosong = secara tertulis maupun lisan di persidangan)', 'data_sql',
  "SELECT IFNULL(NULLIF(%s,''),'secara tertulis maupun lisan di persidangan') AS data" % isi(4853))

v(4858, 'IZIN POLIGAMI: ALASAN KEBERATAN ISTRI (OTOMATIS dari isian 4851; kosong = [PERIKSA])', 'data_sql',
  "SELECT IFNULL(NULLIF(%s,''),'[PERIKSA: isi alasan keberatan istri pada isian 4851]') AS data" % isi(4851))

def _calon_istri():
    s = "LOWER(%s)" % isi(4854)
    b = isi(4855)
    bukti = "IF(%s<>'',CONCAT(' sebagaimana dibuktikan dengan ',%s),'')" % (b, b)
    cerai = ("CONCAT('berstatus janda cerai',%s,' dan telah selesai menjalani masa iddahnya sehingga tidak termasuk wanita yang masih berada dalam masa iddah dengan pria lain '"
             ",'yang dilarang dinikahi menurut Pasal 40 huruf b Kompilasi Hukum Islam')" % bukti)
    mati = ("CONCAT('berstatus janda karena suaminya telah meninggal dunia',%s,' dan telah selesai menjalani masa iddah kematian sehingga tidak termasuk wanita yang masih berada '"
            ",'dalam masa iddah dengan pria lain yang dilarang dinikahi menurut Pasal 40 huruf b Kompilasi Hukum Islam')" % bukti)
    gadis = lit('berstatus perawan atau belum pernah menikah sehingga tidak berada dalam masa iddah')
    umum = lit('tidak sedang terikat perkawinan dengan laki-laki lain dan tidak sedang berada dalam masa iddah')
    status = ("CASE WHEN %s LIKE '%%cerai%%' THEN %s WHEN %s LIKE '%%mati%%' OR %s LIKE '%%meninggal%%' THEN %s "
              "WHEN %s LIKE '%%perawan%%' OR %s LIKE '%%gadis%%' OR %s LIKE '%%belum%%' THEN %s ELSE %s END" % (s, cerai, s, s, mati, s, s, s, gadis, umum))
    buka = lit('<br>Menimbang, bahwa berdasarkan fakta angka 2, calon istri kedua #0046# yaitu #8723# ')
    tutup = lit(', serta antara dirinya dengan #0046# maupun #0047# tidak terdapat hubungan nasab, semenda maupun sesusuan yang menjadi larangan perkawinan menurut '
                'Pasal 8 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan jo. Pasal 39 sampai dengan Pasal 44 Kompilasi Hukum Islam, sehingga tidak terdapat halangan bagi '
                '#0046# untuk menikah dengan calon istri kedua tersebut;')
    return "SELECT CONCAT(%s,%s,%s) AS data" % (buka, status, tutup)


v(4860, 'IZIN POLIGAMI: PERTIMBANGAN CALON ISTRI KEDUA - STATUS, IDDAH DAN HALANGAN PERKAWINAN (OTOMATIS dari isian 4854 dan 4855; diawali baris baru)', 'data_sql', _calon_istri())


def _jumlah_istri():
    x = isi(4856)
    isi_ = "IFNULL(NULLIF(%s,''),'seorang yaitu #0047#')" % x
    biasa = ("CONCAT('<br>Menimbang, bahwa #0046# pada saat ini telah beristri ',%s,', sehingga apabila izin diberikan jumlah istri #0046# tidak melebihi empat orang sebagaimana '"
             ",'dibatasi oleh Pasal 55 ayat (1) Kompilasi Hukum Islam, dan sesuai Pasal 56 ayat (1) dan ayat (3) Kompilasi Hukum Islam suami yang hendak beristri lebih dari satu '"
             ",'orang wajib memperoleh izin Pengadilan Agama karena perkawinan dengan istri kedua, ketiga atau keempat tanpa izin Pengadilan Agama tidak mempunyai kekuatan hukum;')" % isi_)
    penuh = lit('<br>[PERIKSA: jumlah istri Pemohon sudah empat orang; Pasal 55 ayat (1) Kompilasi Hukum Islam membatasi paling banyak empat orang istri]')
    return "SELECT IF(LOWER(%s) LIKE '%%empat%%',%s,%s) AS data" % (x, penuh, biasa)


v(4861, 'IZIN POLIGAMI: PERTIMBANGAN JUMLAH ISTRI DAN IZIN PENGADILAN - Pasal 55 dan 56 KHI (OTOMATIS dari isian 4856; diawali baris baru)', 'data_sql', _jumlah_istri())

v(4862, 'IZIN POLIGAMI: FAKTA PERSETUJUAN ISTRI YANG TIDAK HADIR (OTOMATIS: isian 4852 terisi = tidak mungkin dimintai persetujuan; selain itu surat persetujuan tertulis dari isian 4850)', 'data_sql',
  "SELECT IF(%s<>'',CONCAT('#0047# tidak mungkin dimintai persetujuannya karena ',%s),"
  "CONCAT('#0047# telah membuat surat pernyataan persetujuan secara tertulis',IF(%s<>'',CONCAT(' (',%s,')'),''),' bagi #0046# untuk menikah lagi meskipun #0047# tidak hadir di persidangan')) AS data"
  % (isi(4852), isi(4852), isi(4850), isi(4850)))

v(4863, 'IZIN POLIGAMI: PERTIMBANGAN PERSETUJUAN ISTRI YANG TIDAK HADIR (OTOMATIS: isian 4852 terisi = Pasal 5 ayat (2) UU 1/1974; selain itu surat persetujuan tertulis dan saksi)', 'data_sql',
  "SELECT IF(%s<>'',"
  "CONCAT('Menimbang, bahwa meskipun #0047# tidak hadir di persidangan, persetujuan istri sebagaimana Pasal 5 ayat (1) huruf a Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan tidak diperlukan karena '"
  ",'#0047# tidak mungkin dimintai persetujuannya yaitu ',%s,', sebagaimana Pasal 5 ayat (2) Undang-Undang Nomor 1 Tahun 1974 jo. Pasal 41 huruf b Peraturan Pemerintah Nomor 9 Tahun 1975, '"
  ",'dan keadaan itu telah dibuktikan oleh #0046# dengan alat bukti yang diajukan di persidangan;'),"
  "CONCAT('Menimbang, bahwa meskipun #0047# tidak hadir di persidangan, persetujuan #0047# atas rencana #0046# menikah lagi telah terbukti dengan surat pernyataan persetujuan tertulis yang dibuat '"
  ",'#0047#',IF(%s<>'',CONCAT(' (',%s,')'),''),' serta keterangan para saksi di persidangan, sehingga syarat persetujuan istri sebagaimana Pasal 5 ayat (1) huruf a Undang-Undang Nomor 1 Tahun 1974 '"
  ",'jo. Pasal 58 ayat (1) huruf a Kompilasi Hukum Islam telah terpenuhi;')) AS data" % (isi(4852), isi(4852), isi(4850), isi(4850)))

v(4864, 'IZIN POLIGAMI: PERTIMBANGAN PENGADILAN MENDENGAR ISTRI YANG KEBERATAN - Pasal 59 KHI (OTOMATIS dari isian 4851)', 'data_sql',
  "SELECT CONCAT('Menimbang, bahwa #0047# menyatakan keberatan atas rencana #0046# untuk menikah lagi dengan alasan ',%s,'; bahwa sesuai Pasal 59 Kompilasi Hukum Islam, dalam hal istri tidak mau '"
  ",'memberikan persetujuan dan permohonan izin didasarkan pada salah satu alasan sebagaimana diatur dalam Pasal 55 ayat (2) dan Pasal 57 Kompilasi Hukum Islam, Pengadilan Agama dapat '"
  ",'menetapkan pemberian izin setelah memeriksa dan mendengar istri yang bersangkutan di persidangan, dan oleh karena #8554# telah mendengar keterangan #0047# di persidangan maka '"
  ",'keberatan #0047# tersebut tidak menghalangi pemberian izin apabila alasan dan syarat lainnya terpenuhi;') AS data" % ("IFNULL(NULLIF(%s,''),'[PERIKSA: isi alasan keberatan istri pada isian 4851]')" % isi(4851)))
