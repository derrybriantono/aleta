-- =====================================================================================================
-- AP (28 Okt 2026): keterangan arah di dalam KURUNG pada alamat pihak ("Jalan Poros Palu-Bangga (rumah sesudah Jembatan / Kios X), Desa Poi")
-- hanya untuk juru sita; di PUTUSAN dibuang. Relaas TIDAK memakai fungsi ini (alamat tetap utuh dengan kurungnya).
-- Tiga fungsi baru, semuanya hanya MEMBACA argumen (isian_rtf_alamat_putusan juga membaca tabel referensi wilayah lewat isian_rtf_alamat):
--   isian_rtf_alamat_arah(isi)       : isi satu pasang kurung = petunjuk arah / penanda tempat (1, dibuang) atau bagian alamat/keterangan status (0, dipertahankan)
--   isian_rtf_alamat_buang_arah(x)   : membuang pasang kurung bertingkat-luar yang isinya petunjuk arah; spasi dan koma di sekitarnya dirapikan ("..., Desa Poi", bukan "Bangga , Desa")
--   isian_rtf_alamat_putusan(x)      : isian_rtf_alamat(isian_rtf_alamat_buang_arah(x)) - pengganti isian_rtf_alamat di variabel dan fungsi yang khusus putusan
-- Dipertahankan (bukan petunjuk): (GAIB), (RT/RW ...), (Dusun/Desa/Kelurahan/Kecamatan/Kabupaten/Kota/Provinsi ...), (Jl./Jalan/Gang ...), (Blok ...),
-- keterangan riwayat ("dahulu", "semula", "sesuai ..."), nama kompleks/perumahan/huntara/lapas, dan kurung yang tak berpasangan. Kurung tanpa kata petunjuk dibiarkan (aman: tidak ada yang hilang diam-diam).
-- Ditulis untuk MariaDB 5.5 (REGEXP tanpa batas-kata khusus). Komentar fungsi berawalan "AP:". Tanpa komentar "--" di badan fungsi (klien mysql membuangnya, md5 definisi dihitung tanpa komentar).
-- =====================================================================================================
DELIMITER $$

