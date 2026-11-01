-- Fungsi paket abt-bukti-pisah-1nov (1 Nov 2026): daftar bukti surat dan bukti elektronik DIPISAH dari satu isian gabungan.
DELIMITER $$
DROP FUNCTION IF EXISTS isian_bukti_baris$$
CREATE FUNCTION `isian_bukti_baris`(t TEXT CHARSET latin1, jenis INT) RETURNS text CHARSET latin1 COLLATE latin1_swedish_ci
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT '1 Nov 2026: baris isian daftar bukti (satu pihak) yang termasuk bukti surat (jenis 0) atau bukti elektronik (jenis 1); baris dengan "bukti elektronik tersebut" = elektronik (sama dengan pisahBuktiElektronik ekstensi), baris lanjutan ikut baris sebelumnya'
BEGIN
  DECLARE s TEXT CHARSET latin1;
  DECLARE o TEXT CHARSET latin1 DEFAULT '';
  DECLARE ln TEXT CHARSET latin1;
  DECLARE pos INT DEFAULT 1;
  DECLARE nx INT;
  DECLARE el INT DEFAULT 0;
  DECLARE ada INT DEFAULT 0;
  DECLARE c VARCHAR(1) CHARSET latin1;
  DECLARE nl CHAR(1) CHARSET latin1 DEFAULT CHAR(10 USING latin1);
  IF t IS NULL OR TRIM(t) = '' THEN
    RETURN '';
  END IF;
  SET s = REPLACE(REPLACE(t, CONCAT(CHAR(13 USING latin1), nl), nl), CHAR(13 USING latin1), nl);
  SET s = CONCAT(s, nl);
  lp: LOOP
    SET nx = LOCATE(nl, s, pos);
    IF nx = 0 THEN
      LEAVE lp;
    END IF;
    SET ln = TRIM(BOTH ' ' FROM TRIM(BOTH CHAR(160 USING latin1) FROM TRIM(BOTH CHAR(9 USING latin1) FROM TRIM(BOTH ' ' FROM SUBSTRING(s, pos, nx - pos)))));
    SET pos = nx + 1;
    IF ln <> '' THEN
      SET c = SUBSTRING(ln, 1, 1);
      IF ada = 0 OR NOT (BINARY c BETWEEN 'a' AND 'z' OR c IN (';', ',', '.', ':')) THEN
        SET el = IF(LOCATE('bukti elektronik tersebut', ln) > 0, 1, 0);
      END IF;
      SET ada = 1;
      IF el = jenis THEN
        SET o = CONCAT(o, IF(o = '', '', nl), ln);
      END IF;
    END IF;
  END LOOP;
  RETURN o;
END$$

DROP FUNCTION IF EXISTS isian_bukti_sumber$$
CREATE FUNCTION `isian_bukti_sumber`(pid BIGINT, pihak CHAR(1) CHARSET latin1) RETURNS text CHARSET latin1 COLLATE latin1_swedish_ci
    READS SQL DATA
    NOT DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT '1 Nov 2026: isian daftar bukti satu pihak - T = 9911; selain itu isian bukti pihak pertama yang terisi dan PALING BARU disimpan (9955, 1214, 9958, 8131, 8132, 0378, 9956); kosong bila tidak ada'
BEGIN
  DECLARE v TEXT CHARSET latin1 DEFAULT NULL;
  IF pihak = 'T' THEN
    SELECT d.data INTO v FROM abt_data_teks d WHERE d.perkara_id = pid AND d.no_var = 9911 AND TRIM(IFNULL(d.data, '')) <> '' LIMIT 1;
  ELSE
    SELECT d.data INTO v FROM abt_data_teks d WHERE d.perkara_id = pid AND d.no_var IN (9955, 1214, 9958, 8131, 8132, 378, 9956) AND TRIM(IFNULL(d.data, '')) <> ''
      ORDER BY d.modified DESC, FIELD(d.no_var, 9955, 1214, 9958, 8131, 8132, 378, 9956) LIMIT 1;
  END IF;
  RETURN IFNULL(v, '');
END$$

DROP FUNCTION IF EXISTS isian_bukti_rtf$$
CREATE FUNCTION `isian_bukti_rtf`(t TEXT CHARSET latin1, jenis INT) RETURNS text CHARSET latin1 COLLATE latin1_swedish_ci
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT '1 Nov 2026: daftar bukti surat (jenis 0) atau elektronik (jenis 1) bernomor 1. 2. ... lewat isian_rtf_bukti, ditutup \\par; KOSONG bila jenis itu tidak ada (paragraf pembawa tidak berpenutup sendiri, jadi tidak ada paragraf kosong)'
BEGIN
  DECLARE b TEXT CHARSET latin1;
  SET b = isian_bukti_baris(t, jenis);
  IF b = '' THEN
    RETURN '';
  END IF;
  RETURN CONCAT(isian_rtf_bukti(b), CHAR(92 USING latin1), 'par');
END$$
DELIMITER ;
