-- =====================================================================================================
-- AG (26 Okt 2026): alamat pihak tanpa ekor wilayah ganda. SIPP/e-Court menempelkan di ujung alamat yang diketik nama desa, kecamatan,
-- kabupaten, dan provinsi RESMI tanpa sebutan tingkatan ("..., Kelurahan Ganti, Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah,
-- Ganti, Banawa, Kabupaten Donggala, Sulawesi Tengah"). Fungsi-fungsi ini kembaran SQL dari rapikanAlamat (manajemen_surat/src/lib/alamat-pihak.ts) dan
-- alamatPihakRapi.js (bot): aturan SAMA untuk bagian yang dipakai ABT (merapikan spasi/koma, membuang potongan kembar berurutan, mengenali ekor
-- wilayah sistem dan membuang tingkatan yang sudah disebut di depan, domisili elektronik dipindah ke ujung). Yang sengaja TIDAK ada di SQL:
-- membuang petunjuk arah di dalam kurung dan memberi sebutan pada potongan tanpa ekor sistem (hanya bagian portal).
-- Ditulis untuk MariaDB 5.5 (tanpa pengganti ekspresi-reguler dan tanpa fungsi bawaan 10.x). Membaca (tidak menulis) tabel referensi SIPP ref_kelurahan_new,
-- ref_kecamatan_new, ref_kabupaten_new untuk memutuskan Desa atau Kelurahan; nama basis SIPP tertulis "SIPP" (di laptop pasang-satker.sh menggantinya).
-- Nama fungsi netral (isian_rtf_alamat*), komentar fungsi berawalan "AG:".
-- =====================================================================================================
DELIMITER $$

DROP FUNCTION IF EXISTS isian_rtf_alamat_rapi$$
CREATE FUNCTION isian_rtf_alamat_rapi(x LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AG: spasi/koma/titik ujung dirapikan (satu spasi, ", " antar potongan, tanpa koma ganda, tepi bersih)'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  SET s = IFNULL(x, '');
  SET s = REPLACE(s, CHAR(9 USING latin1), ' ');
  SET s = REPLACE(s, CHAR(10 USING latin1), ' ');
  SET s = REPLACE(s, CHAR(13 USING latin1), ' ');
  SET s = REPLACE(s, CHAR(160 USING latin1), ' ');
  SET s = REPLACE(s, CONVERT(UNHEX('C2A0') USING latin1), ' ');
  WHILE LOCATE('  ', s) > 0 DO SET s = REPLACE(s, '  ', ' '); END WHILE;
  WHILE LOCATE(' ,', s) > 0 DO SET s = REPLACE(s, ' ,', ','); END WHILE;
  WHILE LOCATE(', ', s) > 0 DO SET s = REPLACE(s, ', ', ','); END WHILE;
  SET s = REPLACE(s, ',', ', ');
  WHILE LOCATE(', ,', s) > 0 DO SET s = REPLACE(s, ', ,', ','); END WHILE;
  SET s = RTRIM(s);
  IF RIGHT(s, 1) = '.' THEN SET s = RTRIM(LEFT(s, CHAR_LENGTH(s) - 1)); END IF;
  WHILE CHAR_LENGTH(s) > 0 AND (LEFT(s, 1) = ' ' OR LEFT(s, 1) = ',') DO SET s = SUBSTRING(s, 2); END WHILE;
  WHILE CHAR_LENGTH(s) > 0 AND (RIGHT(s, 1) = ' ' OR RIGHT(s, 1) = ',') DO SET s = LEFT(s, CHAR_LENGTH(s) - 1); END WHILE;
  RETURN TRIM(s);
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_padat$$
CREATE FUNCTION isian_rtf_alamat_padat(x LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AG: huruf kecil, hanya huruf a-z dan angka 0-9'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  DECLARE r LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE i INT DEFAULT 1;
  DECLARE n INT;
  DECLARE o INT;
  SET s = LOWER(IFNULL(x, ''));
  SET n = CHAR_LENGTH(s);
  WHILE i <= n DO
    SET o = ORD(SUBSTRING(s, i, 1));
    IF (o BETWEEN 97 AND 122) OR (o BETWEEN 48 AND 57) THEN SET r = CONCAT(r, SUBSTRING(s, i, 1)); END IF;
    SET i = i + 1;
  END WHILE;
  RETURN r;
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_kunci$$
CREATE FUNCTION isian_rtf_alamat_kunci(x LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AG: kunci nama tempat - satu sebutan tingkatan di depan dibuang, hanya huruf/angka kecil (Kota Pulu = Kotapulu)'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  DECLARE w VARCHAR(20) CHARSET latin1;
  DECLARE k INT DEFAULT 1;
  DECLARE l INT;
  SET s = LOWER(TRIM(IFNULL(x, '')));
  pfx: WHILE k <= 13 DO
    SET w = SUBSTRING_INDEX(SUBSTRING_INDEX('kabupaten/kota,kabupaten,kecamatan,kelurahan,provinsi,propinsi,desa,kab,kec,kel,prov,kota,ds', ',', k), ',', -1);
    SET l = CHAR_LENGTH(w);
    IF LEFT(s, l) = w AND (CHAR_LENGTH(s) = l OR NOT (SUBSTRING(s, l + 1, 1) REGEXP '[a-z0-9_]')) THEN
      SET s = SUBSTRING(s, l + 1);
      IF LEFT(s, 1) = '.' THEN SET s = SUBSTRING(s, 2); END IF;
      SET s = LTRIM(s);
      LEAVE pfx;
    END IF;
    SET k = k + 1;
  END WHILE;
  RETURN isian_rtf_alamat_padat(s);
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_tingkat$$
CREATE FUNCTION isian_rtf_alamat_tingkat(x LONGTEXT CHARSET latin1) RETURNS INT
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AG: potongan diawali sebutan tingkatan? 0 tidak, 1 desa/kelurahan, 2 kecamatan, 3 kabupaten/kota, 4 provinsi'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  DECLARE w VARCHAR(20) CHARSET latin1;
  DECLARE k INT DEFAULT 1;
  DECLARE l INT;
  SET s = LOWER(TRIM(IFNULL(x, '')));
  WHILE k <= 13 DO
    SET w = SUBSTRING_INDEX(SUBSTRING_INDEX('desa,kelurahan,kel,ds,kecamatan,kec,kabupaten,kabupaten/kota,kota,kab,provinsi,propinsi,prov', ',', k), ',', -1);
    SET l = CHAR_LENGTH(w);
    IF LEFT(s, l) = w AND SUBSTRING(s, l + 1) REGEXP '^[.]?[[:space:]]' THEN
      RETURN ELT(k, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4);
    END IF;
    SET k = k + 1;
  END WHILE;
  RETURN 0;
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_sah$$
CREATE FUNCTION isian_rtf_alamat_sah(x LONGTEXT CHARSET latin1) RETURNS INT
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AG: potongan berupa nama desa/kecamatan (bukan jalan, RT, RW, dusun, angka, surel)? 1 ya, 0 bukan'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  SET s = LOWER(TRIM(IFNULL(x, '')));
  IF s = '' OR CHAR_LENGTH(s) > 60 THEN RETURN 0; END IF;
  IF s REGEXP '[0-9@():/]' THEN RETURN 0; END IF;
  IF s REGEXP '^(desa|kelurahan|kel|ds|kecamatan|kec|kabupaten|kab|kota|provinsi|propinsi|prov)[.]?$' THEN RETURN 0; END IF;
  IF s REGEXP '^(rt|rw|dusun|dsn|dukuh|jalan|jl|jln|gang|gg|lorong|lrg|blok|komp|komplek|perum|perumahan|btn|no|nomor|lingkungan|lk|link)([^a-z0-9_]|$)' THEN RETURN 0; END IF;
  IF LOCATE('domisili', s) > 0 OR LOCATE('surel', s) > 0 OR LOCATE('email', s) > 0 THEN RETURN 0; END IF;
  RETURN 1;
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_provinsi$$
CREATE FUNCTION isian_rtf_alamat_provinsi(k VARCHAR(300) CHARSET latin1) RETURNS INT
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AG: kunci nama provinsi Indonesia? 1 ya, 0 bukan'
BEGIN
  RETURN IF(k IN ('aceh', 'sumaterautara', 'sumaterabarat', 'riau', 'jambi', 'sumateraselatan', 'bengkulu', 'lampung',
    'kepulauanbangkabelitung', 'bangkabelitung', 'kepulauanriau', 'dkijakarta', 'jakarta', 'jawabarat',
    'jawatengah', 'diyogyakarta', 'daerahistimewayogyakarta', 'yogyakarta', 'jawatimur', 'banten', 'bali',
    'nusatenggarabarat', 'nusatenggaratimur', 'kalimantanbarat', 'kalimantantengah', 'kalimantanselatan',
    'kalimantantimur', 'kalimantanutara', 'sulawesiutara', 'sulawesitengah', 'sulawesiselatan',
    'sulawesitenggara', 'gorontalo', 'sulawesibarat', 'maluku', 'malukuutara', 'papua', 'papuabarat',
    'papuaselatan', 'papuatengah', 'papuapegunungan', 'papuabaratdaya'), 1, 0);
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_mirip$$
CREATE FUNCTION isian_rtf_alamat_mirip(a VARCHAR(300) CHARSET latin1, b VARCHAR(300) CHARSET latin1) RETURNS INT
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AG: dua kunci nama tempat sama, saling memuat (>= 5 huruf), atau selisih satu huruf? 1 ya, 0 bukan'
BEGIN
  DECLARE la INT;
  DECLARE lb INT;
  DECLARE awal INT DEFAULT 0;
  DECLARE akhir INT DEFAULT 0;
  DECLARE pendek INT;
  SET la = CHAR_LENGTH(IFNULL(a, ''));
  SET lb = CHAR_LENGTH(IFNULL(b, ''));
  IF la = 0 OR lb = 0 THEN RETURN 0; END IF;
  IF BINARY a = BINARY b THEN RETURN 1; END IF;
  IF la >= 5 AND lb >= 5 AND (LOCATE(a, b) > 0 OR LOCATE(b, a) > 0) THEN RETURN 1; END IF;
  IF la < 5 OR ABS(la - lb) > 1 THEN RETURN 0; END IF;
  SET pendek = LEAST(la, lb);
  WHILE awal < pendek AND BINARY SUBSTRING(a, awal + 1, 1) = BINARY SUBSTRING(b, awal + 1, 1) DO SET awal = awal + 1; END WHILE;
  WHILE akhir < pendek - awal AND BINARY SUBSTRING(a, la - akhir, 1) = BINARY SUBSTRING(b, lb - akhir, 1) DO SET akhir = akhir + 1; END WHILE;
  RETURN IF(awal + akhir >= pendek - IF(la = lb, 1, 0), 1, 0);
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_ekor$$
CREATE FUNCTION isian_rtf_alamat_ekor(t LONGTEXT CHARSET latin1, modus INT) RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'AG: ekor wilayah sistem (desa, kecamatan, Kabupaten/Kota X, provinsi tanpa sebutan) disusun ulang; modus 1 = alamat hasil, modus 2 = "1" bila ekor sistem dikenali, selain itu "0"'
BEGIN
  DECLARE n INT;
  DECLARE i INT;
  DECLARE dsa VARCHAR(300) CHARSET latin1;
  DECLARE kec VARCHAR(300) CHARSET latin1;
  DECLARE kab VARCHAR(300) CHARSET latin1;
  DECLARE prv VARCHAR(300) CHARSET latin1;
  DECLARE it VARCHAR(600) CHARSET latin1;
  DECLARE kx VARCHAR(300) CHARSET latin1;
  DECLARE kk VARCHAR(300) CHARSET latin1;
  DECLARE kp VARCHAR(300) CHARSET latin1;
  DECLARE depan LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE low LONGTEXT CHARSET latin1;
  DECLARE padat LONGTEXT CHARSET latin1;
  DECLARE polos LONGTEXT CHARSET latin1 DEFAULT '|';
  DECLARE hasil LONGTEXT CHARSET latin1;
  DECLARE f_kab INT DEFAULT 0;
  DECLARE f_prv INT DEFAULT 0;
  DECLARE m_dsa INT;
  DECLARE m_kec INT;
  DECLARE m_kab INT;
  DECLARE m_prv INT;
  DECLARE jenis VARCHAR(10) CHARSET latin1;
  DECLARE kode CHAR(1) CHARSET latin1 DEFAULT NULL;
  DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET kode = NULL;
  SET t = IFNULL(t, '');
  SET n = IF(t = '', 0, CHAR_LENGTH(t) - CHAR_LENGTH(REPLACE(t, ',', '')) + 1);
  IF n < 4 THEN RETURN IF(modus = 2, '0', t); END IF;
  SET dsa = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(t, ',', n - 3), ',', -1));
  SET kec = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(t, ',', n - 2), ',', -1));
  SET kab = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(t, ',', n - 1), ',', -1));
  SET prv = TRIM(SUBSTRING_INDEX(t, ',', -1));
  IF isian_rtf_alamat_tingkat(dsa) <> 0 OR isian_rtf_alamat_tingkat(kec) <> 0 OR isian_rtf_alamat_sah(dsa) = 0 OR isian_rtf_alamat_sah(kec) = 0 THEN
    RETURN IF(modus = 2, '0', t);
  END IF;
  SET kp = isian_rtf_alamat_kunci(prv);
  IF isian_rtf_alamat_tingkat(kab) <> 3 OR isian_rtf_alamat_tingkat(prv) <> 0 OR isian_rtf_alamat_provinsi(kp) = 0 THEN
    RETURN IF(modus = 2, '0', t);
  END IF;
  SET kk = isian_rtf_alamat_kunci(kab);
  IF n > 4 THEN SET depan = SUBSTRING_INDEX(t, ',', n - 4); END IF;
  SET low = LOWER(depan);
  SET padat = isian_rtf_alamat_padat(depan);
  SET i = 1;
  WHILE i <= n - 4 DO
    SET it = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(depan, ',', i), ',', -1));
    SET kx = isian_rtf_alamat_kunci(it);
    IF isian_rtf_alamat_tingkat(it) = 0 THEN
      SET polos = CONCAT(polos, kx, '|');
    ELSEIF isian_rtf_alamat_tingkat(it) = 3 THEN
      IF isian_rtf_alamat_mirip(kx, kk) = 1 THEN SET f_kab = 1; END IF;
    ELSEIF isian_rtf_alamat_tingkat(it) = 4 THEN
      IF (CHAR_LENGTH(kx) >= 4 AND LEFT(kp, CHAR_LENGTH(kx)) = kx) OR isian_rtf_alamat_mirip(kx, kp) = 1 THEN SET f_prv = 1; END IF;
    END IF;
    SET i = i + 1;
  END WHILE;
  -- tingkatan yang sudah disebut di bagian depan (di mana saja pada teksnya) atau nama polos yang sama
  SET m_kab = IF(low REGEXP '[[:<:]](kabupaten|kab)[[:>:]][.]?[[:space:]]*[a-z]' OR low REGEXP '(^|,[[:space:]]*)kota[[:space:]]+[a-z]', 1, 0);
  SET m_prv = IF(low REGEXP '[[:<:]](provinsi|propinsi|prov)[[:>:]][.]?[[:space:]]*[a-z]', 1, 0);
  -- bentrok: kabupaten/provinsi yang diketik berbeda dari ekor = dibiarkan
  IF m_kab = 1 AND NOT ((CHAR_LENGTH(kk) >= 3 AND LOCATE(kk, padat) > 0) OR f_kab = 1) THEN RETURN IF(modus = 2, '0', t); END IF;
  IF m_prv = 1 AND NOT (LOCATE(kp, padat) > 0 OR f_prv = 1) THEN RETURN IF(modus = 2, '0', t); END IF;
  IF modus = 2 THEN RETURN '1'; END IF;
  SET m_dsa = IF(low REGEXP '[[:<:]](desa|kelurahan|kel|ds)[[:>:]][.]?[[:space:]]*[a-z]' OR LOCATE(CONCAT('|', isian_rtf_alamat_kunci(dsa), '|'), polos) > 0, 1, 0);
  SET m_kec = IF(low REGEXP '[[:<:]](kecamatan|kec)[[:>:]][.]?[[:space:]]*[a-z]' OR LOCATE(CONCAT('|', isian_rtf_alamat_kunci(kec), '|'), polos) > 0, 1, 0);
  IF m_kab = 0 AND LOCATE(CONCAT('|', kk, '|'), polos) > 0 THEN SET m_kab = 1; END IF;
  IF m_prv = 0 AND LOCATE(CONCAT('|', kp, '|'), polos) > 0 THEN SET m_prv = 1; END IF;
  SET hasil = depan;
  IF m_dsa = 0 THEN
    -- desa atau kelurahan: dibaca dari kode wilayah resmi (digit ke-10 kode kelurahan: 1 = kelurahan, 2 = desa); tak ketemu = Kota -> Kelurahan, selain itu Desa
    SET kode = NULL;
    SET kode = (SELECT SUBSTRING(l.kelurahan_kode, 10, 1) FROM SIPP.ref_kelurahan_new l
                  JOIN SIPP.ref_kecamatan_new c ON c.kecamatan_kode = l.kecamatan_kode
                  JOIN SIPP.ref_kabupaten_new g ON g.kabupaten_kode = c.kabupaten_kode
                 WHERE l.kelurahan_nama = CONVERT(dsa USING utf8mb4) AND c.kecamatan_nama = CONVERT(kec USING utf8mb4)
                   AND g.kabupaten_nama = CONVERT(kab USING utf8mb4) LIMIT 1);
    SET jenis = IF(kode = '1', 'Kelurahan', IF(kode = '2', 'Desa', IF(LOWER(kab) REGEXP '^kota([^a-z0-9_]|$)', 'Kelurahan', 'Desa')));
    SET hasil = IF(hasil = '', CONCAT(jenis, ' ', dsa), CONCAT(hasil, ', ', jenis, ' ', dsa));
  END IF;
  IF m_kec = 0 THEN SET hasil = IF(hasil = '', CONCAT('Kecamatan ', kec), CONCAT(hasil, ', Kecamatan ', kec)); END IF;
  IF m_kab = 0 THEN SET hasil = IF(hasil = '', kab, CONCAT(hasil, ', ', kab)); END IF;
  IF m_prv = 0 THEN SET hasil = IF(hasil = '', CONCAT('Provinsi ', prv), CONCAT(hasil, ', Provinsi ', prv)); END IF;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_inti$$
