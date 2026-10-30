-- Paket ABT "abt-ket-saksi-baris-30okt" (30 Okt 2026): fungsi + dua pemicu (trigger) pada abt_keterangan_saksi.
-- isian_rtf_satu_baris: tiap rangkaian ganti baris (CR/LF) beserta spasi di sekitarnya -> SATU spasi; di awal/ujung teks dibuang.
-- Pemicu BEFORE INSERT / BEFORE UPDATE menerapkannya pada pertanyaan dan jawaban yang disimpan penyunting tanya-jawab ABT,
-- sehingga sel tabel BAS (PHP kolom_kode_A4 mencetak teks apa adanya; ganti baris diabaikan RTF) tidak lagi menggabung dua kata.
DROP FUNCTION IF EXISTS `isian_rtf_satu_baris`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_satu_baris`(t TEXT CHARSET latin1) RETURNS text CHARSET latin1
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'B30: ganti baris di teks tanya-jawab saksi -> satu spasi (awal/ujung dibuang)'
BEGIN
  DECLARE o TEXT CHARSET latin1 DEFAULT '';
  DECLARE i INT DEFAULT 1;
  DECLARE n INT;
  DECLARE c VARCHAR(1) CHARSET latin1;
  DECLARE j INT;
  DECLARE k INT;
  IF t IS NULL THEN
    RETURN NULL;
  END IF;
  IF LOCATE(CHAR(10 USING latin1), t) = 0 AND LOCATE(CHAR(13 USING latin1), t) = 0 THEN
    RETURN t;
  END IF;
  SET n = CHAR_LENGTH(t);
  WHILE i <= n DO
    SET c = SUBSTRING(t, i, 1);
    IF c = CHAR(10 USING latin1) OR c = CHAR(13 USING latin1) THEN
      -- mundur: buang spasi/tab yang sudah tertulis sebelum ganti baris
      SET o = TRIM(TRAILING ' ' FROM TRIM(TRAILING CHAR(9 USING latin1) FROM o));
      -- maju: lewati seluruh rangkaian ganti baris, spasi, tab
      SET j = i;
      WHILE j <= n AND SUBSTRING(t, j, 1) IN (CHAR(10 USING latin1), CHAR(13 USING latin1), ' ', CHAR(9 USING latin1)) DO
        SET j = j + 1;
      END WHILE;
      IF CHAR_LENGTH(o) > 0 AND j <= n THEN
        SET o = CONCAT(o, ' ');
      END IF;
      SET i = j;
    ELSE
      SET k = i;
      WHILE k <= n AND SUBSTRING(t, k, 1) NOT IN (CHAR(10 USING latin1), CHAR(13 USING latin1)) DO
        SET k = k + 1;
      END WHILE;
      SET o = CONCAT(o, SUBSTRING(t, i, k - i));
      SET i = k;
    END IF;
  END WHILE;
  RETURN o;
END;;
DELIMITER ;
DROP TRIGGER IF EXISTS `abt_keterangan_saksi_satu_baris_bi`;
DROP TRIGGER IF EXISTS `abt_keterangan_saksi_satu_baris_bu`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER TRIGGER `abt_keterangan_saksi_satu_baris_bi` BEFORE INSERT ON `abt_keterangan_saksi` FOR EACH ROW
BEGIN
  SET NEW.pertanyaan = isian_rtf_satu_baris(NEW.pertanyaan);
  SET NEW.jawaban = isian_rtf_satu_baris(NEW.jawaban);
END;;
CREATE DEFINER=CURRENT_USER TRIGGER `abt_keterangan_saksi_satu_baris_bu` BEFORE UPDATE ON `abt_keterangan_saksi` FOR EACH ROW
BEGIN
  SET NEW.pertanyaan = isian_rtf_satu_baris(NEW.pertanyaan);
  SET NEW.jawaban = isian_rtf_satu_baris(NEW.jawaban);
END;;
DELIMITER ;
