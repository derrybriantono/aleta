-- Paket ABT "abt-titik-koma-30okt": PULIH - isian_rtf_ket_saksi (md5 db6d1b0f2c171f2505e3de6ffd10e4f0) dan isian_rtf_bukti (md5 8dc9c24e6f362576f34fed57544ff8f1) persis seperti sebelum paket;
-- fungsi baru isian_rtf_butir_rapi dihapus.
DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_ket_saksi`(pid INT, sk VARCHAR(40)) RETURNS longtext CHARSET utf8mb4
    READS SQL DATA
    SQL SECURITY INVOKER
    COMMENT 'I3+X6+K30: keterangan saksi ABT seperti list_keterangan TANPA ganti baris di ujung, TANPA kalimat penutup, saya/ya kata utuh'
BEGIN
  DECLARE habis INT DEFAULT 0;
  DECLARE j LONGTEXT CHARSET utf8mb4;
  DECLARE jq LONGTEXT CHARSET utf8mb4;
  DECLARE t LONGTEXT CHARSET latin1;
  DECLARE tq LONGTEXT CHARSET latin1;
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE cur CURSOR FOR
    SELECT jawaban, pertanyaan FROM aps_badilag.abt_keterangan_saksi WHERE perkara_id = pid AND saksi_id = sk ORDER BY id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET habis = 1;
  IF sk IS NOT NULL THEN
    OPEN cur;
    baca: LOOP
      FETCH cur INTO j, jq;
      IF habis = 1 THEN
        LEAVE baca;
      END IF;
      IF j IS NOT NULL AND CHAR_LENGTH(j) > 0 AND NOT (BINARY j = '0') THEN
        SET t = CONVERT(CAST(j AS BINARY) USING latin1);
        SET tq = IFNULL(CONVERT(CAST(jq AS BINARY) USING latin1), '');
        
        SET t = isian_rtf_saring_penutup(t, tq);
      ELSE
        SET t = '';
      END IF;
      IF CHAR_LENGTH(t) > 0 THEN
        SET t = REPLACE(REPLACE(REPLACE(t, CONCAT(CHAR(13 USING latin1), CHAR(10 USING latin1)), ' '), CHAR(10 USING latin1), ' '), CHAR(13 USING latin1), ' ');
        IF ASCII(t) BETWEEN 65 AND 90 THEN
          SET t = CONCAT(LOWER(LEFT(t, 1)), SUBSTRING(t, 2));
        END IF;
        IF LOWER(LEFT(t, 5)) = 'iya, ' THEN
          SET t = SUBSTRING(t, 6);
        END IF;
        SET t = isian_rtf_ganti_kata(t, 'saya', 'saksi');
        SET t = isian_rtf_ganti_kata(t, 'ya, ', '');
        SET t = isian_rtf_iganti(t, 'penggugat', 'Penggugat');
        SET t = isian_rtf_iganti(t, 'pemohon', 'Pemohon');
        SET t = isian_rtf_iganti(t, 'tergugat', 'Tergugat');
        SET t = isian_rtf_iganti(t, 'termohon', 'Termohon');
        SET o = CONCAT(o, IF(CHAR_LENGTH(o) > 0, '<br>', ''), '-   Bahwa ', t);
      END IF;
    END LOOP;
    CLOSE cur;
  END IF;
  IF CHAR_LENGTH(o) = 0 THEN
    SET o = '...';
  END IF;
  RETURN CONVERT(CAST(o AS BINARY) USING utf8mb4);
END;;
DELIMITER ;
DROP FUNCTION IF EXISTS `isian_rtf_bukti`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_bukti`(t TEXT CHARSET latin1) RETURNS text CHARSET latin1
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'B30: daftar bukti surat -> butir bernomor 1. 2. ... (nomor ketikan dibuang, baris lanjutan digabung)'
BEGIN
  DECLARE s TEXT CHARSET latin1;
  DECLARE o TEXT CHARSET latin1 DEFAULT '';
  DECLARE ln TEXT CHARSET latin1;
  DECLARE butir TEXT CHARSET latin1 DEFAULT '';
  DECLARE pos INT DEFAULT 1;
  DECLARE nx INT;
  DECLARE n INT DEFAULT 0;
  DECLARE bernomor INT DEFAULT 0;
  DECLARE k INT;
  DECLARE m INT;
  DECLARE c VARCHAR(1) CHARSET latin1;
  DECLARE awal INT;
  DECLARE j2 INT;
  IF t IS NULL OR TRIM(t) = '' THEN
    RETURN '1.\\tab ...';
  END IF;
  SET s = REPLACE(REPLACE(t, CONCAT(CHAR(13 USING latin1), CHAR(10 USING latin1)), CHAR(10 USING latin1)), CHAR(13 USING latin1), CHAR(10 USING latin1));
  SET s = CONCAT(s, CHAR(10 USING latin1));
  -- ada baris yang diawali nomor ketikan?
  SET bernomor = IF(CONCAT(CHAR(10 USING latin1), s) REGEXP CONCAT(CHAR(10 USING latin1), '[ \t]*[(]?[0-9]{1,2}[ \t]*[.)]([ \t]|[A-Za-z])'), 1, 0);
  lp: LOOP
    SET nx = LOCATE(CHAR(10 USING latin1), s, pos);
    IF nx = 0 THEN
      LEAVE lp;
    END IF;
    SET ln = TRIM(BOTH ' ' FROM TRIM(BOTH CHAR(160 USING latin1) FROM TRIM(BOTH CHAR(9 USING latin1) FROM TRIM(BOTH ' ' FROM SUBSTRING(s, pos, nx - pos)))));
    SET pos = nx + 1;
    IF ln <> '' THEN
      -- nomor ketikan di awal baris dibuang (berulang: "1. 1. ...", "1.<tab>1.<tab>..."); m = 1 bila ada yang dibuang
      SET m = 0;
      SET j2 = 0;
      WHILE j2 < 3 DO
        SET k = isian_rtf_bukti_nomor(ln, bernomor);
        IF k = 0 THEN
          SET j2 = 3;
        ELSE
          SET ln = TRIM(BOTH ' ' FROM TRIM(BOTH CHAR(160 USING latin1) FROM TRIM(BOTH CHAR(9 USING latin1) FROM SUBSTRING(ln, k + 1))));
          SET m = 1;
          SET j2 = j2 + 1;
        END IF;
      END WHILE;
      -- baris lanjutan (digabung ke butir sebelumnya) HANYA bila daftar bernomor ketik dan baris diawali huruf kecil atau
      -- tanda baca penyambung; baris lain tanpa nomor (mis. "Fotokopi ...", "Print out ...") = butir baru seperti dulu
      SET c = SUBSTRING(ln, 1, 1);
      IF m > 0 OR bernomor = 0 OR butir = '' OR NOT (BINARY c BETWEEN 'a' AND 'z' OR c IN (';', ',', '.', ':')) THEN
        IF butir <> '' THEN
          SET n = n + 1;
          SET o = CONCAT(o, IF(n > 1, '<br>', ''), n, '.\\tab ', butir);
        END IF;
        SET butir = ln;
      ELSE
        SET butir = CONCAT(butir, ' ', ln);
      END IF;
    END IF;
  END LOOP;
  IF butir <> '' THEN
    SET n = n + 1;
    SET o = CONCAT(o, IF(n > 1, '<br>', ''), n, '.\\tab ', butir);
  END IF;
  RETURN IF(n = 0, '1.\\tab ...', o);
END;;
DELIMITER ;
DROP FUNCTION IF EXISTS `isian_rtf_butir_rapi`;
