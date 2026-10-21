-- =====================================================================================================
-- X9 (21 Okt 2026): identitas pihak banyak. Kueri ABT 7047/7097 (Pemohon/Penggugat), 7048/7098 (Termohon/Tergugat), 8710 (Turut Tergugat) dan 7054
-- (pihak intervensi) hanya menyusun sampai 4-5 pihak (7047: 4; 7048, 7097, 7098: 5; 8710: 10; 7054: 5) dan berhenti diam-diam ("ELSE ''").
-- Perkara nyata di server punya sampai 32 Pemohon, 25 Tergugat dan 26 Turut Tergugat. Enam fungsi tersimpan di basis ABT menyusun SEMUA pihak
-- (urutan ke-N) dengan sebutan berangka romawi; kueri lama dibiarkan persis untuk pihak <= batas lamanya dan memanggil fungsi hanya sesudah batas itu.
-- Ditulis untuk MariaDB 5.5. Membaca (tidak menulis) tabel SIPP: nama basis SIPP tertulis "SIPP" (sama dengan basis SIPP server);
-- di basis uji laptop pasang-satker.sh menggantinya otomatis. Nama fungsi netral (isian_rtf_*).
-- =====================================================================================================
DELIMITER $$

DROP FUNCTION IF EXISTS isian_rtf_romawi$$
CREATE FUNCTION isian_rtf_romawi(n INT) RETURNS VARCHAR(40) CHARSET latin1
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'X9: angka romawi 1-3999 (selain itu kosong)'
BEGIN
  DECLARE r VARCHAR(40) CHARSET latin1 DEFAULT '';
  IF n IS NULL OR n < 1 OR n > 3999 THEN
    RETURN '';
  END IF;
  WHILE n >= 1000 DO SET r = CONCAT(r, 'M'); SET n = n - 1000; END WHILE;
  WHILE n >= 900 DO SET r = CONCAT(r, 'CM'); SET n = n - 900; END WHILE;
  WHILE n >= 500 DO SET r = CONCAT(r, 'D'); SET n = n - 500; END WHILE;
  WHILE n >= 400 DO SET r = CONCAT(r, 'CD'); SET n = n - 400; END WHILE;
  WHILE n >= 100 DO SET r = CONCAT(r, 'C'); SET n = n - 100; END WHILE;
  WHILE n >= 90 DO SET r = CONCAT(r, 'XC'); SET n = n - 90; END WHILE;
  WHILE n >= 50 DO SET r = CONCAT(r, 'L'); SET n = n - 50; END WHILE;
  WHILE n >= 40 DO SET r = CONCAT(r, 'XL'); SET n = n - 40; END WHILE;
  WHILE n >= 10 DO SET r = CONCAT(r, 'X'); SET n = n - 10; END WHILE;
  WHILE n >= 9 DO SET r = CONCAT(r, 'IX'); SET n = n - 9; END WHILE;
  WHILE n >= 5 DO SET r = CONCAT(r, 'V'); SET n = n - 5; END WHILE;
  WHILE n >= 4 DO SET r = CONCAT(r, 'IV'); SET n = n - 4; END WHILE;
  WHILE n >= 1 DO SET r = CONCAT(r, 'I'); SET n = n - 1; END WHILE;
  RETURN r;
END$$

