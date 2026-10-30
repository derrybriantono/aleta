-- Sampel luas pindai variabel-sehat (baca saja, SIPP salinan). Keluaran: perkara_id TAB golongan TAB jenis TAB nomor
SET SESSION group_concat_max_len = 100000;
DROP TEMPORARY TABLE IF EXISTS s;
CREATE TEMPORARY TABLE s (perkara_id INT, gol VARCHAR(40), PRIMARY KEY (perkara_id, gol));
-- 1. tiap jenis x alur (pendaftaran sejak 2023): 2 putus + 1 belum putus terbaru
INSERT IGNORE INTO s SELECT perkara_id, 'jenis-putus' FROM (
  SELECT p.perkara_id, p.jenis_perkara_id j, p.alur_perkara_id a,
         @r := IF(@k = CONCAT(p.jenis_perkara_id,'|',p.alur_perkara_id), @r + 1, 1) rn, @k := CONCAT(p.jenis_perkara_id,'|',p.alur_perkara_id) kk
  FROM perkara p JOIN perkara_putusan u ON u.perkara_id = p.perkara_id AND u.tanggal_putusan IS NOT NULL, (SELECT @r := 0, @k := '') z
  WHERE p.tanggal_pendaftaran >= '2023-01-01' ORDER BY p.jenis_perkara_id, p.alur_perkara_id, p.perkara_id DESC) x WHERE rn <= 5;
INSERT IGNORE INTO s SELECT perkara_id, 'jenis-berjalan' FROM (
  SELECT p.perkara_id, @r2 := IF(@k2 = CONCAT(p.jenis_perkara_id,'|',p.alur_perkara_id), @r2 + 1, 1) rn, @k2 := CONCAT(p.jenis_perkara_id,'|',p.alur_perkara_id) kk
  FROM perkara p LEFT JOIN perkara_putusan u ON u.perkara_id = p.perkara_id, (SELECT @r2 := 0, @k2 := '') z
  WHERE p.tanggal_pendaftaran >= '2025-01-01' AND u.tanggal_putusan IS NULL ORDER BY p.jenis_perkara_id, p.alur_perkara_id, p.perkara_id DESC) x WHERE rn <= 3;
-- 2. keadaan khusus (terbaru)
INSERT IGNORE INTO s SELECT perkara_id, 'prodeo' FROM perkara WHERE prodeo = 1 ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT perkara_id, 'pihak1-banyak' FROM perkara_pihak1 GROUP BY perkara_id HAVING COUNT(*) > 1 ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT perkara_id, 'pihak2-banyak' FROM perkara_pihak2 GROUP BY perkara_id HAVING COUNT(*) > 1 ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'kuasa' FROM perkara_pengacara ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'ecourt' FROM perkara_efiling_id ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'ghaib' FROM perkara_pihak2 WHERE ghaib = 1 ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'delegasi' FROM delegasi_keluar WHERE perkara_id > 0 ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'ikrar' FROM perkara_ikrar_talak WHERE tgl_ikrar_talak IS NOT NULL ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'eksekusi' FROM perkara_eksekusi WHERE perkara_id > 0 ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'sela' FROM perkara_putusan_sela ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'mediasi-berhasil' FROM perkara_mediasi WHERE hasil_mediasi IN ('Y','S','B') OR mediasi_berhasil IS NOT NULL ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'mediasi-gagal' FROM perkara_mediasi WHERE hasil_mediasi = 'T' ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT u.perkara_id, 'verstek' FROM perkara_putusan u WHERE u.putusan_verstek = 'Y' ORDER BY u.perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT u.perkara_id, 'hadir-kontradiktor' FROM perkara_putusan u JOIN perkara p ON p.perkara_id = u.perkara_id WHERE u.putusan_verstek <> 'Y' AND p.alur_perkara_id = 15 AND u.tanggal_putusan IS NOT NULL ORDER BY u.perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'verzet' FROM perkara_verzet ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT DISTINCT perkara_id, 'banding' FROM perkara_banding ORDER BY perkara_id DESC LIMIT 8;
INSERT IGNORE INTO s SELECT u.perkara_id, 'cabut' FROM perkara_putusan u WHERE u.tanggal_cabut IS NOT NULL ORDER BY u.perkara_id DESC LIMIT 8;
SELECT s.perkara_id, GROUP_CONCAT(s.gol ORDER BY s.gol), MAX(p.jenis_perkara_nama), MAX(p.alur_perkara_id), MAX(p.nomor_perkara)
FROM s JOIN perkara p ON p.perkara_id = s.perkara_id GROUP BY s.perkara_id ORDER BY s.perkara_id;
