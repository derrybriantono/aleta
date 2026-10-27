-- =====================================================================================================
-- PU (27 Okt 2026): sebutan pihak banyak menurut PERINGKAT dalam tabelnya (urut urutan, id), bukan menurut nilai kolom urutan.
-- Pendaftaran e-Court menomori urutan BERSAMBUNG lintas tabel (perkara 656/Pdt.G/2026/PA.Dgl: Penggugat 1-25, Tergugat satu baris urutan 25,
-- Turut Tergugat urutan 25 dan 26), sehingga "Tergugat I-V" kosong dan "Tergugat XXV" tercetak. Peringkat = urutan ke-berapa pihak itu dalam tabelnya.
-- Perkara yang urutannya mulai 1 dan rapat: peringkat = urutan, keluaran SAMA PERSIS dengan fungsi lama.
-- Empat fungsi x9 yang ada diganti (DROP + CREATE; definisi lama di -FUNGSI-X9-LAMA.sql): isian_rtf_pihak_utama, isian_rtf_pihak_nama,
-- isian_rtf_pihak_urutan, isian_rtf_pihak_tambahan. Lima fungsi baru: isian_rtf_pihak_identitas, isian_rtf_pihak_nama_semua, isian_rtf_pihak_kaki,
-- isian_rtf_pihak_sebut dan (pembantu) isian_rtf_pihak_jumlah. Hanya MEMBACA SIPP.perkara, perkara_pihak1/2/3/4, pihak, agama, tingkat_pendidikan.
-- Catatan: klien mysql membuang komentar "--" di dalam badan fungsi (md5 definisi dihitung tanpa komentar), maka tidak ada komentar di badan.
-- isian_rtf_pihak_identitas: sisi 2 dengan alamat berawalan "dahulu bertempat kediaman di ..." (ghaib) tidak diberi awalan "tempat kediaman di" (sama dengan variabel 0124).
-- "SET selesai = 0" sesudah SELECT INTO: SELECT INTO tanpa baris menyalakan penangan NOT FOUND.
-- Ditulis untuk MariaDB 5.5. Nama basis SIPP tertulis "SIPP" (di laptop pasang-satker.sh menggantinya). Komentar fungsi berawalan "PU:".
-- =====================================================================================================
DELIMITER $$

DROP FUNCTION IF EXISTS isian_rtf_pihak_jumlah$$
CREATE FUNCTION isian_rtf_pihak_jumlah(p_perkara BIGINT, p_tabel INT) RETURNS INT
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: jumlah baris pihak perkara (tabel 1 = perkara_pihak1 Pemohon/Penggugat, 2 = perkara_pihak2 Termohon/Tergugat, 3 = perkara_pihak3 intervensi, 4 = perkara_pihak4 Turut Tergugat/Termohon)'
BEGIN
  DECLARE v_n INT DEFAULT 0;
  IF p_perkara IS NULL OR p_tabel IS NULL THEN
    RETURN 0;
  END IF;
  IF p_tabel = 1 THEN
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak1 WHERE perkara_id = p_perkara;
  ELSEIF p_tabel = 2 THEN
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak2 WHERE perkara_id = p_perkara;
  ELSEIF p_tabel = 3 THEN
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak3 WHERE perkara_id = p_perkara;
  ELSEIF p_tabel = 4 THEN
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak4 WHERE perkara_id = p_perkara;
  END IF;
  RETURN v_n;
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
    SELECT a.urutan, a.id, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat(a.alamat)
      FROM SIPP.perkara_pihak1 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 1 AND a.perkara_id = p_perkara
    UNION ALL
    SELECT a.urutan, a.id, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat(a.alamat)
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

DROP FUNCTION IF EXISTS isian_rtf_pihak_nama$$
CREATE FUNCTION isian_rtf_pihak_nama(p_perkara BIGINT, p_sisi INT, p_dari INT, p_sebutan VARCHAR(100) CHARSET latin1)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: nama para pihak (sisi 1 atau 2) mulai PERINGKAT p_dari (urut urutan, id) sampai terakhir: "Nama, sebagai Sebutan N;" dipisah <br>, bentuk sama dengan 7097/7098'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_rn INT DEFAULT 0;
  DECLARE v_urutan INT;
  DECLARE v_id BIGINT;
  DECLARE v_nama VARCHAR(600) CHARSET latin1;
  DECLARE c CURSOR FOR
    SELECT a.urutan, a.id, a.nama FROM SIPP.perkara_pihak1 a WHERE p_sisi = 1 AND a.perkara_id = p_perkara
    UNION ALL
    SELECT a.urutan, a.id, a.nama FROM SIPP.perkara_pihak2 a WHERE p_sisi = 2 AND a.perkara_id = p_perkara
    ORDER BY 1, 2;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) OR p_dari IS NULL THEN
    RETURN '';
  END IF;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_id, v_nama;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET v_rn = v_rn + 1;
    IF v_rn >= p_dari THEN
      SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'), IFNULL(v_nama, ''), ', sebagai <strong>', IFNULL(p_sebutan, ''), ' ', isian_rtf_romawi(v_rn), '</strong>;');
    END IF;
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_urutan$$
CREATE FUNCTION isian_rtf_pihak_urutan(p_perkara BIGINT, p_sisi INT, p_sebutan VARCHAR(100) CHARSET latin1)
  RETURNS VARCHAR(8000) CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: sebutan semua pihak sisi 1 atau 2 dari I sampai pihak terakhir menurut JUMLAH pihak: "Pemohon I, Pemohon II, ... dan Pemohon N" (satu pihak: "Pemohon I")'
