-- Paket ABT "abt-identitas-kosong-31okt": fungsi baru (hanya REPLACE, tanpa membaca tabel). aps_badilag. = basis ABT (pasang-satker.sh menggantinya di laptop).
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_identitas_kosong;
DELIMITER ;;
CREATE DEFINER=CURRENT_USER FUNCTION aps_badilag.isian_rtf_identitas_kosong(t LONGTEXT CHARSET latin1) RETURNS longtext CHARSET latin1
    DETERMINISTIC
    NO SQL
    SQL SECURITY INVOKER
    COMMENT 'identitas pihak: bagian yang datanya kosong di SIPP ditulis "..." (label tetap), agama kosong = Islam, tanggal 00 0000 = kosong'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  IF t IS NULL OR t = '' THEN
    RETURN t;
  END IF;
  SET s = t;
  SET s = REPLACE(s, '00  0000', '00 0000');
  SET s = REPLACE(s, ', 00 0000,', ', ,');
  SET s = REPLACE(s, 'NIK  ,', 'NIK ,');
  SET s = REPLACE(s, 'lahir  ,', 'lahir ,');
  SET s = REPLACE(s, 'lahir , ,', 'lahir ...,');
  SET s = REPLACE(s, 'lahir , ', 'lahir ..., ');
  SET s = REPLACE(s, ', , agama ', ', ..., agama ');
  SET s = REPLACE(s, ', , umur ', ', ..., umur ');
  SET s = REPLACE(s, ', , pekerjaan ', ', ..., pekerjaan ');
  SET s = REPLACE(s, ', , pendidikan ', ', ..., pendidikan ');
  SET s = REPLACE(s, 'NIK ,', 'NIK ...,');
  SET s = REPLACE(s, 'umur  tahun', 'umur ... tahun');
  SET s = REPLACE(s, 'umur tahun', 'umur ... tahun');
  SET s = REPLACE(s, 'agama  ,', 'agama ,');
  SET s = REPLACE(s, 'agama ,', 'agama Islam,');
  SET s = REPLACE(s, 'pekerjaan  ,', 'pekerjaan ,');
  SET s = REPLACE(s, 'pekerjaan ,', 'pekerjaan ...,');
  SET s = REPLACE(s, 'pendidikan  ,', 'pendidikan ,');
  SET s = REPLACE(s, 'pendidikan ,', 'pendidikan ...,');
  SET s = REPLACE(s, 'tempat kediaman di ,', 'tempat kediaman di ...,');
  SET s = REPLACE(s, 'tempat kediaman di ;', 'tempat kediaman di ...;');
  RETURN s;
END ;;
DELIMITER ;
