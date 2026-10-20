-- abt-u3-itsbat-aua: hapus HANYA variabel baru yang isinya masih persis paket (md5), lalu laporkan sisa.
DELETE FROM abt_variabel WHERE no_var=4300 AND MD5(nama)='43fe73751bead45d56207af704480707' AND sql_query IS NULL AND MD5(default_data)='9769d6d3814b35a3c91e3630ca60f2ac';
DELETE FROM abt_variabel WHERE no_var=4301 AND MD5(nama)='d39af26e0f3434043eac29fcbda4a3bd' AND sql_query IS NULL AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4302 AND MD5(nama)='443e166840a4f65e4e2e041deaa1fb73' AND sql_query IS NULL AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4303 AND MD5(nama)='16c2cd0f2858980a2195acebdc2fab00' AND MD5(sql_query)='d86abd141b6927cd0145837ed26d4574' AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4305 AND MD5(nama)='9029ecde45d77b7451bcf4be7c35b261' AND sql_query IS NULL AND MD5(default_data)='a6074562e97295e352cb1a93711ee99b';
DELETE FROM abt_variabel WHERE no_var=4306 AND MD5(nama)='6d8d3f1345d8182118206d62238e6d54' AND MD5(sql_query)='905715cdf295255a0832752cca4e35ad' AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4307 AND MD5(nama)='9d6c7424ad221c458efca10b566ba5a1' AND MD5(sql_query)='3e12245f0df318ac614aa2261224e049' AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4308 AND MD5(nama)='28ddb1f89fb4b08fbff778d228caef4f' AND MD5(sql_query)='8d64342ffd815ebdb653eb26a201daf5' AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4310 AND MD5(nama)='ce39b3ece65d6825100d52b286036d4d' AND sql_query IS NULL AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4311 AND MD5(nama)='a025f0f3b1d21a6ba46ab68588161674' AND sql_query IS NULL AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4312 AND MD5(nama)='1660140c478170646450432a99560207' AND MD5(sql_query)='722bbae49b5b99caec239fdfa5720dcc' AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4313 AND MD5(nama)='a6ad958b9c7124e76a77fd61a69dc32e' AND MD5(sql_query)='ec4c911830574999005e8d0b4d46606b' AND default_data IS NULL;
DELETE FROM abt_variabel WHERE no_var=4314 AND MD5(nama)='d44ba38478892950b6ee9d60ed43d6a5' AND sql_query IS NULL AND MD5(default_data)='a734b39cd75655582f0ea9d450a7a30e';
DELETE FROM abt_variabel WHERE no_var=4315 AND MD5(nama)='ab73383d1c02ba7d44f09895a46beeef' AND sql_query IS NULL AND MD5(default_data)='eeae6c8289bb667bfe093f3f80138a21';
SELECT IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4300 AND 4399)=0, 'PULIH COCOK', CONCAT('PULIH TIDAK COCOK - masih ada ', (SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4300 AND 4399), ' baris 4300-4399 (sudah disunting sesudah dipasang? periksa dengan tangan)')) AS hasil;
