-- Pulih fungsi paket abt-teks-pihak-1nov: fungsi baru dihapus, isian_rtf_penanda dikembalikan ke isi LAMA (sesudah 25 paket)
DROP FUNCTION IF EXISTS isian_rtf_kalimat_kecil;
DROP FUNCTION IF EXISTS isian_awal_kecil;
-- isian_rtf_penanda LAMA
DELIMITER $$
DROP FUNCTION IF EXISTS isian_rtf_penanda$$
CREATE FUNCTION `isian_rtf_penanda`(t LONGTEXT CHARSET latin1) RETURNS varchar(255) CHARSET latin1 COLLATE latin1_swedish_ci
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'I3: penanda butir di awal teks -> gaya,akhir,mulai (indeks 0) atau NULL'
BEGIN
  DECLARE bs CHAR(1) CHARSET latin1 DEFAULT CHAR(92 USING latin1);
  DECLARE n INT DEFAULT CHAR_LENGTH(t);
  DECLARE k INT DEFAULT 0;
  DECLARE j INT DEFAULT 0;
  DECLARE m INT DEFAULT 0;
  DECLARE tingkat INT DEFAULT 1;
  DECLARE kurung INT DEFAULT 0;
  DECLARE a INT;
  DECLARE gaya VARCHAR(8) CHARSET latin1 DEFAULT NULL;
  DECLARE akhir INT;
  IF t IS NULL OR n < 3 THEN RETURN NULL; END IF;
  IF BINARY SUBSTRING(t, 1, 1) = '(' THEN
    SET kurung = 1;
    SET k = 1;
  END IF;
  SET a = ASCII(SUBSTRING(t, k + 1, 1));
  IF a = 111 AND kurung = 0 AND BINARY SUBSTRING(t, k + 2, 1) = ' ' AND ASCII(SUBSTRING(t, k + 3, 1)) BETWEEN 65 AND 90 THEN
    SET gaya = 'o';
    SET j = k + 1;
  ELSEIF a BETWEEN 48 AND 57 THEN
    SET j = k;
    WHILE j < n AND j - k < 3 AND ASCII(SUBSTRING(t, j + 1, 1)) BETWEEN 48 AND 57 DO
      SET j = j + 1;
    END WHILE;
    SET tingkat = 1;
    WHILE kurung = 0 AND j + 1 < n AND BINARY SUBSTRING(t, j + 1, 1) = '.' AND ASCII(SUBSTRING(t, j + 2, 1)) BETWEEN 48 AND 57 DO
      SET m = j + 1;
      WHILE m < n AND m - j - 1 < 2 AND ASCII(SUBSTRING(t, m + 1, 1)) BETWEEN 48 AND 57 DO
        SET m = m + 1;
      END WHILE;
      SET tingkat = tingkat + 1;
      SET j = m;
    END WHILE;
    IF j >= n THEN RETURN NULL; END IF;
    IF kurung = 1 THEN
      IF NOT (BINARY SUBSTRING(t, j + 1, 1) = ')') THEN RETURN NULL; END IF;
      SET gaya = '(d)';
      SET j = j + 1;
    ELSEIF BINARY SUBSTRING(t, j + 1, 1) = '.' THEN
      SET gaya = CONCAT('n', tingkat);
      SET j = j + 1;
    ELSEIF BINARY SUBSTRING(t, j + 1, 1) = ')' AND tingkat = 1 THEN
      SET gaya = 'd)';
      SET j = j + 1;
    ELSEIF tingkat > 1 AND BINARY SUBSTRING(t, j + 1, 1) = ' ' THEN
      SET gaya = CONCAT('n', tingkat);
    ELSE
      RETURN NULL;
    END IF;
  ELSEIF a BETWEEN 97 AND 122 THEN
    SET j = k + 1;
    IF j >= n THEN RETURN NULL; END IF;
    IF kurung = 1 THEN
      IF NOT (BINARY SUBSTRING(t, j + 1, 1) = ')') THEN RETURN NULL; END IF;
      SET gaya = '(a)';
      SET j = j + 1;
    ELSEIF BINARY SUBSTRING(t, j + 1, 1) = '.' THEN
      SET gaya = 'a.';
      SET j = j + 1;
    ELSEIF BINARY SUBSTRING(t, j + 1, 1) = ')' THEN
      SET gaya = 'a)';
      SET j = j + 1;
    ELSE
      RETURN NULL;
    END IF;
  ELSEIF a BETWEEN 65 AND 90 AND kurung = 0 THEN
    SET j = k;
    WHILE j < n AND j - k < 4 AND BINARY SUBSTRING(t, j + 1, 1) IN ('I', 'V', 'X') DO
      SET j = j + 1;
    END WHILE;
    IF j > k AND j < n AND BINARY SUBSTRING(t, j + 1, 1) = '.'
       AND BINARY SUBSTRING(t, k + 1, j - k) IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII') THEN
      SET gaya = 'R.';
      SET j = j + 1;
    ELSE
      SET j = k + 1;
      IF j < n AND BINARY SUBSTRING(t, j + 1, 1) IN ('.', ')') THEN
        SET gaya = IF(BINARY SUBSTRING(t, j + 1, 1) = '.', 'U.', 'U)');
        SET j = j + 1;
        IF j >= n OR NOT (BINARY SUBSTRING(t, j + 1, 1) = ' ') THEN RETURN NULL; END IF;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
  ELSEIF (a = 45 OR a = 42) AND kurung = 0 THEN
    SET gaya = '-';
    SET j = k + 1;
    IF j >= n OR NOT (BINARY SUBSTRING(t, j + 1, 1) = ' ') THEN RETURN NULL; END IF;
  ELSEIF kurung = 0 AND (BINARY SUBSTRING(t, k + 1, 7) = CONCAT(bs, 'u8211?') OR BINARY SUBSTRING(t, k + 1, 7) = CONCAT(bs, 'u8226?')) THEN
    SET gaya = '-';
    SET j = k + 7;
    IF j >= n OR NOT (BINARY SUBSTRING(t, j + 1, 1) = ' ') THEN RETURN NULL; END IF;
  ELSE
    RETURN NULL;
  END IF;
  SET akhir = j;
  IF j < n AND BINARY SUBSTRING(t, j + 1, 1) = ' ' THEN
    WHILE j < n AND BINARY SUBSTRING(t, j + 1, 1) = ' ' DO
      SET j = j + 1;
    END WHILE;
  ELSEIF j < n AND ASCII(SUBSTRING(t, j + 1, 1)) BETWEEN 65 AND 90 AND BINARY LEFT(gaya, 1) = 'n' THEN
    SET j = j;
  ELSE
    RETURN NULL;
  END IF;
  IF j >= n THEN RETURN NULL; END IF;
  RETURN CONCAT(gaya, ',', akhir, ',', j);
END$$
DELIMITER ;
