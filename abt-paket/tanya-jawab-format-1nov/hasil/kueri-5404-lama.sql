SELECT 
  CASE
    /* ==== PERUBAHAN HAKIM & PANITERA (MAJELIS) ==== */
    WHEN EXISTS (
      SELECT 1
      FROM perkara b
	  JOIN perkara_hakim_pn hhh ON hhh.perkara_id = b.perkara_id
	  JOIN perkara_panitera_pn ppp ON ppp.perkara_id = b.perkara_id
      WHERE b.perkara_id = #perkara_id#
	    AND hhh.tanggal_penetapan = "#0033#"
		AND ppp.tanggal_penetapan = "#0033#"
        AND YEAR(b.tanggal_surat) = YEAR(CURDATE())
        /* ada panitera yang nonaktif (pergantian panitera) */
        AND EXISTS (
          SELECT 1 
          FROM perkara_panitera_pn pp_old
          WHERE pp_old.perkara_id = b.perkara_id
            AND pp_old.tanggal_penetapan = "#0033#"
            AND pp_old.aktif = 'T'
            AND pp_old.tanggal_tidak_aktif IS NOT NULL
        )
        /* ada hakim yang nonaktif (pergantian hakim) */
        AND EXISTS (
          SELECT 1
          FROM perkara_hakim_pn hh_old
          WHERE hh_old.perkara_id = b.perkara_id
            AND hh_old.tanggal_penetapan = "#0033#"
            AND hh_old.aktif = 'T'
            AND hh_old.tanggal_tidak_aktif IS NOT NULL
        )
        /* saat ini majelis (3 hakim) aktif */
        AND EXISTS (
          SELECT 1 
          FROM perkara_hakim_pn hh_now
          WHERE hh_now.perkara_id = b.perkara_id
            AND hh_now.aktif = 'Y'
            AND hh_now.jabatan_hakim_id = 1
        )
    ) THEN 
      "Susunan majelis sidang sebelumnya mengalami perubahan karena Hakim bernama #5406# yang sebelumnya bertugas sedang #5407# dan Panitera Sidang bernama <strong>#5403#</strong> yang sebelumnya bertugas sedang #5405#, sehingga susunan majelis bersidang menjadi sebagai berikut:<br>1.<li><strong>#0012#</strong><li>sebagai #4004#;<br>2.<li><strong>#0013#</strong><li>sebagai Hakim Anggota;<br>3.<li><strong>#0014#</strong><li>sebagai Hakim Anggota;dan dibantu<br><li><strong>#0015#</strong><li>sebagai #6034#;"

    /* ==== PERUBAHAN HAKIM & PANITERA (HAKIM TUNGGAL) ==== */
    WHEN EXISTS (
      SELECT 1
      FROM perkara b
      WHERE b.perkara_id = #perkara_id#
        AND YEAR(b.tanggal_surat) = YEAR(CURDATE())
        AND EXISTS (
          SELECT 1 
          FROM perkara_panitera_pn pp_old
          WHERE pp_old.perkara_id = b.perkara_id
            AND pp_old.aktif = 'T'
            AND pp_old.tanggal_tidak_aktif IS NOT NULL
        )
        AND EXISTS (
          SELECT 1
          FROM perkara_hakim_pn hh_old
          WHERE hh_old.perkara_id = b.perkara_id
            AND hh_old.aktif = 'T'
            AND hh_old.tanggal_tidak_aktif IS NOT NULL
        )
        /* saat ini hakim tunggal aktif */
        AND EXISTS (
          SELECT 1 
          FROM perkara_hakim_pn hh_now
          WHERE hh_now.perkara_id = b.perkara_id
            AND hh_now.aktif = 'Y'
            AND hh_now.jabatan_hakim_id = 3
        )
    ) THEN 
      "Susunan majelis sidang sebelumnya mengalami perubahan karena Hakim bernama #5406# yang sebelumnya bertugas sedang #5407# dan Panitera Sidang bernama <strong>#5403#</strong> yang sebelumnya bertugas sedang #5405#, sehingga susunan majelis bersidang menjadi sebagai berikut:<br>-<li><strong>#0012#</strong><li>sebagai #4004#;dan dibantu<br><li><strong>#0015#</strong><li>sebagai #6034#;"

    /* ==== PERUBAHAN PANITERA SAJA (MAJELIS) ==== */
    WHEN EXISTS (
      SELECT 1
      FROM perkara_panitera_pn a
      LEFT JOIN perkara b ON a.perkara_id = b.perkara_id
      LEFT JOIN perkara_hakim_pn c ON a.perkara_id = c.perkara_id
      WHERE a.aktif = 'Y'
        AND YEAR(b.tanggal_surat) = YEAR(CURDATE())
        AND a.perkara_id IN (
          SELECT perkara_id
          FROM perkara_panitera_pn
          WHERE aktif = 'T' AND tanggal_tidak_aktif IS NOT NULL
        )
        AND a.tanggal_penetapan = "#0033#"
        AND a.perkara_id = #perkara_id#
        AND c.aktif = 'Y'
        AND c.jabatan_hakim_id = 1
    ) THEN 
      "Susunan majelis sidang sebelumnya mengalami perubahan karena Panitera Sidang bernama <strong>#5403#</strong> yang sebelumnya bertugas sedang #5405#, sehingga susunan majelis bersidang menjadi sebagai berikut:<br>1.<li><strong>#0012#</strong><li>sebagai #4004#;<br>2.<li><strong>#0013#</strong><li>sebagai Hakim Anggota;<br>3.<li><strong>#0014#</strong><li>sebagai Hakim Anggota;dan dibantu<br><li><strong>#0015#</strong><li>sebagai #6034#;"

    /* ==== PERUBAHAN PANITERA SAJA (HAKIM TUNGGAL) ==== */
    WHEN EXISTS (
      SELECT 1
      FROM perkara_panitera_pn a
      LEFT JOIN perkara b ON a.perkara_id = b.perkara_id
      LEFT JOIN perkara_hakim_pn c ON a.perkara_id = c.perkara_id
      WHERE a.aktif = 'Y'
        AND YEAR(b.tanggal_surat) = YEAR(CURDATE())
        AND a.perkara_id IN (
          SELECT perkara_id
          FROM perkara_panitera_pn
          WHERE aktif = 'T' AND tanggal_tidak_aktif IS NOT NULL
        )
        AND a.tanggal_penetapan = "#0033#"
        AND a.perkara_id = #perkara_id#
        AND c.aktif = 'Y'
        AND c.jabatan_hakim_id = 3
    ) THEN 
      "Susunan majelis sidang sebelumnya mengalami perubahan karena Panitera Sidang bernama <strong>#5403#</strong> yang sebelumnya bertugas sedang #5405#, sehingga susunan majelis bersidang menjadi sebagai berikut:<br>-<li><strong>#0012#</strong><li>sebagai #4004#;dan dibantu<br><li><strong>#0015#</strong><li>sebagai #6034#;"

    /* ==== PERUBAHAN HAKIM SAJA (MAJELIS) ==== */
    WHEN EXISTS (
      SELECT 1
      FROM perkara b
	  JOIN perkara_hakim_pn ppp ON ppp.perkara_id = b.perkara_id
      WHERE b.perkara_id = #perkara_id#
	    AND ppp.tanggal_penetapan = "#0033#"
        AND YEAR(b.tanggal_surat) = YEAR(CURDATE())
        /* ada hakim yang nonaktif (pergantian hakim) */
        AND EXISTS (
          SELECT 1
          FROM perkara_hakim_pn hh_old
          WHERE hh_old.perkara_id = b.perkara_id
            AND hh_old.aktif = 'T'
            AND hh_old.tanggal_tidak_aktif IS NOT NULL
        )
        /* tidak ada pergantian panitera */
        AND NOT EXISTS (
          SELECT 1 
          FROM perkara_panitera_pn pp_old
          WHERE pp_old.perkara_id = b.perkara_id
            AND pp_old.aktif = 'T'
            AND pp_old.tanggal_tidak_aktif IS NOT NULL
        )
        /* saat ini majelis (3 hakim) aktif */
        AND EXISTS (
          SELECT 1 
          FROM perkara_hakim_pn hh_now
          WHERE hh_now.perkara_id = b.perkara_id
            AND hh_now.aktif = 'Y'
            AND hh_now.jabatan_hakim_id = 1
        )
    ) THEN 
      "Susunan majelis sidang sebelumnya mengalami perubahan karena terjadi pergantian Hakim bernama #5406# yang sebelumnya bertugas sedang #5407#, sehingga susunan majelis bersidang menjadi sebagai berikut:<br>1.<li><strong>#0012#</strong><li>sebagai #4004#;<br>2.<li><strong>#0013#</strong><li>sebagai Hakim Anggota;<br>3.<li><strong>#0014#</strong><li>sebagai Hakim Anggota;dan dibantu<br><li><strong>#0015#</strong><li>sebagai #6034#;"

    /* ==== PERUBAHAN HAKIM SAJA (HAKIM TUNGGAL) ==== */
    WHEN EXISTS (
      SELECT 1
      FROM perkara b
	  JOIN perkara_hakim_pn ppp ON ppp.perkara_id = b.perkara_id
      WHERE b.perkara_id = #perkara_id#
	    AND ppp.tanggal_penetapan = "#0033#"
        AND YEAR(b.tanggal_surat) = YEAR(CURDATE())
        AND EXISTS (
          SELECT 1
          FROM perkara_hakim_pn hh_old
          WHERE hh_old.perkara_id = b.perkara_id
            AND hh_old.aktif = 'T'
            AND hh_old.tanggal_tidak_aktif IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 
          FROM perkara_panitera_pn pp_old
          WHERE pp_old.perkara_id = b.perkara_id
            AND pp_old.aktif = 'T'
            AND pp_old.tanggal_tidak_aktif IS NOT NULL
        )
        /* saat ini hakim tunggal aktif */
        AND EXISTS (
          SELECT 1 
          FROM perkara_hakim_pn hh_now
          WHERE hh_now.perkara_id = b.perkara_id
            AND hh_now.aktif = 'Y'
            AND hh_now.jabatan_hakim_id = 3
        )
    ) THEN 
      "Susunan majelis sidang sebelumnya mengalami perubahan karena terjadi pergantian Hakim bernama #5406# yang sebelumnya bertugas sedang #5407#, sehingga susunan majelis bersidang menjadi sebagai berikut:<br>-<li><strong>#0012#</strong><li>sebagai #4004#;dan dibantu<br><li><strong>#0015#</strong><li>sebagai #6034#;"

    /* ==== TIDAK ADA PERUBAHAN ==== */
    ELSE 
      'Susunan majelis yang bersidang sama dengan sidang yang lalu;'
  END AS data;
