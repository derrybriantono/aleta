SELECT p.perkara_id,
 IF(w.pet REGEXP 'iddah|idah',1,0) AS ti0,
 IF(w.pet REGEXP '(nafkah|biaya|uang|masa|selama|membayar|tunggu)[^;]{0,40}[^a-z](iddah|idah|eddah)([^a-z]|$)',1,0) AS ti1,
 IF(w.pet REGEXP 'mut[^a-z]{0,4}ah',1,0) AS tm0,
 IF(w.pet REGEXP '(^|[^a-z])muth?[^a-z]{0,6}ah([^a-z]|$)',1,0) AS tm1,
 IF(w.pet REGEXP 'madli|madhi|mahdhi|lampau|yang lalu|terhutang',1,0) AS td0,
 IF(w.pet REGEXP '(^|[^a-z])(madl?iy*ah|madhiy*ah|mahdhiy*ah)|nafkah[^;]{0,30}(lampau|yang lalu|terhutang|terutang|tertunggak|yang belum dibayar|yang tidak dibayar)',1,0) AS td1,
 IF(w.pet REGEXP 'hadhanah|hadlanah|hadanah|hak asuh|hak pengasuhan|kuasa asuh|hak pemeliharaan|pemeliharaan anak|pengasuhan anak|asuhan anak|di bawah (asuhan|pemeliharaan)|berada (di bawah|dalam) (asuhan|pemeliharaan|hadhanah)' OR w.kh>0,1,0) AS th,
 IF(w.pet REGEXP 'nafkah[^;]{0,60}anak|anak[^;]{0,60}nafkah|biaya (hidup|pemeliharaan|pendidikan|kebutuhan)[^;]{0,60}anak|biaya anak',1,0) AS tn,
 IF(w.pet REGEXP 'harta bersama|harta gono|gono.?gini' OR w.kbh>0,1,0) AS tb
FROM perkara p JOIN perkara_putusan pp ON pp.perkara_id=p.perkara_id
JOIN (SELECT p2.perkara_id, LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(IFNULL(p2.petitum,''), ' ', IFNULL((SELECT GROUP_CONCAT(r.isi_petitum SEPARATOR ' ') FROM perkara_rekonvensi r WHERE r.perkara_id = p2.perkara_id),'')),'<strong>',''),'</strong>',''),'<em>',''),'</em>',''),'&nbsp;',' '),CHAR(10),' '),CHAR(13),' ')) AS pet,
  (SELECT COUNT(*) FROM perkara_kumulasi k WHERE k.perkara_id = p2.perkara_id AND k.jenis_perkara_id = 349) AS kh,
  (SELECT COUNT(*) FROM perkara_kumulasi k WHERE k.perkara_id = p2.perkara_id AND k.jenis_perkara_id = 348) AS kbh
  FROM perkara p2 WHERE p2.jenis_perkara_id IN (346,347)) w ON w.perkara_id=p.perkara_id
WHERE p.jenis_perkara_id IN (346,347) AND pp.tanggal_putusan >= '2023-01-01' AND pp.amar_putusan IS NOT NULL AND pp.amar_putusan <> '';
