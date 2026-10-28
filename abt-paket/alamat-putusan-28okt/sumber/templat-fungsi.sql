-- =====================================================================================================
-- AP (28 Okt 2026): keterangan arah di dalam KURUNG pada alamat pihak ("Jalan Poros Palu-Bangga (rumah sesudah Jembatan / Kios X), Desa Poi")
-- hanya untuk juru sita; di PUTUSAN dibuang. Relaas TIDAK memakai fungsi ini (alamat tetap utuh dengan kurungnya).
-- Tiga fungsi baru, semuanya hanya MEMBACA argumen (isian_rtf_alamat_putusan juga membaca tabel referensi wilayah lewat isian_rtf_alamat):
--   isian_rtf_alamat_arah(isi)       : isi satu pasang kurung = petunjuk arah / penanda tempat (1, dibuang) atau bagian alamat/keterangan status (0, dipertahankan)
--   isian_rtf_alamat_buang_arah(x)   : membuang pasang kurung bertingkat-luar yang isinya petunjuk arah; spasi dan koma di sekitarnya dirapikan ("..., Desa Poi", bukan "Bangga , Desa")
--   isian_rtf_alamat_putusan(x)      : isian_rtf_alamat(isian_rtf_alamat_buang_arah(x)) - pengganti isian_rtf_alamat di variabel dan fungsi yang khusus putusan
-- Dipertahankan (bukan petunjuk): (GAIB), (RT/RW ...), (Dusun/Desa/Kelurahan/Kecamatan/Kabupaten/Kota/Provinsi ...), (Jl./Jalan/Gang ...), (Blok ...),
-- keterangan riwayat ("dahulu", "semula", "sesuai ..."), nama kompleks/perumahan/huntara/lapas, dan kurung yang tak berpasangan. Kurung tanpa kata petunjuk dibiarkan (aman: tidak ada yang hilang diam-diam).
-- Ditulis untuk MariaDB 5.5 (REGEXP tanpa batas-kata khusus). Komentar fungsi berawalan "AP:". Tanpa komentar "--" di badan fungsi (klien mysql membuangnya, md5 definisi dihitung tanpa komentar).
-- =====================================================================================================
DELIMITER $$

