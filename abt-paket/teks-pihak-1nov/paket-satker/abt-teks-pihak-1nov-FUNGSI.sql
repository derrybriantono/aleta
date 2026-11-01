-- Fungsi paket abt-teks-pihak-1nov (1 Nov 2026): teks para pihak disalin apa adanya; huruf awal diturunkan SAAT CETAK bila dirangkai di tengah kalimat.
DELIMITER $$
DROP FUNCTION IF EXISTS isian_awal_kecil$$
CREATE FUNCTION `isian_awal_kecil`(t LONGTEXT CHARSET latin1) RETURNS longtext CHARSET latin1 COLLATE latin1_swedish_ci
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT '1 Nov 2026: teks pihak yang dirangkai di tengah kalimat - HANYA huruf pertama (A-Z) diturunkan, sisanya apa adanya; tidak diturunkan bila kata pertama sebutan pihak (Penggugat, Tergugat, Pemohon, Termohon, Turut, Majelis, Hakim, Pengadilan, Kuasa), seluruhnya huruf besar (singkatan / ketikan huruf besar), atau satu huruf'
BEGIN
  DECLARE n INT DEFAULT CHAR_LENGTH(t);
  DECLARE i INT DEFAULT 1;
  DECLARE j INT;
  DECLARE k VARCHAR(40) CHARSET latin1;
  IF t IS NULL OR n = 0 THEN
    RETURN t;
  END IF;
  WHILE i <= n AND ASCII(SUBSTRING(t, i, 1)) IN (32, 9, 10, 13, 160) DO
    SET i = i + 1;
  END WHILE;
  IF i > n THEN
    RETURN t;
  END IF;
  IF NOT (ASCII(SUBSTRING(t, i, 1)) BETWEEN 65 AND 90) THEN
    RETURN t;
  END IF;
  SET j = i;
  WHILE j <= n AND (ASCII(SUBSTRING(t, j, 1)) BETWEEN 65 AND 90 OR ASCII(SUBSTRING(t, j, 1)) BETWEEN 97 AND 122) DO
    SET j = j + 1;
  END WHILE;
  SET k = SUBSTRING(t, i, LEAST(j - i, 40));
  IF CHAR_LENGTH(k) < 2 THEN
    RETURN t;
  END IF;
  IF BINARY k = BINARY UPPER(k) THEN
    RETURN t;
  END IF;
  IF BINARY k IN ('Penggugat', 'Tergugat', 'Pemohon', 'Termohon', 'Turut', 'Majelis', 'Hakim', 'Pengadilan', 'Kuasa') THEN
    RETURN t;
  END IF;
  RETURN CONCAT(LEFT(t, i - 1), LOWER(SUBSTRING(t, i, 1)), SUBSTRING(t, i + 1));
END$$

DROP FUNCTION IF EXISTS isian_rtf_kalimat_kecil$$
CREATE FUNCTION `isian_rtf_kalimat_kecil`(teks LONGTEXT CHARSET latin1, gantung INT) RETURNS longtext CHARSET latin1 COLLATE latin1_swedish_ci
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT '1 Nov 2026: seperti isian_rtf_kalimat, tetapi satu paragraf (frasa yang dirangkai di tengah kalimat) dicetak dengan huruf pertama diturunkan; beberapa paragraf (sebagai berikut: + butir) apa adanya'
BEGIN
  DECLARE r LONGTEXT CHARSET latin1;
  SET r = isian_rtf_kalimat(isian_awal_kecil(teks), gantung);
  IF BINARY LEFT(r, 16) = 'sebagai berikut:' THEN
    RETURN isian_rtf_kalimat(teks, gantung);
  END IF;
  RETURN r;
END$$
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
    IF kurung = 0 AND tingkat = 1 AND j < n AND BINARY SUBSTRING(t, j + 1, 1) = ' ' THEN
      SET m = j + 1;
      WHILE m < n AND m - j < 3 AND BINARY SUBSTRING(t, m + 1, 1) = ' ' DO
        SET m = m + 1;
      END WHILE;
      IF m < n AND BINARY SUBSTRING(t, m + 1, 1) IN ('.', ')') THEN
        SET j = m;
      END IF;
    END IF;
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
