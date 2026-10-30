# -*- coding: utf-8 -*-
"""Variabel tambahan sesudah jawaban pengguna 30 Okt (13 butir): blok 11370-11419. Dipanggil dari variabel.py (tambah(...))."""


def tambah(var, isian, nil, ada, huruf1, PERKARA, UU_PA):
    # --- ACARA tambahan --------------------------------------------------------------------------------------------------------
    var(11370, 'ACARA: PASAL PUTUSAN SELA (putusan yang bukan putusan akhir) (RBg; padanan untuk satker Jawa-Madura: Pasal 185 ayat (1) HIR - belum dipakai)',
        sql="SELECT 'Pasal 196 ayat (1) RBg' AS data")
    var(11371, 'ACARA: PASAL SUMPAH PEMUTUS (DECISOIR) (RBg; padanan untuk satker Jawa-Madura: Pasal 156 HIR - belum dipakai)',
        sql="SELECT 'Pasal 183 RBg' AS data")
    var(11379, 'ACARA: PASAL GUGATAN REKONVENSI (RBg; padanan untuk satker Jawa-Madura: Pasal 132a dan Pasal 132b HIR - belum dipakai)',
        sql="SELECT 'Pasal 157 dan Pasal 158 RBg' AS data")

    # --- butir 10: bidang kewenangan Pasal 49 (dan 50) UU Peradilan Agama menurut jenis/objek perkara ----------------------------
    lain = ("LOWER(CONCAT(IFNULL(p.petitum, ''), ' ', IFNULL(p.jenis_perkara_nama, '')))")
    var(11372, 'KEWENANGAN: BIDANG PERKARA MENURUT PASAL 49 UU PERADILAN AGAMA DAN PENJELASANNYA (OTOMATIS dari jenis perkara SIPP; Lain-Lain menurut petitum; tidak tercakup = lain-lain)',
        sql=('SELECT CASE WHEN p.jenis_perkara_id BETWEEN 341 AND 363 OR p.jenis_perkara_id = 743 '
             'OR (p.jenis_perkara_id = 369 AND (' + lain + " LIKE '%hak asuh%' OR " + lain + " LIKE '%hadhanah%' OR " + lain + " LIKE '%pemeliharaan anak%' OR "
             + lain + " LIKE '%pengangkatan anak%' OR " + lain + " LIKE '%anak angkat%' OR " + lain + " LIKE '%perwalian%')) "
             'THEN "bidang perkawinan sebagaimana dimaksud dalam Pasal 49 huruf a ' + UU_PA + ' beserta penjelasannya" '
             'WHEN p.jenis_perkara_id IN (364, 371) THEN "bidang waris sebagaimana dimaksud dalam Pasal 49 huruf b ' + UU_PA + ' beserta penjelasannya" '
             'WHEN p.jenis_perkara_id = 365 THEN "bidang wasiat sebagaimana dimaksud dalam Pasal 49 huruf c ' + UU_PA + ' beserta penjelasannya" '
             'WHEN p.jenis_perkara_id = 366 THEN "bidang hibah sebagaimana dimaksud dalam Pasal 49 huruf d ' + UU_PA + ' beserta penjelasannya" '
             'WHEN p.jenis_perkara_id = 367 THEN "bidang wakaf sebagaimana dimaksud dalam Pasal 49 huruf e ' + UU_PA + ' beserta penjelasannya" '
             'WHEN ' + lain + " LIKE '%zakat%' THEN \"bidang zakat sebagaimana dimaksud dalam Pasal 49 huruf f " + UU_PA + ' beserta penjelasannya" '
             'WHEN ' + lain + " LIKE '%infaq%' OR " + lain + " LIKE '%infak%' THEN \"bidang infaq sebagaimana dimaksud dalam Pasal 49 huruf g " + UU_PA + ' beserta penjelasannya" '
             'WHEN ' + lain + " LIKE '%shadaqah%' OR " + lain + " LIKE '%sedekah%' THEN \"bidang shadaqah sebagaimana dimaksud dalam Pasal 49 huruf h " + UU_PA + ' beserta penjelasannya" '
             'WHEN p.jenis_perkara_id = 370 THEN "bidang ekonomi syari\'ah sebagaimana dimaksud dalam Pasal 49 huruf i ' + UU_PA + ' beserta penjelasannya" '
             'ELSE "perkara lain-lain yang menjadi kewenangan Pengadilan Agama menurut ' + UU_PA + '" END AS data ' + PERKARA))
    var(11373, 'KEWENANGAN: KALIMAT PASAL 50 AYAT (2) UU PERADILAN AGAMA (sengketa hak milik antara orang-orang Islam; OTOMATIS hanya perkara kebendaan HB/waris/wasiat/hibah/wakaf/ES)',
        sql=('SELECT IF(p.jenis_perkara_id IN (348, 364, 365, 366, 367, 370), "<br>Menimbang, bahwa berdasarkan Pasal 50 ayat (2) ' + UU_PA +
             ', apabila terjadi sengketa hak milik atau keperdataan lain yang subjek hukumnya antara orang-orang yang beragama Islam, objek sengketa tersebut diputus oleh '
             'Pengadilan Agama bersama-sama perkara sebagaimana dimaksud dalam Pasal 49;", "") AS data ' + PERKARA))

    # --- butir 9: eksepsi lain, rekonvensi, penggabungan ---------------------------------------------------------------------
    var(11374, 'EKSEPSI LAIN: FAKTA DAN ALASAN MAJELIS ATAS EKSEPSI - ISIAN (kalimat sesudah "bahwa", tanpa titik akhir; dipakai saat dikabulkan maupun ditolak)', tipe='data_teks')
    var(11375, 'EKSEPSI NE BIS IN IDEM: PUTUSAN TERDAHULU YANG BERKEKUATAN HUKUM TETAP - ISIAN (nomor, tanggal, para pihak, objek, amar pokok; tanpa titik akhir)', tipe='data_teks')
    var(11376, 'EKSEPSI KURANG PIHAK: PIHAK YANG TIDAK DITARIK - ISIAN (nama dan hubungan hukumnya dengan objek/perkara; tanpa titik akhir)', tipe='data_teks')
    var(11378, 'REKONVENSI: ALASAN GUGATAN REKONVENSI TIDAK DAPAT DITERIMA - ISIAN (mis. diajukan sesudah jawaban pertama / kualitas berbeda / bukan kewenangan; tanpa titik akhir)', tipe='data_teks')
    var(11380, 'PENGGABUNGAN PERKARA: NOMOR PERKARA YANG DIMOHONKAN DIGABUNGKAN - ISIAN (mis. 123/Pdt.G/2026/PA.Xxx)', tipe='data_teks')
    var(11381, 'PENGGABUNGAN PERKARA: HUBUNGAN ERAT KEDUA PERKARA ATAU ALASAN MAJELIS - ISIAN (pihak, objek, dasar hukum yang sama; tanpa titik akhir)', tipe='data_teks')

    # --- butir 7: sumpah - lafal per agama satu tempat --------------------------------------------------------------------------
    def lafal(no, nama, agama, isi):
        """agama/isi = ekspresi SQL; pola lafal sama dengan lafal sumpah saksi Derry (var 7029)."""
        var(no, nama, sql=('SELECT CASE WHEN %s = "Islam" THEN CONCAT("Demi Allah, saya bersumpah bahwa ", %s) '
                           'WHEN %s IN ("Protestan", "Katolik") THEN CONCAT("Saya berjanji bahwa ", %s, ", semoga Tuhan menolong saya") '
                           'WHEN %s = "Hindu" THEN CONCAT("Om Atah Parama Wisesa, saya bersumpah bahwa ", %s) '
                           'WHEN %s = "Budha" THEN CONCAT("Demi Sang Hyang Adi Budha, saya bersumpah bahwa ", %s) '
                           'ELSE CONCAT("Saya berjanji bahwa ", %s) END AS data') % (agama, isi, agama, isi, agama, isi, agama, isi, isi))

    # sumpah pemutus (decisoir): pihak yang DIBEBANI sumpah dan pihak yang memintanya
    var(11382, 'SUMPAH PEMUTUS: PIHAK YANG DIBEBANI SUMPAH - ISIAN (ketik P bila #0046#; kosong = #0047#)', tipe='data_teks')
    var(11383, 'SUMPAH PEMUTUS: SEBUTAN PIHAK YANG DIBEBANI SUMPAH (OTOMATIS dari isian 11382; bawaan #0047#)',
        sql='SELECT IF(%s = "P", "#7036#", "#7037#") AS data' % huruf1(11382))
    var(11384, 'SUMPAH PEMUTUS: SEBUTAN PIHAK YANG MEMINTA SUMPAH (OTOMATIS: lawan dari pihak yang dibebani)',
        sql='SELECT IF(%s = "P", "#7037#", "#7036#") AS data' % huruf1(11382))
    var(11385, 'SUMPAH PEMUTUS: AGAMA PIHAK YANG DIBEBANI SUMPAH (OTOMATIS SIPP #0011# / #0020#; kosong = Islam)',
        sql='SELECT IF(%s = "P", IFNULL(NULLIF(TRIM("#0011#"), ""), "Islam"), IFNULL(NULLIF(TRIM("#0020#"), ""), "Islam")) AS data' % huruf1(11382))
    var(11386, 'SUMPAH PEMUTUS: RUMUSAN PERISTIWA YANG DISUMPAHKAN - ISIAN (perbuatan pihak yang dibebani, mis. saya tidak pernah menerima uang sejumlah ... dari Penggugat; tanpa titik akhir)', tipe='data_teks')
    lafal(11387, 'SUMPAH PEMUTUS: LAFAL SUMPAH MENURUT AGAMA (OTOMATIS: pembuka per agama + rumusan isian 11386)', '"#11385#"', 'COALESCE(%s, "...")' % nil(isian(11386)))
    # sumpah penaksir (aestimatoir): pihak = isian 11338 (sama dengan sumpah pelengkap, sumpah karena jabatan)
    var(11388, 'SUMPAH PENAKSIR: OBJEK DAN JUMLAH YANG DITAKSIR - ISIAN (mis. nilai kerugian atas ... adalah sejumlah Rp...; tanpa titik akhir)', tipe='data_teks')
    var(11389, 'SUMPAH PENAKSIR: BATAS JUMLAH YANG DITETAPKAN MAJELIS - ISIAN (mis. setinggi-tingginya Rp... (... rupiah); tanpa titik akhir)', tipe='data_teks')
    lafal(11390, 'SUMPAH PENAKSIR: LAFAL SUMPAH MENURUT AGAMA (OTOMATIS: pembuka per agama + isian 11388)', '"#11340#"', 'COALESCE(%s, "...")' % nil(isian(11388)))
    # sumpah li'an (UU 7/1989 Pasal 87-88; KHI Pasal 125-128)
    var(11391, "SUMPAH LI'AN: TUDUHAN ZINA DAN/ATAU PENGINGKARAN ANAK OLEH SUAMI - ISIAN (rumusan tuduhan, mis. istri saya telah berbuat zina dengan ... / anak bernama ... bukan anak saya; tanpa titik akhir)", tipe='data_teks')
    var(11392, "SUMPAH LI'AN: SEBUTAN SUAMI DAN ISTRI (OTOMATIS: cerai talak = #0046# suami; cerai gugat = #0047# suami)",
        sql="SELECT IF(p.jenis_perkara_id = 347, 'Tergugat', 'Pemohon') AS data " + PERKARA)
    var(11393, "SUMPAH LI'AN: SEBUTAN ISTRI (OTOMATIS: cerai talak = #0047#; cerai gugat = #0046#)",
        sql="SELECT IF(p.jenis_perkara_id = 347, 'Penggugat', 'Termohon') AS data " + PERKARA)

    # --- butir 8: mediasi tidak beriktikad baik (PERMA 1/2016 Pasal 7, 22, 23) dan mediasi elektronik (PERMA 3/2022) -------------
    var(11394, 'MEDIASI TIDAK BERIKTIKAD BAIK: HURUF PASAL 7 AYAT (2) PERMA 1/2016 - ISIAN (a / b / c / d / e, boleh lebih dari satu dipisah koma; arti huruf di isian 11395)', tipe='data_teks')
    H = "REPLACE(REPLACE(REPLACE(LOWER(IFNULL(%s, '')), ' ', ''), ';', ','), '.', '')" % isian(11394)
    var(11395, 'MEDIASI TIDAK BERIKTIKAD BAIK: KALIMAT PERBUATAN MENURUT PASAL 7 AYAT (2) PERMA 1/2016 (OTOMATIS dari isian 11394; kosong = titik-titik)',
        sql=('SELECT IFNULL(NULLIF(CONCAT_WS(", serta ", '
             "IF(FIND_IN_SET('a', %s) > 0," ' "tidak hadir setelah dipanggil secara patut 2 (dua) kali berturut-turut dalam pertemuan mediasi tanpa alasan sah (huruf a)", NULL), '
             "IF(FIND_IN_SET('b', %s) > 0," ' "menghadiri pertemuan mediasi pertama, tetapi selanjutnya tidak pernah hadir meskipun telah dipanggil secara patut 2 (dua) kali berturut-turut tanpa alasan sah (huruf b)", NULL), '
             "IF(FIND_IN_SET('c', %s) > 0," ' "ketidakhadiran berulang-ulang yang mengganggu jadwal pertemuan mediasi tanpa alasan sah (huruf c)", NULL), '
             "IF(FIND_IN_SET('d', %s) > 0," ' "menghadiri pertemuan mediasi, tetapi tidak mengajukan dan/atau tidak menanggapi resume perkara pihak lain (huruf d)", NULL), '
             "IF(FIND_IN_SET('e', %s) > 0," ' "tidak menandatangani konsep kesepakatan perdamaian yang telah disepakati tanpa alasan sah (huruf e)", NULL)), ""), "...") AS data')
        % (H, H, H, H, H))
    var(11396, 'PEMERIKSAAN SETEMPAT: TAMBAHAN PANJAR BIAYA PEMERIKSAAN SETEMPAT - ISIAN (angka dan terbilang, mis. Rp1.500.000,00 (satu juta lima ratus ribu rupiah))', tipe='data_teks')
    var(11397, 'PEMERIKSAAN SETEMPAT: PIHAK YANG MEMBAYAR PANJAR (OTOMATIS dari isian 11344: T = #0047#; selain itu #0046#)',
        sql='SELECT IF(%s = "T", "#7037#", "#7036#") AS data' % huruf1(11344))
    var(11398, 'MEDIASI TIDAK BERIKTIKAD BAIK: BIAYA MEDIASI - ISIAN (angka dan terbilang, mis. Rp150.000,00 (seratus lima puluh ribu rupiah))', tipe='data_teks')
    var(11399, 'MEDIASI ELEKTRONIK: SARANA YANG DISEPAKATI - ISIAN (mis. aplikasi konferensi video ...; kosong = media komunikasi audio visual jarak jauh)', tipe='data_teks')
    var(11400, 'MEDIASI ELEKTRONIK: KALIMAT SARANA (OTOMATIS dari isian 11399; kosong = melalui media komunikasi audio visual jarak jauh; tanpa spasi awal)',
        sql='SELECT CONCAT("melalui ", COALESCE(%s, "media komunikasi audio visual jarak jauh")) AS data' % nil(isian(11399)))
