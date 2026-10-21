-- =====================================================================================================
-- X6 (21 Okt 2026): kalimat penutup keterangan saksi ("Sudah cukup;", "Cukup sekian", ...) tidak pernah tercetak dari variabel
-- ABT yang menyusun keterangan saksi dengan SQL (9259-9265 memanggil isian_rtf_ket_saksi).
-- Sebab: isian_rtf_ket_saksi (paket I3) membaca SEMUA jawaban abt_keterangan_saksi tanpa penyaring; penyaring penutup hanya ada
-- di JS (bot + ekstensi). Kini penyaring yang SAMA (terjemahan mekanis POLA_PENUTUP_LENTUR bot -> ERE POSIX) ada di SQL.
-- Ditulis untuk MariaDB 5.5: REGEXP = Henry Spencer ERE (tanpa kelas spasi singkat, tanpa kelompok tak-menangkap, tanpa batas kata, tanpa lookahead, tanpa fungsi ganti-regex).
-- Teks dinormalkan dulu (huruf kecil, spasi tunggal, awalan butir/"bahwa" dan tanda baca ujung dibuang) sehingga pola cukup
-- memakai spasi tunggal. Hanya MEMBACA abt_keterangan_saksi; tidak menulis apa pun. Nama fungsi netral (isian_rtf_*).
-- Tiga fungsi: isian_rtf_penutup (satu baris seluruhnya penutup? 1/0), isian_rtf_saring_penutup (jawaban tanpa baris penutup),
-- isian_rtf_ket_saksi (diganti: memanggil dua yang lain; selebihnya sama persis dengan versi I3).
-- =====================================================================================================
DELIMITER $$

