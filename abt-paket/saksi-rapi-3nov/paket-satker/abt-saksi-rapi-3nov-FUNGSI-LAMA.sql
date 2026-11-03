-- PULIH "abt-saksi-rapi-3nov": isian_rtf_ket_saksi kembali ke versi titik-koma-30okt, 2 fungsi paket dihapus.
DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_ket_saksi`(pid INT, sk VARCHAR(40)) RETURNS longtext CHARSET utf8mb4
    READS SQL DATA
    SQL SECURITY INVOKER
    COMMENT 'I3+X6+K30: keterangan saksi ABT seperti list_keterangan TANPA ganti baris di ujung, TANPA kalimat penutup, saya/ya kata utuh, T30 butir rapi'
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
DROP FUNCTION IF EXISTS `isian_rtf_tahu_lengkap`;
DROP FUNCTION IF EXISTS `isian_rtf_objek_tanya`;
