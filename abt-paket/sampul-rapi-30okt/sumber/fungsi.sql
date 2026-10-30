-- Paket ABT "abt-sampul-rapi-30okt": fungsi tersimpan tabel RTF blangko berkas perkara Derry (daftar isi, ceklist, lampiran sampul).
-- Fungsi mengembalikan BARIS TABEL RTF sungguhan (\trowd ... \row). ABT mencetak kode RTF dari kueri variabel apa adanya (TemplateHelper
-- hanya membuang tag HTML); mesin variabel portal mempertahankan kata kendali RTF dari rumus data_sql. Karena itu keluaran: tanpa kurung kurawal,
-- tanpa titik koma, tanpa dua spasi berurutan, tanpa baris baru (aturan pembersih ABT), dan diakhiri paragraf biasa (\pard) agar \par blangko
-- sesudahnya tidak masuk tabel.
-- Penanda nama basis: SIPP. = basis SIPP, aps_badilag. = basis ABT (pasang-satker.sh menggantinya). MariaDB 5.5: kursor, tanpa CTE/fungsi jendela.
-- Tidak ada nama aplikasi di nama fungsi, isi, maupun komentar fungsi.

DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_teks_sel;
DELIMITER $$
CREATE FUNCTION aps_badilag.isian_rtf_teks_sel(x TEXT) RETURNS TEXT CHARSET latin1
    NO SQL DETERMINISTIC SQL SECURITY INVOKER
    COMMENT 'teks aman untuk sel tabel RTF: tanpa garis miring terbalik, kurung kurawal, titik koma, tab, baris baru, spasi ganda'
BEGIN
  DECLARE t TEXT CHARSET latin1;
  SET t = IFNULL(x, '');
  SET t = REPLACE(REPLACE(REPLACE(REPLACE(t, '\\', '/'), '{', '('), '}', ')'), ';', ',');
  SET t = REPLACE(REPLACE(REPLACE(t, CHAR(13), ' '), CHAR(10), ' '), CHAR(9), ' ');
  SET t = REPLACE(REPLACE(REPLACE(t, '<', '('), '>', ')'), '&nbsp', ' ');
  WHILE LOCATE('  ', t) > 0 DO
    SET t = REPLACE(t, '  ', ' ');
  END WHILE;
  RETURN TRIM(t);
END$$
DELIMITER ;

DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_baris_tabel;
DELIMITER $$
CREATE FUNCTION aps_badilag.isian_rtf_baris_tabel(lebar INT, pola VARCHAR(200), isi LONGTEXT, tinggi INT, fs INT, tebal INT, latar INT, kepala INT)
    RETURNS LONGTEXT CHARSET latin1
    NO SQL DETERMINISTIC SQL SECURITY INVOKER
    COMMENT 'satu baris tabel RTF: pola = lebar relatif sel berawalan rata (l/c/r) dipisah koma, isi = teks sel (sudah aman) dipisah CHAR(31)'
BEGIN
  DECLARE n INT;
  DECLARE k INT DEFAULT 1;
  DECLARE total INT DEFAULT 0;
  DECLARE kum INT DEFAULT 0;
  DECLARE w INT;
  DECLARE x INT;
  DECLARE spec VARCHAR(20) CHARSET latin1;
  DECLARE garis VARCHAR(120) CHARSET latin1 DEFAULT '\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10';
  DECLARE defs LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE sel LONGTEXT CHARSET latin1 DEFAULT '';
  SET n = 1 + LENGTH(pola) - LENGTH(REPLACE(pola, ',', ''));
  WHILE k <= n DO
    SET total = total + SUBSTRING(SUBSTRING_INDEX(SUBSTRING_INDEX(pola, ',', k), ',', -1), 2) + 0;
    SET k = k + 1;
  END WHILE;
  SET k = 1;
  WHILE k <= n DO
    SET spec = SUBSTRING_INDEX(SUBSTRING_INDEX(pola, ',', k), ',', -1);
    SET w = SUBSTRING(spec, 2) + 0;
    SET kum = kum + w;
    SET x = IF(k = n, lebar, ROUND(lebar * kum / total));
    SET defs = CONCAT(defs, IF(latar > 0, CONCAT('\\clcbpat', latar), ''), garis, '\\clvertalc\\cellx', x);
    SET sel = CONCAT(sel, '\\pard\\plain\\intbl\\q', LEFT(spec, 1), '\\f0\\fs', fs, IF(tebal = 1, '\\b', ''), '\\sb20\\sa20 ',
                     IF(k = 1 AND n = 1, isi, SUBSTRING_INDEX(SUBSTRING_INDEX(isi, CHAR(31), k), CHAR(31), -1)), '\\cell');
    SET k = k + 1;
  END WHILE;
  RETURN CONCAT('\\trowd\\trgaph70\\trleft0\\trkeep', IF(kepala = 1, '\\trhdr', ''), IF(tinggi > 0, CONCAT('\\trrh', tinggi), ''), defs, sel, '\\row ');
END$$
DELIMITER ;

