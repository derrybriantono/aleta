-- Periksa hasil pemasangan: tiap baris harus cocok = 1, dan baris terakhir "SEMUA COCOK".
SELECT 4500 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4500) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4500 AND sql_query IS NULL AND MD5(nama) = 'af2a1d04a9861ff961c32b4dcb661998' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4501 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4501) AS panjang, 735 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4501 AND MD5(sql_query) = '4341c6375e214587458fdc5eb2a1d7c7' AND MD5(nama) = 'c2c43c845aaee2bbea6f99a4edcd6042' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4502 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4502) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4502 AND sql_query IS NULL AND MD5(nama) = '20234bc188c39c8916ae1a64809c07d2' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4503 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4503) AS panjang, 405 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4503 AND MD5(sql_query) = '7da8c307e6b54259b8a3e39148c30503' AND MD5(nama) = 'a2a0a381a529cc7190b0094137c1447e' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4504 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4504) AS panjang, 1969 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4504 AND MD5(sql_query) = 'ac91d1021b26faf4d1000d6ae4e3d411' AND MD5(nama) = '88fa8bb9e47fc6a7ead1da4783bd9293' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4505 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4505) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4505 AND sql_query IS NULL AND MD5(nama) = 'bc13c06f1a74940e541437f0118cbf76' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4506 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4506) AS panjang, 790 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4506 AND MD5(sql_query) = '9122e8e0ee3feb30d82eba826ca9ac47' AND MD5(nama) = 'eb01c22e395e6cbbdb997b3054f6941b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4507 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4507) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4507 AND sql_query IS NULL AND MD5(nama) = 'd9bd6ff10a5dd164a5cb0d309f26e6da' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4508 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4508) AS panjang, 408 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4508 AND MD5(sql_query) = '5d7461160cc079be8dc8ada4dee17b39' AND MD5(nama) = '42b722b43b374310d25f45eda11a598c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4509 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4509) AS panjang, 1242 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4509 AND MD5(sql_query) = '2fc7a18a6f02c6eda3b0f1bfa8c44842' AND MD5(nama) = '28652ac8da68d8b8353561015500ac6b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4510 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4510) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4510 AND sql_query IS NULL AND MD5(nama) = '4f6bb4aa65a67b209d4a18400a8af0f3' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4511 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4511) AS panjang, 501 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4511 AND MD5(sql_query) = '03ba188799dbf6a980e300e5161ef633' AND MD5(nama) = 'bb394f4568b2a120c09e87cac379be7f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4512 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4512) AS panjang, 716 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4512 AND MD5(sql_query) = '1f98d615ec29833d9b0662e982029e47' AND MD5(nama) = '495867e471c88a92a2fc559b7085ec41' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4513 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4513) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4513 AND sql_query IS NULL AND MD5(nama) = '3636c1a0f3af72a753a4bbbbf947bc61' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4514 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4514) AS panjang, 2080 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4514 AND MD5(sql_query) = 'a62c7095472a0e9fe5c3e97eebc1c70d' AND MD5(nama) = '532025066a3fa1ff0dbe24e78541fdbc' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4515 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4515) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4515 AND sql_query IS NULL AND MD5(nama) = 'c3e74e403395e45bcb6d09d9c7c909f2' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4516 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4516) AS panjang, 453 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4516 AND MD5(sql_query) = '0976f12fc9a781b05b78470d1c306ca0' AND MD5(nama) = 'd2e675e3dae8ba4c1b50a3777c859dc5' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4517 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4517) AS panjang, 588 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4517 AND MD5(sql_query) = 'd1d9f30a7a14534315d9dacec157387b' AND MD5(nama) = '287eb2a05f6b91c0e07b330bb12d3165' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4520 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4520) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4520 AND sql_query IS NULL AND MD5(nama) = '240f7900ff9b6efaf05220f93dd019fb' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4521 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4521) AS panjang, 1174 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4521 AND MD5(sql_query) = 'eca805bf2941c7ca7a401d15d4debd6d' AND MD5(nama) = 'ba2261364ad6619e08d0cc6f728ffe54' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4530 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4530) AS panjang, 10729 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4530 AND MD5(sql_query) = 'bac0729e291deef41e038835755c2ae4' AND MD5(nama) = '769728bee1cf720db8c91212f94d0ee0' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4531 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4531) AS panjang, 1084 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4531 AND MD5(sql_query) = 'cf0854488a7de3a59a23d03d4e2350c2' AND MD5(nama) = '59f36b434e786f5463a1b23c0aab6133' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4532 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4532) AS panjang, 920 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4532 AND MD5(sql_query) = '26c4cc448443ab65855ad7371cabd4c6' AND MD5(nama) = '7c9f8a2a76d0eedfa7005ab113ab2a9c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4534 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4534) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4534 AND sql_query IS NULL AND MD5(nama) = '57eb35602014f501367154fbdfa0bc29' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4535 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4535) AS panjang, 404 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4535 AND MD5(sql_query) = '84f59c9e54aa9de436c39400c9c2eae2' AND MD5(nama) = 'ad02e72e1e734138866d66a2acdf8360' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4540 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4540) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4540 AND sql_query IS NULL AND MD5(nama) = '158b73ba005e73692415be9e870eaf7f' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4541 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4541) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4541 AND sql_query IS NULL AND MD5(nama) = '76cc51b0b09b07555bf908c51b26a988' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4542 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4542) AS panjang, 1723 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4542 AND MD5(sql_query) = '937295958b443e43a8991359159c7b1b' AND MD5(nama) = '482a8e495ae774af554f5d304c6bbd60' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4543 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4543) AS panjang, 1000 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4543 AND MD5(sql_query) = '88394787558a06afdaa965d061805d05' AND MD5(nama) = 'd5fd7a02c914766346918d13b423d3e6' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 0 AS no_var, NULL AS panjang, NULL AS panjang_harap, IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599) = 29, 1, 0) AS cocok;
SELECT IF(SUM(c.cocok) = 30, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil FROM (
SELECT 4500 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4500) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4500 AND sql_query IS NULL AND MD5(nama) = 'af2a1d04a9861ff961c32b4dcb661998' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4501 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4501) AS panjang, 735 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4501 AND MD5(sql_query) = '4341c6375e214587458fdc5eb2a1d7c7' AND MD5(nama) = 'c2c43c845aaee2bbea6f99a4edcd6042' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4502 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4502) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4502 AND sql_query IS NULL AND MD5(nama) = '20234bc188c39c8916ae1a64809c07d2' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4503 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4503) AS panjang, 405 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4503 AND MD5(sql_query) = '7da8c307e6b54259b8a3e39148c30503' AND MD5(nama) = 'a2a0a381a529cc7190b0094137c1447e' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4504 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4504) AS panjang, 1969 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4504 AND MD5(sql_query) = 'ac91d1021b26faf4d1000d6ae4e3d411' AND MD5(nama) = '88fa8bb9e47fc6a7ead1da4783bd9293' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4505 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4505) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4505 AND sql_query IS NULL AND MD5(nama) = 'bc13c06f1a74940e541437f0118cbf76' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4506 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4506) AS panjang, 790 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4506 AND MD5(sql_query) = '9122e8e0ee3feb30d82eba826ca9ac47' AND MD5(nama) = 'eb01c22e395e6cbbdb997b3054f6941b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4507 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4507) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4507 AND sql_query IS NULL AND MD5(nama) = 'd9bd6ff10a5dd164a5cb0d309f26e6da' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4508 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4508) AS panjang, 408 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4508 AND MD5(sql_query) = '5d7461160cc079be8dc8ada4dee17b39' AND MD5(nama) = '42b722b43b374310d25f45eda11a598c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4509 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4509) AS panjang, 1242 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4509 AND MD5(sql_query) = '2fc7a18a6f02c6eda3b0f1bfa8c44842' AND MD5(nama) = '28652ac8da68d8b8353561015500ac6b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4510 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4510) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4510 AND sql_query IS NULL AND MD5(nama) = '4f6bb4aa65a67b209d4a18400a8af0f3' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4511 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4511) AS panjang, 501 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4511 AND MD5(sql_query) = '03ba188799dbf6a980e300e5161ef633' AND MD5(nama) = 'bb394f4568b2a120c09e87cac379be7f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4512 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4512) AS panjang, 716 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4512 AND MD5(sql_query) = '1f98d615ec29833d9b0662e982029e47' AND MD5(nama) = '495867e471c88a92a2fc559b7085ec41' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4513 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4513) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4513 AND sql_query IS NULL AND MD5(nama) = '3636c1a0f3af72a753a4bbbbf947bc61' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4514 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4514) AS panjang, 2080 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4514 AND MD5(sql_query) = 'a62c7095472a0e9fe5c3e97eebc1c70d' AND MD5(nama) = '532025066a3fa1ff0dbe24e78541fdbc' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4515 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4515) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4515 AND sql_query IS NULL AND MD5(nama) = 'c3e74e403395e45bcb6d09d9c7c909f2' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4516 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4516) AS panjang, 453 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4516 AND MD5(sql_query) = '0976f12fc9a781b05b78470d1c306ca0' AND MD5(nama) = 'd2e675e3dae8ba4c1b50a3777c859dc5' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4517 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4517) AS panjang, 588 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4517 AND MD5(sql_query) = 'd1d9f30a7a14534315d9dacec157387b' AND MD5(nama) = '287eb2a05f6b91c0e07b330bb12d3165' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4520 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4520) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4520 AND sql_query IS NULL AND MD5(nama) = '240f7900ff9b6efaf05220f93dd019fb' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4521 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4521) AS panjang, 1174 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4521 AND MD5(sql_query) = 'eca805bf2941c7ca7a401d15d4debd6d' AND MD5(nama) = 'ba2261364ad6619e08d0cc6f728ffe54' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4530 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4530) AS panjang, 10729 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4530 AND MD5(sql_query) = 'bac0729e291deef41e038835755c2ae4' AND MD5(nama) = '769728bee1cf720db8c91212f94d0ee0' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4531 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4531) AS panjang, 1084 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4531 AND MD5(sql_query) = 'cf0854488a7de3a59a23d03d4e2350c2' AND MD5(nama) = '59f36b434e786f5463a1b23c0aab6133' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4532 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4532) AS panjang, 920 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4532 AND MD5(sql_query) = '26c4cc448443ab65855ad7371cabd4c6' AND MD5(nama) = '7c9f8a2a76d0eedfa7005ab113ab2a9c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4534 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4534) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4534 AND sql_query IS NULL AND MD5(nama) = '57eb35602014f501367154fbdfa0bc29' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4535 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4535) AS panjang, 404 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4535 AND MD5(sql_query) = '84f59c9e54aa9de436c39400c9c2eae2' AND MD5(nama) = 'ad02e72e1e734138866d66a2acdf8360' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4540 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4540) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4540 AND sql_query IS NULL AND MD5(nama) = '158b73ba005e73692415be9e870eaf7f' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4541 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4541) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4541 AND sql_query IS NULL AND MD5(nama) = '76cc51b0b09b07555bf908c51b26a988' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4542 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4542) AS panjang, 1723 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4542 AND MD5(sql_query) = '937295958b443e43a8991359159c7b1b' AND MD5(nama) = '482a8e495ae774af554f5d304c6bbd60' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4543 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4543) AS panjang, 1000 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4543 AND MD5(sql_query) = '88394787558a06afdaa965d061805d05' AND MD5(nama) = 'd5fd7a02c914766346918d13b423d3e6' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 0 AS no_var, NULL AS panjang, NULL AS panjang_harap, IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4500 AND 4599) = 29, 1, 0) AS cocok
) c;
