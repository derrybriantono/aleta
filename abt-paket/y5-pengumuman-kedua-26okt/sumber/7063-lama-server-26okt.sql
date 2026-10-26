-- Tanggal pengumuman panggilan ghaib (keputusan 14 Okt 2026 butir 4), TIDAK lagi dihitung dari tanggal pendaftaran:
-- 1) isian 8564 (diisi tangan / pembaca relaas) bila ada;
-- 2) SIPP: relaas pihak kedua bersandi R/M/W/P (radio, media massa, papan pengadilan, papan Pemda) untuk sidang yang
--    pertama kali dipanggil secara ghaib - bukan sidang ikrar, tidak sesudah putusan; tanggal ke-1 dan ke-2;
-- 3) yang tidak diketahui dicetak "..." untuk diisi tangan.
SELECT IF(TRIM(x.isi) <> '', x.isi,
  CONCAT(IFNULL(CONCAT(LPAD(CAST(DAY(x.d1) AS CHAR CHARACTER SET utf8), 2, '0'), ' ', ELT(MONTH(x.d1), 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'), ' ', CAST(YEAR(x.d1) AS CHAR CHARACTER SET utf8)), '...'),
         ' dan ',
         IFNULL(CONCAT(LPAD(CAST(DAY(x.d2) AS CHAR CHARACTER SET utf8), 2, '0'), ' ', ELT(MONTH(x.d2), 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'), ' ', CAST(YEAR(x.d2) AS CHAR CHARACTER SET utf8)), '...'))) AS data
FROM (
  SELECT y.isi,
    (SELECT DISTINCT r.tanggal_relaas FROM perkara_pelaksanaan_relaas r
      WHERE r.perkara_id = '#perkara_id#' AND r.sidang_id = y.sid AND r.ket_temu IN ('R', 'M', 'W', 'P') AND r.tanggal_relaas > '1000-01-01'
        AND r.pihak_id IN (SELECT p2.pihak_id FROM perkara_pihak2 p2 WHERE p2.perkara_id = '#perkara_id#')
      ORDER BY r.tanggal_relaas LIMIT 0, 1) AS d1,
    (SELECT DISTINCT r.tanggal_relaas FROM perkara_pelaksanaan_relaas r
      WHERE r.perkara_id = '#perkara_id#' AND r.sidang_id = y.sid AND r.ket_temu IN ('R', 'M', 'W', 'P') AND r.tanggal_relaas > '1000-01-01'
        AND r.pihak_id IN (SELECT p2.pihak_id FROM perkara_pihak2 p2 WHERE p2.perkara_id = '#perkara_id#')
      ORDER BY r.tanggal_relaas LIMIT 1, 1) AS d2
  FROM (
    SELECT IFNULL(REPLACE(REPLACE(REPLACE(CONVERT((SELECT data FROM aps_badilag.abt_data_teks WHERE no_var=8564 AND perkara_id='#perkara_id#') USING utf8),'\\','/'),'"','&quot;'),'''','&#39;'),'') AS isi,
      (SELECT r.sidang_id FROM perkara_pelaksanaan_relaas r JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id
        WHERE r.perkara_id = '#perkara_id#' AND r.ket_temu IN ('R', 'M', 'W', 'P') AND r.tanggal_relaas > '1000-01-01'
          AND IFNULL(j.ikrar_talak, 'T') <> 'Y'
          AND r.pihak_id IN (SELECT p2.pihak_id FROM perkara_pihak2 p2 WHERE p2.perkara_id = '#perkara_id#')
          AND r.tanggal_relaas <= IFNULL((SELECT MAX(pu.tanggal_putusan) FROM perkara_putusan pu WHERE pu.perkara_id = '#perkara_id#' AND pu.tanggal_putusan > '1000-01-01'), '9999-12-31')
        ORDER BY r.tanggal_relaas, r.id LIMIT 1) AS sid
  ) y
) x
