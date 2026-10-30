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
END
