-- isian_rtf_butir + isian_rtf_judul LAMA (keadaan sesudah 22 paket) - pulih
DELIMITER $$
DROP FUNCTION IF EXISTS isian_rtf_butir$$
CREATE FUNCTION `isian_rtf_butir`(teks LONGTEXT CHARSET utf8mb4, mode VARCHAR(10), gantung INT) RETURNS longtext CHARSET latin1 COLLATE latin1_swedish_ci
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'I3 16 Okt 2026: posita/petitum/teks isian -> paragraf RTF bernomor berinden gantung'
BEGIN
  DECLARE tk1 CHAR(1) CHARSET latin1 DEFAULT CHAR(1 USING latin1);
  DECLARE bs CHAR(1) CHARSET latin1 DEFAULT CHAR(92 USING latin1);
  DECLARE s LONGTEXT CHARSET latin1;
  DECLARE html INT DEFAULT 0;
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE blok LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE seg LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE tok VARCHAR(5) CHARSET latin1 DEFAULT 'B';
  DECLARE pos INT DEFAULT 1;
  DECLARE nx INT DEFAULT 0;
  DECLARE q2 INT;
  DECLARE gabung INT;
  DECLARE ber LONGTEXT CHARSET latin1;
  DECLARE inti LONGTEXT CHARSET latin1;
  DECLARE isi LONGTEXT CHARSET latin1;
  DECLARE gdepan LONGTEXT CHARSET latin1;
  DECLARE gl INT;
  DECLARE pnd VARCHAR(255) CHARSET latin1;
  DECLARE gaya VARCHAR(8) CHARSET latin1;
  DECLARE p_akhir INT;
  DECLARE p_mulai INT;
  DECLARE pen VARCHAR(255) CHARSET latin1;
  DECLARE sisa LONGTEXT CHARSET latin1;
  DECLARE tkk INT;
  DECLARE kk INT;
  DECLARE cnt INT;
  DECLARE e INT;
  DECLARE baru LONGTEXT CHARSET latin1;
  DECLARE idx INT;
  DECLARE pertama LONGTEXT CHARSET latin1;
  DECLARE atas LONGTEXT CHARSET latin1;
  DECLARE t CHAR(1) CHARSET latin1;
  DECLARE st INT;
  DECLARE mulai INT;
  DECLARE lv INT;
  
  DECLARE dl_tipe LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE dl_hit LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE maya INT DEFAULT 0;
  DECLARE li_pen VARCHAR(255) CHARSET latin1 DEFAULT NULL;
  DECLARE li_ptk INT DEFAULT 0;
  DECLARE li_tk INT DEFAULT 0;
  DECLARE man LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE man_dasar INT DEFAULT 0;
  DECLARE nomor_atas INT DEFAULT 0;
  DECLARE akhir_atas LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE ada_judul INT DEFAULT 0;

  IF teks IS NULL THEN RETURN ''; END IF;
  SET html = IF(mode = 'html', 1, 0);
  IF mode = 'teks' THEN
    SET s = LOWER(teks);
    SET html = IF(LOCATE('<p', s) > 0 OR LOCATE('<br', s) > 0 OR LOCATE('<li', s) > 0 OR LOCATE('<div', s) > 0
                  OR LOCATE('<ol', s) > 0 OR LOCATE('<ul', s) > 0, 1, 0);
  END IF;
  SET s = isian_rtf_norm(teks);
  IF html = 0 THEN
    SET s = isian_rtf_pecah(s);
  END IF;
  SET s = isian_rtf_token(s, html);

  utama: LOOP
    IF tok = 'Z' THEN
      SET seg = '';
      SET nx = 0;
    ELSE
      SET nx = LOCATE(tk1, s, pos);
      SET seg = IF(nx = 0, SUBSTRING(s, pos), SUBSTRING(s, pos, nx - pos));
    END IF;
    SET gabung = 0;
    IF tok = 'S' THEN
      SET ber = isian_rtf_spasi(isian_rtf_polos(seg));
      IF CHAR_LENGTH(isian_rtf_spasi(isian_rtf_polos(blok))) > 0 AND CHAR_LENGTH(ber) > 0 AND isian_rtf_selesai(blok) = 0
         AND li_pen IS NULL THEN
        SET inti = SUBSTRING(ber, isian_rtf_gdepan(ber) + 1);
        IF isian_rtf_penanda(inti) IS NULL AND NOT (ASCII(inti) BETWEEN 65 AND 90) THEN
          SET gabung = 1;
        END IF;
      END IF;
    END IF;
    IF gabung = 1 THEN
      SET blok = CONCAT(TRIM(TRAILING ' ' FROM blok), ' ', TRIM(LEADING ' ' FROM seg));
    ELSE
      
      SET isi = isian_rtf_spasi(blok);
      SET gl = isian_rtf_gdepan(isi);
      SET gdepan = LEFT(isi, gl);
      SET inti = SUBSTRING(isi, gl + 1);
      IF CHAR_LENGTH(isian_rtf_spasi(isian_rtf_polos(inti))) > 0 THEN
        IF li_pen IS NOT NULL THEN
          SET pen = li_pen;
          SET tkk = li_ptk;
          SET li_pen = NULL;
          SET pnd = isian_rtf_penanda(inti);
          IF pnd IS NOT NULL THEN
            SET p_akhir = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(pnd, ',', 2), ',', -1) AS UNSIGNED);
            SET p_mulai = CAST(SUBSTRING_INDEX(pnd, ',', -1) AS UNSIGNED);
            SET pen = LEFT(inti, p_akhir);
            SET isi = CONCAT(gdepan, SUBSTRING(inti, p_mulai + 1));
          END IF;
          SET li_tk = tkk;
          SET man = '';
          SET man_dasar = tkk;
          SET hasil = CONCAT(hasil, isian_rtf_par(tkk, pen, isi, gantung, 0));
          IF tkk = 1 THEN SET akhir_atas = isi; END IF;
        ELSEIF isian_rtf_judul(isi) = 1 THEN
          SET man = '';
          SET man_dasar = 0;
          IF dl_tipe = '' THEN SET li_tk = 0; END IF;
          SET ada_judul = 1;
          SET hasil = CONCAT(hasil, isian_rtf_par(0, '', isi, gantung, 0));
        ELSE
          SET pnd = isian_rtf_penanda(inti);
          IF pnd IS NOT NULL THEN
            SET gaya = SUBSTRING_INDEX(pnd, ',', 1);
            SET p_akhir = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(pnd, ',', 2), ',', -1) AS UNSIGNED);
            SET p_mulai = CAST(SUBSTRING_INDEX(pnd, ',', -1) AS UNSIGNED);
            SET pen = LEFT(inti, p_akhir);
            SET sisa = CONCAT(gdepan, SUBSTRING(inti, p_mulai + 1));
            
            SET cnt = IF(man = '', 0, CHAR_LENGTH(man) - CHAR_LENGTH(REPLACE(man, ',', '')) + 1);
            IF BINARY LEFT(gaya, 1) = 'n' THEN
              SET kk = CAST(SUBSTRING(gaya, 2) AS UNSIGNED);
              IF kk - 1 <= 0 THEN
                SET baru = '';
              ELSEIF cnt >= kk - 1 THEN
                SET baru = SUBSTRING_INDEX(man, ',', kk - 1);
              ELSE
                SET baru = man;
                SET e = cnt + 1;
                WHILE e <= kk - 1 DO
                  SET baru = CONCAT(baru, IF(baru = '', '', ','), 'n', e);
                  SET e = e + 1;
                END WHILE;
              END IF;
              SET man = CONCAT(baru, IF(baru = '', '', ','), gaya);
            ELSE
              SET idx = IF(man = '', 0, FIND_IN_SET(gaya, man));
              IF idx > 0 THEN
                SET man = SUBSTRING_INDEX(man, ',', idx);
              ELSE
                SET man = CONCAT(man, IF(man = '', '', ','), gaya);
              END IF;
            END IF;
            SET tkk = man_dasar + (CHAR_LENGTH(man) - CHAR_LENGTH(REPLACE(man, ',', '')) + 1);
            SET hasil = CONCAT(hasil, isian_rtf_par(tkk, pen, sisa, gantung, 0));
            IF tkk = 1 AND BINARY gaya = 'n1' THEN
              SET kk = 0;
              SET e = 1;
              WHILE e <= CHAR_LENGTH(pen) AND ASCII(SUBSTRING(pen, e, 1)) BETWEEN 48 AND 57 DO
                SET kk = kk * 10 + ASCII(SUBSTRING(pen, e, 1)) - 48;
                SET e = e + 1;
              END WHILE;
              SET nomor_atas = kk;
              SET akhir_atas = sisa;
              SET ada_judul = 0;
            END IF;
          ELSEIF dl_tipe <> '' THEN
            SET tkk = GREATEST(1, li_tk);
            SET hasil = CONCAT(hasil, isian_rtf_par(tkk, '', isi, gantung, 1));
            SET man = '';
            SET man_dasar = tkk;
          ELSEIF man <> '' THEN
            SET tkk = man_dasar + 1;
            SET hasil = CONCAT(hasil, isian_rtf_par(tkk, '', isi, gantung, 1));
            SET man = SUBSTRING_INDEX(man, ',', 1);
          ELSE
            SET hasil = CONCAT(hasil, isian_rtf_par(0, '', isi, gantung, 0));
          END IF;
        END IF;
      END IF;
      
      IF BINARY LEFT(tok, 1) = 'O' THEN
        SET pertama = '';
        IF nx > 0 AND BINARY SUBSTRING(s, nx + 1, 1) = 'L' THEN
          SET q2 = LOCATE(tk1, s, nx + 2);
          SET pertama = IF(q2 = 0, SUBSTRING(s, nx + 2), SUBSTRING(s, nx + 2, q2 - nx - 2));
          SET pertama = isian_rtf_spasi(isian_rtf_polos(pertama));
          SET pertama = SUBSTRING(pertama, isian_rtf_gdepan(pertama) + 1);
        END IF;
        SET t = SUBSTRING(tok, 2, 1);
        SET st = CAST(SUBSTRING(tok, 3, 3) AS UNSIGNED);
        IF dl_tipe = '' THEN
          SET mulai = IF(st > 0, st, 1);
          SET maya = 0;
          IF st = 0 AND nomor_atas > 0 AND ada_judul = 0 THEN
            SET atas = isian_rtf_spasi(isian_rtf_polos(akhir_atas));
            SET atas = SUBSTRING(atas, isian_rtf_gdepan(atas) + 1);
            IF NOT (BINARY t = 'd') THEN
              SET maya = 1;
            ELSEIF LOWER(LEFT(pertama, 5)) = 'bahwa' THEN
              SET mulai = nomor_atas + 1;
            ELSEIF BINARY RIGHT(TRIM(TRAILING ' ' FROM atas), 1) = ':' OR LOWER(LEFT(atas, 5)) = 'bahwa' THEN
              SET maya = 1;
            ELSE
              SET mulai = nomor_atas + 1;
            END IF;
          END IF;
          IF maya = 0 THEN SET ada_judul = 0; END IF;
          SET dl_tipe = t;
          SET dl_hit = LPAD(mulai - 1, 4, '0');
        ELSE
          SET dl_tipe = CONCAT(dl_tipe, t);
          SET dl_hit = CONCAT(dl_hit, LPAD(IF(st > 0, st, 1) - 1, 4, '0'));
        END IF;
        SET man = '';
        SET man_dasar = CHAR_LENGTH(dl_tipe) + maya;
      ELSEIF tok = 'C' THEN
        IF dl_tipe <> '' THEN
          IF CHAR_LENGTH(dl_tipe) = 1 AND maya = 0 AND BINARY dl_tipe = 'd' THEN
            SET nomor_atas = CAST(LEFT(dl_hit, 4) AS UNSIGNED);
          END IF;
          SET dl_tipe = LEFT(dl_tipe, CHAR_LENGTH(dl_tipe) - 1);
          SET dl_hit = LEFT(dl_hit, CHAR_LENGTH(dl_hit) - 4);
          IF dl_tipe = '' THEN SET maya = 0; END IF;
        END IF;
        SET li_pen = NULL;
        IF dl_tipe <> '' THEN
          SET li_tk = CHAR_LENGTH(dl_tipe) + maya;
          SET man = '';
          SET man_dasar = li_tk;
        ELSE
          SET li_tk = 0;
          SET man = IF(nomor_atas > 0, 'n1', '');
          SET man_dasar = 0;
        END IF;
      ELSEIF tok = 'L' THEN
        IF dl_tipe = '' THEN
          SET dl_tipe = 'd';
          SET dl_hit = '0000';
        END IF;
        SET lv = CHAR_LENGTH(dl_tipe);
        SET cnt = CAST(SUBSTRING(dl_hit, (lv - 1) * 4 + 1, 4) AS UNSIGNED) + 1;
        SET dl_hit = CONCAT(LEFT(dl_hit, (lv - 1) * 4), LPAD(cnt, 4, '0'));
        SET tkk = lv + maya;
        SET li_pen = isian_rtf_nomor(RIGHT(dl_tipe, 1), cnt, tkk);
        SET li_ptk = tkk;
      END IF;
      SET blok = seg;
    END IF;
    IF tok = 'Z' THEN
      LEAVE utama;
    END IF;
    IF nx = 0 THEN
      SET tok = 'Z';
    ELSEIF BINARY SUBSTRING(s, nx + 1, 1) = 'O' THEN
      SET tok = SUBSTRING(s, nx + 1, 5);
      SET pos = nx + 6;
    ELSE
      SET tok = SUBSTRING(s, nx + 1, 1);
      SET pos = nx + 2;
    END IF;
  END LOOP;
  
  RETURN REPLACE(REPLACE(hasil, '&', CONCAT(bs, '''26')), ';', CONCAT(bs, '''3b'));
END$$
DROP FUNCTION IF EXISTS isian_rtf_judul$$
CREATE FUNCTION `isian_rtf_judul`(t LONGTEXT CHARSET latin1) RETURNS int(11)
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'I3: paragraf judul (PRIMER, SUBSIDER, DALAM REKONVENSI, huruf besar pendek)?'
BEGIN
  DECLARE p LONGTEXT CHARSET latin1;
  DECLARE n INT;
  DECLARE i INT DEFAULT 1;
  DECLARE besar INT DEFAULT 0;
  DECLARE kecil INT DEFAULT 0;
  DECLARE a INT;
  SET p = isian_rtf_spasi(isian_rtf_polos(t));
  WHILE CHAR_LENGTH(p) > 0 AND BINARY RIGHT(p, 1) IN (' ', ':', ';', '.') DO
    SET p = LEFT(p, CHAR_LENGTH(p) - 1);
  END WHILE;
  SET n = CHAR_LENGTH(p);
  IF n = 0 OR n > 40 THEN RETURN 0; END IF;
  IF BINARY UPPER(p) IN ('PRIMAIR', 'PRIMER', 'SUBSIDAIR', 'SUBSIDER', 'LEBIH SUBSIDAIR', 'DALAM KONVENSI', 'DALAM REKONVENSI',
                         'DALAM POKOK PERKARA', 'DALAM EKSEPSI', 'DALAM PROVISI', 'KONVENSI', 'REKONVENSI', 'PROVISI', 'EKSEPSI', 'POKOK PERKARA') THEN
    RETURN 1;
  END IF;
  WHILE i <= n DO
    SET a = ASCII(SUBSTRING(p, i, 1));
    IF a BETWEEN 65 AND 90 THEN SET besar = besar + 1; END IF;
    IF a BETWEEN 97 AND 122 THEN SET kecil = kecil + 1; END IF;
    SET i = i + 1;
  END WHILE;
  RETURN IF(besar >= 4 AND kecil = 0 AND NOT (ASCII(p) BETWEEN 48 AND 57), 1, 0);
END$$
DELIMITER ;