CREATE FUNCTION isian_rtf_alamat_inti(x LONGTEXT CHARSET latin1, modus INT) RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'AG: rapi, potongan kembar berurutan dibuang, ekor wilayah sistem; modus 1 = alamat, modus 2 = "1" bila ekor sistem dikenali'
BEGIN
  DECLARE t LONGTEXT CHARSET latin1;
  DECLARE r LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE it VARCHAR(600) CHARSET latin1;
  DECLARE ia VARCHAR(600) CHARSET latin1 DEFAULT NULL;
  DECLARE n INT;
  DECLARE i INT DEFAULT 1;
  SET t = isian_rtf_alamat_rapi(x);
  IF t = '' THEN RETURN IF(modus = 2, '0', ''); END IF;
  SET n = CHAR_LENGTH(t) - CHAR_LENGTH(REPLACE(t, ',', '')) + 1;
  WHILE i <= n DO
    SET it = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(t, ',', i), ',', -1));
    IF ia IS NULL OR LOWER(it) <> LOWER(ia) OR isian_rtf_alamat_tingkat(it) = 0 THEN SET r = IF(r = '', it, CONCAT(r, ', ', it)); END IF;
    SET ia = it;
    SET i = i + 1;
  END WHILE;
  IF modus = 2 THEN RETURN isian_rtf_alamat_ekor(r, 2); END IF;
  RETURN isian_rtf_alamat_rapi(isian_rtf_alamat_ekor(r, 1));
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat$$
CREATE FUNCTION isian_rtf_alamat(a LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'AG: alamat pihak tanpa ekor wilayah ganda (kembaran rapikanAlamat portal); domisili elektronik dipindah ke ujung; alamat yang sudah rapi tidak berubah'
BEGIN
  DECLARE c LONGTEXT CHARSET latin1;
  DECLARE kecil LONGTEXT CHARSET latin1;
  DECLARE kepala LONGTEXT CHARSET latin1;
  DECLARE sisa LONGTEXT CHARSET latin1;
  DECLARE sisa0 LONGTEXT CHARSET latin1;
  DECLARE lab LONGTEXT CHARSET latin1;
  DECLARE tok LONGTEXT CHARSET latin1;
  DECLARE ekor LONGTEXT CHARSET latin1;
  DECLARE gabung LONGTEXT CHARSET latin1;
  DECLARE sambung CHAR(1) CHARSET latin1 DEFAULT ',';
  DECLARE pos INT;
  DECLARE p INT;
  DECLARE ch VARCHAR(1) CHARSET latin1;
  SET c = isian_rtf_alamat_rapi(a);
  IF c = '' THEN RETURN ''; END IF;
  -- spasi tunggal untuk pencarian "domisili elektronik"; rapi() membuang titik/koma ujung sehingga dipakai bentuk yang hanya merapikan spasi
  SET c = TRIM(IFNULL(a, ''));
  SET c = REPLACE(REPLACE(REPLACE(REPLACE(c, CHAR(9 USING latin1), ' '), CHAR(10 USING latin1), ' '), CHAR(13 USING latin1), ' '), CHAR(160 USING latin1), ' ');
  SET c = REPLACE(c, CONVERT(UNHEX('C2A0') USING latin1), ' ');
  WHILE LOCATE('  ', c) > 0 DO SET c = REPLACE(c, '  ', ' '); END WHILE;
  SET kecil = LOWER(c);
  SET pos = LOCATE('domisili elektronik', kecil);
  IF pos > 0 THEN
    SET kepala = RTRIM(LEFT(c, pos - 1));
    SET sisa0 = SUBSTRING(c, pos + 19);
    SET sisa = LTRIM(sisa0);
    IF LEFT(sisa, 1) = ':' THEN SET sisa = LTRIM(SUBSTRING(sisa, 2)); END IF;
    -- label "Domisili elektronik :" dipertahankan apa adanya (huruf besar/kecil dan titik dua seperti diketik)
    SET lab = CONCAT(SUBSTRING(c, pos, 19), LEFT(sisa0, CHAR_LENGTH(sisa0) - CHAR_LENGTH(sisa)));
    -- kata "dengan" tepat di depan "domisili elektronik" bukan bagian wilayah
    IF LOWER(kepala) = 'dengan' THEN
      SET kepala = '';
    ELSEIF LOWER(RIGHT(kepala, 7)) = ' dengan' OR LOWER(RIGHT(kepala, 7)) = ',dengan' OR LOWER(RIGHT(kepala, 7)) = '.dengan' THEN
      SET kepala = RTRIM(LEFT(kepala, CHAR_LENGTH(kepala) - 6));
    END IF;
    -- satu tanda baca tepat sebelumnya ('.', ',' atau ';') menjadi penyambung
    IF RIGHT(kepala, 1) IN ('.', ',', ';') THEN
      SET sambung = IF(RIGHT(kepala, 1) = '.', '.', ',');
      SET kepala = RTRIM(LEFT(kepala, CHAR_LENGTH(kepala) - 1));
    END IF;
    -- surel: deretan huruf/angka/._%+-@ dari awal sisa, dipangkas sampai berakhir ".huruf huruf"
    IF kepala <> '' AND sisa REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z][A-Za-z]' THEN
      SET p = 1;
      SET tok = '';
      WHILE p <= CHAR_LENGTH(sisa) DO
        SET ch = SUBSTRING(sisa, p, 1);
        IF ch REGEXP '[A-Za-z0-9._%+@-]' AND NOT (ch = '@' AND LOCATE('@', tok) > 0) THEN SET tok = CONCAT(tok, ch); SET p = p + 1; ELSE SET p = CHAR_LENGTH(sisa) + 1; END IF;
      END WHILE;
      WHILE CHAR_LENGTH(tok) > 0 AND NOT (tok REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z][A-Za-z]+$') DO SET tok = LEFT(tok, CHAR_LENGTH(tok) - 1); END WHILE;
      IF tok <> '' THEN
        SET ekor = TRIM(SUBSTRING(sisa, CHAR_LENGTH(tok) + 1));
        IF ekor <> '' THEN
          SET gabung = CONCAT(kepala, ', ', ekor);
          IF isian_rtf_alamat_inti(gabung, 2) = '1' THEN
            RETURN CONCAT(isian_rtf_alamat_inti(gabung, 1), sambung, ' ', lab, tok);
          END IF;
        END IF;
        SET ekor = isian_rtf_alamat_rapi(ekor);
        RETURN CONCAT(isian_rtf_alamat_inti(kepala, 1), sambung, ' ', lab, tok, IF(ekor = '', '', CONCAT(', ', ekor)));
      END IF;
    END IF;
  END IF;
  RETURN isian_rtf_alamat_inti(c, 1);
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_utama$$
CREATE FUNCTION isian_rtf_pihak_utama(p_perkara BIGINT, p_sisi INT, p_dari INT, p_sebutan VARCHAR(100) CHARSET latin1, p_kediaman VARCHAR(200) CHARSET latin1)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'X9: identitas lengkap para pihak (sisi 1 = Pemohon/Penggugat, 2 = Termohon/Tergugat) mulai urutan p_dari sampai terakhir, satu pihak satu baris dipisah <br>, bentuk sama dengan 7047/7048'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_urutan INT;
  DECLARE v_nama, v_nik, v_tempat, v_agama, v_pekerjaan, v_pendidikan, v_alamat VARCHAR(600) CHARSET latin1;
  DECLARE v_tgl DATE;
  DECLARE c CURSOR FOR
    SELECT a.urutan, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat(a.alamat)
      FROM SIPP.perkara_pihak1 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 1 AND a.perkara_id = p_perkara AND a.urutan >= p_dari
    UNION ALL
    SELECT a.urutan, a.nama, b.nomor_indentitas, b.tempat_lahir, b.tanggal_lahir, g.nama, b.pekerjaan, d.kode, isian_rtf_alamat(a.alamat)
      FROM SIPP.perkara_pihak2 a
      LEFT JOIN SIPP.pihak b ON b.id = a.pihak_id
      LEFT JOIN SIPP.agama g ON g.id = b.agama_id
      LEFT JOIN SIPP.tingkat_pendidikan d ON d.id = b.pendidikan_id
     WHERE p_sisi = 2 AND a.perkara_id = p_perkara AND a.urutan >= p_dari
    ORDER BY 1;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_sisi NOT IN (1, 2) OR p_dari IS NULL THEN
    RETURN '';
  END IF;
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_nama, v_nik, v_tempat, v_tgl, v_agama, v_pekerjaan, v_pendidikan, v_alamat;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET hasil = CONCAT(hasil, IF(hasil = '', '', '<br>'),
      '<strong>', IFNULL(v_nama, ''), '</strong>, NIK ', IFNULL(v_nik, ''),
      ', tempat dan tanggal lahir ', IFNULL(v_tempat, ''), ', ', isian_rtf_tanggal(v_tgl),
      ', agama ', IFNULL(v_agama, ''), ', pekerjaan ', IFNULL(v_pekerjaan, ''), ', pendidikan ', IFNULL(v_pendidikan, ''),
      ', ', IFNULL(p_kediaman, ''), ' ', IFNULL(v_alamat, ''),
      ', sebagai <strong>', IFNULL(p_sebutan, ''), ' ', isian_rtf_romawi(v_urutan), '</strong>;');
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DROP FUNCTION IF EXISTS isian_rtf_pihak_tambahan$$
CREATE FUNCTION isian_rtf_pihak_tambahan(p_perkara BIGINT, p_tabel INT)
  RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'X9: identitas Turut Tergugat/Termohon (p_tabel 4, perkara_pihak4; bentuk sama dengan 8710) atau pihak intervensi (3, perkara_pihak3; bentuk sama dengan 7054), semua urutan, diawali <br>; kosong bila tidak ada'
