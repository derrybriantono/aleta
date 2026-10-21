-- Paket ABT "abt-x6-penutup-saksi-21okt" (21 Okt 2026): PERIKSA = fungsi ada + perilakunya sama dengan penyaring bot (contoh dihitung oleh aleta_bot/services/penutupSaksi.js)
-- + tak satu pun kelompok saksi di data nyata mencetak butir penutup. Baris terakhir "SEMUA COCOK". Tidak mengubah apa pun.
SET @ok = 1;
SELECT 'tiga fungsi ada' AS butir, (@c := ((SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name IN ('isian_rtf_penutup','isian_rtf_saring_penutup','isian_rtf_ket_saksi'))=3)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'isian_rtf_ket_saksi memanggil penyaring' AS butir, (@c := ((SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name='isian_rtf_ket_saksi' AND LOCATE('isian_rtf_saring_penutup', routine_definition) > 0)=1)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'variabel pemanggil tidak berubah (nama fungsi sama)' AS butir, (@c := ((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 9259 AND 9265 AND LOCATE('isian_rtf_ket_saksi', IFNULL(sql_query, '')) > 0)=7)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'isian_rtf_penutup sama dengan bot atas 353 contoh (137 penutup, 216 bukan)' AS butir, (@c := ((SELECT COUNT(*) FROM (
SELECT 'Bahwa cukup sekian' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa cukup sekian;' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sudah cukup;' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang ingin disampaikan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang ingin saya sampaikan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang akan saksi sampaikan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang dapat disampaikan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi keterangan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada keterangan lain' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada keterangan tambahan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi tidak ada lagi keterangan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sudah tidak ada lagi yang ingin saya sampaikan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sekian' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sekian keterangan saya' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa hanya itu yang saya ketahui' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa itu saja yang saksi sampaikan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa demikian keterangan saya' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi dan sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya sudah tidak sanggup lagi, cukup sekian' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa cukup sekian dan terima kasih' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada, sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak, sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa ya, sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi menjawab' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi memberikan keterangan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'sudah  cukup .' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Tidak ada, sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Tidak, sudah cukup;' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Cukup sekian;' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa, sudah cukup' AS t, '' AS q, 1 AS e
 UNION ALL SELECT '- Bahwa sudah cukup;' AS t, '' AS q, 1 AS e
 UNION ALL SELECT '-   Bahwa sudah cukup;' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'SUDAH CUKUP;' AS t, '' AS q, 1 AS e
 UNION ALL SELECT CONCAT('Sudah', CHAR(10), 'cukup;') AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang ingin diterangkan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang saksi ketahui' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang saya ketahui' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada hal lain yang saya ketahui' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada yang saksi ketahui lagi' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi tidak mampu lagi memberikan keterangan' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya tidak kuat lagi menjawab' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Cukup sekian, terima kasih' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Sampai di sini saja' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Sekian dulu' AS t, '' AS q, 1 AS e
 UNION ALL SELECT 'Sekian lama ia pergi meninggalkan rumah' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa sekian lama Tergugat pergi meninggalkan Penggugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa sudah cukup lama keduanya berpisah tempat tinggal' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa nafkah yang diberikan Tergugat tidak pernah cukup untuk anak-anaknya' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa Tergugat sudah cukup sering memukul Penggugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa cukup banyak barang yang dibawa Tergugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Saksi sudah tidak sanggup lagi merukunkan keduanya' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi tidak sanggup lagi mendamaikan keduanya' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup mendamaikan karena tidak tahu persoalannya' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi tidak sanggup mendamaikan' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa Tergugat tidak sanggup lagi menafkahi Penggugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa Tergugat sudah tidak sanggup lagi hidup bersama Penggugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak ada pekerjaan lain' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak ada halangan secara hukum' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak ada' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi harapan untuk rukun' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang menafkahi anak' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak ada keterangan Penggugat tentang itu' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa hanya itu penyebabnya' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa hanya itu yang diketahui Tergugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa itu saja penyebab pertengkaran mereka' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa demikian keterangan Tergugat kepada saksi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa sampai di sini rumah mereka' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa cukup sekian lama mereka berpisah' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak tahu' AS t, '' AS q, 0 AS e
 UNION ALL SELECT '' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak kuat lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak kuat lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak mampu lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi tidak mampu lagi merukunkan' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Tidak ada yang diketahui tentang sebab perselisihan' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak ada yang saya ketahui' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak ada yang saksi ketahui' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat tidak mampu lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa Penggugat sudah tidak kuat lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'tidak sanggup lagi menunggu tergugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa sudah cukup lama berpisah' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi hidup bersama Tergugat' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Tidak ada;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya tidak ada;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Tidak;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa cukup sekian' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa cukup sekian' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa cukup sekian;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa cukup sekian;' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sudah cukup' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sudah cukup' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sudah cukup;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa sudah cukup;' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa cukup' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa cukup' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi sudah cukup' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi sudah cukup' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya sudah cukup' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya sudah cukup' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang ingin disampaikan' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang ingin disampaikan' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang ingin saya sampaikan' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang ingin saya sampaikan' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang akan saksi sampaikan' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang akan saksi sampaikan' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang dapat disampaikan' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi yang dapat disampaikan' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi keterangan' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak ada lagi keterangan' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saya tidak sanggup lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi sudah tidak sanggup lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa tidak sanggup lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa saksi tidak lagi sanggup' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT 'Bahwa belum sanggup lagi' AS t, '' AS q, 0 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT '- BAHWA SAYA TIDAK SANGGUP LAGI;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, CONCAT('Apakah', CHAR(10), 'saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?') AS q, 0 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, 'Apakah Saudara masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, 'Apakah saudara masih sanggup untuk menasehati Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, 'Apakah masih ada hal lain yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, 'Apakah masih ada yang tanyakan ?' AS q, 1 AS e
 UNION ALL SELECT 'Iya, saya tidak sanggup lagi;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Sudah cukup ;' AS t, 'Apakah masih ada hal lain yang Saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup ;' AS t, 'Apakah masih ada hal lain yang Saudara ingin sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup ;' AS t, 'Apakah masih ada keterangan lain yang ingin Saudara sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup.' AS t, 'Apakah masih ada keterangan yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup.' AS t, 'Apakah masih ada yang Saudara ingin sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada hal lain yang Saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada hal lain yang Saudara ingin sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada hal lain yang akan Saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada hal yang akan Saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada keterangan yang Saudara akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada keterangan yang saudara akan sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada keterangan yang saudara ingin sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada yang ingin Saudara sampaikan ?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada yang ingin saksi sampaikan pada persidangan ini?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada yang ingin saksi sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup;' AS t, 'Apakah masih ada yang saudara ingin sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Sudah cukup' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Tidak ada, cukup.' AS t, 'Apakah masih ada yang saudara ingin sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Tidak ada, sudah cukup.' AS t, 'Apakah masih ada hal lain yang Saudara ingin sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Tidak ada, sudah cukup;' AS t, 'Apakah masih ada ingin saksi sampaikan pada persidangan ini?' AS q, 1 AS e
 UNION ALL SELECT 'Tidak ada, sudah cukup;' AS t, 'Apakah masih ada keterangan yang saksi akan sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Tidak ada, sudah cukup' AS t, 'Apakah masih ada yang ingin saksi sampaikan pada persidangan ini?' AS q, 1 AS e
 UNION ALL SELECT 'Tidak, sudah cukup;' AS t, 'Apakah masih ada keterangan yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT 'Tidak, sudah cukup;' AS t, 'Apakah masih ada yang ingin saudara sampaikan?' AS q, 1 AS e
 UNION ALL SELECT '... meninggal dunia murni karena ... dan tidak ada unsur penganiayan;' AS t, 'Apakah ada unsur penganiayaan sehingga Almarhum meninggal dunia?' AS q, 0 AS e
 UNION ALL SELECT 'Almarhum tidak pernah bercerai dengan suaminya sampai meninggal dunia;' AS t, 'Apakah Almarhum pernah bercerai dengan suaminya?' AS q, 0 AS e
 UNION ALL SELECT 'Almarhumah meninggal dunia murni karena sakit dan tidak ada unsur penganiayan;' AS t, 'Apakah ada unsur penganiayaan sehingga Almarhumah meninggal dunia?' AS q, 0 AS e
 UNION ALL SELECT 'Antara Pemohon dan Termohon tidak ada perselisihan dan pertengkaran;' AS t, 'Apakah antara Pemohon dan Termohon sering terjadi perselisihan dan pertengkaran, dan kapan mulainya?' AS q, 0 AS e
 UNION ALL SELECT 'Antara Penggugat dan Tergugat tidak ada pertengkaran;' AS t, 'Apakah antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran?' AS q, 0 AS e
 UNION ALL SELECT 'Awalnya rumah tangga Penggugat dan Tergugat rukun dan harmonis namun sekarang tidak lagi;' AS t, 'Bagaimana kehidupan rumah tangga Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Keadaan Rumah tangga Penggugat dan Tergugat sudah tidak rukun lagi sejak awal tahun 2022;' AS t, 'Bagaimana keadaan Rumah tangga Penggugat danTergugat yang Saudara ketahui?' AS q, 0 AS e
 UNION ALL SELECT 'Keadaan Rumah tangga Penggugat dan Tergugat sudah tidak rukun lagi sejak tahun 2010;' AS t, 'Bagaimana keadaan Rumah tangga Penggugat dan Tergugat yang Saudara ketahui?' AS q, 0 AS e
 UNION ALL SELECT 'Keadaan Rumah tangga Penggugat dan Tergugat sudah tidak rukun lagi sejak tahun 2018;' AS t, 'Bagaimana keadaan Rumah tangga Penggugat dan Tergugat yang Saudara ketahui?' AS q, 0 AS e
 UNION ALL SELECT 'Keadaan rumah tangga Pemohon dan Termohon sudah tidak rukun lagi sejak tahun 2015;' AS t, 'Bagaimana keadaan Rumah tangga Pemohon dan Termohon yang Saudara ketahui?' AS q, 0 AS e
 UNION ALL SELECT 'Pemohon I dengan Pemohon II tidak pernah bercerai, keduanya hidup rukun sampai saat ini;' AS t, 'Apakah Pemohon I dengan Pemohon II pernah bercerai?' AS q, 0 AS e
 UNION ALL SELECT 'Pemohon dan Termohon saat ini sudah tidak rukun lagi, karena sering cekcok;' AS t, 'Apakah Pemohon dan Termohon masih rukun dan bahagia sekarang ?' AS q, 0 AS e
 UNION ALL SELECT 'Pemohon dan Termohon sudah diupayakan untuk rukun lagi namun tidak berhasil;' AS t, 'Apakah sejak ada masalah, Pemohon dan Termohon pernah diupayakan untuk rukun kembali?' AS q, 0 AS e
 UNION ALL SELECT 'Pemohon dan Termohon sudah pisah tempat tinggal sampai sekarang sudah sekitar 11 bulan;' AS t, 'Apakah Pemohon dan Termohon masih tinggal satu rumah sampai saat ini?' AS q, 0 AS e
 UNION ALL SELECT 'Pemohon dan Termohon sudah tidak rukun dan tidak harmonis lagi;' AS t, 'Apakah Pemohon dan Termohon masih rukun dan harmonis sampai sekarang ?' AS q, 0 AS e
 UNION ALL SELECT 'Pemohon mengajukan cerai terhadap Termohon karena sudah tidak hidup bersama lagi;' AS t, 'Kenapa Pemohon mengajukan cerai terhadap Termohon?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah pisah tempat tinggal sampai sekarang 1 (satu) tahun lebih;' AS t, 'Apakah Penggugat dan Tergugat masih tinggal satu rumah sampai saat ini?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah pisah tempat tinggal sampai sekarang sudah sekitar 10 bulan;' AS t, 'Apakah Penggugat dan Tergugat masih tinggal satu rumah sampai saat ini?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah pisah tempat tinggal sampai sekarang sudah sekitar 6 bulan;' AS t, 'Apakah Penggugat dan Tergugat masih tinggal satu rumah sampai saat ini?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2025 sampai sekarang;' AS t, 'Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah pisah tempat tinggal sejak tahun 2015 sampai sekarang;' AS t, 'Apakah saat ini Penggugat dan Tergugat masih tinggal serumah ?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah pisah tempat tinggal selama 6 (enam) bulan sampai sekarang ;' AS t, 'Apakah Penggugat dan Tergugat masih tinggal satu rumah sampai saat ini?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah pisah tempat tinggal, sejak tahun 2021 sampai saat ini;' AS t, 'Apakah Penggugat dan Tergugat masih tinggal satu rumah sampai saat ini?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah tidak ada lagi hubungan komunikasi sampai sekarang ;' AS t, 'Apakah Penggugat dan Tergugat masih ada hubungan komunikasi ?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah tidak ada lagi hubungan komunikasi sampai sekarang ;' AS t, 'Siapa yang pergi meninggalkan tempat kediaman bersama ? Apakah Penggugat dan Tergugat masih ada hubungan komunikasi ?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah tidak ada lagi hubungan komunikasi sampai sekarang;' AS t, 'Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah tidak tinggal bersama lagi kurang lebih 8 (delapan) bulan;' AS t, 'Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat sudah tidak tinggal bersama lagi;' AS t, 'Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat telah berpisah selama 1 tahun lebih sampai sekarang;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat tidak rukun lagi;' AS t, 'Apakah Penggugat dan Tergugat masih rukun dan bahagia sekarang ?' AS q, 0 AS e
 UNION ALL SELECT 'Penggugat dan Tergugat tinggal bersama di rumah orangtua Penggugat sampai berpisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Penyebab lainnya adalah karena Tergugat telah menikah lagi dengan perempuan lain;' AS t, 'Apakah ada hal lain yang menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Penyebab lainnya adalah karena Tergugat tidak menafkahi lagi Penggugat;' AS t, 'Apakah ada hal lain yang menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Penyebab lainnya adalah karena Termohon telah menikah lagi dengan laki-laki lain;' AS t, 'Apakah ada hal lain yang menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon?' AS q, 0 AS e
 UNION ALL SELECT 'Saat ini Penggugat dan Tergugat sudah pisah tempat tinggal bersama lagi;' AS t, 'Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?' AS q, 0 AS e
 UNION ALL SELECT 'Sampai saat ini Penggugat dan Tergugat belum dikaruniai anak;' AS t, 'Apakah Penggugat dan Tergugat sudah dikarunia anak?' AS q, 0 AS e
 UNION ALL SELECT 'Saya cukup sering melihat Penggugat dan Tergugat berselisih dan bertengkar;' AS t, 'Berapa kali saksi melihat perselisihan dan pertengkaran Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya cukup sering melihat dan mendengar Penggugat dan Tergugat bertengkar;' AS t, 'Berapa kali saksi melihat dan mendengar Penggugat dan Tergugat bertengkar?' AS q, 0 AS e
 UNION ALL SELECT 'Saya cukup sering melihat dan mendengar langsung Pemohon dan Termohon bertengkar;' AS t, 'Apakah saksi pernah melihat atau mendengar langsung Pemohon dan Termohon bertengkar?' AS q, 0 AS e
 UNION ALL SELECT 'Saya juga tidak ketahui hal tersebut;' AS t, 'Apakah selama berpisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Saya sudah tidak sanggup lagi merukunkan Penggugat dan Tergugat;' AS t, 'Apakah saksi masih sanggup merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak ada hubungan keluarga dengan Pemohon, tetapi Termohon adalah tante saya;' AS t, 'Apakah saudara mempunyai hubungan keluarga dengan Pemohon dan Termohon ?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak mengetahui penyebab Tergugat sudah tidak kembali lagi;' AS t, 'Apakah saksi tahu penyebab sehingga Tergugat sudah tidak kembali ke Donggala?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak pernah lagi melihat Pemohon berkomunikasi dengan Termohon;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi karena Penggugat dan Tergugat sudah tidak mau rukun lagi;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi untuk merukunkan keduanya;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Saya tidak sanggup lagi;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Pemohon dan Termohon?' AS q, 0 AS e
 UNION ALL SELECT 'Sebab lainnya yang saya ketahui adalah Tergugat tidak memberikan nafkah kepada Penggugat;' AS t, 'Apakah masih ada penyebab lain yang mengakibatkan rumah tangga Penggugat dan Tergugat tidak rukun dan harmonis ?' AS q, 0 AS e
 UNION ALL SELECT 'Sejak Penggugat dan Tergugat berpisah tempat tinggal sudah tidak ada lagi komunikasi ;' AS t, 'Sejak Penggugat dan Tergugat berpisah tempat tinggal apakah masih ada komunikasi antara Penggugat dan Tergugat ?' AS q, 0 AS e
 UNION ALL SELECT 'Sejak Penggugat dan Tergugat berpisah tempat tinggal sudah tidak ada lagi komunikasi ;' AS t, 'Sejak Penggugat dan Tergugat berpisah tempat tinggal, apakah masih ada komunikasi ?' AS q, 0 AS e
 UNION ALL SELECT 'Sejak bulan September 2024 Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Sejak bulan September 2024 antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Sejak pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah antara Penggugat dan Tergugat masih ada komunikasi sejak pisah?' AS q, 0 AS e
 UNION ALL SELECT 'Selama 1 (satu) terakhir antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah sekarang antara Penggugat dan Tergugat tidak ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama berpisah Pemohon dan Termohon sudah tidak pernah lagi berkomunikasi;' AS t, 'Apakah Pemohon dan Termohon masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Selama berpisah Penggugat dan Tergugat sudah tidak pernah lagi berkomunikasi;' AS t, 'Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Selama berpisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Selama berpisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama berpisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama berpisah antara Penggugat dan Tergugat sudah tidak ada lagi komunikasi;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Selama berpisah antara Penggugat dan Tergugat sudah tidak ada lagi komunikasi;' AS t, 'Apakah selama berpisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama berpisah tempat tinggal Penggugat dan Tergugat sudah tidak ada komunikasi lagi ;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pergi meninggalkan kediaman bersama, Pemohon tidak pernah kembali lagi;' AS t, 'Apakah selama Pemohon pergi meninggalkan rumah kediaman bersama tidak pernah kembali lagi bersama Termohon?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pernikahan Pemohon I dan Pemohon II sampai sekarang tidak pernah bercerai ;' AS t, 'Selama Pernikahan Pemohon I dan Pemohon II apakah pernah bercerai ?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah Pemohon dan Termohon tidak ada komunikasi lagi;' AS t, 'Apakah Pemohon dan Termohon masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah Pemohon dan Termohon tidak ada komunikasi lagi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah Penggugat dan Tergugat tidak ada komunikasi lagi;' AS t, 'Apakah Pemohon dan Termohon masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah Penggugat dan Tergugat tidak ada komunikasi lagi;' AS t, 'Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Pemohon dan Termohon sudah lama tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Pemohon dan Termohon sudah tidak ada komunikasi ;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Pemohon dan Termohon sudah tidak ada komunikasi;' AS t, 'Apakah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Pemohon dan Termohon sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Pemohon dan Termohon sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon tinggal masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Pemohon tinggal Termohon sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi lagi ;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi lagi sejak berpisah;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Dimana Penggugat dan Tergugat masing-masing bertempat tinggal setelah keduanya berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Pernahkah ada upaya untuk merukunkan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak ada lagi komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Selama pisah antara Penggugat dan Tergugat sudah tidak saling berkomunikasi lagi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Sepengetahuan saksi selama pisah antara Pemohon dan Termohon sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Sepengetahuan saya rumah tangga Penggugat dan Tergugat sudah tidak rukun lagi;' AS t, 'Bagaimana keadaan Rumah tangga Penggugat dan Tergugat yang Saudara ketahui?' AS q, 0 AS e
 UNION ALL SELECT 'Sepengetahuan saya selama pisah Pemohon dan Termohon tidak ada komunikasi lagi;' AS t, 'Apakah Pemohon dan Termohon masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Sepengetahuan saya selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Sepengetahuan saya, saya tidak sanggup lagi;' AS t, 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saksi antara Pemohon dan Termohon sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saksi meninggal dunia murni dan tidak ada unsur penganiayan;' AS t, 'Apakah ada unsur penganiayaan sehingga Almarhum meninggal dunia?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saksi sampai saat ini Penggugat dan Tergugat sudah tidak rukun lagi;' AS t, 'Apakah sekarang ini Penggugat dan Tergugat masih rukun?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saksi selama pisah Penggugat dan Tergugat tidak ada komunikasi lagi;' AS t, 'Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saksi selama pisah antara Pemohon dan Termohon sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saksi selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya Penggugat dan Tergugat tidak pernah kembali lagi sampai sekarang;' AS t, 'Apakah Penggugat pernah kembali lagi sejak pergi meninggalkan Tergugat?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya Tergugat tidak pernah lagi memberi nafkah kepada Penggugat;' AS t, 'Apakah selama pisah, Tergugat masih memberi nafkah kepada Penggugat?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya selama berpisah Tergugat tidak pernah lagi memberikan nafkah kepada Penggugat;' AS t, 'Apakah selama pisah Tergugat masih memberikan nafkah kepada Penggugat?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya selama pisah Pemohon dan Termohon tidak ada komunikasi lagi;' AS t, 'Apakah Pemohon dan Termohon masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya selama pisah Penggugat dan Tergugat tidak ada komunikasi lagi;' AS t, 'Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya tidak ada ada pihak yang keberatan dengan permohonan Pemohon;' AS t, 'Apakah ada pihak yang keberatan dengan permohonan Pemohon ini?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya, selama pisah antara Pemohon dan Termohon sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya, selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;' AS t, 'Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setahu saya, tidak ada lagi ahli waris selain Para Pemohon;' AS t, 'Apakah masih ada lagi ahli waris selain Para Pemohon?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah berpisah antara Pemohon dan Termohon tidak ada lagi hubungan komunikasi;' AS t, 'Apakah selama pisah antara Pemohon dan Termohon masih ada komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah berpisah antara Pemohon dan Termohon tidak ada lagi hubungan komunikasi;' AS t, 'Apakah selama pisah tempat tinggal Pemohon dan Termohon masih menjalin komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah berpisah antara Penggugat dan Tergugat tidak ada lagi hubungan komunikasi;' AS t, '' AS q, 0 AS e
 UNION ALL SELECT 'Setelah berpisah antara Penggugat dan Tergugat tidak ada lagi hubungan komunikasi;' AS t, 'Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah berpisah antara Penggugat dan Tergugat tidak ada lagi hubungan komunikasi;' AS t, 'Apakah selama pisah tempat tinggal Penggugat dan Tergugat masih menjalin komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah berpisah antara Penggugat dan Tergugat tidak ada lagi komunikasi;' AS t, 'Apakah selama pisah tempat tinggal Penggugat dan Tergugat masih saling komunikasi?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Pemohon dan Termohon tinggal bersama Palu sampai berpisah;' AS t, 'Dimana Pemohon dan Termohon tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Pemohon dan Termohon tinggal bersama di Desa Loru sampai berpisah;' AS t, 'Dimana Pemohon dan Termohon tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Pemohon dan Termohon tinggal bersama di rumah Pemohon sampai berpisah;' AS t, 'Dimana Pemohon dan Termohon tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Pemohon dan Termohon tinggal bersama dirumah Termohon sampai berpisah;' AS t, 'Dimana Pemohon dan Termohon tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Pemohon dan Termohon tinggal bersama dirumah pemohon sampai berpisah;' AS t, 'Dimana Pemohon dan Termohon tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Pemohon dan Termohon tinggal dirumah bersama sampai berpisah;' AS t, 'Dimana Pemohon dan Termohon tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah Penggugat sampai berpisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah Tergugat sampai berpisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah Tergugat sampai pisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah bersama sampai berpisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah saya sampai berpisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah saya sampai pisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal bersama di rumah sendiri sampai berpisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal bersama dirumah saya sampai berpisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal di rumah orang tua Penggugat sampai pisah;' AS t, 'Dimanakah Penggugat dan Tergugat tinggal setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Setelah menikah Penggugat dan Tergugat tinggal di rumah saya di Desa Lolu sampai Berpisah;' AS t, 'Dimana Penggugat dan Tergugat tinggal bersama setelah menikah?' AS q, 0 AS e
 UNION ALL SELECT 'Tergugat sudah tidak pernah memberikan nafkah lagi kepada Penggugat;' AS t, 'Apakah Tergugat masih memberikan nafkah kepada Penggugat?' AS q, 0 AS e
) z WHERE isian_rtf_penutup(z.t, z.q) <> z.e)=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'isian_rtf_penutup: NULL dan teks sangat panjang bukan penutup' AS butir, (@c := (isian_rtf_penutup(NULL, NULL)=0 AND isian_rtf_penutup(REPEAT('cukup ', 100), '')=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'saring: penutup di ujung jawaban beberapa baris dibuang' AS butir, (@c := (isian_rtf_saring_penutup(CONCAT('Tergugat pergi sejak 2024;', CHAR(10), 'Sudah cukup;'), '')='Tergugat pergi sejak 2024;')) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'saring: seluruh jawaban penutup (terbelah baris) -> kosong' AS butir, (@c := (isian_rtf_saring_penutup(CONCAT('Sudah', CHAR(10), 'cukup;'), '')='' AND isian_rtf_saring_penutup('Sudah cukup;', '')='' AND isian_rtf_saring_penutup(NULL, '')='')) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'saring: pecahan baris di tengah kalimat tidak dipotong' AS butir, (@c := (isian_rtf_saring_penutup(CONCAT('nafkah yang diberikan Tergugat kepada Penggugat tidak', CHAR(10), 'cukup;'), '')=CONCAT('nafkah yang diberikan Tergugat kepada Penggugat tidak', CHAR(10), 'cukup;'))) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'saring: jawaban biasa tidak berubah sama sekali' AS butir, (@c := (isian_rtf_saring_penutup('Saya kenal Penggugat dan Tergugat;', '')='Saya kenal Penggugat dan Tergugat;' AND isian_rtf_saring_penutup(CONCAT('Satu;', CHAR(10), '', CHAR(10), 'Dua;'), '')=CONCAT('Satu;', CHAR(10), '', CHAR(10), 'Dua;'))) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'saring: tidak sanggup lagi - jawaban perkara bila pertanyaannya mendamaikan, penutup bila pertanyaannya penutup' AS butir, (@c := (isian_rtf_saring_penutup('Saya tidak sanggup lagi;', 'Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?')='Saya tidak sanggup lagi;' AND isian_rtf_saring_penutup('Saya tidak sanggup lagi;', 'Apakah masih ada yang ingin saudara sampaikan?')='' AND isian_rtf_saring_penutup('Saya tidak sanggup lagi;', '')='Saya tidak sanggup lagi;')) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'isian_rtf_ket_saksi tanpa saksi/NULL tetap ''...''' AS butir, (@c := (isian_rtf_ket_saksi(0, NULL)='...' AND isian_rtf_ket_saksi(0, '0')='...')) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'data nyata: tidak ada kelompok saksi yang keluarannya memuat butir penutup' AS butir, (@c := ((SELECT COUNT(*) FROM (SELECT DISTINCT perkara_id, saksi_id FROM abt_keterangan_saksi WHERE perkara_id IS NOT NULL AND saksi_id IS NOT NULL AND (jawaban LIKE '%cukup%' OR jawaban LIKE '%sekian%' OR jawaban LIKE '%tidak ada%' OR jawaban LIKE '%sampai di sini%')) g WHERE isian_rtf_ket_saksi(g.perkara_id, CAST(g.saksi_id AS CHAR)) REGEXP '(^|<br>)-   Bahwa ((tidak ada|tidak|ya|iya|baik), )?((saya|saksi) )?((sudah|telah|memang|sekarang) )*(cukup|sekian|tidak ada lagi|sampai di sini)( sekian| saja| dulu)*[ ;.,]*(<br>|$)')=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT 'data nyata: jumlah butir - Bahwa keluaran = jumlah jawaban yang bukan penutup' AS butir, (@c := ((SELECT COUNT(*) FROM (SELECT g.perkara_id, g.saksi_id, isian_rtf_ket_saksi(g.perkara_id, CAST(g.saksi_id AS CHAR)) AS o,
       (SELECT COUNT(*) FROM abt_keterangan_saksi k WHERE k.perkara_id = g.perkara_id AND k.saksi_id = g.saksi_id AND k.jawaban IS NOT NULL AND CHAR_LENGTH(k.jawaban) > 0 AND NOT (BINARY k.jawaban = '0')
          AND CHAR_LENGTH(isian_rtf_saring_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), ''))) > 0) AS n
       FROM (SELECT DISTINCT perkara_id, saksi_id FROM abt_keterangan_saksi WHERE perkara_id IS NOT NULL AND saksi_id IS NOT NULL AND (jawaban LIKE '%cukup%' OR jawaban LIKE '%sekian%' OR jawaban LIKE '%tidak ada%' OR jawaban LIKE '%sampai di sini%')) g) z
     WHERE CASE WHEN z.n = 0 THEN z.o <> '...' ELSE ((CHAR_LENGTH(z.o) - CHAR_LENGTH(REPLACE(z.o, '-   Bahwa ', ''))) / 10) <> z.n END)=0)) AS cocok;
SET @ok = @ok AND IFNULL(@c, 0);
SELECT IF(@ok = 1, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil;
