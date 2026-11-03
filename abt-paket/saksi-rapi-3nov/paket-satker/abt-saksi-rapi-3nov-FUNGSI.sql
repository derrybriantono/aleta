-- Paket ABT "abt-saksi-rapi-3nov" (3 Nov 2026): 2 fungsi baru (isian_rtf_objek_tanya, isian_rtf_tahu_lengkap) + isian_rtf_ket_saksi diganti (nama dan tanda tangan sama,
-- satu baris ditambah). Dijalankan pasang-satker.sh SESUDAH PRASYARAT.
DROP FUNCTION IF EXISTS `isian_rtf_objek_tanya`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_objek_tanya`(q LONGTEXT CHARSET latin1, kel VARCHAR(10) CHARSET latin1) RETURNS longtext CHARSET latin1
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'S3N: objek pertanyaan saksi untuk melengkapi jawaban tidak tahu (NULL = tidak dapat ditentukan)'
BEGIN
  DECLARE qq LONGTEXT CHARSET latin1;
  DECLARE ql LONGTEXT CHARSET latin1;
  DECLARE sisa LONGTEXT CHARSET latin1;
  DECLARE w1 VARCHAR(40) CHARSET latin1;
  DECLARE kw VARCHAR(20) CHARSET latin1;
  DECLARE p INT;
  DECLARE k INT DEFAULT 1;
  IF q IS NULL THEN
    RETURN NULL;
  END IF;
  SET qq = TRIM(REPLACE(REPLACE(REPLACE(q, CHAR(13 USING latin1), ' '), CHAR(10 USING latin1), ' '), CHAR(9 USING latin1), ' '));
  WHILE LOCATE('  ', qq) > 0 DO
    SET qq = REPLACE(qq, '  ', ' ');
  END WHILE;
  WHILE CHAR_LENGTH(qq) > 0 AND RIGHT(qq, 1) IN (' ', '?', ';', ':', '.', '!', ',') DO
    SET qq = LEFT(qq, CHAR_LENGTH(qq) - 1);
  END WHILE;
  -- buang keterangan "yang saudara ketahui" / "menurut saksi" di ujung pertanyaan
  WHILE k <= 3 DO
    SET kw = ELT(k, ' yang ', ' sepengetahuan ', ' menurut ');
    SET ql = LOWER(qq);
    SET p = LOCATE(REVERSE(kw), REVERSE(ql));
    IF p > 0 THEN
      SET p = CHAR_LENGTH(ql) - p - CHAR_LENGTH(kw) + 2;
      IF SUBSTRING(ql, p) REGEXP '^ (yang|sepengetahuan|menurut) (saudara|sdr|saksi|anda)( (ketahui|kertahui|tahu|lihat))?$' THEN
        SET qq = TRIM(LEFT(qq, p - 1));
        WHILE CHAR_LENGTH(qq) > 0 AND RIGHT(qq, 1) IN (' ', ',') DO
          SET qq = LEFT(qq, CHAR_LENGTH(qq) - 1);
        END WHILE;
      END IF;
    END IF;
    SET k = k + 1;
  END WHILE;
  SET ql = LOWER(qq);
  IF ql = '' OR ql REGEXP '(,|[[:<:]]dan|[[:<:]]atau) +(berapa|siapa|kapan|bagaimana|mengapa|kenapa|di ?mana|apa|apakah)[[:>:]]' THEN
    RETURN NULL;
  END IF;
  IF ql REGEXP '^apakah (saudara|sdr[.]?|saksi|anda) (pernah )?(tahu|tau|mengetahui|melihat|mendengar|kenal|mengenal) ' THEN
    SET sisa = SUBSTRING(qq, 8);
    SET sisa = SUBSTRING(sisa, LOCATE(' ', sisa) + 1);
    IF LOWER(sisa) LIKE 'pernah %' THEN
      SET sisa = SUBSTRING(sisa, 8);
    END IF;
    SET w1 = LOWER(SUBSTRING_INDEX(sisa, ' ', 1));
    SET sisa = SUBSTRING(sisa, CHAR_LENGTH(w1) + 2);
    IF (CASE w1 WHEN 'melihat' THEN 'lihat' WHEN 'mendengar' THEN 'dengar' ELSE 'tahu' END) <> kel THEN
      RETURN NULL;
    END IF;
    -- "melihat dan mendengar X" -> "melihat X"
    IF LOWER(sisa) REGEXP '^(dan|atau) (juga )?(pernah )?(melihat|mendengar|mengetahui|tahu) ' THEN
      WHILE LOWER(SUBSTRING_INDEX(sisa, ' ', 1)) IN ('dan', 'atau', 'juga', 'pernah') DO
        SET sisa = SUBSTRING(sisa, LOCATE(' ', sisa) + 1);
      END WHILE;
      SET sisa = SUBSTRING(sisa, LOCATE(' ', sisa) + 1);
    END IF;
    IF LOWER(sisa) REGEXP '^(tentang|mengenai|soal) ' THEN
      SET sisa = CONCAT('tentang ', SUBSTRING(sisa, LOCATE(' ', sisa) + 1));
    ELSEIF LOWER(sisa) REGEXP '^(bahwa|kalau|jika) ' THEN
      SET sisa = CONCAT('apakah ', SUBSTRING(sisa, LOCATE(' ', sisa) + 1));
    END IF;
  ELSEIF ql LIKE 'apakah %' THEN
    SET sisa = SUBSTRING(qq, 8);
    IF kel <> 'tahu' OR LOWER(sisa) REGEXP '^(saudara|sdr|saksi|anda)[[:>:]]' THEN
      RETURN NULL;
    END IF;
    SET sisa = CONCAT('apakah ', sisa);
  ELSEIF ql REGEXP '^(pernah|sudah|masih|ada)kah ' THEN
    IF kel <> 'tahu' THEN
      RETURN NULL;
    END IF;
    SET w1 = SUBSTRING_INDEX(ql, ' ', 1);
    SET sisa = CONCAT('apakah ', LEFT(w1, CHAR_LENGTH(w1) - 3), ' ', SUBSTRING(qq, CHAR_LENGTH(w1) + 2));
  ELSEIF ql REGEXP '^(sejak kapan|apa yang|di mana|ke mana|berapa|siapa|kapan|bagaimana|mengapa|kenapa|dimana|kemana|bilamana) ' THEN
    IF kel <> 'tahu' THEN
      RETURN NULL;
    END IF;
    SET kw = IF(ql REGEXP '^(sejak kapan|apa yang|di mana|ke mana) ', SUBSTRING_INDEX(ql, ' ', 2), SUBSTRING_INDEX(ql, ' ', 1));
    SET sisa = SUBSTRING(qq, CHAR_LENGTH(kw) + 2);
    IF LOWER(sisa) REGEXP '^(saudara|sdr|saksi|anda)[[:>:]]' THEN
      RETURN NULL;
    END IF;
    SET sisa = CONCAT(CASE kw WHEN 'dimana' THEN 'di mana' WHEN 'kemana' THEN 'ke mana' WHEN 'kenapa' THEN 'mengapa' ELSE kw END, ' ', sisa);
  ELSEIF ql REGEXP '^(berapa|siapa|kapan|bagaimana|mengapa|dimana)kah ' THEN
    IF kel <> 'tahu' THEN
      RETURN NULL;
    END IF;
    SET w1 = SUBSTRING_INDEX(ql, ' ', 1);
    SET sisa = CONCAT(LEFT(w1, CHAR_LENGTH(w1) - 3), ' ', SUBSTRING(qq, CHAR_LENGTH(w1) + 2));
  ELSE
    RETURN NULL;
  END IF;
  SET sisa = isian_rtf_ganti_kata(isian_rtf_ganti_kata(sisa, 'saudara', 'saksi'), 'anda', 'saksi');
  RETURN TRIM(sisa);
END;;
DELIMITER ;
DROP FUNCTION IF EXISTS `isian_rtf_tahu_lengkap`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_tahu_lengkap`(t LONGTEXT CHARSET latin1, q LONGTEXT CHARSET latin1) RETURNS longtext CHARSET latin1
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'S3N: jawaban saksi yang hanya "tidak tahu/tidak mengetahuinya/tidak pernah melihatnya" dilengkapi objek dari pertanyaannya'
BEGIN
  DECLARE a LONGTEXT CHARSET latin1;
  DECLARE la LONGTEXT CHARSET latin1;
  DECLARE awal LONGTEXT CHARSET latin1;
  DECLARE kata VARCHAR(40) CHARSET latin1;
  DECLARE kel VARCHAR(10) CHARSET latin1;
  DECLARE obj LONGTEXT CHARSET latin1;
  DECLARE ekor LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE i INT DEFAULT 1;
  DECLARE p INT;
  DECLARE pk INT DEFAULT 0;
  IF t IS NULL OR q IS NULL OR CHAR_LENGTH(t) > 400 THEN
    RETURN t;
  END IF;
  SET a = TRIM(REPLACE(REPLACE(REPLACE(t, CHAR(13 USING latin1), ' '), CHAR(10 USING latin1), ' '), CHAR(9 USING latin1), ' '));
  WHILE LOCATE('  ', a) > 0 DO
    SET a = REPLACE(a, '  ', ' ');
  END WHILE;
  WHILE CHAR_LENGTH(a) > 0 AND RIGHT(a, 1) IN (' ', ';', '.', ',') DO
    SET a = LEFT(a, CHAR_LENGTH(a) - 1);
  END WHILE;
  -- "saya tidak tahu karena ..." / "saya tidak pernah melihatnya, tetapi ...": kepala dilengkapi, ekor (kata sambung dst.) tetap
  SET la = LOWER(a);
  WHILE i <= 15 DO
    SET p = LOCATE(ELT(i, ', karena ', ' karena ', ', tetapi ', ' tetapi ', ', tapi ', ' tapi ', ', namun ', ' namun ', ', akan tetapi ', ' akan tetapi ',
                       ', saya hanya ', ', yang saya ', ', dan saya ', ', sebab ', ' sebab '), la);
    IF p > 0 AND (pk = 0 OR p < pk) THEN
      SET pk = p;
    END IF;
    SET i = i + 1;
  END WHILE;
  IF pk > 0 THEN
    SET ekor = SUBSTRING(a, pk);
    SET a = LEFT(a, pk - 1);
  END IF;
  SET la = LOWER(a);
  IF NOT (la REGEXP '^((tidak|ya|iya) ?, ?)?((saya|saksi) )?((juga|memang|sama sekali) )?(tidak|tdk|kurang|belum) (pernah )?(tahu|tau|mengetahui|mengetahuinya|melihat|melihatnya|mendengar|mendengarnya|kenal|mengenal|mengenalnya)$') THEN
    RETURN t;
  END IF;
  SET kata = SUBSTRING_INDEX(la, ' ', -1);
  SET kel = CASE WHEN kata IN ('melihat', 'melihatnya') THEN 'lihat' WHEN kata IN ('mendengar', 'mendengarnya') THEN 'dengar' ELSE 'tahu' END;
  SET obj = isian_rtf_objek_tanya(q, kel);
  IF obj IS NULL OR obj = '' THEN
    RETURN t;
  END IF;
  SET awal = LEFT(a, CHAR_LENGTH(a) - CHAR_LENGTH(kata));
  IF la REGEXP '^(tidak|ya|iya) ?,' THEN
    SET awal = CONCAT(TRIM(SUBSTRING(awal, LOCATE(',', awal) + 1)), ' ');
  END IF;
  IF NOT (LOWER(awal) REGEXP '^(saya|saksi) ') THEN
    SET awal = CONCAT('saya ', LOWER(awal));
  END IF;
  IF RIGHT(kata, 3) = 'nya' THEN
    SET kata = LEFT(kata, CHAR_LENGTH(kata) - 3);
  END IF;
  RETURN CONCAT(awal, kata, ' ', obj, ekor);
END;;
DELIMITER ;
DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_ket_saksi`(pid INT, sk VARCHAR(40)) RETURNS longtext CHARSET utf8mb4
    READS SQL DATA
    SQL SECURITY INVOKER
    COMMENT 'I3+X6+K30: keterangan saksi ABT seperti list_keterangan TANPA ganti baris di ujung, TANPA kalimat penutup, saya/ya kata utuh, T30 butir rapi, S3N tidak tahu dilengkapi'
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
        SET t = isian_rtf_tahu_lengkap(t, tq);
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
        SET t = isian_rtf_butir_rapi(t, ';');
        IF CHAR_LENGTH(t) > 0 THEN
          SET o = CONCAT(o, IF(CHAR_LENGTH(o) > 0, '<br>', ''), '-   Bahwa ', t);
        END IF;
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
