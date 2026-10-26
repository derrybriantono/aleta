-- DRAF 26 Okt 2026 - TIDAK DIUJI, BELUM DIPASANG KE MANA PUN.
-- Fungsi tersimpan untuk Daftar Isi Berkas (blangko Derry, menu PTSP). Hanya basis ABT (aps_badilag).
-- Tidak ada kata nama aplikasi; nama fungsi netral (pola isian_rtf_*).
-- Penanda __SIPP__ diganti nama basis SIPP saat pasang (server: SIPP; lab laptop: nama basis uji) - pola paket x6/x9.
-- Kompatibel MariaDB 5.5: kursor, tanpa CTE/JSON/fungsi jendela, tanpa GROUP_CONCAT panjang.
--
-- isian_rtf_daftar_isi(pid, bundel, kol)
--   bundel 'A' = pendaftaran sampai putusan; 'B' = pasca putusan dan administrasi (usulan, perlu diverifikasi - RANCANGAN.md bagian 4)
--   kol 1 = nomor, 2 = jenis dokumen, 3 = tanggal, 4 = halaman (titik-titik)
-- Keempat kolom dibangun dari himpunan baris yang SAMA dan urutan SAMA, sehingga selalu sama panjang dan sejajar
-- (satu dokumen satu baris; nama dokumen <= 52 karakter).
-- Yang BELUM ada di draf ini (belum diukur atas SIPP): pengumuman ghaib, salinan putusan, sita, jawaban/replik/duplik/kesimpulan,
-- daftar bukti P/T, keterangan saksi, upaya hukum (banding/kasasi/PK), eksekusi, bagian IKRAR TALAK. Lihat RANCANGAN.md bagian 4.2 dan 4.3.
DELIMITER $$
DROP FUNCTION IF EXISTS isian_rtf_daftar_isi$$
CREATE FUNCTION isian_rtf_daftar_isi(pid INT, bundel CHAR(1), kol INT) RETURNS LONGTEXT CHARSET utf8mb4
  READS SQL DATA SQL SECURITY INVOKER COMMENT 'daftar isi berkas: satu kolom, baris dipisah <br>'
