-- Paket ABT "abt-titik-koma-30okt": 1 fungsi baru (isian_rtf_butir_rapi) + 2 diganti (isian_rtf_ket_saksi, isian_rtf_bukti; nama dan tanda tangan sama).
-- Dijalankan pasang-satker.sh SESUDAH PRASYARAT.
DROP FUNCTION IF EXISTS `isian_rtf_butir_rapi`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_butir_rapi`(t LONGTEXT CHARSET latin1, ujung VARCHAR(1) CHARSET latin1) RETURNS longtext CHARSET latin1
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'T30: satu butir rapi - ganti baris jadi spasi, spasi/tanda baca ganda, titik koma di tengah jadi koma, ujung ; bila diminta'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE i INT DEFAULT 1;
  DECLARE n INT;
  DECLARE ta INT;
  DECLARE c VARCHAR(1) CHARSET latin1;
  DECLARE nx VARCHAR(1) CHARSET latin1;
  DECLARE ak VARCHAR(1) CHARSET latin1;
  DECLARE pa INT;
  IF t IS NULL THEN
    RETURN NULL;
  END IF;
  -- ganti baris, tab, spasi tak putus, <br> -> spasi
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(t, '<br />', ' '), '<br/>', ' '), '<br>', ' '), '<BR />', ' '), '<BR>', ' ');
  SET s = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(s, CHAR(13 USING latin1), ' '), CHAR(10 USING latin1), ' '), CHAR(9 USING latin1), ' '), CHAR(160 USING latin1), ' '), '&nbsp;', ' ');
  SET n = CHAR_LENGTH(s);
  -- ta = letak huruf/angka terakhir: titik koma SEBELUM letak itu ada di tengah butir
  SET ta = n;
  cari: WHILE ta > 0 DO
    SET c = SUBSTRING(s, ta, 1);
    IF ASCII(c) BETWEEN 48 AND 57 OR ASCII(c) BETWEEN 65 AND 90 OR ASCII(c) BETWEEN 97 AND 122 OR ASCII(c) >= 192 THEN
      LEAVE cari;
    END IF;
    SET ta = ta - 1;
  END WHILE cari;
  WHILE i <= n DO
    SET c = SUBSTRING(s, i, 1);
    SET nx = IF(i < n, SUBSTRING(s, i + 1, 1), '');
    SET ak = RIGHT(o, 1);
    SET pa = ASCII(c) BETWEEN 48 AND 57 OR ASCII(c) BETWEEN 65 AND 90 OR ASCII(c) BETWEEN 97 AND 122 OR ASCII(c) >= 192;
    IF c = ' ' THEN
      IF o <> '' AND ak <> ' ' THEN
        SET o = CONCAT(o, ' ');
      END IF;
    ELSEIF c = ';' AND o REGEXP '&[A-Za-z#0-9]{2,8}$' THEN
      -- entitas HTML (&quot; dst.) bukan titik koma
      SET o = CONCAT(o, ';');
    ELSEIF c IN (';', ',', ':') THEN
      IF c = ';' AND i < ta THEN
        SET c = ',';
      END IF;
      IF ak = ' ' THEN
        SET o = LEFT(o, CHAR_LENGTH(o) - 1);
        SET ak = RIGHT(o, 1);
      END IF;
      IF o = '' THEN
        -- tanda baca di awal butir dibuang
        SET o = '';
      ELSEIF ak IN (';', ',') AND c IN (';', ',') THEN
        SET o = CONCAT(LEFT(o, CHAR_LENGTH(o) - 1), IF(ak = ';' OR c = ';', ';', ','));
      ELSEIF ak IN (';', ',') AND c = ':' THEN
        SET o = CONCAT(LEFT(o, CHAR_LENGTH(o) - 1), ':');
      ELSEIF ak = ':' THEN
        SET o = o;
      ELSEIF ak = '.' AND c <> ':' AND BINARY RIGHT(o, 5) REGEXP '^[a-z]{4}[.]$' THEN
        -- "polisi.," -> "polisi,"; singkatan (S.H., dll.) tetap
        SET o = CONCAT(LEFT(o, CHAR_LENGTH(o) - 1), c);
      ELSE
        SET o = CONCAT(o, c);
      END IF;
    ELSEIF c = '.' THEN
      IF ak IN (';', ',') AND nx <> '.' THEN
        -- ";." dan ",." -> tanda baca pertama
        SET o = o;
      ELSEIF ak = ' ' AND nx IN ('', ' ', ';', ',') AND RIGHT(RTRIM(o), 1) <> '.' THEN
        SET o = CONCAT(LEFT(o, CHAR_LENGTH(o) - 1), '.');
      ELSE
        SET o = CONCAT(o, '.');
      END IF;
    ELSEIF c = '-' AND (nx = ' ' OR nx = '' OR BINARY nx REGEXP '^[A-Za-z]$')
           AND (RTRIM(o) = '' OR (RIGHT(RTRIM(o), 1) IN (':', ';', ',') AND NOT (BINARY RIGHT(RTRIM(o), 3) REGEXP '[0-9][.]?,$'))) THEN
      -- tanda butir "- " sesudah titik dua/titik koma/koma (atau di awal/ujung butir) dibuang; "Rp 100.000,-" tetap
      IF o <> '' AND ak <> ' ' THEN
        SET o = CONCAT(o, ' ');
      END IF;
    ELSEIF ak IN (';', ',', ':') AND (pa OR c = '(')
           AND NOT (ak IN (',', ':') AND ASCII(c) BETWEEN 48 AND 57 AND BINARY RIGHT(o, 2) REGEXP '^[0-9][,:]$')
           AND NOT (o REGEXP '&[A-Za-z#0-9]{2,8};$') THEN
      -- spasi sesudah tanda baca ("tidak tahu,karena" -> "tidak tahu, karena"); angka 2,5 / 10:30 tetap
      SET o = CONCAT(o, ' ', c);
    ELSE
      SET o = CONCAT(o, c);
    END IF;
    SET i = i + 1;
  END WHILE;
  SET o = TRIM(o);
  IF ujung = ';' THEN
    WHILE o <> '' AND RIGHT(o, 1) IN (';', ',', ':', ' ') AND NOT (o REGEXP '&[A-Za-z#0-9]{2,8};$') DO
      SET o = LEFT(o, CHAR_LENGTH(o) - 1);
    END WHILE;
    IF BINARY RIGHT(o, 5) REGEXP '^[a-z]{4}[.]$' THEN
      SET o = LEFT(o, CHAR_LENGTH(o) - 1);
    END IF;
    IF o <> '' AND RIGHT(o, 1) NOT IN ('?', '!', ';') THEN
      SET o = CONCAT(o, ';');
    END IF;
  END IF;
  RETURN o;
END;;
DELIMITER ;
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
DROP FUNCTION IF EXISTS `isian_rtf_bukti`;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_bukti`(t TEXT CHARSET latin1) RETURNS text CHARSET latin1
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'B30: daftar bukti surat -> butir bernomor 1. 2. ... (nomor ketikan dibuang, baris lanjutan digabung, T30 butir rapi)'
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
          SET o = CONCAT(o, IF(n > 1, '<br>', ''), n, '.\\tab ', isian_rtf_butir_rapi(butir, ''));
        END IF;
        SET butir = ln;
      ELSE
        SET butir = CONCAT(butir, ' ', ln);
      END IF;
    END IF;
  END LOOP;
  IF butir <> '' THEN
    SET n = n + 1;
    SET o = CONCAT(o, IF(n > 1, '<br>', ''), n, '.\\tab ', isian_rtf_butir_rapi(butir, ''));
  END IF;
  RETURN IF(n = 0, '1.\\tab ...', o);
END;;
DELIMITER ;