DROP FUNCTION IF EXISTS isian_rtf_penutup$$
CREATE FUNCTION isian_rtf_penutup(t LONGTEXT CHARSET latin1, tanya LONGTEXT CHARSET latin1) RETURNS INT
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'X6: seluruh teks kalimat penutup keterangan saksi (sudah cukup, cukup sekian, ...)? 1 ya, 0 bukan'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  DECLARE q LONGTEXT CHARSET latin1;
  IF t IS NULL OR CHAR_LENGTH(t) > 400 THEN
    RETURN 0;
  END IF;
  -- baris/tab -> spasi, spasi ganda -> satu, huruf kecil (pola semuanya huruf kecil)
  SET s = LOWER(isian_rtf_spasi(REPLACE(REPLACE(REPLACE(t, CHAR(13 USING latin1), ' '), CHAR(10 USING latin1), ' '), CHAR(9 USING latin1), ' ')));
  -- awalan butir: spasi - * serta tanda hubung/butir Windows-1252 (96 en dash, 95 bullet) dan UTF-8 (E28093, E280A2)
  buang: WHILE CHAR_LENGTH(s) > 0 DO
    IF LEFT(s, 1) IN (' ', '-', '*') THEN
      SET s = SUBSTRING(s, 2);
    ELSEIF HEX(LEFT(s, 1)) IN ('96', '95') THEN
      SET s = SUBSTRING(s, 2);
    ELSEIF HEX(LEFT(s, 3)) IN ('E28093', 'E280A2') THEN
      SET s = SUBSTRING(s, 4);
    ELSE
      LEAVE buang;
    END IF;
  END WHILE;
  -- awalan "bahwa" (dan spasi/koma sesudahnya)
  IF LEFT(s, 5) = 'bahwa' THEN
    SET s = SUBSTRING(s, 6);
    WHILE LEFT(s, 1) IN (' ', ',') DO
      SET s = SUBSTRING(s, 2);
    END WHILE;
  END IF;
  -- tanda baca ujung
  WHILE CHAR_LENGTH(s) > 0 AND RIGHT(s, 1) IN (' ', ';', '.', ',', '!', ':') DO
    SET s = LEFT(s, CHAR_LENGTH(s) - 1);
  END WHILE;
  IF CHAR_LENGTH(s) = 0 THEN
    RETURN 0;
  END IF;
  -- "tidak ada yang (saya) ketahui" tanpa "lagi"/"lain" = jawaban perkara (keputusan 17 Okt), bukan penutup
  IF s REGEXP '(^|[^a-z0-9_])tidak ada([^a-z0-9_]|$)' AND s REGEXP '(^|[^a-z0-9_])(ketahui|diketahui)([^a-z0-9_]|$)' AND NOT s REGEXP '(^|[^a-z0-9_])(lagi|lain)([^a-z0-9_]|$)' THEN
    RETURN 0;
  END IF;
  IF NOT (s REGEXP '^((tidak ada|tidak|ya|iya|baik) ?, ?)?((saya|saksi|aku) )?((sudah|telah|memang|sekarang) )*(cukup( sekian)?( (saja|dulu|sampai di sini))?|sekian( (saja|dulu))?( (keterangan|jawaban) (saya|saksi))?|sampai di sini( saja)?|(tidak|belum) sanggup lagi( (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara))?|(tidak|belum) (kuat|mampu) lagi (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)|(tidak|belum) lagi sanggup( (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara))?|(tidak|belum) lagi (kuat|mampu) (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)|(tidak|belum) (sanggup|kuat|mampu) (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)( lagi)?|(sudah )?tidak ada (lagi )?(yang )?((ingin|akan|hendak|mau|perlu|dapat|bisa) )?((saya|saksi) )?(sampaikan|disampaikan|terangkan|diterangkan|tambahkan|ditambahkan|jelaskan|dijelaskan|katakan|dikatakan|ketahui|diketahui)( lagi)?|(sudah )?tidak ada (lagi )?(keterangan|jawaban|hal|tambahan)( (lain|tambahan|lagi))*( (dari|yang) (saya|saksi)( (sampaikan|terangkan|ketahui))?)?|(hanya itu|itu saja|hanya demikian)( saja)?( yang)? (saya|saksi) (ketahui|terangkan|sampaikan|ketahui dan sampaikan)|demikian( saja)? (keterangan|jawaban) (saya|saksi))( ?(,|dan|serta) ?((saya|saksi|aku) )?((sudah|telah|memang|sekarang) )*(cukup( sekian)?( (saja|dulu|sampai di sini))?|sekian( (saja|dulu))?( (keterangan|jawaban) (saya|saksi))?|sampai di sini( saja)?|(tidak|belum) sanggup lagi( (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara))?|(tidak|belum) (kuat|mampu) lagi (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)|(tidak|belum) lagi sanggup( (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara))?|(tidak|belum) lagi (kuat|mampu) (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)|(tidak|belum) (sanggup|kuat|mampu) (untuk )?(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)( lagi)?|(sudah )?tidak ada (lagi )?(yang )?((ingin|akan|hendak|mau|perlu|dapat|bisa) )?((saya|saksi) )?(sampaikan|disampaikan|terangkan|diterangkan|tambahkan|ditambahkan|jelaskan|dijelaskan|katakan|dikatakan|ketahui|diketahui)( lagi)?|(sudah )?tidak ada (lagi )?(keterangan|jawaban|hal|tambahan)( (lain|tambahan|lagi))*( (dari|yang) (saya|saksi)( (sampaikan|terangkan|ketahui))?)?|(hanya itu|itu saja|hanya demikian)( saja)?( yang)? (saya|saksi) (ketahui|terangkan|sampaikan|ketahui dan sampaikan)|demikian( saja)? (keterangan|jawaban) (saya|saksi)))*( ?(,|dan)? ?terima kasih)?$') THEN
    RETURN 0;
  END IF;
  -- bentuk bermakna ganda ("tidak sanggup lagi" tanpa kata kerja menjawab/menerangkan, tanpa kata penutup pasti):
  -- penutup HANYA bila pertanyaannya pertanyaan penutup; tanpa pertanyaan dibiarkan (keterangan perkara)
  IF s REGEXP '(^|[^a-z0-9_])(sanggup|kuat|mampu)([^a-z0-9_]|$)' AND NOT s REGEXP '(^|[^a-z0-9_])(menjawab|memberi(kan)? keterangan|menerangkan|menjelaskan|melanjutkan|berbicara|bicara)([^a-z0-9_]|$)' AND NOT s REGEXP '(^|[^a-z0-9_])(cukup|sekian|terima kasih|tidak ada|sampai di sini|demikian|hanya itu|itu saja)([^a-z0-9_]|$)' THEN
    SET q = LOWER(isian_rtf_spasi(REPLACE(REPLACE(REPLACE(IFNULL(tanya, ''), CHAR(13 USING latin1), ' '), CHAR(10 USING latin1), ' '), CHAR(9 USING latin1), ' ')));
    IF CHAR_LENGTH(q) = 0 THEN
      RETURN 0;
    END IF;
    IF q REGEXP '(^|[^a-z0-9_])(sanggup|mampu|kuat|bisa|dapat)[^a-z0-9_?][^?]*(damai|rukun|nasihat|nasehat|pertahankan|bersatu|akur)' THEN
      RETURN 0;
    END IF;
    IF q REGEXP 'masih ada[^a-z0-9_?]([^?]*[^a-z0-9_?])?(sampaikan|sampikan|disampaikan|tanyakan|keterangan|hal lain)' OR q REGEXP '(^|[^a-z0-9_])(sudah cukup|cukup sekian)([^a-z0-9_]|$)' THEN
      RETURN 1;
    END IF;
    RETURN 0;
  END IF;
  RETURN 1;
END$$

