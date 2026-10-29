-- PP29: terbilang rupiah persis TemplateHelper::Terbilang ABT (angka bulat; 0 dan >= 1 miliar = kosong), MariaDB 5.5, tanpa SQL.
-- Dipakai variabel amar biaya perkara dan jumlah rincian biaya (paket prodeo-panggilan-29okt) supaya kata terbilang dan tanda kurung
-- dicetak dari SATU variabel (perkara prodeo: tanpa terbilang). Hasil tanpa spasi di tepi.
-- Angka di bawah 12 = kosong, persis ABT untuk masukan bertitik desimal ("5.00": PHP mencari indeks larik "5.00" yang tidak ada).
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_terbilang;
DELIMITER $$
CREATE FUNCTION aps_badilag.isian_rtf_terbilang(n DECIMAL(20,2)) RETURNS VARCHAR(255) CHARSET latin1
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'PP29: terbilang gaya ABT (TemplateHelper::Terbilang) untuk angka bulat 12 s.d. 999.999.999; selain itu kosong'
BEGIN
  DECLARE x BIGINT;
  DECLARE g INT;
  DECLARE h INT;
  DECLARE s INT;
  DECLARE i INT DEFAULT 0;
  DECLARE w VARCHAR(80) CHARSET latin1;
  DECLARE r VARCHAR(255) CHARSET latin1 DEFAULT '';
  IF n IS NULL OR n < 12 OR n >= 1000000000 THEN
    RETURN '';
  END IF;
  SET x = FLOOR(n);
  -- i = 0 juta, 1 ribu, 2 satuan
  WHILE i < 3 DO
    SET g = CASE i WHEN 0 THEN x DIV 1000000 WHEN 1 THEN (x DIV 1000) MOD 1000 ELSE x MOD 1000 END;
    IF g > 0 THEN
      IF i = 1 AND g = 1 THEN
        SET w = 'seribu';
      ELSE
        SET h = g DIV 100;
        SET s = g MOD 100;
        SET w = CASE WHEN h = 0 THEN '' WHEN h = 1 THEN 'seratus'
                ELSE CONCAT(ELT(h, 'satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan'), ' ratus') END;
        IF s > 0 THEN
          SET w = CONCAT(w, IF(w = '', '', ' '),
            CASE WHEN s < 12 THEN ELT(s, 'satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas')
                 WHEN s < 20 THEN CONCAT(ELT(s - 10, 'satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan'), ' belas')
                 ELSE CONCAT(ELT(s DIV 10, 'satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan'), ' puluh',
                             IF(s MOD 10 = 0, '', CONCAT(' ', ELT(s MOD 10, 'satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan')))) END);
        END IF;
        IF i = 0 THEN SET w = CONCAT(w, ' juta'); END IF;
        IF i = 1 THEN SET w = CONCAT(w, ' ribu'); END IF;
      END IF;
      SET r = CONCAT(r, IF(r = '', '', ' '), w);
    END IF;
    SET i = i + 1;
  END WHILE;
  RETURN r;
END$$
DELIMITER ;
