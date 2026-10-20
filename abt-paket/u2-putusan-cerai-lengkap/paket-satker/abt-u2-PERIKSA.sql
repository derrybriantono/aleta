-- Periksa hasil pemasangan paket U2: tabel rinci (tiap baris cocok = 1), lalu baris terakhir "SEMUA COCOK".
SELECT t.no_var, t.panjang, t.panjang_harap, t.cocok FROM (
SELECT 4100 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4100) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4100 AND sql_query IS NULL AND MD5(nama) = 'e2935e770d9979d40901dad37d4c1c2d' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4101 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4101) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4101 AND sql_query IS NULL AND MD5(nama) = 'b3d936a5dad5301b8a7e9b0fef437599' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4102 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4102) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4102 AND sql_query IS NULL AND MD5(nama) = 'f9f4a07110337bb12dd6b648a1014924' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4103 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4103) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4103 AND sql_query IS NULL AND MD5(nama) = 'cccb056604501d3a2e580f83e154c609' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4104 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4104) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4104 AND sql_query IS NULL AND MD5(nama) = '6bb91979304363fc47c65c5d9f5363cc' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4105 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4105) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4105 AND sql_query IS NULL AND MD5(nama) = 'db641e414b2d0489827c9b4e3b756570' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4106 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4106) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4106 AND sql_query IS NULL AND MD5(nama) = 'bd0d88bda0fb7ac4d2c3db146589ca1a' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4107 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4107) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4107 AND sql_query IS NULL AND MD5(nama) = 'ffc500aed3a52e264251a573856d1fb5' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4108 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4108) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4108 AND sql_query IS NULL AND MD5(nama) = '8673492b3268cfb450ec5a23e7da1aa4' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4109 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4109) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4109 AND sql_query IS NULL AND MD5(nama) = 'b06d84578c44956f099aa6bc7d78498e' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4140 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4140) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4140 AND MD5(sql_query) = '65c840a62eb186039aad3b3fe8df7401' AND MD5(nama) = '4a572cc506d619de35b1e54d05817380' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4141 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4141) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4141 AND MD5(sql_query) = '99373cd6d407df8f85bac560e9bcbec8' AND MD5(nama) = '17d6370497273067e04bc4e5ca007e9a' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4142 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4142) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4142 AND MD5(sql_query) = 'ad237a2952545b10c91a9fbc0feb6bf5' AND MD5(nama) = '34e5cea47106f1077b49b6e23999197c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4143 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4143) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4143 AND MD5(sql_query) = '6ca4ebda1713d2363ecc45ab2e6e053b' AND MD5(nama) = 'ee265dccbfe9294a6c5d5af383949490' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4144 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4144) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4144 AND MD5(sql_query) = '1027b480622cb5900ce44453f929d57a' AND MD5(nama) = 'bccffb1f3a0cc23d42657e897584ff99' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4145 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4145) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4145 AND MD5(sql_query) = 'e945c2fd5a6f6469953da45cf7af888f' AND MD5(nama) = '663b445e3c7d6a19511b5013e09927f4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4146 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4146) AS panjang, 8968 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4146 AND MD5(sql_query) = '96b10258e6a8eeb2a2fa87abe6da8400' AND MD5(nama) = 'e30df2e06bca97f313b80be1cfb14387' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4110 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4110) AS panjang, 22601 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4110 AND MD5(sql_query) = '343394c8e5c0b2a0bfb44d41726f208c' AND MD5(nama) = 'a4b1760839792332e3e1af3e92ab8ec0' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4111 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4111) AS panjang, 16277 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4111 AND MD5(sql_query) = '2ec1845a880f9cf3a57f7b20618627ad' AND MD5(nama) = 'd33c22d73c18bc611575cefc60c5f477' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4112 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4112) AS panjang, 17352 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4112 AND MD5(sql_query) = 'f26488e30e57c32a8abca1e7d24f8371' AND MD5(nama) = '310550f318537a357588b8d65c1db23f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4113 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4113) AS panjang, 16761 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4113 AND MD5(sql_query) = '60b3860d013f522494a25dcac8ee7708' AND MD5(nama) = '7e0af9ba97b1cdfab54695a3ba8445d9' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4114 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4114) AS panjang, 10871 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4114 AND MD5(sql_query) = 'dc51b6cedfea23d736d37640adde275a' AND MD5(nama) = 'c02cdc60564a0b0ff8862ae27d399c1f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4115 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4115) AS panjang, 12117 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4115 AND MD5(sql_query) = '462d18ceaa4bc64aeff2ad95d3f5d1b9' AND MD5(nama) = 'fdce9714014575a5dcb56a71d44f2f92' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4116 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4116) AS panjang, 10739 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4116 AND MD5(sql_query) = '5d52541c7c813c7b78f9ebf06cb08cb1' AND MD5(nama) = '2b8e6571d255e3f3ba8e664e8aa70a9e' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4117 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4117) AS panjang, 9654 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4117 AND MD5(sql_query) = '387b524c5fba98c4d5f7d70d6ca57405' AND MD5(nama) = '11a18659b4584a91f4e907d909bff598' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4118 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4118) AS panjang, 11484 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4118 AND MD5(sql_query) = '94bd20d1581b11c59fba0d578e9d3e80' AND MD5(nama) = '1165c0beee02dc833bd969b387c60ec6' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4119 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4119) AS panjang, 53914 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4119 AND MD5(sql_query) = '104852899a8428b9690d46c2514e8e25' AND MD5(nama) = 'c0b33ad5d43cd14005eb640c0d0688d2' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4130 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4130) AS panjang, 9287 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4130 AND MD5(sql_query) = '982e944bf1f4ae4cdb0ab395674e19ed' AND MD5(nama) = '91f45db390a7093d84f63f95e9528c1c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4131 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4131) AS panjang, 9321 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4131 AND MD5(sql_query) = '1e604019849c3fef14c96b879fe76922' AND MD5(nama) = '8bc0f9c3f974b7c56079b5c620edb260' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4132 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4132) AS panjang, 9967 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4132 AND MD5(sql_query) = '813ca7e1beb921d7affec2535fe35310' AND MD5(nama) = '4bb6153aa5521ecb83482b13903c0b91' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4133 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4133) AS panjang, 9204 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4133 AND MD5(sql_query) = '77c53cdc56eebe692cd73fef24dbae58' AND MD5(nama) = '85e3ed59c8e0e9d3eec2c6854f58e3e4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4134 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4134) AS panjang, 8999 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4134 AND MD5(sql_query) = 'a4a578732d86b0305bf820df5edf648b' AND MD5(nama) = 'e2cbb82b9154751853cdc08625199321' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4138 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4138) AS panjang, 11578 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4138 AND MD5(sql_query) = '2ebb01d31ce546b5ea39c9e7fa611235' AND MD5(nama) = '6e4d5f801e7b6700179c50935d893674' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4139 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4139) AS panjang, 10723 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4139 AND MD5(sql_query) = 'c21b2a8dad25635c1c3f4391c9599bbe' AND MD5(nama) = 'cb1db3bb3ead123b8255b2b43465e04a' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4150 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4150) AS panjang, 9452 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4150 AND MD5(sql_query) = 'ac3e3a516e636d647ebf2d012de3ddc4' AND MD5(nama) = 'f52902ed671601117516865062bea420' AND data_type = 'data_sql') AS cocok
) t ORDER BY t.no_var;

