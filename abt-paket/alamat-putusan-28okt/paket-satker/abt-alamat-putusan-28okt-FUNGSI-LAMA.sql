-- Definisi LAMA (persis paket pihak-urut-ecourt-27okt) dua fungsi yang diganti; dipakai pulih-satker.sh.
DELIMITER $$

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

DELIMITER ;