DROP FUNCTION IF EXISTS isian_rtf_alamat_arah$$
CREATE FUNCTION isian_rtf_alamat_arah(x LONGTEXT CHARSET latin1) RETURNS INT
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AP: isi satu pasang kurung pada alamat = petunjuk arah/penanda tempat yang dibuang di putusan? 1 ya, 0 bukan (GAIB, RT/RW, dusun/desa/jalan, riwayat, kompleks tetap)'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  SET s = LOWER(TRIM(IFNULL(x, '')));
  IF s REGEXP '^[^a-z0-9]*$' THEN RETURN 1; END IF;
  IF s REGEXP 'g[h]?aib' THEN RETURN 0; END IF;
  IF s REGEXP '^(rt|rw|dusun|dsn|dukuh|desa|kelurahan|kel|kecamatan|kec|kabupaten|kab|kota|provinsi|prov|jl|jln|jalan|gang|gg|lingkungan|lk|blok|dahulu|semula|awalnya|sekarang|sesuai|saat ini|tidak diketahui)([^a-z0-9]|$)' THEN RETURN 0; END IF;
  IF s REGEXP '(^|[^a-z0-9])((di)?rumah[a-z]*|sesudah|setelah|sebelum|sebelah|depan|didepan|deopan|belakang|dibelakang|samping|disamping|dekat|didekat|dekan|berdekatan|arah|kearah|masuk|lorong|lrg|dilorong|seberang|sebrang|atas|bawah|menuju|jurusan|sekitar|sekitaran|perbatasan|pertigaan|perempatan|tikungan|simpang|belok|meter|km|pinggir|cat|warna|dikenal|kiri|kanan)([^a-z0-9]|$)' THEN RETURN 1; END IF;
  IF s REGEXP '^(di|kios|koios|toko|warung|bengkel|salon|apotik|apotek|mesjid|masjid|mushollah|musholla|sd|sdn|smp|sma|mts|paud|tk|puskesmas|kantor|pasar|lapangan|jembatan|pabrik|gereja|polsek|sekolah|dealer|ruko|cafe|depot|tugu|tanggul|gudang|taman|dapur|foto|optik|spbu|madrasah|panti|ponpes|peternakan|pemotongan)([^a-z0-9]|$)' THEN RETURN 1; END IF;
  RETURN 0;
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_buang_arah$$
CREATE FUNCTION isian_rtf_alamat_buang_arah(x LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  DETERMINISTIC NO SQL SQL SECURITY INVOKER COMMENT 'AP: pasang kurung (bertingkat-luar) berisi petunjuk arah dibuang dari alamat pihak; spasi/koma sekitarnya dirapikan; kurung tak berpasangan dan bagian alamat dibiarkan; tanpa kurung = tidak berubah'
BEGIN
  DECLARE s LONGTEXT CHARSET latin1;
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE n INT DEFAULT 0;
  DECLARE i INT DEFAULT 1;
  DECLARE j INT DEFAULT 0;
  DECLARE k INT DEFAULT 0;
  DECLARE d INT DEFAULT 0;
  DECLARE akhir INT DEFAULT 0;
  DECLARE c VARCHAR(1) CHARSET latin1;
  DECLARE c2 VARCHAR(1) CHARSET latin1;
  IF x IS NULL THEN
    RETURN NULL;
  END IF;
  IF LOCATE('(', x) = 0 THEN
    RETURN x;
  END IF;
  SET s = x;
  SET n = CHAR_LENGTH(s);
  WHILE i <= n DO
    SET c = SUBSTRING(s, i, 1);
    IF c = '(' THEN
      SET d = 0;
      SET j = i;
      SET akhir = 0;
      WHILE j <= n AND akhir = 0 DO
        SET c2 = SUBSTRING(s, j, 1);
        IF c2 = '(' THEN
          SET d = d + 1;
        ELSEIF c2 = ')' THEN
          SET d = d - 1;
          IF d = 0 THEN
            SET akhir = j;
          END IF;
        END IF;
        IF akhir = 0 THEN
          SET j = j + 1;
        END IF;
      END WHILE;
      IF akhir > 0 THEN
        IF isian_rtf_alamat_arah(SUBSTRING(s, i + 1, akhir - i - 1)) = 1 THEN
          SET o = RTRIM(o);
          IF RIGHT(o, 1) = '(' THEN
            SET o = RTRIM(LEFT(o, CHAR_LENGTH(o) - 1));
          END IF;
          SET k = akhir + 1;
          WHILE k <= n AND SUBSTRING(s, k, 1) = ' ' DO
            SET k = k + 1;
          END WHILE;
          SET c2 = SUBSTRING(s, k, 1);
          IF c2 = ',' AND (o = '' OR RIGHT(o, 1) = ',') THEN
            SET k = k + 1;
            WHILE k <= n AND SUBSTRING(s, k, 1) = ' ' DO
              SET k = k + 1;
            END WHILE;
            SET c2 = SUBSTRING(s, k, 1);
          END IF;
          IF o <> '' AND c2 <> '' AND c2 NOT IN (',', '.', ';', ')') THEN
            SET o = CONCAT(o, ' ');
          END IF;
          SET i = k;
        ELSE
          SET o = CONCAT(o, SUBSTRING(s, i, akhir - i + 1));
          SET i = akhir + 1;
        END IF;
      ELSE
        SET o = CONCAT(o, c);
        SET i = i + 1;
      END IF;
    ELSE
      SET o = CONCAT(o, c);
      SET i = i + 1;
    END IF;
  END WHILE;
  RETURN o;
END$$

DROP FUNCTION IF EXISTS isian_rtf_alamat_putusan$$
CREATE FUNCTION isian_rtf_alamat_putusan(x LONGTEXT CHARSET latin1) RETURNS LONGTEXT CHARSET latin1
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'AP: alamat pihak untuk PUTUSAN = isian_rtf_alamat tanpa petunjuk arah dalam kurung (relaas memakai isian_rtf_alamat, kurung tetap)'
BEGIN
  RETURN isian_rtf_alamat(isian_rtf_alamat_buang_arah(x));
END$$

DELIMITER ;
