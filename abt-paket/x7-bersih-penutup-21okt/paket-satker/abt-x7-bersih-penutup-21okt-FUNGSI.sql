-- =====================================================================================================
-- X7 (21 Okt 2026): jawaban lisan (jawaban/replik/duplik, abt_keterangan_terdakwa) juga tidak mencetak kalimat penutup pemeriksaan
-- ("Sudah cukup;" atas "Apakah masih ada yang ingin Saudara sampaikan?"): isian_rtf_keterangan (variabel 9252-9254) kini melewati baris yang
-- jawabannya SELURUHNYA penutup menurut isian_rtf_penutup (paket x6, pola bot, kolom pertanyaan ikut menentukan). Selebihnya sama persis dengan
-- versi I3. Hanya MEMBACA abt_keterangan_terdakwa. Nama fungsi netral.
-- =====================================================================================================
DELIMITER $$
DROP FUNCTION IF EXISTS isian_rtf_keterangan$$
CREATE FUNCTION isian_rtf_keterangan(pid INT, pk VARCHAR(40), sebutan VARCHAR(100)) RETURNS LONGTEXT CHARSET utf8mb4
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'I3+X7: jawab-menjawab lisan ABT (abt_keterangan_terdakwa) -> baris "- Bahwa ..." (pengganti list_keterangan), tanpa kalimat penutup (sudah cukup dst.)'
BEGIN
  DECLARE habis INT DEFAULT 0;
  DECLARE j LONGTEXT CHARSET utf8mb4;
  DECLARE jq LONGTEXT CHARSET utf8mb4;
  DECLARE t LONGTEXT CHARSET latin1;
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE seb VARCHAR(255) CHARSET latin1;
  DECLARE g LONGTEXT CHARSET latin1;
  DECLARE baris LONGTEXT CHARSET latin1;
  DECLARE pertama INT;
  DECLARE p INT;
  DECLARE i INT;
  DECLARE cur CURSOR FOR
    SELECT jawaban, pertanyaan FROM aps_badilag.abt_keterangan_terdakwa WHERE perkara_id = pid AND pihak_id = pk ORDER BY id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET habis = 1;
  SET seb = CONVERT(CAST(CONVERT(IFNULL(sebutan, '') USING utf8mb4) AS BINARY) USING latin1);
  IF pk IS NOT NULL THEN
    OPEN cur;
    baca: LOOP
      FETCH cur INTO j, jq;
      IF habis = 1 THEN
        LEAVE baca;
      END IF;
      IF j IS NOT NULL AND CHAR_LENGTH(j) > 0 AND NOT (BINARY j = '0')
        AND isian_rtf_penutup(CONVERT(CAST(j AS BINARY) USING latin1), IFNULL(CONVERT(CAST(jq AS BINARY) USING latin1), '')) = 0 THEN
        SET t = CONVERT(CAST(j AS BINARY) USING latin1);
        
        SET t = REPLACE(REPLACE(t, CHAR(13 USING latin1), ''), CHAR(9 USING latin1), ' ');
        SET g = '';
        SET pertama = 1;
        SET p = 1;
        gb: LOOP
          SET i = LOCATE(CHAR(10 USING latin1), t, p);
          SET baris = IF(i = 0, SUBSTRING(t, p), SUBSTRING(t, p, i - p));
          IF pertama = 1 THEN
            SET g = baris;
            SET pertama = 0;
          ELSEIF isian_rtf_penanda(TRIM(LEADING ' ' FROM baris)) IS NOT NULL THEN
            SET g = CONCAT(g, CHAR(10 USING latin1), baris);
          ELSE
            SET g = CONCAT(TRIM(TRAILING ' ' FROM g), ' ', TRIM(LEADING ' ' FROM baris));
          END IF;
          IF i = 0 THEN
            LEAVE gb;
          END IF;
          SET p = i + 1;
        END LOOP;
        SET t = g;
        IF ASCII(t) BETWEEN 65 AND 90 THEN
          SET t = CONCAT(LOWER(LEFT(t, 1)), SUBSTRING(t, 2));
        END IF;
        IF BINARY LOWER(LEFT(t, 4)) = 'ya, ' THEN
          SET t = SUBSTRING(t, 5);
        END IF;
        SET t = isian_rtf_kata(t, 'saya', seb);
        SET t = isian_rtf_kata(t, 'penggugat', 'Penggugat');
        SET t = isian_rtf_kata(t, 'pemohon', 'Pemohon');
        SET t = isian_rtf_kata(t, 'tergugat', 'Tergugat');
        SET t = isian_rtf_kata(t, 'termohon', 'Termohon');
        SET o = CONCAT(o, IF(CHAR_LENGTH(o) > 0, CHAR(10 USING latin1), ''), '- Bahwa ', t);
      END IF;
    END LOOP;
    CLOSE cur;
  END IF;
  IF CHAR_LENGTH(o) = 0 THEN
    SET o = '- ...';
  END IF;
  RETURN CONVERT(CAST(o AS BINARY) USING utf8mb4);
END$$
DELIMITER ;