BEGIN
  DECLARE v_max INT DEFAULT 0;
  DECLARE i INT DEFAULT 1;
  DECLARE hasil VARCHAR(8000) CHARSET latin1 DEFAULT '';
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) THEN
    RETURN '';
  END IF;
  SET v_max = isian_rtf_pihak_jumlah(p_perkara, p_sisi);
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
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: identitas Turut Tergugat/Termohon (p_tabel 4, perkara_pihak4; bentuk sama dengan 8710) atau pihak intervensi (3, perkara_pihak3; bentuk sama dengan 7054), semua pihak menurut peringkat (urut urutan, id), diawali <br>; kosong bila tidak ada'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_n INT DEFAULT 0;
  DECLARE v_rn INT DEFAULT 0;
  DECLARE v_s2 VARCHAR(20) CHARSET latin1 DEFAULT 'Tergugat';
  DECLARE v_urutan INT;
  DECLARE v_id BIGINT;
  DECLARE v_nama, v_alamat, v_jenis VARCHAR(600) CHARSET latin1;
  DECLARE v_nik, v_tempat, v_pekerjaan VARCHAR(600) CHARSET latin1;
  DECLARE v_tgl DATE;
  DECLARE v_agama_id INT;
  DECLARE v_sebut VARCHAR(700) CHARSET latin1;
  DECLARE c CURSOR FOR
    SELECT t.urutan, t.id, t.nama, isian_rtf_alamat(t.alamat), NULL, ph.nomor_indentitas, ph.tempat_lahir, ph.tanggal_lahir, ph.agama_id, ph.pekerjaan
      FROM SIPP.perkara_pihak4 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id
     WHERE p_tabel = 4 AND t.perkara_id = p_perkara
    UNION ALL
    SELECT t.urutan, t.id, t.nama, isian_rtf_alamat(t.alamat), t.jenis_intervensi_nama, ph.nomor_indentitas, ph.tempat_lahir, ph.tanggal_lahir, ph.agama_id, ph.pekerjaan
      FROM SIPP.perkara_pihak3 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id
     WHERE p_tabel = 3 AND t.perkara_id = p_perkara
    ORDER BY 1, 2;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_tabel NOT IN (3, 4) THEN
    RETURN '';
  END IF;
  SET v_n = isian_rtf_pihak_jumlah(p_perkara, p_tabel);
  IF v_n = 0 THEN
    RETURN '';
  END IF;
  SELECT IF(p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341), 'Termohon', 'Tergugat') INTO v_s2 FROM SIPP.perkara p WHERE p.perkara_id = p_perkara;
  SET selesai = 0;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_id, v_nama, v_alamat, v_jenis, v_nik, v_tempat, v_tgl, v_agama_id, v_pekerjaan;
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
    SELECT a.urutan, a.id, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat(a.alamat)
      FROM SIPP.perkara_pihak1 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 1 AND a.perkara_id = p_perkara
    UNION ALL
    SELECT a.urutan, a.id, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat(a.alamat)
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

