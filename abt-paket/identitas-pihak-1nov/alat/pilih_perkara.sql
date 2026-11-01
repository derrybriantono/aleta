-- jalankan di sipp_w177; keluaran: kategori, perkara_id, nomor
(SELECT 'normal' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE p.tanggal_pendaftaran >= '2026-01-01' AND p.jenis_perkara_nama IN ('Cerai Gugat','Cerai Talak')
   AND (SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=p.perkara_id)=1 AND (SELECT COUNT(*) FROM perkara_pihak2 WHERE perkara_id=p.perkara_id)=1
   AND NOT EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id=p.perkara_id) ORDER BY p.perkara_id DESC LIMIT 6)
UNION ALL
(SELECT 'kuasa1' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE p.tanggal_pendaftaran >= '2026-01-01'
   AND EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id=p.perkara_id AND k.pihak_ke=1 AND k.aktif='Y')
   AND NOT EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id=p.perkara_id AND k.pihak_ke=2 AND k.aktif='Y') ORDER BY p.perkara_id DESC LIMIT 3)
UNION ALL
(SELECT 'kuasa2' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE p.tanggal_pendaftaran >= '2026-01-01'
   AND EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id=p.perkara_id AND k.pihak_ke=2 AND k.aktif='Y')
   AND NOT EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id=p.perkara_id AND k.pihak_ke=1 AND k.aktif='Y') ORDER BY p.perkara_id DESC LIMIT 3)
UNION ALL
(SELECT 'kuasaDua' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE p.tanggal_pendaftaran >= '2026-01-01'
   AND EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id=p.perkara_id AND k.pihak_ke=1 AND k.aktif='Y')
   AND EXISTS (SELECT 1 FROM perkara_pengacara k WHERE k.perkara_id=p.perkara_id AND k.pihak_ke=2 AND k.aktif='Y') ORDER BY p.perkara_id DESC LIMIT 4)
UNION ALL
(SELECT 'p1=2' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE p.tanggal_pendaftaran >= '2025-06-01' AND (SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=p.perkara_id)=2 ORDER BY p.perkara_id DESC LIMIT 4)
UNION ALL
(SELECT 'p1=3' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE (SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=p.perkara_id)=3 ORDER BY p.perkara_id DESC LIMIT 2)
UNION ALL
(SELECT 'p1=4' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE (SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=p.perkara_id)=4 ORDER BY p.perkara_id DESC LIMIT 2)
UNION ALL
(SELECT 'p1>=5' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE (SELECT COUNT(*) FROM perkara_pihak1 WHERE perkara_id=p.perkara_id)>=5 ORDER BY p.perkara_id DESC LIMIT 3)
UNION ALL
(SELECT 'p2>=2' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE (SELECT COUNT(*) FROM perkara_pihak2 WHERE perkara_id=p.perkara_id)>=2 ORDER BY p.perkara_id DESC LIMIT 4)
UNION ALL
(SELECT 'tak-rapat' k, p.perkara_id, p.nomor_perkara FROM perkara p WHERE EXISTS (SELECT 1 FROM perkara_pihak1 a WHERE a.perkara_id=p.perkara_id GROUP BY a.perkara_id HAVING MIN(a.urutan)<>1) ORDER BY p.perkara_id DESC LIMIT 3)
UNION ALL
(SELECT 'tgl-kosong' k, p.perkara_id, p.nomor_perkara FROM perkara p JOIN perkara_pihak1 a ON a.perkara_id=p.perkara_id JOIN pihak b ON b.id=a.pihak_id WHERE b.tanggal_lahir IS NULL AND p.tanggal_pendaftaran>='2026-01-01' ORDER BY p.perkara_id DESC LIMIT 3)
UNION ALL
(SELECT 'dahulu' k, p.perkara_id, p.nomor_perkara FROM perkara p JOIN perkara_pihak2 a ON a.perkara_id=p.perkara_id WHERE a.alamat LIKE '%dahulu%' ORDER BY p.perkara_id DESC LIMIT 2)
UNION ALL
(SELECT 'ubah-alamat' k, p.perkara_id, p.nomor_perkara FROM perkara p JOIN aps_badilag_w177d.abt_data_teks t ON t.perkara_id=p.perkara_id AND t.no_var IN (8548,8549) WHERE TRIM(IFNULL(t.data,''))<>'' ORDER BY p.perkara_id DESC LIMIT 3);