DROP FUNCTION IF EXISTS isian_rtf_alamat_arah$$
CREATE FUNCTION isian_rtf_alamat_arah(x LONGTEXT CHARSET latin1) RETURNS INT
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AP: isi satu pasang kurung pada alamat = petunjuk arah/penanda tempat yang dibuang di putusan? 1 ya, 0 bukan (GAIB, RT/RW, dusun/desa/jalan, riwayat, kompleks tetap)'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  SET s = LOWER(TRIM(IFNULL(x, '')));
  IF s REGEXP '^[^a-z0-9]*$' THEN RETURN 1; END IF;
  IF s REGEXP 'g[h]?aib' THEN RETURN 0; END IF;
  IF s REGEXP '^(rt|rw|dusun|dsn|dukuh|desa|kelurahan|kel|kecamatan|kec|kabupaten|kab|kota|provinsi|prov|jl|jln|jalan|gang|gg|lingkungan|lk|blok|dahulu|semula|awalnya|sekarang|sesuai|saat ini|tidak diketahui)([^a-z0-9]|$)' THEN RETURN 0; END IF;
  IF s REGEXP '(^|[^a-z0-9])((di)?rumah[a-z]*|sesudah|setelah|sebelum|sebelah|depan|didepan|deopan|belakang|dibelakang|samping|disamping|dekat|didekat|dekan|berdekatan|arah|kearah|masuk|lorong|lrg|dilorong|seberang|sebrang|atas|bawah|menuju|jurusan|sekitar|sekitaran|perbatasan|pertigaan|perempatan|tikungan|simpang|belok|meter|km|pinggir|cat|warna|dikenal|kiri|kanan)([^a-z0-9]|$)' THEN RETURN 1; END IF;
  IF s REGEXP '^(di|kios|koios|toko|warung|bengkel|salon|apotik|apotek|mesjid|masjid|mushollah|musholla|sd|sdn|smp|sma|mts|paud|tk|puskesmas|kantor|pasar|lapangan|jembatan|pabrik|gereja|polsek|sekolah|dealer|ruko|cafe|depot|tugu|tanggul|gudang|taman|dapur|foto|optik|spbu|madrasah|panti|ponpes|peternakan|pemotongan)([^a-z0-9]|$)' THEN RETURN 1; END IF;
  RETURN 0;
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_buang_arah$$
CREATE FUNCTION isian_rtf_alamat_buang_arah(x LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AP: pasang kurung (bertingkat-luar) berisi petunjuk arah dibuang dari alamat pihak; spasi/koma sekitarnya dirapikan; kurung tak berpasangan dan bagian alamat dibiarkan; tanpa kurung = tidak berubah'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE n INT DEFAULT 0;
  DECLARE i INT DEFAULT 1;
  DECLARE j INT DEFAULT 0;
  DECLARE k INT DEFAULT 0;
  DECLARE d INT DEFAULT 0;
  DECLARE akhir INT DEFAULT 0;
  DECLARE c VARCHAR(1) CHARSET latin1;
  DECLARE c2 VARCHAR(1) CHARSET latin1;
  IF x IS NULL THEN
    RETURN NULL;
  END IF;
  IF LOCATE('(', x) = 0 THEN
    RETURN x;
  END IF;
  SET s = x;
  SET n = CHAR_LENGTH(s);
  WHILE i <= n DO
    SET c = SUBSTRING(s, i, 1);
    IF c = '(' THEN
      SET d = 0;
      SET j = i;
      SET akhir = 0;
      WHILE j <= n AND akhir = 0 DO
        SET c2 = SUBSTRING(s, j, 1);
        IF c2 = '(' THEN
          SET d = d + 1;
        ELSEIF c2 = ')' THEN
          SET d = d - 1;
          IF d = 0 THEN
            SET akhir = j;
          END IF;
        END IF;
        IF akhir = 0 THEN
          SET j = j + 1;
        END IF;
      END WHILE;
      IF akhir > 0 THEN
        IF isian_rtf_alamat_arah(SUBSTRING(s, i + 1, akhir - i - 1)) = 1 THEN
          SET o = RTRIM(o);
          IF RIGHT(o, 1) = '(' THEN
            SET o = RTRIM(LEFT(o, CHAR_LENGTH(o) - 1));
          END IF;
          SET k = akhir + 1;
          WHILE k <= n AND SUBSTRING(s, k, 1) = ' ' DO
            SET k = k + 1;
          END WHILE;
          SET c2 = SUBSTRING(s, k, 1);
          IF c2 = ',' AND (o = '' OR RIGHT(o, 1) = ',') THEN
            SET k = k + 1;
            WHILE k <= n AND SUBSTRING(s, k, 1) = ' ' DO
              SET k = k + 1;
            END WHILE;
            SET c2 = SUBSTRING(s, k, 1);
          END IF;
          IF o <> '' AND c2 <> '' AND c2 NOT IN (',', '.', ';', ')') THEN
            SET o = CONCAT(o, ' ');
          END IF;
          SET i = k;
        ELSE
          SET o = CONCAT(o, SUBSTRING(s, i, akhir - i + 1));
          SET i = akhir + 1;
        END IF;
      ELSE
        SET o = CONCAT(o, c);
        SET i = i + 1;
      END IF;
    ELSE
      SET o = CONCAT(o, c);
      SET i = i + 1;
    END IF;
  END WHILE;
  RETURN o;
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_putusan$$
CREATE FUNCTION isian_rtf_alamat_putusan(x LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'AP: alamat pihak untuk PUTUSAN = isian_rtf_alamat tanpa petunjuk arah dalam kurung (relaas memakai isian_rtf_alamat, kurung tetap)'
BEGIN
  RETURN isian_rtf_alamat(isian_rtf_alamat_buang_arah(x));
END$$

-- Dua fungsi paket 27 Okt diganti: isian_rtf_alamat( -> isian_rtf_alamat_putusan( (dua tempat per fungsi: pihak sisi 1 dan sisi 2). Selebihnya persis paket 27 Okt.
DROP FUNCTION IF EXISTS isian_rtf_pihak_identitas$$
CREATE FUNCTION isian_rtf_pihak_identitas(p_perkara BIGINT, p_sisi INT, p_sebutan VARCHAR(100) CHARSET latin1, p_kediaman VARCHAR(200) CHARSET latin1, p_alamat1 VARCHAR(1000) CHARSET latin1, p_kuasa TEXT CHARSET latin1)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: identitas SEMUA pihak sisi 1 atau 2 menurut peringkat (urut urutan, id) untuk perkara yang urutannya tidak rapat dari 1; satu pihak tanpa angka romawi; alamat pihak pertama boleh diganti p_alamat1; p_kuasa (bila terisi) = kalimat kuasa'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_n INT DEFAULT 0;
  DECLARE v_rn INT DEFAULT 0;
  DECLARE v_kuasa TEXT CHARSET latin1;
  DECLARE v_urutan INT;
  DECLARE v_id BIGINT;
  DECLARE v_nama, v_nik, v_tempat, v_agama, v_pekerjaan, v_pendidikan, v_alamat, v_kedi VARCHAR(1000) CHARSET latin1;
  DECLARE v_akhir VARCHAR(400) CHARSET latin1;
  DECLARE v_tgl DATE;
  DECLARE c CURSOR FOR
    SELECT a.urutan, a.id, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat_putusan(a.alamat)
      FROM SIPP.perkara_pihak1 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 1 AND a.perkara_id = p_perkara
    UNION ALL
    SELECT a.urutan, a.id, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat_putusan(a.alamat)
      FROM SIPP.perkara_pihak2 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 2 AND a.perkara_id = p_perkara
    ORDER BY 1, 2;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) THEN
    RETURN '';
  END IF;
  SET v_n = isian_rtf_pihak_jumlah(p_perkara, p_sisi);
  IF v_n = 0 THEN
    RETURN '';
  END IF;
  SET v_kuasa = TRIM(IFNULL(p_kuasa, ''));
  SET selesai = 0;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_id, v_nama, v_nik, v_tempat, v_tgl, v_agama, v_pekerjaan, v_pendidikan, v_alamat;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET v_rn = v_rn + 1;
    IF v_rn = 1 AND TRIM(IFNULL(p_alamat1, '')) <> '' THEN
      SET v_alamat = TRIM(p_alamat1);
    END IF;
    IF p_sisi = 2 AND LOCATE('dahulu', IFNULL(v_alamat, '')) > 0 THEN
      SET v_kedi = '';
    ELSE
      SET v_kedi = IFNULL(p_kediaman, '');
    END IF;
    IF v_n = 1 THEN
      IF v_kuasa <> '' THEN
        SET v_akhir = CONCAT(', dalam hal ini ', v_kuasa, ', sebagai <strong>', IFNULL(p_sebutan, ''), '</strong>;');
      ELSE
        SET v_akhir = CONCAT(', sebagai <strong>', IFNULL(p_sebutan, ''), '</strong>;');
      END IF;
    ELSE
      SET v_akhir = CONCAT(', sebagai <strong>', IFNULL(p_sebutan, ''), ' ', isian_rtf_romawi(v_rn), '</strong>;');
    END IF;
    SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'),
      '<strong>', IFNULL(v_nama, ''), '</strong>, NIK ', IFNULL(v_nik, ''),
      ', tempat dan tanggal lahir ', IFNULL(v_tempat, ''), ', ', isian_rtf_tanggal(v_tgl),
      ', agama ', IFNULL(v_agama, ''), ', pekerjaan ', IFNULL(v_pekerjaan, ''), ', pendidikan ', IFNULL(v_pendidikan, ''),
      ', ', TRIM(CONCAT_WS(' ', v_kedi, IFNULL(v_alamat, ''))), v_akhir);
  END LOOP;
  CLOSE c;
  IF v_n > 1 AND v_kuasa <> '' THEN
    SET hasil = CONCAT(hasil, '<br>Dalam hal ini ', isian_rtf_pihak_urutan(p_perkara, p_sisi, p_sebutan), ' ', v_kuasa,
      IF(p_sisi = 1, ', selanjutnya disebut sebagai <strong>', ', sebagai <strong>'), IFNULL(p_sebutan, ''), '</strong>;');
  END IF;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_utama$$
CREATE FUNCTION isian_rtf_pihak_utama(p_perkara BIGINT, p_sisi INT, p_dari INT, p_sebutan VARCHAR(100) CHARSET latin1, p_kediaman VARCHAR(200) CHARSET latin1)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: identitas lengkap para pihak (sisi 1 = Pemohon/Penggugat, 2 = Termohon/Tergugat) mulai PERINGKAT p_dari (urut urutan, id) sampai terakhir, satu pihak satu baris dipisah <br>, bentuk sama dengan 7047/7048'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_rn INT DEFAULT 0;
  DECLARE v_urutan INT;
  DECLARE v_id BIGINT;
  DECLARE v_nama, v_nik, v_tempat, v_agama, v_pekerjaan, v_pendidikan, v_alamat VARCHAR(600) CHARSET latin1;
  DECLARE v_tgl DATE;
  DECLARE c CURSOR FOR
    SELECT a.urutan, a.id, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat_putusan(a.alamat)
      FROM SIPP.perkara_pihak1 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 1 AND a.perkara_id = p_perkara
    UNION ALL
    SELECT a.urutan, a.id, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat_putusan(a.alamat)
      FROM SIPP.perkara_pihak2 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 2 AND a.perkara_id = p_perkara
    ORDER BY 1, 2;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) OR p_dari IS NULL THEN
    RETURN '';
  END IF;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_id, v_nama, v_nik, v_tempat, v_tgl, v_agama, v_pekerjaan, v_pendidikan, v_alamat;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET v_rn = v_rn + 1;
    IF v_rn >= p_dari THEN
      SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'),
        '<strong>', IFNULL(v_nama, ''), '</strong>, NIK ', IFNULL(v_nik, ''),
        ', tempat dan tanggal lahir ', IFNULL(v_tempat, ''), ', ', isian_rtf_tanggal(v_tgl),
        ', agama ', IFNULL(v_agama, ''), ', pekerjaan ', IFNULL(v_pekerjaan, ''), ', pendidikan ', IFNULL(v_pendidikan, ''),
        ', ', IFNULL(p_kediaman, ''), ' ', IFNULL(v_alamat, ''),
        ', sebagai <strong>', IFNULL(p_sebutan, ''), ' ', isian_rtf_romawi(v_rn), '</strong>;');
    END IF;
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DELIMITER ;