BEGIN
  DECLARE hasil LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE selesai INT DEFAULT 0;
  DECLARE v_n INT DEFAULT 0;
  DECLARE v_rn INT DEFAULT 0;
  DECLARE v_s2 VARCHAR(20) CHARSET latin1 DEFAULT 'Tergugat';
  DECLARE v_urutan INT;
  DECLARE v_nama, v_alamat, v_jenis VARCHAR(600) CHARSET latin1;
  DECLARE v_nik, v_tempat, v_pekerjaan VARCHAR(600) CHARSET latin1;
  DECLARE v_tgl DATE;
  DECLARE v_agama_id INT;
  DECLARE v_sebut VARCHAR(700) CHARSET latin1;
  DECLARE c CURSOR FOR
    SELECT t.urutan, t.nama, isian_rtf_alamat(t.alamat), NULL, ph.nomor_indentitas, ph.tempat_lahir, ph.tanggal_lahir, ph.agama_id, ph.pekerjaan
      FROM SIPP.perkara_pihak4 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id
     WHERE p_tabel = 4 AND t.perkara_id = p_perkara
    UNION ALL
    SELECT t.urutan, t.nama, isian_rtf_alamat(t.alamat), t.jenis_intervensi_nama, ph.nomor_indentitas, ph.tempat_lahir, ph.tanggal_lahir, ph.agama_id, ph.pekerjaan
      FROM SIPP.perkara_pihak3 t LEFT JOIN SIPP.pihak ph ON ph.id = t.pihak_id
     WHERE p_tabel = 3 AND t.perkara_id = p_perkara
    ORDER BY 1;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET selesai = 1;
  IF p_perkara IS NULL OR p_tabel NOT IN (3, 4) THEN
    RETURN '';
  END IF;
  IF p_tabel = 4 THEN
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak4 WHERE perkara_id = p_perkara;
  ELSE
    SELECT COUNT(*) INTO v_n FROM SIPP.perkara_pihak3 WHERE perkara_id = p_perkara;
  END IF;
  IF v_n = 0 THEN
    RETURN '';
  END IF;
  SELECT IF(p.alur_perkara_id = 16 OR p.jenis_perkara_id IN (346, 341), 'Termohon', 'Tergugat') INTO v_s2 FROM SIPP.perkara p WHERE p.perkara_id = p_perkara;
  SET selesai = 0;   
  OPEN c;
  baca: LOOP
    FETCH c INTO v_urutan, v_nama, v_alamat, v_jenis, v_nik, v_tempat, v_tgl, v_agama_id, v_pekerjaan;
    IF selesai = 1 THEN
      LEAVE baca;
    END IF;
    SET v_rn = v_rn + 1;
    IF p_tabel = 4 THEN
      SET v_sebut = CONCAT('Turut ', IFNULL(v_s2, 'Tergugat'));
    ELSE
      SET v_sebut = IFNULL(NULLIF(TRIM(v_jenis), ''), 'Pihak Intervensi');
    END IF;
    SET hasil = CONCAT(hasil, '<br>',
      '<strong>', TRIM(IFNULL(v_nama, '')), '</strong>',
      IF(TRIM(IFNULL(v_nik, '')) = '' OR TRIM(v_nik) REGEXP '^[0 -]+$', '', CONCAT(', NIK ', TRIM(v_nik))),
      IF(TRIM(IFNULL(v_tempat, '')) = '' OR v_tgl IS NULL OR v_tgl < '1900-01-01', '', CONCAT(', tempat dan tanggal lahir ', TRIM(v_tempat), ', ', isian_rtf_tanggal(v_tgl))),
      IF(IFNULL(v_agama_id, 0) BETWEEN 1 AND 7, CONCAT(', agama ', ELT(v_agama_id, 'Islam','Protestan','Katolik','Budha','Hindu','Lainnya','Kong Hu Cu')), ''),
      IF(TRIM(IFNULL(v_pekerjaan, '')) = '', '', CONCAT(', pekerjaan ', TRIM(v_pekerjaan))),
      ', beralamat di ', TRIM(IFNULL(v_alamat, '')), ', sebagai <strong>', v_sebut,
      IF(v_n > 1, CONCAT(' ', isian_rtf_romawi(v_rn)), ''), '</strong>;');
  END LOOP;
  CLOSE c;
  RETURN hasil;
END$$

DELIMITER ;