-- ============================================================================================================================
-- DAFTAR ISI: baris dokumen dari isian_rtf_daftar_isi (paket sampul-daftar-isi-26okt; satu sumber), judul bagian berlatar, baris kosong
-- sampai `baris` (memenuhi halaman; untuk dokumen tambahan tulisan tangan). Kolom halaman kosong (diisi saat dijilid; lewat panel: otomatis).
-- ============================================================================================================================
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_tabel_daftar_isi;
DELIMITER $$
CREATE FUNCTION aps_badilag.isian_rtf_tabel_daftar_isi(pid INT, bundel CHAR(1), lebar INT, baris INT) RETURNS LONGTEXT CHARSET latin1
    READS SQL DATA SQL SECURITY INVOKER
    COMMENT 'daftar isi berkas: tabel RTF NO, JENIS SURAT / DOKUMEN, TANGGAL, HALAMAN; baris kosong sampai jumlah baris'
BEGIN
  DECLARE c1 LONGTEXT CHARSET latin1;
  DECLARE c2 LONGTEXT CHARSET latin1;
  DECLARE c3 LONGTEXT CHARSET latin1;
  DECLARE n INT DEFAULT 0;
  DECLARE i INT DEFAULT 1;
  DECLARE jml INT DEFAULT 0;
  DECLARE x2 VARCHAR(300) CHARSET latin1;
  DECLARE pola VARCHAR(60) CHARSET latin1 DEFAULT 'c600,l6100,l2150,c1600';
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  SET c1 = IFNULL(aps_badilag.isian_rtf_daftar_isi(pid, bundel, 1), '');
  SET c2 = IFNULL(aps_badilag.isian_rtf_daftar_isi(pid, bundel, 2), '');
  SET c3 = IFNULL(aps_badilag.isian_rtf_daftar_isi(pid, bundel, 3), '');
  IF c2 <> '' THEN
    SET n = 1 + (LENGTH(c2) - LENGTH(REPLACE(c2, '<br>', ''))) / 4;
  END IF;
  SET o = aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT('NO', CHAR(31), 'JENIS SURAT / DOKUMEN', CHAR(31), 'TANGGAL', CHAR(31), 'HALAMAN'), 380, 16, 1, 2, 1);
  WHILE i <= n DO
    SET x2 = SUBSTRING_INDEX(SUBSTRING_INDEX(c2, '<br>', i), '<br>', -1);
    IF x2 LIKE '<b>%' THEN
      SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, 'l1', aps_badilag.isian_rtf_teks_sel(REPLACE(REPLACE(x2, '<b>', ''), '</b>', '')), 360, 17, 1, 3, 0));
    ELSE
      SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola,
        CONCAT(aps_badilag.isian_rtf_teks_sel(SUBSTRING_INDEX(SUBSTRING_INDEX(c1, '<br>', i), '<br>', -1)), CHAR(31),
               aps_badilag.isian_rtf_teks_sel(x2), CHAR(31),
               aps_badilag.isian_rtf_teks_sel(SUBSTRING_INDEX(SUBSTRING_INDEX(c3, '<br>', i), '<br>', -1)), CHAR(31), ''), 400, 19, 0, 0, 0));
    END IF;
    SET jml = jml + 1;
    SET i = i + 1;
  END WHILE;
  IF n = 0 THEN
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, 'l1', 'Belum ada dokumen yang tercatat di SIPP', 400, 19, 0, 0, 0));
    SET jml = 1;
  END IF;
  WHILE jml < baris DO
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT('', CHAR(31), '', CHAR(31), '', CHAR(31), ''), 400, 19, 0, 0, 0));
    SET jml = jml + 1;
  END WHILE;
  RETURN CONCAT(o, '\\pard\\plain\\f0\\fs4 ');
END$$
DELIMITER ;

-- ============================================================================================================================
-- CEKLIST BERKAS (Meja I): dokumen menurut jenis dan keadaan perkara (kembaran lib/ceklist-berkas.ts portal tanpa judul dokumen e-Court).
-- ADA / TIDAK ADA otomatis (tanda OTO) HANYA dari sumber pasti: penetapan awal (perkara_penetapan) dan kasir (panjar). Selebihnya kosong
-- untuk dicentang petugas. Baris kosong TAMBAHAN sampai `baris`.
-- ============================================================================================================================
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_tabel_ceklist;
DELIMITER $$
CREATE FUNCTION aps_badilag.isian_rtf_tabel_ceklist(pid INT, lebar INT, baris INT) RETURNS LONGTEXT CHARSET latin1
    READS SQL DATA SQL SECURITY INVOKER
    COMMENT 'ceklist berkas Meja I: tabel RTF dokumen per jenis perkara; ada/tidak ada otomatis dari penetapan dan kasir'