DROP FUNCTION IF EXISTS isian_rtf_tanggal$$
CREATE FUNCTION isian_rtf_tanggal(d DATE) RETURNS VARCHAR(40) CHARSET latin1
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'X9: tanggal gaya ABT (tgl_indo2: 01 Oktober 1970); kosong bila NULL atau sebelum 1900'
BEGIN
  IF d IS NULL OR d < '1900-01-01' THEN
    RETURN '';
  END IF;
  RETURN CONCAT(LPAD(DAY(d), 2, '0'), ' ', ELT(MONTH(d), 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'), ' ', YEAR(d));
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_utama$$
CREATE FUNCTION isian_rtf_pihak_utama(p_perkara BIGINT, p_sisi INT, p_dari INT, p_sebutan VARCHAR(100) CHARSET latin1, p_kediaman VARCHAR(200) CHARSET latin1)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'X9: identitas lengkap para pihak (sisi 1 = Pemohon/Penggugat, 2 = Termohon/Tergugat) mulai urutan p_dari sampai terakhir, satu pihak satu baris dipisah <br>, bentuk sama dengan 7047/7048'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_urutan INT;
  DECLARE v_nama, v_nik, v_tempat, v_agama, v_pekerjaan, v_pendidikan, v_alamat VARCHAR(600) CHARSET latin1;
  DECLARE v_tgl DATE;
  DECLARE c CURSOR FOR
    SELECT a.urutan, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, a.alamat
      FROM SIPP.perkara_pihak1 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 1 AND a.perkara_id = p_perkara AND a.urutan >= p_dari
    UNION ALL
    SELECT a.urutan, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, a.alamat
      FROM SIPP.perkara_pihak2 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 2 AND a.perkara_id = p_perkara AND a.urutan >= p_dari
    ORDER BY 1;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) OR p_dari IS NULL THEN
    RETURN '';
  END IF;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_nama, v_nik, v_tempat, v_tgl, v_agama, v_pekerjaan, v_pendidikan, v_alamat;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'),
      '<strong>', IFNULL(v_nama, ''), '</strong>, NIK ', IFNULL(v_nik, ''),
      ', tempat dan tanggal lahir ', IFNULL(v_tempat, ''), ', ', isian_rtf_tanggal(v_tgl),
      ', agama ', IFNULL(v_agama, ''), ', pekerjaan ', IFNULL(v_pekerjaan, ''), ', pendidikan ', IFNULL(v_pendidikan, ''),
      ', ', IFNULL(p_kediaman, ''), ' ', IFNULL(v_alamat, ''),
      ', sebagai <strong>', IFNULL(p_sebutan, ''), ' ', isian_rtf_romawi(v_urutan), '</strong>;');
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_nama$$
CREATE FUNCTION isian_rtf_pihak_nama(p_perkara BIGINT, p_sisi INT, p_dari INT, p_sebutan VARCHAR(100) CHARSET latin1)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'X9: nama para pihak (sisi 1 atau 2) mulai urutan p_dari sampai terakhir: "Nama, sebagai Sebutan N;" dipisah <br>, bentuk sama dengan 7097/7098'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_urutan INT;
  DECLARE v_nama VARCHAR(600) CHARSET latin1;
  DECLARE c CURSOR FOR
    SELECT a.urutan, a.nama FROM SIPP.perkara_pihak1 a WHERE p_sisi = 1 AND a.perkara_id = p_perkara AND a.urutan >= p_dari
    UNION ALL
    SELECT a.urutan, a.nama FROM SIPP.perkara_pihak2 a WHERE p_sisi = 2 AND a.perkara_id = p_perkara AND a.urutan >= p_dari
    ORDER BY 1;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) OR p_dari IS NULL THEN
    RETURN '';
  END IF;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_nama;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'), IFNULL(v_nama, ''), ', sebagai <strong>', IFNULL(p_sebutan, ''), ' ', isian_rtf_romawi(v_urutan), '</strong>;');
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_urutan$$
CREATE FUNCTION isian_rtf_pihak_urutan(p_perkara BIGINT, p_sisi INT, p_sebutan VARCHAR(100) CHARSET latin1)
  RETURNS VARCHAR(8000) CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'X9: sebutan semua pihak sisi 1 atau 2 dari I sampai urutan terbesar: "Pemohon I, Pemohon II, ... dan Pemohon N" (satu pihak: "Pemohon I")'
BEGIN
  DECLARE v_max INT DEFAULT 0;
  DECLARE i INT DEFAULT 1;
  DECLARE hasil VARCHAR(8000) CHARSET latin1 DEFAULT '';
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) THEN
    RETURN '';
  END IF;
  IF p_sisi = 1 THEN
    SELECT IFNULL(MAX(urutan), 0) INTO v_max FROM SIPP.perkara_pihak1 WHERE perkara_id = p_perkara;
  ELSE
    SELECT IFNULL(MAX(urutan), 0) INTO v_max FROM SIPP.perkara_pihak2 WHERE perkara_id = p_perkara;
  END IF;
  IF v_max > 400 THEN
    SET v_max = 400;
  END IF;
  WHILE i <= v_max DO
    SET hasil = CONCAT(hasil,
      IF(i = 1, '', IF(i = v_max, ' dan ', ', ')),
      IFNULL(p_sebutan, ''), ' ', isian_rtf_romawi(i));
    SET i = i + 1;
  END WHILE;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_tambahan$$
