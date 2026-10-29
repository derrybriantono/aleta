-- Peringkat perkara putus 2 tahun terakhir (29 Okt 2024 - 28 Okt 2026) per jenis x status putusan x verstek x jumlah sidang.
-- Baca saja atas salinan SIPP server 28 Okt (sipp_2810). Sidang = baris perkara_jadwal_sidang bukan ikrar talak.
SELECT p.jenis_perkara_nama AS jenis,
       COALESCE(NULLIF(pp.status_putusan_nama, ''), sp.nama) AS status,
       IF(pp.putusan_verstek = 'Y', 'verstek', '-') AS verstek,
       CASE WHEN js.n IS NULL OR js.n = 0 THEN '0' WHEN js.n = 1 THEN '1' WHEN js.n = 2 THEN '2' ELSE '3+' END AS sidang,
       COUNT(*) AS perkara
FROM perkara p
JOIN perkara_putusan pp ON pp.perkara_id = p.perkara_id
LEFT JOIN status_putusan sp ON sp.id = pp.status_putusan_id
LEFT JOIN (SELECT perkara_id, COUNT(*) n FROM perkara_jadwal_sidang WHERE IFNULL(ikrar_talak, 'T') <> 'Y' GROUP BY perkara_id) js ON js.perkara_id = p.perkara_id
WHERE pp.tanggal_putusan BETWEEN '2024-10-29' AND '2026-10-28'
GROUP BY 1, 2, 3, 4
ORDER BY 5 DESC;