BEGIN
  DECLARE jenis INT DEFAULT 0;
  DECLARE alur INT DEFAULT 0;
  DECLARE prodeo INT DEFAULT 0;
  DECLARE kuasa INT DEFAULT 0;
  DECLARE anak INT DEFAULT 0;
  DECLARE pns INT DEFAULT 0;
  DECLARE ghaib INT DEFAULT 0;
  DECLARE cerai INT DEFAULT 0;
  DECLARE lawan INT DEFAULT 1;
  DECLARE panjar DECIMAL(15,2) DEFAULT 0;
  DECLARE tpanjar DATE DEFAULT NULL;
  DECLARE tpmh DATE DEFAULT NULL;
  DECLARE tppp DATE DEFAULT NULL;
  DECLARE tpjs DATE DEFAULT NULL;
  DECLARE tphs DATE DEFAULT NULL;
  DECLARE sp VARCHAR(12) CHARSET latin1;
  DECLARE pola VARCHAR(60) CHARSET latin1 DEFAULT 'c560,l4500,c1100,c700,c800,l2806';
  DECLARE ya VARCHAR(30) CHARSET latin1 DEFAULT '\\f1\\b\\u10003?';
  DECLARE tidak VARCHAR(30) CHARSET latin1 DEFAULT '\\f1\\b\\u10007?';
  DECLARE no INT DEFAULT 0;
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE S CHAR(1) CHARSET latin1 DEFAULT CHAR(31);
  SELECT IFNULL(p.jenis_perkara_id, 0), IFNULL(p.alur_perkara_id, 0), IF(IFNULL(p.prodeo, 0) = 1, 1, 0) INTO jenis, alur, prodeo FROM SIPP.perkara p WHERE p.perkara_id = pid;
  SET cerai = IF(jenis IN (346, 347), 1, 0);
  SET lawan = IF(alur = 16, 0, 1);
  SET sp = IF(lawan = 1 AND jenis <> 346, 'Penggugat', 'Pemohon');
  SELECT COUNT(*) INTO kuasa FROM SIPP.perkara_pengacara k WHERE k.perkara_id = pid AND k.aktif = 'Y';
  SELECT COUNT(*) INTO anak FROM SIPP.perkara_anak_pihak a WHERE a.perkara_id = pid AND TRIM(IFNULL(a.nama_anak, '')) <> '';
  SELECT COUNT(*) INTO pns FROM SIPP.perkara_pihak1 a JOIN SIPP.pihak b ON b.id = a.pihak_id
    WHERE a.perkara_id = pid AND (b.pekerjaan LIKE '%PNS%' OR b.pekerjaan LIKE '%Pegawai Negeri%' OR b.pekerjaan LIKE '%TNI%' OR b.pekerjaan LIKE '%POLRI%' OR b.pekerjaan LIKE '%Polisi%');
  SELECT pns + COUNT(*) INTO pns FROM SIPP.perkara_pihak2 a JOIN SIPP.pihak b ON b.id = a.pihak_id
    WHERE a.perkara_id = pid AND (b.pekerjaan LIKE '%PNS%' OR b.pekerjaan LIKE '%Pegawai Negeri%' OR b.pekerjaan LIKE '%TNI%' OR b.pekerjaan LIKE '%POLRI%' OR b.pekerjaan LIKE '%Polisi%');
  SELECT COUNT(*) INTO ghaib FROM SIPP.perkara_pihak2 a WHERE a.perkara_id = pid AND (a.alamat LIKE '%tidak diketahui%' OR a.alamat LIKE '%ghaib%' OR a.alamat LIKE '%gaib%');
  SELECT IFNULL(SUM(b.jumlah), 0), MIN(b.tanggal_transaksi) INTO panjar, tpanjar FROM SIPP.perkara_biaya b WHERE b.perkara_id = pid AND b.kategori_id = 1 AND b.jenis_transaksi = 1;
  SELECT e.penetapan_majelis_hakim, e.penetapan_panitera_pengganti, e.penetapan_jurusita, e.penetapan_hari_sidang INTO tpmh, tppp, tpjs, tphs
    FROM SIPP.perkara_penetapan e WHERE e.perkara_id = pid LIMIT 1;

  SET o = aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT('NO', S, 'JENIS SURAT / DOKUMEN', S, 'SIFAT', S, 'ADA', S, 'TIDAK ADA', S, 'SUMBER / KETERANGAN'), 380, 15, 1, 2, 1);
  -- PENDAFTARAN
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, 'l1', 'PENDAFTARAN', 340, 16, 1, 3, 0));
  SET no = no + 1;
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Surat ', IF(lawan = 1 AND jenis <> 346, 'Gugatan', 'Permohonan'), S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
  SET no = no + 1;
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Surat Kuasa Untuk Membayar (SKUM)', S, 'WAJIB', S,
      IF(panjar > 0, ya, ''), S, IF(panjar > 0 OR prodeo = 1, '', tidak), S,
      IF(panjar > 0, CONCAT('kasir: panjar Rp ', REPLACE(FORMAT(panjar, 0), ',', '.'), ' OTO'), IF(prodeo = 1, 'prodeo: tanpa panjar - diperiksa petugas', 'kasir: belum tercatat OTO'))), 400, 18, 0, 0, 0));
  SET no = no + 1;
  IF prodeo = 1 THEN
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Surat Keterangan Tidak Mampu (SKTM) / Kartu Indonesia Sehat', S, 'WAJIB', S, '', S, '', S, 'prodeo: diperiksa petugas'), 400, 18, 0, 0, 0));
  ELSE
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Bukti Setor Panjar Biaya Perkara', S, 'WAJIB', S,
        IF(panjar > 0, ya, ''), S, IF(panjar > 0, '', tidak), S,
        IF(panjar > 0, CONCAT('kasir: ', DAY(tpanjar), ' ', ELT(MONTH(tpanjar), 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'), ' ', YEAR(tpanjar), ' OTO'), 'kasir: belum ada setoran OTO')), 400, 18, 0, 0, 0));
  END IF;
  IF kuasa > 0 THEN
    SET no = no + 1;
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Surat Kuasa Khusus', S, 'WAJIB', S, ya, S, '', S, 'SIPP: kuasa terdaftar OTO'), 400, 18, 0, 0, 0));
    SET no = no + 1;
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Kartu Advokat dan Berita Acara Sumpah', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
  END IF;
  -- PENETAPAN AWAL
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, 'l1', 'PENETAPAN AWAL', 340, 16, 1, 3, 0));
  SET no = no + 1;
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Penetapan Majelis Hakim (PMH)', S, 'WAJIB', S, IF(tpmh IS NULL, '', ya), S, IF(tpmh IS NULL, tidak, ''), S, IF(tpmh IS NULL, 'belum terbit di SIPP OTO', CONCAT('SIPP: PMH ', DATE_FORMAT(tpmh, '%d-%m-%Y'), ' OTO'))), 400, 18, 0, 0, 0));
  SET no = no + 1;
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Penunjukan Panitera Pengganti (PP)', S, 'WAJIB', S, IF(tppp IS NULL, '', ya), S, IF(tppp IS NULL, tidak, ''), S, IF(tppp IS NULL, 'belum terbit di SIPP OTO', CONCAT('SIPP: PPP ', DATE_FORMAT(tppp, '%d-%m-%Y'), ' OTO'))), 400, 18, 0, 0, 0));
  SET no = no + 1;
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Penunjukan Jurusita / Jurusita Pengganti', S, 'WAJIB', S, IF(tpjs IS NULL, '', ya), S, IF(tpjs IS NULL, tidak, ''), S, IF(tpjs IS NULL, 'belum terbit di SIPP OTO', CONCAT('SIPP: PJS ', DATE_FORMAT(tpjs, '%d-%m-%Y'), ' OTO'))), 400, 18, 0, 0, 0));
  SET no = no + 1;
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Penetapan Hari Sidang (PHS)', S, 'WAJIB', S, IF(tphs IS NULL, '', ya), S, IF(tphs IS NULL, tidak, ''), S, IF(tphs IS NULL, 'belum terbit di SIPP OTO', CONCAT('SIPP: PHS ', DATE_FORMAT(tphs, '%d-%m-%Y'), ' OTO'))), 400, 18, 0, 0, 0));
  -- IDENTITAS DAN BUKTI AWAL
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, 'l1', 'IDENTITAS DAN BUKTI AWAL', 340, 16, 1, 3, 0));
  SET no = no + 1;
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Fotokopi KTP ', sp, S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
  IF cerai = 1 OR jenis IN (360, 365) THEN
    SET no = no + 1;
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Fotokopi Kutipan Akta Nikah / Buku Nikah', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
  END IF;
  IF jenis <> 370 THEN
    SET no = no + 1;
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Fotokopi Kartu Keluarga', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
  END IF;
  IF cerai = 1 THEN
    SET no = no + 1;
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Buku Nikah Asli (dokumen fisik)', S, 'WAJIB', S, '', S, '', S, 'diserahkan di Meja I'), 400, 18, 0, 0, 0));
    IF pns > 0 THEN
      SET no = no + 1;
      SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Surat Izin / Keterangan Atasan (PNS/TNI/Polri)', S, 'WAJIB', S, '', S, '', S, 'pihak PNS/TNI/Polri - diperiksa petugas'), 400, 18, 0, 0, 0));
    END IF;
    IF ghaib > 0 THEN
      SET no = no + 1;
      SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Surat Keterangan Ghaib dari Kepala Desa/Lurah', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    END IF;
    IF anak > 0 THEN
      SET no = no + 1;
      SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, 'Fotokopi Akta Kelahiran Anak', S, 'BILA ADA', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    END IF;
  END IF;
  -- dokumen khas jenis perkara (sama dengan KHAS di lib/ceklist-berkas.ts)
  IF jenis = 362 THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Surat Penolakan Pencatatan Nikah dari KUA', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Fotokopi Akta Kelahiran Anak dan Calon Pasangan', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 3, S, 'Fotokopi KTP / KK Calon Pasangan dan Orang Tuanya', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 4, S, 'Surat Keterangan Sehat / Rekomendasi Konseling', S, 'BILA ADA', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 4;
  ELSEIF jenis = 360 THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Surat Keterangan KUA (pernikahan tidak tercatat)', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Surat Keterangan Kepala Desa tentang Pernikahan', S, 'BILA ADA', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 2;
  ELSEIF jenis IN (364, 371) THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Surat Keterangan Kematian Pewaris', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Silsilah / Keterangan Ahli Waris dari Desa', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 3, S, IF(jenis = 364, 'Bukti Kepemilikan Harta Waris (sertifikat, BPKB)', 'Bukti Peninggalan (tabungan, sertifikat, BPKB)'), S, 'BILA ADA', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 3;
  ELSEIF jenis = 348 THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Akta Cerai / Putusan Cerai', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Bukti Kepemilikan Objek Harta Bersama', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 2;
  ELSEIF jenis = 358 THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Akta / Surat Keterangan Kelahiran Anak', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Surat Keterangan Bidan / Rumah Sakit', S, 'BILA ADA', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 2;
  ELSEIF jenis = 354 THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Surat Keterangan Kematian Orang Tua Anak', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Kartu Keluarga Anak dan Calon Wali', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 2;
  ELSEIF jenis = 363 THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Surat Penolakan KUA (wali enggan menikahkan)', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Keterangan Calon Mempelai dan Wali', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 2;
  ELSEIF jenis = 341 THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Surat Persetujuan Istri', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Keterangan Penghasilan Pemohon', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 3, S, 'Surat Pernyataan Berlaku Adil', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 3;
  ELSEIF jenis = 370 THEN
    SET o = CONCAT(o,
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 1, S, 'Akad / Perjanjian Pembiayaan', S, 'WAJIB', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0),
      aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no + 2, S, 'Surat Peringatan (Somasi)', S, 'BILA ADA', S, '', S, '', S, 'diperiksa petugas'), 400, 18, 0, 0, 0));
    SET no = no + 2;
  END IF;
  -- TAMBAHAN (ditulis tangan): sekurang-kurangnya 4 baris, lalu sampai `baris`
  SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, 'l1', 'TAMBAHAN (DITULIS TANGAN)', 340, 16, 1, 3, 0));
  SET jenis = 0;
  WHILE jenis < 4 OR no < baris DO
    SET no = no + 1;
    SET jenis = jenis + 1;
    SET o = CONCAT(o, aps_badilag.isian_rtf_baris_tabel(lebar, pola, CONCAT(no, S, '', S, '', S, '', S, '', S, ''), 400, 18, 0, 0, 0));
  END WHILE;
  RETURN CONCAT(o, '\\pard\\plain\\f0\\fs4 ');
