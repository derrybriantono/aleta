-- Paket ABT "abt-bukti-nomor-30okt" (30 Okt 2026): dua fungsi baru (isian_rtf_bukti_nomor, isian_rtf_bukti).
-- isian_rtf_bukti(teks): isian daftar bukti surat -> butir bernomor "1.<tab>...", "2.<tab>..." dipisah <br> (ABT: paragraf baru).
--   * nomor yang DIKETIK petugas di awal baris ("1.", "1)", "(1)", "1 .") dibuang - penomoran hanya dari fungsi ini;
--   * bila teks memuat baris bernomor, baris TANPA nomor sesudahnya = lanjutan butir sebelumnya (digabung satu spasi);
--     bila tidak ada baris bernomor sama sekali, tiap baris = satu butir;
--   * baris kosong dilewati; teks kosong -> '1.<tab>...' (sama dengan isian kosong ABT di butir bernomor).
DROP FUNCTION IF EXISTS `isian_rtf_bukti_nomor`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_bukti_nomor`(ln TEXT CHARSET latin1, bernomor INT) RETURNS int(11)
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'B30: panjang nomor butir ketikan di awal baris (0 bila tidak ada)'
BEGIN
  -- Dikenali: [(]angka(1-2)[spasi][.)] lalu spasi/tab/huruf  -> "1.", "1)", "(1)", "1 .", "1.Fotokopi"
  --           angka(1-2)(.angka(1-2))+[.)] lalu spasi/tab     -> "1.1."
  --           angka(1-2) spasi+ HURUF BESAR (hanya bila daftar bernomor) -> "6 Fotokopi"
  -- BUKAN nomor: "1.5 juta", "12.000 rupiah", "2 (dua) orang".
  DECLARE k INT DEFAULT 1;
  DECLARE n INT;
  DECLARE awal INT;
  DECLARE kurung INT DEFAULT 0;
  DECLARE c VARCHAR(1) CHARSET latin1;
  DECLARE sp INT;
  SET n = CHAR_LENGTH(ln);
  IF SUBSTRING(ln, 1, 1) = '(' THEN
    SET kurung = 1;
    SET k = 2;
  END IF;
  SET awal = k;
  WHILE k <= n AND k - awal < 2 AND SUBSTRING(ln, k, 1) BETWEEN '0' AND '9' DO
    SET k = k + 1;
  END WHILE;
  IF k = awal THEN
    RETURN 0;
  END IF;
  -- "1.1." : (titik angka)+
  WHILE kurung = 0 AND k + 1 <= n AND SUBSTRING(ln, k, 1) = '.' AND SUBSTRING(ln, k + 1, 1) BETWEEN '0' AND '9' DO
    SET k = k + 2;
    WHILE k <= n AND SUBSTRING(ln, k, 1) BETWEEN '0' AND '9' DO
      SET k = k + 1;
    END WHILE;
  END WHILE;
  SET sp = k;
  WHILE k <= n AND SUBSTRING(ln, k, 1) IN (' ', CHAR(9 USING latin1), CHAR(160 USING latin1)) DO
    SET k = k + 1;
  END WHILE;
  SET c = SUBSTRING(ln, k, 1);
  IF c = '.' OR c = ')' THEN
    SET k = k + 1;
    -- sesudah tanda: harus spasi/tab atau huruf (bukan angka: "1.5", "12.000")
    IF k <= n AND SUBSTRING(ln, k, 1) BETWEEN '0' AND '9' THEN
      RETURN 0;
    END IF;
    IF k > n THEN
      RETURN k - 1;
    END IF;
    IF SUBSTRING(ln, k, 1) IN (' ', CHAR(9 USING latin1), CHAR(160 USING latin1)) OR BINARY UPPER(SUBSTRING(ln, k, 1)) BETWEEN 'A' AND 'Z' THEN
      RETURN k - 1;
    END IF;
    RETURN 0;
  END IF;
  -- tanpa tanda: hanya "6 Fotokopi" dalam daftar bernomor, satu angka tanpa titik-angka di depan
  IF bernomor = 1 AND kurung = 0 AND k > sp AND sp - awal <= 2 AND BINARY c BETWEEN 'A' AND 'Z' THEN
    RETURN k - 1;
  END IF;
  RETURN 0;
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