DROP FUNCTION IF EXISTS isian_rtf_pihak_nama_semua$$
CREATE FUNCTION isian_rtf_pihak_nama_semua(p_perkara BIGINT, p_sisi INT, p_sebutan VARCHAR(100) CHARSET latin1)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: nama SEMUA pihak sisi 1 atau 2 menurut peringkat untuk perkara yang urutannya tidak rapat dari 1: "Nama, sebagai Sebutan N;" dipisah <br>; satu pihak tanpa angka romawi'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_n INT DEFAULT 0;
  DECLARE v_rn INT DEFAULT 0;
  DECLARE v_urutan INT;
  DECLARE v_id BIGINT;
  DECLARE v_nama VARCHAR(600) CHARSET latin1;
  DECLARE c CURSOR FOR
    SELECT a.urutan, a.id, a.nama FROM SIPP.perkara_pihak1 a WHERE p_sisi = 1 AND a.perkara_id = p_perkara
    UNION ALL
    SELECT a.urutan, a.id, a.nama FROM SIPP.perkara_pihak2 a WHERE p_sisi = 2 AND a.perkara_id = p_perkara
    ORDER BY 1, 2;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) THEN
    RETURN '';
  END IF;
  SET v_n = isian_rtf_pihak_jumlah(p_perkara, p_sisi);
  IF v_n = 0 THEN
    RETURN '';
  END IF;
  SET selesai = 0;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_id, v_nama;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET v_rn = v_rn + 1;
    SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'), IFNULL(v_nama, ''), ', sebagai <strong>', IFNULL(p_sebutan, ''),
      IF(v_n = 1, '', CONCAT(' ', isian_rtf_romawi(v_rn))), '</strong>;');
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_kaki$$
CREATE FUNCTION isian_rtf_pihak_kaki(p_perkara BIGINT, p_sisi INT)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: sebutan pihak sisi 1 atau 2 untuk kaki putusan/penetapan: satu pihak = "Penggugat"; banyak pihak = "Penggugat I, Penggugat II, ... Penggugat XI, ..." (angka romawi untuk semua, peringkat menurut urut urutan, id); NULL bila tak ada pihak'
BEGIN
  DECLARE v_alur INT;
  DECLARE v_jenis INT;
  DECLARE v_n INT DEFAULT 0;
  DECLARE v_label VARCHAR(20) CHARSET latin1 DEFAULT '';
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE i INT DEFAULT 1;
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) THEN
    RETURN NULL;
  END IF;
  SET v_n = isian_rtf_pihak_jumlah(p_perkara, p_sisi);
  IF v_n = 0 THEN
    RETURN NULL;
  END IF;
  SELECT p.alur_perkara_id, p.jenis_perkara_id INTO v_alur, v_jenis FROM SIPP.perkara p WHERE p.perkara_id = p_perkara;
  IF v_n = 1 THEN
    IF v_jenis = 346 THEN
      RETURN IF(p_sisi = 1, 'Pemohon', 'Termohon');
    ELSEIF v_alur IN (15, 17) THEN
      RETURN IF(p_sisi = 1, 'Penggugat', 'Tergugat');
    ELSEIF v_alur = 16 THEN
      RETURN IF(p_sisi = 1, 'Pemohon', 'Termohon');
    END IF;
    RETURN NULL;
  END IF;
  IF v_alur IN (15, 17) THEN
    SET v_label = IF(p_sisi = 1, 'Penggugat', 'Tergugat');
  ELSEIF v_alur = 16 OR v_jenis = 346 THEN
    SET v_label = IF(p_sisi = 1, 'Pemohon', 'Termohon');
  ELSE
    RETURN '';
  END IF;
  IF v_n > 400 THEN
    SET v_n = 400;
  END IF;
  WHILE i <= v_n DO
    SET hasil = CONCAT(hasil, IF(i = 1, '', ', '), v_label, ' ', isian_rtf_romawi(i));
    SET i = i + 1;
  END WHILE;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_sebut$$
CREATE FUNCTION isian_rtf_pihak_sebut(p_perkara BIGINT, p_tabel INT)
  RETURNS VARCHAR(8000) CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'PU: sebutan Turut Tergugat/Termohon (p_tabel 4) atau pihak intervensi (3) untuk kaki putusan: "Turut Tergugat" (satu) atau "Turut Tergugat I dan Turut Tergugat II", "Turut Tergugat I, Turut Tergugat II dan Turut Tergugat III"; kosong bila tidak ada'
BEGIN
  DECLARE hasil VARCHAR(8000) CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_n INT DEFAULT 0;
  DECLARE v_rn INT DEFAULT 0;
  DECLARE v_s2 VARCHAR(20) CHARSET latin1 DEFAULT 'Tergugat';
  DECLARE v_urutan INT;
  DECLARE v_id BIGINT;
  DECLARE v_jenis VARCHAR(600) CHARSET latin1;
  DECLARE v_sebut VARCHAR(700) CHARSET latin1;
  DECLARE c CURSOR FOR
    SELECT t.urutan, t.id, NULL FROM SIPP.perkara_pihak4 t WHERE p_tabel = 4 AND t.perkara_id = p_perkara
    UNION ALL
    SELECT t.urutan, t.id, t.jenis_intervensi_nama FROM SIPP.perkara_pihak3 t WHERE p_tabel = 3 AND t.perkara_id = p_perkara
    ORDER BY 1, 2;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_tabel NOT IN (3, 4) THEN
    RETURN '';
  END IF;
  SET v_n = isian_rtf_pihak_jumlah(p_perkara, p_tabel);
  IF v_n = 0 THEN
    RETURN '';
  END IF;
  SELECT IF(p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341), 'Termohon', 'Tergugat') INTO v_s2 FROM SIPP.perkara p WHERE p.perkara_id = p_perkara;
  SET selesai = 0;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_id, v_jenis;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET v_rn = v_rn + 1;
    IF p_tabel = 4 THEN
      SET v_sebut = CONCAT('Turut ', IFNULL(v_s2, 'Tergugat'));
    ELSE
      SET v_sebut = IFNULL(NULLIF(TRIM(v_jenis), ''), 'Pihak Intervensi');
    END IF;
    SET hasil = CONCAT(hasil, IF(v_rn = 1, '', IF(v_rn = v_n, ' dan ', ', ')), v_sebut, IF(v_n > 1, CONCAT(' ', isian_rtf_romawi(v_rn)), ''));
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DELIMITER ;