END$$
DELIMITER ;

-- ============================================================================================================================
-- LAMPIRAN SAMPUL CETAK AWAL - hanya bila perlu (keputusan Derry 26 Okt, versi 7): kaki rujukan lampiran + halaman lampiran.
--   muat = nama per sisi yang tampil di varian sampul (1 berlawanan, 2 permohonan, 8 pihak banyak, 12 permohonan pihak banyak)
--   1. DAFTAR PARA PIHAK  pihak I/II melebihi muat, ada intervensi, turut tergugat lebih dari 3 (varian biasa: ada turut tergugat)
--   2. DAFTAR OBJEK SENGKETA  objek (baris teks SIPP) lebih dari 2 - hanya kewarisan, harta bersama, ekonomi syariah, ahli waris
--   3. DAFTAR ANAK  anak lebih dari 3 (1-3 anak sebaris di sampul)
--   4. RIWAYAT SIDANG (LANJUTAN)  sidang melebihi baris riwayat sampul
-- Tanpa yang perlu = '' (sampul satu lembar). Lampiran alasan (deteksi posita) hanya lewat panel.
-- ============================================================================================================================
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_lampiran_sampul;
DELIMITER $$
CREATE FUNCTION aps_badilag.isian_rtf_lampiran_sampul(pid INT, lebar INT, baris_riwayat INT, muat INT) RETURNS LONGTEXT CHARSET latin1
    READS SQL DATA SQL SECURITY INVOKER
    COMMENT 'lampiran sampul cetak awal hanya bila perlu: pihak, objek sengketa, anak, riwayat sidang lanjutan'