DROP FUNCTION IF EXISTS isian_rtf_saring_penutup$$
CREATE FUNCTION isian_rtf_saring_penutup(t LONGTEXT CHARSET latin1, tanya LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'X6: jawaban saksi tanpa kalimat penutup (seluruh jawaban, atau baris yang berdiri sendiri sebagai kalimat penutup); kosong bila hanya penutup'
BEGIN
  DECLARE r LONGTEXT CHARSET latin1;
  DECLARE sisa LONGTEXT CHARSET latin1;
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE kini LONGTEXT CHARSET latin1;
  DECLARE p INT;
  DECLARE akhirnya INT;
  DECLARE sebelumnya INT DEFAULT 1;
  DECLARE berakhir INT;
  DECLARE terakhir INT;
  DECLARE dibuang INT DEFAULT 0;
  DECLARE lf CHAR(1) CHARSET latin1 DEFAULT CHAR(10 USING latin1);
  IF t IS NULL THEN
    RETURN '';
  END IF;
  -- seluruh jawaban (baris yang terbelah pun dirapatkan) hanya kalimat penutup: dibuang utuh
  IF isian_rtf_penutup(t, tanya) = 1 THEN
    RETURN '';
  END IF;
  IF LOCATE(CHAR(10 USING latin1), t) = 0 AND LOCATE(CHAR(13 USING latin1), t) = 0 THEN
    RETURN t;
  END IF;
  -- jawaban beberapa baris: baris penutup dibuang HANYA bila berdiri sesudah kalimat yang selesai (baris sebelumnya berakhir
  -- ; . ! ? :) dan ia sendiri berakhir dengan tanda itu atau baris terakhir. Pecahan baris di tengah kalimat ("... tidak" /
  -- "cukup;") bukan penutup - keterangan perkara tidak boleh terpotong.
  SET r = REPLACE(REPLACE(t, CONCAT(CHAR(13 USING latin1), CHAR(10 USING latin1)), lf), CHAR(13 USING latin1), lf);
  SET sisa = r;
  baris: LOOP
    SET p = LOCATE(lf, sisa);
    IF p > 0 THEN
      SET kini = LEFT(sisa, p - 1);
      SET sisa = SUBSTRING(sisa, p + 1);
      SET akhirnya = 0;
    ELSE
      SET kini = sisa;
      SET sisa = '';
      SET akhirnya = 1;
    END IF;
    IF CHAR_LENGTH(TRIM(REPLACE(kini, CHAR(9 USING latin1), ' '))) = 0 THEN
      SET hasil = CONCAT(hasil, kini, lf);
    ELSE
      SET berakhir = IF(RIGHT(RTRIM(kini), 1) IN (';', '.', '!', '?', ':'), 1, 0);
      SET terakhir = IF(akhirnya = 1 OR CHAR_LENGTH(TRIM(REPLACE(REPLACE(sisa, lf, ' '), CHAR(9 USING latin1), ' '))) = 0, 1, 0);
      IF sebelumnya = 1 AND (berakhir = 1 OR terakhir = 1) AND isian_rtf_penutup(kini, tanya) = 1 THEN
        SET dibuang = dibuang + 1;
      ELSE
        SET hasil = CONCAT(hasil, kini, lf);
        SET sebelumnya = berakhir;
      END IF;
    END IF;
    IF akhirnya = 1 THEN
      LEAVE baris;
    END IF;
  END LOOP;
  IF dibuang = 0 THEN
    RETURN t;
  END IF;
  RETURN TRIM(BOTH lf FROM TRIM(hasil));
END$$

DROP FUNCTION IF EXISTS isian_rtf_ket_saksi$$
CREATE FUNCTION isian_rtf_ket_saksi(pid INT, sk VARCHAR(40)) RETURNS LONGTEXT CHARSET utf8mb4
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'I3+X6: keterangan saksi ABT seperti list_keterangan TANPA ganti baris di ujung dan TANPA kalimat penutup (sudah cukup dst.)'
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
        -- X6: kalimat penutup pemeriksaan saksi tidak ikut tercetak (pertanyaan menentukan bentuk "tidak sanggup lagi")
        SET t = isian_rtf_saring_penutup(t, tq);
      ELSE
        SET t = '';
      END IF;
      IF CHAR_LENGTH(t) > 0 THEN
        SET t = REPLACE(REPLACE(REPLACE(t, CONCAT(CHAR(13 USING latin1), CHAR(10 USING latin1)), ' '), CHAR(10 USING latin1), ' '), CHAR(13 USING latin1), ' ');
        IF ASCII(t) BETWEEN 65 AND 90 THEN
          SET t = CONCAT(LOWER(LEFT(t, 1)), SUBSTRING(t, 2));
        END IF;
        SET t = isian_rtf_iganti(t, 'saya', 'saksi');
        SET t = isian_rtf_iganti(t, 'ya, ', '');
        SET t = isian_rtf_iganti(t, 'penggugat', 'Penggugat');
        SET t = isian_rtf_iganti(t, 'pemohon', 'Pemohon');
        SET t = isian_rtf_iganti(t, 'tergugat', 'Tergugat');
        SET t = isian_rtf_iganti(t, 'termohon', 'Termohon');
        SET o = CONCAT(o, IF(CHAR_LENGTH(o) > 0, '<br>', ''), '-   Bahwa ', t);
      END IF;
    END LOOP;
    CLOSE cur;
  END IF;
  IF CHAR_LENGTH(o) = 0 THEN
    SET o = '...';
  END IF;
  RETURN CONVERT(CAST(o AS BINARY) USING utf8mb4);
END$$

DELIMITER ;