BEGIN
  DECLARE habis INT DEFAULT 0;
  DECLARE g INT;
  DECLARE s INT;
  DECLARE d VARCHAR(90) CHARSET latin1;
  DECLARE t DATE;
  DECLARE glama INT DEFAULT -1;
  DECLARE nomor INT DEFAULT 0;
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE sep VARCHAR(4) CHARSET latin1 DEFAULT '';
  DECLARE judul VARCHAR(60) CHARSET latin1;
  DECLARE sebut1 VARCHAR(12) CHARSET latin1;
  DECLARE sebut2 VARCHAR(12) CHARSET latin1;
  DECLARE permohonan INT DEFAULT 0;
  DECLARE cur CURSOR FOR
    SELECT x.g, x.s, x.d, x.t FROM (
      -- ============ BUNDEL A, I. PENDAFTARAN (grup 1)
      SELECT 1 AS g, 10 AS s, CAST(CONCAT('Surat ', IF(p.alur_perkara_id = 16 OR p.jenis_perkara_id = 346, 'Permohonan', 'Gugatan')) AS CHAR(90)) AS d, p.tanggal_surat AS t
        FROM __SIPP__.perkara p WHERE p.perkara_id = pid
      UNION ALL
      SELECT 1, 15, 'Surat Keterangan Tidak Mampu (SKTM)', p.tanggal_surat FROM __SIPP__.perkara p WHERE p.perkara_id = pid AND p.prodeo = 1
      UNION ALL
      SELECT 1, 16, 'Surat Permohonan Prodeo', p.tanggal_surat FROM __SIPP__.perkara p WHERE p.perkara_id = pid AND p.prodeo = 1
      UNION ALL
      SELECT 1, 20, 'Surat Kuasa Khusus Pemohon/Penggugat', k.tanggal_kuasa FROM __SIPP__.perkara_pengacara k
        WHERE k.perkara_id = pid AND k.pihak_ke = 1 AND k.aktif = 'Y' AND k.urutan = 1
      UNION ALL
      SELECT 1, 21, 'Surat Kuasa Khusus Termohon/Tergugat', k.tanggal_kuasa FROM __SIPP__.perkara_pengacara k
        WHERE k.perkara_id = pid AND k.pihak_ke = 2 AND k.aktif = 'Y' AND k.urutan = 1
      UNION ALL
      SELECT 1, 30, 'Surat Kuasa Untuk Membayar', p.tanggal_pendaftaran FROM __SIPP__.perkara p WHERE p.perkara_id = pid
      UNION ALL
      SELECT 1, 31, 'Slip Setoran Panjar Biaya Perkara', p.tanggal_pendaftaran FROM __SIPP__.perkara p WHERE p.perkara_id = pid AND IFNULL(p.prodeo, 0) <> 1
      -- ============ II. PENETAPAN AWAL (grup 2)
      UNION ALL
      SELECT 2, 10, 'Penetapan Majelis Hakim / Hakim Tunggal', e.penetapan_majelis_hakim FROM __SIPP__.perkara_penetapan e WHERE e.perkara_id = pid AND e.penetapan_majelis_hakim IS NOT NULL
      UNION ALL
      SELECT 2, 20, 'Penunjukan Panitera Pengganti', e.penetapan_panitera_pengganti FROM __SIPP__.perkara_penetapan e WHERE e.perkara_id = pid AND e.penetapan_panitera_pengganti IS NOT NULL
      UNION ALL
      SELECT 2, 30, 'Penunjukan Jurusita / Jurusita Pengganti', e.penetapan_jurusita FROM __SIPP__.perkara_penetapan e WHERE e.perkara_id = pid AND e.penetapan_jurusita IS NOT NULL
      UNION ALL
      SELECT 2, 40, 'Penetapan Hari Sidang (PHS)', e.penetapan_hari_sidang FROM __SIPP__.perkara_penetapan e WHERE e.perkara_id = pid AND e.penetapan_hari_sidang IS NOT NULL
      -- ============ III. PEMERIKSAAN DI PERSIDANGAN (grup 3); s = nomor sidang * 100 + urutan dalam sidang
      UNION ALL
      SELECT 3, n.no * 100 + 50, CAST(CONCAT('Berita Acara Sidang ', ELT(LEAST(n.no, 9), 'Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima', 'Keenam', 'Ketujuh', 'Kedelapan', 'Kesembilan'),
             IF(n.sidang_keliling = 'Y', ' (keliling)', '')) AS CHAR(90)), n.tanggal_sidang
        FROM (SELECT s1.id, s1.tanggal_sidang, s1.sidang_keliling,
                     (SELECT COUNT(*) FROM __SIPP__.perkara_jadwal_sidang s2
                       WHERE s2.perkara_id = s1.perkara_id AND IFNULL(s2.ikrar_talak, 'T') <> 'Y'
                         AND (s2.tanggal_sidang < s1.tanggal_sidang OR (s2.tanggal_sidang = s1.tanggal_sidang AND s2.id <= s1.id))) AS no
                FROM __SIPP__.perkara_jadwal_sidang s1
               WHERE s1.perkara_id = pid AND IFNULL(s1.ikrar_talak, 'T') <> 'Y' AND s1.tanggal_sidang <= CURDATE()) n
      UNION ALL
      -- relaas panggilan per pihak (sisi 1 = Pemohon/Penggugat, sisi 2 = Termohon/Tergugat) per sidang
      SELECT 3, n.no * 100 + 10 + r.sisi, CAST(CONCAT('Relaas Panggilan ', IF(r.sisi = 1, 'Pemohon/Penggugat', 'Termohon/Tergugat'), ' ke ', n.no) AS CHAR(90)), r.tanggal_relaas
        FROM (SELECT s1.id, (SELECT COUNT(*) FROM __SIPP__.perkara_jadwal_sidang s2
                       WHERE s2.perkara_id = s1.perkara_id AND IFNULL(s2.ikrar_talak, 'T') <> 'Y'
                         AND (s2.tanggal_sidang < s1.tanggal_sidang OR (s2.tanggal_sidang = s1.tanggal_sidang AND s2.id <= s1.id))) AS no
                FROM __SIPP__.perkara_jadwal_sidang s1 WHERE s1.perkara_id = pid AND IFNULL(s1.ikrar_talak, 'T') <> 'Y') n
        JOIN (SELECT a.sidang_id, a.tanggal_relaas, 1 AS sisi FROM __SIPP__.perkara_pelaksanaan_relaas a
                JOIN __SIPP__.perkara_pihak1 b ON b.perkara_id = a.perkara_id AND b.pihak_id = a.pihak_id WHERE a.perkara_id = pid AND a.tanggal_relaas IS NOT NULL
              UNION ALL
              SELECT a.sidang_id, a.tanggal_relaas, 2 FROM __SIPP__.perkara_pelaksanaan_relaas a
                JOIN __SIPP__.perkara_pihak2 b ON b.perkara_id = a.perkara_id AND b.pihak_id = a.pihak_id WHERE a.perkara_id = pid AND a.tanggal_relaas IS NOT NULL) r
          ON r.sidang_id = n.id
      UNION ALL
      SELECT 3, 160, 'Penetapan Penunjukan Mediator', m.penetapan_penunjukan_mediator FROM __SIPP__.perkara_mediasi m
        WHERE m.perkara_id = pid AND m.penetapan_penunjukan_mediator IS NOT NULL
      UNION ALL
      SELECT 3, 161, 'Laporan Hasil Mediasi', m.tgl_laporan_mediator FROM __SIPP__.perkara_mediasi m
        WHERE m.perkara_id = pid AND m.tgl_laporan_mediator IS NOT NULL
      -- ============ IV. PUTUSAN / PENETAPAN (grup 4)
      UNION ALL
      SELECT 4, 10, CAST(IF(p.alur_perkara_id = 16 OR u.status_putusan_id IN (7, 37, 67), 'Penetapan', 'Putusan') AS CHAR(90)), u.tanggal_putusan
        FROM __SIPP__.perkara_putusan u JOIN __SIPP__.perkara p ON p.perkara_id = u.perkara_id WHERE u.perkara_id = pid AND u.tanggal_putusan IS NOT NULL
      -- ============ BUNDEL B (grup 10 ke atas)
      UNION ALL
      SELECT 10, 10, 'Relaas Pemberitahuan Isi Putusan/Penetapan', w.tanggal_pemberitahuan_putusan FROM __SIPP__.perkara_putusan_pemberitahuan_putusan w
        WHERE w.perkara_id = pid AND w.tanggal_pemberitahuan_putusan IS NOT NULL
      UNION ALL
      SELECT 10, 20, 'Penetapan Minutasi', u.tanggal_minutasi FROM __SIPP__.perkara_putusan u WHERE u.perkara_id = pid AND u.tanggal_minutasi IS NOT NULL
      UNION ALL
      SELECT 10, 30, 'Akta Pernyataan Berkekuatan Hukum Tetap (BHT)', u.tanggal_bht FROM __SIPP__.perkara_putusan u WHERE u.perkara_id = pid AND u.tanggal_bht IS NOT NULL
      UNION ALL
      SELECT 10, 40, CAST(CONCAT('Akta Cerai Nomor ', IFNULL(c.nomor_akta_cerai, '-')) AS CHAR(90)), c.tgl_akta_cerai FROM __SIPP__.perkara_akta_cerai c WHERE c.perkara_id = pid AND c.tgl_akta_cerai IS NOT NULL
      UNION ALL
      SELECT 10, 41, 'Tanda Terima Akta Cerai Pemohon/Penggugat', c.tgl_penyerahan_akta_cerai FROM __SIPP__.perkara_akta_cerai c WHERE c.perkara_id = pid AND c.tgl_penyerahan_akta_cerai IS NOT NULL
      UNION ALL
      SELECT 10, 42, 'Tanda Terima Akta Cerai Termohon/Tergugat', c.tgl_penyerahan_akta_cerai_pihak2 FROM __SIPP__.perkara_akta_cerai c WHERE c.perkara_id = pid AND c.tgl_penyerahan_akta_cerai_pihak2 IS NOT NULL
    ) x
    WHERE (bundel = 'A' AND x.g < 10) OR (bundel = 'B' AND x.g >= 10)
    ORDER BY x.g, x.s, x.t;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET habis = 1;

  OPEN cur;
  baca: LOOP
    FETCH cur INTO g, s, d, t;
    IF habis = 1 THEN LEAVE baca; END IF;
    IF g <> glama THEN
      -- baris judul bagian: kolom 2 tebal, kolom lain kosong
      SET judul = ELT(g, 'I. PENDAFTARAN', 'II. PENETAPAN AWAL', 'III. PEMERIKSAAN DI PERSIDANGAN', 'IV. PUTUSAN / PENETAPAN');
      IF g >= 10 THEN SET judul = 'PASCA PUTUSAN'; END IF;
      SET o = CONCAT(o, sep, IF(kol = 2, CONCAT('<b>', judul, '</b>'), ''));
      SET sep = '<br>';
      SET glama = g;
    END IF;
    SET nomor = nomor + 1;
    SET o = CONCAT(o, sep, CASE kol
        WHEN 1 THEN CAST(nomor AS CHAR)
        WHEN 2 THEN LEFT(d, 52)
        WHEN 3 THEN IF(t IS NULL, '', CONCAT(DAY(t), ' ', ELT(MONTH(t), 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'), ' ', YEAR(t)))
        ELSE '......' END);
  END LOOP;
  CLOSE cur;
  RETURN CONVERT(CAST(o AS BINARY) USING utf8mb4);
END$$
DELIMITER ;