CREATE FUNCTION isian_rtf_pihak_tambahan(p_perkara BIGINT, p_tabel INT)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'X9: identitas Turut Tergugat/Termohon (p_tabel 4, perkara_pihak4; bentuk sama dengan 8710) atau pihak intervensi (3, perkara_pihak3; bentuk sama dengan 7054), semua urutan, diawali <br>; kosong bila tidak ada'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_n INT DEFAULT 0;
  DECLARE v_rn INT DEFAULT 0;
  DECLARE v_s2 VARCHAR(20) CHARSET latin1 DEFAULT 'Tergugat';
  DECLARE v_urutan INT;
  DECLARE v_nama, v_alamat, v_jenis VARCHAR(600) CHARSET latin1;
  DECLARE v_nik, v_tempat, v_pekerjaan VARCHAR(600) CHARSET latin1;
  DECLARE v_tgl DATE;
  DECLARE v_agama_id INT;
  DECLARE v_sebut VARCHAR(700) CHARSET latin1;
  DECLARE c CURSOR FOR
    SELECT t.urutan, t.nama, t.alamat, NULL, ph.nomor_indentitas, ph.tempat_lahir, ph.tanggal_lahir, ph.agama_id, ph.pekerjaan
      FROM SIPP.perkara_pihak4 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id
     WHERE p_tabel = 4 AND t.perkara_id = p_perkara
    UNION ALL
    SELECT t.urutan, t.nama, t.alamat, t.jenis_intervensi_nama, ph.nomor_indentitas, ph.tempat_lahir, ph.tanggal_lahir, ph.agama_id, ph.pekerjaan
      FROM SIPP.perkara_pihak3 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id
     WHERE p_tabel = 3 AND t.perkara_id = p_perkara
    ORDER BY 1;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_tabel NOT IN (3, 4) THEN
    RETURN '';
  END IF;
  IF p_tabel = 4 THEN
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak4 WHERE perkara_id = p_perkara;
  ELSE
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak3 WHERE perkara_id = p_perkara;
  END IF;
  IF v_n = 0 THEN
    RETURN '';
  END IF;
  SELECT IF(p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341), 'Termohon', 'Tergugat') INTO v_s2 FROM SIPP.perkara p WHERE p.perkara_id = p_perkara;
  SET selesai = 0;   -- SELECT INTO tanpa baris memicu NOT FOUND; jangan dibawa ke perulangan
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_nama, v_alamat, v_jenis, v_nik, v_tempat, v_tgl, v_agama_id, v_pekerjaan;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET v_rn = v_rn + 1;
    IF p_tabel = 4 THEN
      SET v_sebut = CONCAT('Turut ', IFNULL(v_s2, 'Tergugat'));
    ELSE
      SET v_sebut = IFNULL(NULLIF(TRIM(v_jenis), ''), 'Pihak Intervensi');
    END IF;
    SET hasil = CONCAT(hasil, '<br>',
      '<strong>', TRIM(IFNULL(v_nama, '')), '</strong>',
      IF(TRIM(IFNULL(v_nik, '')) = '' OR TRIM(v_nik) REGEXP '^[0 -]+$', '', CONCAT(', NIK ', TRIM(v_nik))),
      IF(TRIM(IFNULL(v_tempat, '')) = '' OR v_tgl IS NULL OR v_tgl < '1900-01-01', '', CONCAT(', tempat dan tanggal lahir ', TRIM(v_tempat), ', ', isian_rtf_tanggal(v_tgl))),
      IF(IFNULL(v_agama_id, 0) BETWEEN 1 AND 7, CONCAT(', agama ', ELT(v_agama_id, 'Islam','Protestan','Katolik','Budha','Hindu','Lainnya','Kong Hu Cu')), ''),
      IF(TRIM(IFNULL(v_pekerjaan, '')) = '', '', CONCAT(', pekerjaan ', TRIM(v_pekerjaan))),
      ', beralamat di ', TRIM(IFNULL(v_alamat, '')), ', sebagai <strong>', v_sebut,
      IF(v_n > 1, CONCAT(' ', isian_rtf_romawi(v_rn)), ''), '</strong>;');
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DELIMITER ;
