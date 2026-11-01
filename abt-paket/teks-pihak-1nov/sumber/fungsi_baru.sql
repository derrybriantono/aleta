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
DELIMITER ;
