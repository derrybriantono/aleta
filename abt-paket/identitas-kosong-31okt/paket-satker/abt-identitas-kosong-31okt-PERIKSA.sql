-- PERIKSA abt-identitas-kosong-31okt (BACA SAJA). Baris terakhir harus "SEMUA COCOK".
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (3507,3509,3970,3971,7047,7048,7062,9230,9231,11205,11206) AND MD5(REPLACE(sql_query, CONCAT(DATABASE(), '.'), 'aps_badilag.')) IN ('b2c49821806976b8b577670c374c3034','010f3cb080c0a51d7cca23359502b68e','0b3270992f35b20a69c3b8aaaf00f5ed','3b9da06e2551cf1bdddf7230a2c92ddd','e301c4feae2efcb0794fdff285d8f155','f9552a7f198356fd6394e7c212bdfc37','5a0f3279bc836552bd0337463d59e5ee','dff863fbd41b56f29580f5ddee03a971','57cc0d9e95e7bf2f6a1c2c829089f0af','fffb733939324341021a36f281ef66d9','07245104946e48b1d09d96ed4fbc8f4e')) = 11
  AND isian_rtf_identitas_kosong('<strong>A</strong>, NIK , tempat dan tanggal lahir , 00 0000, agama , pekerjaan , pendidikan , tempat kediaman di X, sebagai <strong>B</strong>;')
    = '<strong>A</strong>, NIK ..., tempat dan tanggal lahir ..., agama Islam, pekerjaan ..., pendidikan ..., tempat kediaman di X, sebagai <strong>B</strong>;'
  AND isian_rtf_identitas_kosong('<strong>A</strong>, NIK 1, tempat dan tanggal lahir P, 1 Mei 1990, agama Islam, pekerjaan Q, pendidikan S1, tempat kediaman di X;')
    = '<strong>A</strong>, NIK 1, tempat dan tanggal lahir P, 1 Mei 1990, agama Islam, pekerjaan Q, pendidikan S1, tempat kediaman di X;',
  'SEMUA COCOK', 'TIDAK COCOK') AS periksa;