BEGIN
  DECLARE habis INT DEFAULT 0;
  DECLARE jenis INT DEFAULT 0;
  DECLARE alur INT DEFAULT 0;
  DECLARE nomor VARCHAR(100) CHARSET latin1 DEFAULT '';
  DECLARE mohon INT DEFAULT 0;
  DECLARE p1 INT DEFAULT 0;
  DECLARE p2 INT DEFAULT 0;
  DECLARE p3 INT DEFAULT 0;
  DECLARE p4 INT DEFAULT 0;
  DECLARE na INT DEFAULT 0;
  DECLARE ns INT DEFAULT 0;
  DECLARE nob INT DEFAULT 0;
  DECLARE ob LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE i INT;
  DECLARE j INT;
  DECLARE t TEXT CHARSET latin1;
  DECLARE nl INT DEFAULT 0;
  DECLARE perlu_pihak INT DEFAULT 0;
  DECLARE nlamp INT DEFAULT 0;
  DECLARE kaki LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE isi LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE xs INT;
  DECLARE xu INT;
  DECLARE xn VARCHAR(500) CHARSET latin1;
  DECLARE xa VARCHAR(500) CHARSET latin1;
  DECLARE xt DATE;
  DECLARE xd INT;
  DECLARE xg VARCHAR(500) CHARSET latin1;
  DECLARE xl VARCHAR(500) CHARSET latin1;
  DECLARE sisi_lama INT DEFAULT 0;
  DECLARE S CHAR(1) CHARSET latin1 DEFAULT CHAR(31);
  DECLARE BLN VARCHAR(120) CHARSET latin1 DEFAULT 'Januari,Februari,Maret,April,Mei,Juni,Juli,Agustus,September,Oktober,November,Desember';
  DECLARE cpihak CURSOR FOR
    SELECT x.s, x.nama, x.alamat FROM (
      SELECT 1 AS s, a.urutan AS u, a.id AS i, a.nama, a.alamat FROM SIPP.perkara_pihak1 a WHERE a.perkara_id = pid
      UNION ALL SELECT 2, a.urutan, a.id, a.nama, a.alamat FROM SIPP.perkara_pihak2 a WHERE a.perkara_id = pid
      UNION ALL SELECT 3, a.urutan, a.id, a.nama, a.alamat FROM SIPP.perkara_pihak3 a WHERE a.perkara_id = pid
      UNION ALL SELECT 4, a.urutan, a.id, a.nama, a.alamat FROM SIPP.perkara_pihak4 a WHERE a.perkara_id = pid) x
    ORDER BY x.s, IFNULL(x.u, 0), x.i;
  DECLARE canak CURSOR FOR
    SELECT a.nama_anak, a.tanggal_lahir, IFNULL(a.diasuh_oleh, 0) FROM SIPP.perkara_anak_pihak a
     WHERE a.perkara_id = pid AND TRIM(IFNULL(a.nama_anak, '')) <> '' ORDER BY a.anak_ke, a.id;
  DECLARE csidang CURSOR FOR
    SELECT s.tanggal_sidang, IFNULL(s.dihadiri_oleh, 0), CONCAT(IFNULL(s.agenda, ''), IF(s.sidang_keliling = 'Y', ' (sidang keliling)', '')), IFNULL(s.alasan_ditunda, '')
      FROM SIPP.perkara_jadwal_sidang s WHERE s.perkara_id = pid AND IFNULL(s.ikrar_talak, 'T') <> 'Y' ORDER BY s.tanggal_sidang, s.id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET habis = 1;

  SELECT IFNULL(p.jenis_perkara_id, 0), IFNULL(p.alur_perkara_id, 0), IFNULL(p.nomor_perkara, '') INTO jenis, alur, nomor FROM SIPP.perkara p WHERE p.perkara_id = pid;
  SET habis = 0;
  SET mohon = IF(alur = 16 OR jenis = 346, 1, 0);
  SELECT COUNT(*) INTO p1 FROM SIPP.perkara_pihak1 WHERE perkara_id = pid;
  SELECT COUNT(*) INTO p2 FROM SIPP.perkara_pihak2 WHERE perkara_id = pid;
  SELECT COUNT(*) INTO p3 FROM SIPP.perkara_pihak3 WHERE perkara_id = pid;
  SELECT COUNT(*) INTO p4 FROM SIPP.perkara_pihak4 WHERE perkara_id = pid;
  SELECT COUNT(*) INTO na FROM SIPP.perkara_anak_pihak WHERE perkara_id = pid AND TRIM(IFNULL(nama_anak, '')) <> '';
  SELECT COUNT(*) INTO ns FROM SIPP.perkara_jadwal_sidang WHERE perkara_id = pid AND IFNULL(ikrar_talak, 'T') <> 'Y';
  -- objek sengketa: baris tidak kosong dari teks bebas SIPP (hanya perkara harta)
  IF jenis IN (348, 364, 370, 371) THEN
    SELECT IFNULL(MAX(o.obyek_gugatan), '') INTO ob FROM SIPP.perkara_obyek_sengketa o WHERE o.perkara_id = pid;
    SET habis = 0;
    SET ob = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ob, '<br />', CHAR(10)), '<br/>', CHAR(10)), '<br>', CHAR(10)), '</p>', CHAR(10)), '</li>', CHAR(10)), CHAR(13), '');
    -- buang tag HTML lain
    SET i = LOCATE('<', ob);
    WHILE i > 0 DO
      SET j = LOCATE('>', ob, i);
      IF j = 0 THEN SET j = i; END IF;
      SET ob = CONCAT(LEFT(ob, i - 1), SUBSTRING(ob, j + 1));
      SET i = LOCATE('<', ob);
    END WHILE;
    SET nl = 1 + LENGTH(ob) - LENGTH(REPLACE(ob, CHAR(10), ''));
    SET i = 1;
    WHILE i <= nl DO
      SET t = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(ob, CHAR(10), i), CHAR(10), -1));
      IF t <> '' AND t NOT REGEXP '^[-.0 ]*$' THEN SET nob = nob + 1; END IF;
      SET i = i + 1;
    END WHILE;
  END IF;
  SET perlu_pihak = IF(p1 > muat OR p2 > muat OR p3 > 0 OR p4 > 3 OR (muat < 8 AND p4 > 0), 1, 0);

  -- ---- 1. DAFTAR PARA PIHAK
  IF perlu_pihak = 1 THEN
    SET nlamp = nlamp + 1;
    SET kaki = CONCAT(kaki, IF(nlamp > 1, ' - ', ''), nlamp, '. Daftar Para Pihak');
    SET isi = CONCAT(isi, '\\par\\pard\\plain\\pagebb\\qc\\f0\\fs26\\b\\sa40 LAMPIRAN ', nlamp, ' - DAFTAR PARA PIHAK\\par\\pard\\plain\\qc\\f0\\fs19\\sa20 Perkara Nomor ',
      aps_badilag.isian_rtf_teks_sel(nomor), '\\par\\pard\\plain\\qc\\f0\\fs15\\sa140 Halaman ', nlamp + 1, ' sampul berkas - dicetak karena pihak melebihi ruang sampul (',
      p1 + p2 + p3 + p4, ' pihak)\\par ',
      aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l3500,l1900,l4546', CONCAT('NO', S, 'NAMA', S, 'KEDUDUKAN', S, 'ALAMAT'), 380, 16, 1, 2, 1));
    SET habis = 0;
    SET j = 0;
    OPEN cpihak;
    bp: LOOP
      FETCH cpihak INTO xs, xn, xa;
      IF habis = 1 THEN LEAVE bp; END IF;
      IF xs <> sisi_lama THEN
        SET j = 0;
        SET sisi_lama = xs;
        SET isi = CONCAT(isi, aps_badilag.isian_rtf_baris_tabel(lebar, 'l1', CONCAT(UPPER(ELT(xs, IF(mohon = 1, 'Pemohon', 'Penggugat'), IF(mohon = 1, 'Termohon', 'Tergugat'), 'Intervensi', IF(mohon = 1, 'Turut Termohon', 'Turut Tergugat'))),
          ' (', ELT(xs, p1, p2, p3, p4), ' ORANG)'), 340, 16, 1, 3, 0));
      END IF;
      SET j = j + 1;
      IF j <= 150 THEN
        SET isi = CONCAT(isi, aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l3500,l1900,l4546',
          CONCAT(j, S, aps_badilag.isian_rtf_teks_sel(LEFT(xn, 200)), S, ELT(xs, IF(mohon = 1, 'Pemohon', 'Penggugat'), IF(mohon = 1, 'Termohon', 'Tergugat'), 'Intervensi', IF(mohon = 1, 'Turut Termohon', 'Turut Tergugat')),
                 ' ', aps_badilag.isian_rtf_romawi(j), S, aps_badilag.isian_rtf_teks_sel(LEFT(IFNULL(xa, '-'), 250))), 380, 18, 0, 0, 0));
      END IF;
    END LOOP;
    CLOSE cpihak;
    SET isi = CONCAT(isi, '\\pard\\plain\\f0\\fs4 ');
  END IF;

  -- ---- 2. DAFTAR OBJEK SENGKETA
  IF nob > 2 THEN
    SET nlamp = nlamp + 1;
    SET kaki = CONCAT(kaki, IF(nlamp > 1, ' - ', ''), nlamp, '. Daftar Objek Sengketa');
    SET isi = CONCAT(isi, '\\par\\pard\\plain\\pagebb\\qc\\f0\\fs26\\b\\sa40 LAMPIRAN ', nlamp, ' - DAFTAR OBJEK SENGKETA\\par\\pard\\plain\\qc\\f0\\fs19\\sa20 Perkara Nomor ',
      aps_badilag.isian_rtf_teks_sel(nomor), '\\par\\pard\\plain\\qc\\f0\\fs15\\sa140 Halaman ', nlamp + 1, ' sampul berkas - dicetak karena objek sengketa ', nob, ' (lebih dari 2)\\par ',
      aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l9946', CONCAT('NO', S, 'OBJEK SENGKETA (SIPP)'), 380, 16, 1, 2, 1));
    SET i = 1;
    SET j = 0;
    WHILE i <= nl DO
      SET t = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(ob, CHAR(10), i), CHAR(10), -1));
      IF t <> '' AND t NOT REGEXP '^[-.0 ]*$' AND j < 120 THEN
        SET j = j + 1;
        SET isi = CONCAT(isi, aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l9946', CONCAT(j, S, aps_badilag.isian_rtf_teks_sel(LEFT(t, 400))), 380, 18, 0, 0, 0));
      END IF;
      SET i = i + 1;
    END WHILE;
    SET isi = CONCAT(isi, '\\pard\\plain\\f0\\fs4 ');
  END IF;

  -- ---- 3. DAFTAR ANAK
  IF na > 3 THEN
    SET nlamp = nlamp + 1;
    SET kaki = CONCAT(kaki, IF(nlamp > 1, ' - ', ''), nlamp, '. Daftar Anak');
    SET isi = CONCAT(isi, '\\par\\pard\\plain\\pagebb\\qc\\f0\\fs26\\b\\sa40 LAMPIRAN ', nlamp, ' - DAFTAR ANAK\\par\\pard\\plain\\qc\\f0\\fs19\\sa20 Perkara Nomor ',
      aps_badilag.isian_rtf_teks_sel(nomor), '\\par\\pard\\plain\\qc\\f0\\fs15\\sa140 Halaman ', nlamp + 1, ' sampul berkas - dicetak karena anak ', na, ' orang (lebih dari 3)\\par ',
      aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l5200,c1300,l3446', CONCAT('NO', S, 'NAMA ANAK', S, 'UMUR', S, 'DIASUH OLEH'), 380, 16, 1, 2, 1));
    SET habis = 0;
    SET j = 0;
    OPEN canak;
    ba: LOOP
      FETCH canak INTO xn, xt, xd;
      IF habis = 1 THEN LEAVE ba; END IF;
      SET j = j + 1;
      SET isi = CONCAT(isi, aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l5200,c1300,l3446',
        CONCAT(j, S, aps_badilag.isian_rtf_teks_sel(LEFT(xn, 200)), S, IF(xt IS NULL OR xt < '1900-01-02', '', CONCAT(TIMESTAMPDIFF(YEAR, xt, CURDATE()), ' tahun')), S,
               IF(xd = 1, IF(mohon = 1, 'Pemohon', 'Penggugat'), IF(xd = 2, IF(mohon = 1, 'Termohon', 'Tergugat'), ''))), 380, 18, 0, 0, 0));
    END LOOP;
    CLOSE canak;
    SET isi = CONCAT(isi, '\\pard\\plain\\f0\\fs4 ');
  END IF;

  -- ---- 4. RIWAYAT SIDANG (LANJUTAN)
  IF ns > baris_riwayat THEN
    SET nlamp = nlamp + 1;
    SET kaki = CONCAT(kaki, IF(nlamp > 1, ' - ', ''), nlamp, '. Riwayat Sidang lanjutan');
    SET isi = CONCAT(isi, '\\par\\pard\\plain\\pagebb\\qc\\f0\\fs26\\b\\sa40 LAMPIRAN ', nlamp, ' - RIWAYAT SIDANG (LANJUTAN)\\par\\pard\\plain\\qc\\f0\\fs19\\sa20 Perkara Nomor ',
      aps_badilag.isian_rtf_teks_sel(nomor), '\\par\\pard\\plain\\qc\\f0\\fs15\\sa140 Halaman ', nlamp + 1, ' sampul berkas - sidang sudah ', ns, ' kali (sampul memuat ', baris_riwayat, ')\\par ',
      aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l1950,l3200,c1150,l3646', CONCAT('KE', S, 'TANGGAL', S, 'AGENDA', S, 'HADIR', S, 'HASIL / DITUNDA KE - ALASAN'), 380, 16, 1, 2, 1));
    SET habis = 0;
    SET j = 0;
    OPEN csidang;
    bs: LOOP
      FETCH csidang INTO xt, xd, xg, xl;
      IF habis = 1 THEN LEAVE bs; END IF;
      SET j = j + 1;
      IF j > baris_riwayat THEN
        SET isi = CONCAT(isi, aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l1950,l3200,c1150,l3646',
          CONCAT(j, S, IF(xt IS NULL, '', CONCAT(DAY(xt), ' ', SUBSTRING_INDEX(SUBSTRING_INDEX(BLN, ',', MONTH(xt)), ',', -1), ' ', YEAR(xt))), S,
                 IF(TRIM(xg) REGEXP '^[-0._ ]*$', '', aps_badilag.isian_rtf_teks_sel(LEFT(xg, 200))), S,
                 CASE xd WHEN 1 THEN 'P dan T' WHEN 2 THEN 'P' WHEN 3 THEN 'T' WHEN 4 THEN '-' WHEN 5 THEN 'I' ELSE '' END, S,
                 IF(TRIM(xl) REGEXP '^[-0._ ]*$', '', aps_badilag.isian_rtf_teks_sel(LEFT(xl, 250)))), 420, 18, 0, 0, 0));
      END IF;
    END LOOP;
    CLOSE csidang;
    -- lima baris kosong untuk sidang berikutnya (tulisan tangan)
    SET i = 1;
    WHILE i <= 5 DO
      SET isi = CONCAT(isi, aps_badilag.isian_rtf_baris_tabel(lebar, 'c560,l1950,l3200,c1150,l3646', CONCAT(j + i, S, '', S, '', S, '', S, ''), 420, 18, 0, 0, 0));
      SET i = i + 1;
    END WHILE;
    SET isi = CONCAT(isi, '\\pard\\plain\\f0\\fs4 ');
  END IF;

  IF nlamp = 0 THEN
    RETURN '\\b0';   -- kata kendali tanpa tampilan: ABT dan panel tidak mencetak tanda kosong
  END IF;
  RETURN CONCAT('\\fs15\\b Lampiran (', nlamp, '): ', kaki, '\\b0', isi);
END$$
DELIMITER ;