SELECT IF(SUM(t.cocok) = COUNT(*) AND COUNT(*) = 35, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil FROM (
SELECT 4100 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4100) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4100 AND sql_query IS NULL AND MD5(nama) = 'e2935e770d9979d40901dad37d4c1c2d' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4101 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4101) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4101 AND sql_query IS NULL AND MD5(nama) = 'b3d936a5dad5301b8a7e9b0fef437599' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4102 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4102) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4102 AND sql_query IS NULL AND MD5(nama) = 'f9f4a07110337bb12dd6b648a1014924' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4103 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4103) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4103 AND sql_query IS NULL AND MD5(nama) = 'cccb056604501d3a2e580f83e154c609' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4104 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4104) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4104 AND sql_query IS NULL AND MD5(nama) = '6bb91979304363fc47c65c5d9f5363cc' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4105 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4105) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4105 AND sql_query IS NULL AND MD5(nama) = 'db641e414b2d0489827c9b4e3b756570' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4106 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4106) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4106 AND sql_query IS NULL AND MD5(nama) = 'bd0d88bda0fb7ac4d2c3db146589ca1a' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4107 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4107) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4107 AND sql_query IS NULL AND MD5(nama) = 'ffc500aed3a52e264251a573856d1fb5' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4108 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4108) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4108 AND sql_query IS NULL AND MD5(nama) = '8673492b3268cfb450ec5a23e7da1aa4' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4109 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4109) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4109 AND sql_query IS NULL AND MD5(nama) = 'b06d84578c44956f099aa6bc7d78498e' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4140 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4140) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4140 AND MD5(sql_query) = '65c840a62eb186039aad3b3fe8df7401' AND MD5(nama) = '4a572cc506d619de35b1e54d05817380' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4141 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4141) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4141 AND MD5(sql_query) = '99373cd6d407df8f85bac560e9bcbec8' AND MD5(nama) = '17d6370497273067e04bc4e5ca007e9a' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4142 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4142) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4142 AND MD5(sql_query) = 'ad237a2952545b10c91a9fbc0feb6bf5' AND MD5(nama) = '34e5cea47106f1077b49b6e23999197c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4143 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4143) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4143 AND MD5(sql_query) = '6ca4ebda1713d2363ecc45ab2e6e053b' AND MD5(nama) = 'ee265dccbfe9294a6c5d5af383949490' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4144 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4144) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4144 AND MD5(sql_query) = '1027b480622cb5900ce44453f929d57a' AND MD5(nama) = 'bccffb1f3a0cc23d42657e897584ff99' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4145 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4145) AS panjang, 8757 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4145 AND MD5(sql_query) = 'e945c2fd5a6f6469953da45cf7af888f' AND MD5(nama) = '663b445e3c7d6a19511b5013e09927f4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4146 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4146) AS panjang, 8968 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4146 AND MD5(sql_query) = '96b10258e6a8eeb2a2fa87abe6da8400' AND MD5(nama) = 'e30df2e06bca97f313b80be1cfb14387' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4110 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4110) AS panjang, 22601 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4110 AND MD5(sql_query) = '343394c8e5c0b2a0bfb44d41726f208c' AND MD5(nama) = 'a4b1760839792332e3e1af3e92ab8ec0' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4111 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4111) AS panjang, 16277 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4111 AND MD5(sql_query) = '2ec1845a880f9cf3a57f7b20618627ad' AND MD5(nama) = 'd33c22d73c18bc611575cefc60c5f477' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4112 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4112) AS panjang, 17352 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4112 AND MD5(sql_query) = 'f26488e30e57c32a8abca1e7d24f8371' AND MD5(nama) = '310550f318537a357588b8d65c1db23f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4113 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4113) AS panjang, 16761 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4113 AND MD5(sql_query) = '60b3860d013f522494a25dcac8ee7708' AND MD5(nama) = '7e0af9ba97b1cdfab54695a3ba8445d9' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4114 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4114) AS panjang, 10871 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4114 AND MD5(sql_query) = 'dc51b6cedfea23d736d37640adde275a' AND MD5(nama) = 'c02cdc60564a0b0ff8862ae27d399c1f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4115 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4115) AS panjang, 12117 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4115 AND MD5(sql_query) = '462d18ceaa4bc64aeff2ad95d3f5d1b9' AND MD5(nama) = 'fdce9714014575a5dcb56a71d44f2f92' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4116 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4116) AS panjang, 10739 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4116 AND MD5(sql_query) = '5d52541c7c813c7b78f9ebf06cb08cb1' AND MD5(nama) = '2b8e6571d255e3f3ba8e664e8aa70a9e' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4117 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4117) AS panjang, 9654 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4117 AND MD5(sql_query) = '387b524c5fba98c4d5f7d70d6ca57405' AND MD5(nama) = '11a18659b4584a91f4e907d909bff598' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4118 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4118) AS panjang, 11484 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4118 AND MD5(sql_query) = '94bd20d1581b11c59fba0d578e9d3e80' AND MD5(nama) = '1165c0beee02dc833bd969b387c60ec6' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4119 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4119) AS panjang, 53914 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4119 AND MD5(sql_query) = '104852899a8428b9690d46c2514e8e25' AND MD5(nama) = 'c0b33ad5d43cd14005eb640c0d0688d2' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4130 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4130) AS panjang, 9287 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4130 AND MD5(sql_query) = '982e944bf1f4ae4cdb0ab395674e19ed' AND MD5(nama) = '91f45db390a7093d84f63f95e9528c1c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4131 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4131) AS panjang, 9321 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4131 AND MD5(sql_query) = '1e604019849c3fef14c96b879fe76922' AND MD5(nama) = '8bc0f9c3f974b7c56079b5c620edb260' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4132 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4132) AS panjang, 9967 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4132 AND MD5(sql_query) = '813ca7e1beb921d7affec2535fe35310' AND MD5(nama) = '4bb6153aa5521ecb83482b13903c0b91' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4133 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4133) AS panjang, 9204 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4133 AND MD5(sql_query) = '77c53cdc56eebe692cd73fef24dbae58' AND MD5(nama) = '85e3ed59c8e0e9d3eec2c6854f58e3e4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4134 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4134) AS panjang, 8999 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4134 AND MD5(sql_query) = 'a4a578732d86b0305bf820df5edf648b' AND MD5(nama) = 'e2cbb82b9154751853cdc08625199321' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4138 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4138) AS panjang, 11578 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4138 AND MD5(sql_query) = '2ebb01d31ce546b5ea39c9e7fa611235' AND MD5(nama) = '6e4d5f801e7b6700179c50935d893674' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4139 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4139) AS panjang, 10723 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4139 AND MD5(sql_query) = 'c21b2a8dad25635c1c3f4391c9599bbe' AND MD5(nama) = 'cb1db3bb3ead123b8255b2b43465e04a' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4150 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4150) AS panjang, 9452 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4150 AND MD5(sql_query) = 'ac3e3a516e636d647ebf2d012de3ddc4' AND MD5(nama) = 'f52902ed671601117516865062bea420' AND data_type = 'data_sql') AS cocok
) t;
