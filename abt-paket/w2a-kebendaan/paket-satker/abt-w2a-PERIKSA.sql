-- Periksa hasil pemasangan: tiap baris harus cocok = 1, dan baris terakhir "SEMUA COCOK".
SELECT 4780 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4780) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4780 AND sql_query IS NULL AND MD5(nama) = 'c528ffb474eff0606245e9819b0158f4' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4781 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4781) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4781 AND sql_query IS NULL AND MD5(nama) = '86e488ec6a58ed1975da4a8566793d45' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4782 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4782) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4782 AND sql_query IS NULL AND MD5(nama) = 'e9f1c2adcb7857b37aaaefdb012531aa' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4783 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4783) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4783 AND sql_query IS NULL AND MD5(nama) = '3e2dc6dfbea9eb4e3e076d5b01394e10' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4784 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4784) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4784 AND sql_query IS NULL AND MD5(nama) = 'b49e91904489b5b951d0ae5e5001090f' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4785 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4785) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4785 AND sql_query IS NULL AND MD5(nama) = '43386b07e5e4ef8fc796048494bdc360' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4786 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4786) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4786 AND sql_query IS NULL AND MD5(nama) = 'f7fdc503aea9f54c4eb996f65731d2ca' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4787 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4787) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4787 AND sql_query IS NULL AND MD5(nama) = 'fa71bbae81edd4a3460d048b5862684a' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4788 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4788) AS panjang, 3997 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4788 AND MD5(sql_query) = 'be3965b29d8e2a07e994a0965dc56393' AND MD5(nama) = '0b5b1c578b24007058ec905c73372366' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4789 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4789) AS panjang, 3996 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4789 AND MD5(sql_query) = 'cb0eb96563b41fb1b4c0b2350ad32b7f' AND MD5(nama) = '1378c2cd12b4859d2288d9b346be3e4d' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4790 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4790) AS panjang, 3997 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4790 AND MD5(sql_query) = 'ed6015a5962efdeeb4e9babee8f6fe0a' AND MD5(nama) = '7db208a59455992347c0e34bdafb48ce' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4791 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4791) AS panjang, 3998 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4791 AND MD5(sql_query) = '3281caa4b03a53987b2ec8b0e44cc96e' AND MD5(nama) = 'c4d8b2b76674e16aa6f43d7250a39a59' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4792 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4792) AS panjang, 4341 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4792 AND MD5(sql_query) = 'b230b951dd0ac34213e9d7d2373046fc' AND MD5(nama) = 'de1452a419bd7b46c75d4f5c82b63158' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4793 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4793) AS panjang, 5151 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4793 AND MD5(sql_query) = '31a616e60c504e68fa2a82f08da0dd87' AND MD5(nama) = '44c7e31d34cc9d04dba31e8ea5efefc1' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4794 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4794) AS panjang, 5356 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4794 AND MD5(sql_query) = '6156ddc095b3e90904cbd5adae95a514' AND MD5(nama) = 'f251c6d4ef3d553e996a2641ce167bfa' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4795 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4795) AS panjang, 4415 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4795 AND MD5(sql_query) = '18b2597f3e4da3d7dfdf0ea672b3a7b9' AND MD5(nama) = 'dc7a0cf3214c27d0374de7e4b0324314' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4796 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4796) AS panjang, 4363 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4796 AND MD5(sql_query) = 'defc08eea32bf44f001b97fb94f9be91' AND MD5(nama) = '672d9652cf2c839c89283fd291d6305e' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4797 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4797) AS panjang, 5138 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4797 AND MD5(sql_query) = '3179a04979933fbf7b1ecd4e9a0515c1' AND MD5(nama) = 'f7a600eb1bbeb62f729c926fc270cec5' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4798 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4798) AS panjang, 5104 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4798 AND MD5(sql_query) = '1da48fe9ad9c9f059ea0d2b3068b007a' AND MD5(nama) = '132ff158b7b271b1a9f84ac30886af90' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4799 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4799) AS panjang, 8416 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4799 AND MD5(sql_query) = 'b2df31d219a25226e911720dee9c6da3' AND MD5(nama) = '46e4df14b05befbe761687497aefaaa4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4800 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4800) AS panjang, 7942 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4800 AND MD5(sql_query) = 'f63a61ee6601d3495ddbdd4fdb9a05db' AND MD5(nama) = '1a3179aef6e7bfaed3cec419faf51357' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4801 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4801) AS panjang, 4212 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4801 AND MD5(sql_query) = '413ea40ed5160ec8a42f36ca40b103ac' AND MD5(nama) = 'e255daf20d53f3ef18e18754fcee3128' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4802 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4802) AS panjang, 7713 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4802 AND MD5(sql_query) = '0380cbd8b626001ef3cc931b4391f5e8' AND MD5(nama) = 'f84743d2e4cb87ed79f2931eb2de6ea3' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4803 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4803) AS panjang, 4208 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4803 AND MD5(sql_query) = '8b920ca780e928830a7b88f8e017cfb4' AND MD5(nama) = '4480ba7d55bcc4fdd14e9faf4323a510' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4804 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4804) AS panjang, 9165 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4804 AND MD5(sql_query) = 'b0475c07748efb3a2af3b83cfcf7628d' AND MD5(nama) = '65600eb5682d66abb1241c4a643c8425' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4805 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4805) AS panjang, 5358 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4805 AND MD5(sql_query) = 'a854c1a488a061251a408c76c6cb624c' AND MD5(nama) = '5397ebd6c13486f6e6476a603903ae7c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4806 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4806) AS panjang, 3855 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4806 AND MD5(sql_query) = 'baec251bf12f14cc297893a7597ace4a' AND MD5(nama) = '064d72a6c0eff51b6adb62ab56c9c831' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4807 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4807) AS panjang, 15843 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4807 AND MD5(sql_query) = 'b397ba5f6da3be9ac00593142aa85498' AND MD5(nama) = '17f7184837af15a712d1f3a048cbf587' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4808 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4808) AS panjang, 15843 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4808 AND MD5(sql_query) = '3f6a0fab2aefdc0572f00b80de95b869' AND MD5(nama) = 'fe64fd4857457ab8f0520765ee6a39fa' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4809 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4809) AS panjang, 2669 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4809 AND MD5(sql_query) = 'd65b798cb59fda9d5d2993cb8468c553' AND MD5(nama) = '4b11d6aae1aec385d725011b0d8d1c8f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4810 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4810) AS panjang, 6525 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4810 AND MD5(sql_query) = 'c0fc02241cd3fe1829c24d708d79ddb8' AND MD5(nama) = '4432f6b21b6e4d66dedf76536b44712a' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4811 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4811) AS panjang, 6482 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4811 AND MD5(sql_query) = '2ec54dfcd76fb82d646f153b39b25bfc' AND MD5(nama) = '6ec9caa92528a596419fb18a23b9fb9e' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4812 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4812) AS panjang, 5301 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4812 AND MD5(sql_query) = '67a74659269ae77dd2a1191610bb157e' AND MD5(nama) = '2b0e905acc1be6645930edce5ac78a3f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4813 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4813) AS panjang, 6468 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4813 AND MD5(sql_query) = '010ab0fe08ca193641245fa98a089d0a' AND MD5(nama) = '83e5aab51802e92394502cf27fdda8e4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4814 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4814) AS panjang, 4983 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4814 AND MD5(sql_query) = '3c577a7b6c52c9e4007547cf539efec8' AND MD5(nama) = '08bdcfa1fdab81562054af0f8f19ce1f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4815 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4815) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4815 AND sql_query IS NULL AND MD5(nama) = 'f593a7f5fc5a861a5167575d16ac4272' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4816 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4816) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4816 AND sql_query IS NULL AND MD5(nama) = '45ca44db7ebe7983cfa856cf66db7f57' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4817 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4817) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4817 AND sql_query IS NULL AND MD5(nama) = 'd6e4ba964641df56e4a656ea7a82c465' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4818 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4818) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4818 AND sql_query IS NULL AND MD5(nama) = '21cc76c71a34432ac8e1a8d533b05ab3' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4819 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4819) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4819 AND sql_query IS NULL AND MD5(nama) = 'a112dc59aaaf0a17f53e80c39bea8a56' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4820 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4820) AS panjang, 11045 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4820 AND MD5(sql_query) = 'd7e3d5dbf6ca3153eedaf1445d2944e0' AND MD5(nama) = 'b816850270c2972fbaa6757e731292f8' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4821 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4821) AS panjang, 11145 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4821 AND MD5(sql_query) = '0350d259b3356acce32f5467bf8efe0d' AND MD5(nama) = 'd3cbb59c0a29aa7ecf3c1fd2772c90ed' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4822 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4822) AS panjang, 44789 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4822 AND MD5(sql_query) = 'ca7057ba44c1d8aff42147f5b1abe68c' AND MD5(nama) = '05f27731aaef0c08c5eb668b75a43434' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4823 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4823) AS panjang, 4861 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4823 AND MD5(sql_query) = '01027c770602ef6049f9989f2f5492c0' AND MD5(nama) = '0ed4adf8f451ac7e7d4bc4569e06bd75' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4824 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4824) AS panjang, 7886 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4824 AND MD5(sql_query) = 'f64e74825022fc621ee58dd0f34c167d' AND MD5(nama) = 'cdecd34fa0149a0b18ed15dd42390939' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4825 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4825) AS panjang, 8321 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4825 AND MD5(sql_query) = 'cd44ff7511aa5637a03f9d261fe09c81' AND MD5(nama) = '64f3c6f1e6f591ed7ebba21306089868' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4826 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4826) AS panjang, 3982 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4826 AND MD5(sql_query) = 'c6a88cdd3a8e9e01a719f2d7f45a79d8' AND MD5(nama) = 'b5826a07d264063eb07c7bc19e4947aa' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4827 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4827) AS panjang, 8092 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4827 AND MD5(sql_query) = '8ad8f590746cd6cbaf75e919ead3c7c0' AND MD5(nama) = '1bb09b2164a3e9e127a21ba475630d59' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4828 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4828) AS panjang, 3978 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4828 AND MD5(sql_query) = '64047b36b89f235e18714e1dff9fa404' AND MD5(nama) = '9c0c9b0d3b242427c103a341a000f367' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4829 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4829) AS panjang, 16370 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4829 AND MD5(sql_query) = '71fa8b4668f76daccbb434f23f673140' AND MD5(nama) = 'c4e48a16944181fda0e46fc5700fa21b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4830 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4830) AS panjang, 16370 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4830 AND MD5(sql_query) = '5a67b4a265feee7496e5874d6a1cea87' AND MD5(nama) = '714e6606ec0ff0dee747431f022aec15' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4831 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4831) AS panjang, 2678 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4831 AND MD5(sql_query) = 'f4365eda2c2de2faac657a46f8de0dc1' AND MD5(nama) = '4902e7f1222a13faf75ea495309aaa31' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4832 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4832) AS panjang, 4346 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4832 AND MD5(sql_query) = 'a3633d5b1648b98e58eb2dd5452293a3' AND MD5(nama) = '58800b69d8e3f405d2e1b6a1712346d9' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4833 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4833) AS panjang, 20011 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4833 AND MD5(sql_query) = '05db056b48bcdced3c4b9d9f09e5e5aa' AND MD5(nama) = '531079c9811131cae00dd7d50d5699dc' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4834 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4834) AS panjang, 20011 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4834 AND MD5(sql_query) = 'd45f3c7acf1969e74314553000f2a11e' AND MD5(nama) = '028c4e2c71cfd5d9bfdee4eec8cca969' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4835 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4835) AS panjang, 10557 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4835 AND MD5(sql_query) = '46daeb8298587d443231da6a71d0e07b' AND MD5(nama) = '78e39d1fcc4c9d2a91855316e4aa89c2' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4836 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4836) AS panjang, 3964 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4836 AND MD5(sql_query) = '15ba2e637e2ef5c1e1f530f054c3bceb' AND MD5(nama) = '0739adead45ad658cd017fde6e05551b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4837 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4837) AS panjang, 6976 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4837 AND MD5(sql_query) = '321da3dd6316b08c28896b76bb79574f' AND MD5(nama) = 'c08c014540754eb1f4552ac792d4c48b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4838 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4838) AS panjang, 4128 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4838 AND MD5(sql_query) = '1cf915157dab1aee9b5586438a83e2a3' AND MD5(nama) = 'ebc6fce74a57dcde565ec73700008e5d' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4839 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4839) AS panjang, 3983 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4839 AND MD5(sql_query) = '4c25887cc61c35725c78c77bf319995c' AND MD5(nama) = '95b5bd490ce58d2de6abf99c02bf65ff' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4840 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4840) AS panjang, 6976 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4840 AND MD5(sql_query) = '6fa7cd66a2bc0c2715f44327d7b677ba' AND MD5(nama) = '84fac7820c3022cba40d2e0d1eabfd42' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4841 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4841) AS panjang, 4128 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4841 AND MD5(sql_query) = '3c4c26ad82120cc0bea686cb208feab7' AND MD5(nama) = 'd8b5b1170563dca544be36be9917d931' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4842 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4842) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4842 AND sql_query IS NULL AND MD5(nama) = '195ca6e3b687a32e1a6ba2f7b5b53a8f' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4843 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4843) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4843 AND sql_query IS NULL AND MD5(nama) = '8a23f499a3487343f5da569bbdaeb830' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4844 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4844) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4844 AND sql_query IS NULL AND MD5(nama) = '8a2f2ce3b1721f0e2e9b0bf8c1e2129e' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4845 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4845) AS panjang, 3831 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4845 AND MD5(sql_query) = 'e46aa04d194903d63394139fb184f8eb' AND MD5(nama) = 'e31c0c1c02e044729d6049d4fed272d4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4846 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4846) AS panjang, 3831 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4846 AND MD5(sql_query) = 'd4348bb9a6be648c63780a21f6f47467' AND MD5(nama) = '63b5a47e004082f530a1aadf73deef47' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4847 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4847) AS panjang, 3831 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4847 AND MD5(sql_query) = '7885a8a301dfd88688ddb4cf8229bceb' AND MD5(nama) = '1dd6c59db64ef2c403c0bdf3d5eaaa56' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4848 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4848) AS panjang, 619 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4848 AND MD5(sql_query) = '1a4a3ec7c99c4357d3e7082497ea0359' AND MD5(nama) = 'cf4c38f959741f776cdc414e374cc17b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4849 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4849) AS panjang, 608 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4849 AND MD5(sql_query) = 'b02103ba1e5ffb0822d3a356fc3e2c96' AND MD5(nama) = 'f24eb02849b93da1d85bddf45639a8f8' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 0 AS no_var, NULL AS panjang, NULL AS panjang_harap, IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849) = 70, 1, 0) AS cocok;
SELECT IF(SUM(c.cocok) = 71, 'SEMUA COCOK', 'ADA YANG TIDAK COCOK') AS hasil FROM (
SELECT 4780 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4780) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4780 AND sql_query IS NULL AND MD5(nama) = 'c528ffb474eff0606245e9819b0158f4' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4781 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4781) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4781 AND sql_query IS NULL AND MD5(nama) = '86e488ec6a58ed1975da4a8566793d45' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4782 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4782) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4782 AND sql_query IS NULL AND MD5(nama) = 'e9f1c2adcb7857b37aaaefdb012531aa' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4783 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4783) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4783 AND sql_query IS NULL AND MD5(nama) = '3e2dc6dfbea9eb4e3e076d5b01394e10' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4784 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4784) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4784 AND sql_query IS NULL AND MD5(nama) = 'b49e91904489b5b951d0ae5e5001090f' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4785 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4785) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4785 AND sql_query IS NULL AND MD5(nama) = '43386b07e5e4ef8fc796048494bdc360' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4786 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4786) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4786 AND sql_query IS NULL AND MD5(nama) = 'f7fdc503aea9f54c4eb996f65731d2ca' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4787 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4787) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4787 AND sql_query IS NULL AND MD5(nama) = 'fa71bbae81edd4a3460d048b5862684a' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4788 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4788) AS panjang, 3997 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4788 AND MD5(sql_query) = 'be3965b29d8e2a07e994a0965dc56393' AND MD5(nama) = '0b5b1c578b24007058ec905c73372366' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4789 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4789) AS panjang, 3996 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4789 AND MD5(sql_query) = 'cb0eb96563b41fb1b4c0b2350ad32b7f' AND MD5(nama) = '1378c2cd12b4859d2288d9b346be3e4d' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4790 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4790) AS panjang, 3997 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4790 AND MD5(sql_query) = 'ed6015a5962efdeeb4e9babee8f6fe0a' AND MD5(nama) = '7db208a59455992347c0e34bdafb48ce' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4791 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4791) AS panjang, 3998 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4791 AND MD5(sql_query) = '3281caa4b03a53987b2ec8b0e44cc96e' AND MD5(nama) = 'c4d8b2b76674e16aa6f43d7250a39a59' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4792 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4792) AS panjang, 4341 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4792 AND MD5(sql_query) = 'b230b951dd0ac34213e9d7d2373046fc' AND MD5(nama) = 'de1452a419bd7b46c75d4f5c82b63158' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4793 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4793) AS panjang, 5151 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4793 AND MD5(sql_query) = '31a616e60c504e68fa2a82f08da0dd87' AND MD5(nama) = '44c7e31d34cc9d04dba31e8ea5efefc1' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4794 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4794) AS panjang, 5356 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4794 AND MD5(sql_query) = '6156ddc095b3e90904cbd5adae95a514' AND MD5(nama) = 'f251c6d4ef3d553e996a2641ce167bfa' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4795 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4795) AS panjang, 4415 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4795 AND MD5(sql_query) = '18b2597f3e4da3d7dfdf0ea672b3a7b9' AND MD5(nama) = 'dc7a0cf3214c27d0374de7e4b0324314' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4796 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4796) AS panjang, 4363 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4796 AND MD5(sql_query) = 'defc08eea32bf44f001b97fb94f9be91' AND MD5(nama) = '672d9652cf2c839c89283fd291d6305e' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4797 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4797) AS panjang, 5138 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4797 AND MD5(sql_query) = '3179a04979933fbf7b1ecd4e9a0515c1' AND MD5(nama) = 'f7a600eb1bbeb62f729c926fc270cec5' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4798 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4798) AS panjang, 5104 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4798 AND MD5(sql_query) = '1da48fe9ad9c9f059ea0d2b3068b007a' AND MD5(nama) = '132ff158b7b271b1a9f84ac30886af90' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4799 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4799) AS panjang, 8416 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4799 AND MD5(sql_query) = 'b2df31d219a25226e911720dee9c6da3' AND MD5(nama) = '46e4df14b05befbe761687497aefaaa4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4800 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4800) AS panjang, 7942 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4800 AND MD5(sql_query) = 'f63a61ee6601d3495ddbdd4fdb9a05db' AND MD5(nama) = '1a3179aef6e7bfaed3cec419faf51357' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4801 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4801) AS panjang, 4212 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4801 AND MD5(sql_query) = '413ea40ed5160ec8a42f36ca40b103ac' AND MD5(nama) = 'e255daf20d53f3ef18e18754fcee3128' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4802 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4802) AS panjang, 7713 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4802 AND MD5(sql_query) = '0380cbd8b626001ef3cc931b4391f5e8' AND MD5(nama) = 'f84743d2e4cb87ed79f2931eb2de6ea3' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4803 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4803) AS panjang, 4208 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4803 AND MD5(sql_query) = '8b920ca780e928830a7b88f8e017cfb4' AND MD5(nama) = '4480ba7d55bcc4fdd14e9faf4323a510' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4804 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4804) AS panjang, 9165 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4804 AND MD5(sql_query) = 'b0475c07748efb3a2af3b83cfcf7628d' AND MD5(nama) = '65600eb5682d66abb1241c4a643c8425' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4805 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4805) AS panjang, 5358 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4805 AND MD5(sql_query) = 'a854c1a488a061251a408c76c6cb624c' AND MD5(nama) = '5397ebd6c13486f6e6476a603903ae7c' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4806 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4806) AS panjang, 3855 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4806 AND MD5(sql_query) = 'baec251bf12f14cc297893a7597ace4a' AND MD5(nama) = '064d72a6c0eff51b6adb62ab56c9c831' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4807 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4807) AS panjang, 15843 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4807 AND MD5(sql_query) = 'b397ba5f6da3be9ac00593142aa85498' AND MD5(nama) = '17f7184837af15a712d1f3a048cbf587' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4808 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4808) AS panjang, 15843 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4808 AND MD5(sql_query) = '3f6a0fab2aefdc0572f00b80de95b869' AND MD5(nama) = 'fe64fd4857457ab8f0520765ee6a39fa' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4809 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4809) AS panjang, 2669 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4809 AND MD5(sql_query) = 'd65b798cb59fda9d5d2993cb8468c553' AND MD5(nama) = '4b11d6aae1aec385d725011b0d8d1c8f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4810 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4810) AS panjang, 6525 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4810 AND MD5(sql_query) = 'c0fc02241cd3fe1829c24d708d79ddb8' AND MD5(nama) = '4432f6b21b6e4d66dedf76536b44712a' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4811 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4811) AS panjang, 6482 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4811 AND MD5(sql_query) = '2ec54dfcd76fb82d646f153b39b25bfc' AND MD5(nama) = '6ec9caa92528a596419fb18a23b9fb9e' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4812 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4812) AS panjang, 5301 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4812 AND MD5(sql_query) = '67a74659269ae77dd2a1191610bb157e' AND MD5(nama) = '2b0e905acc1be6645930edce5ac78a3f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4813 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4813) AS panjang, 6468 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4813 AND MD5(sql_query) = '010ab0fe08ca193641245fa98a089d0a' AND MD5(nama) = '83e5aab51802e92394502cf27fdda8e4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4814 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4814) AS panjang, 4983 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4814 AND MD5(sql_query) = '3c577a7b6c52c9e4007547cf539efec8' AND MD5(nama) = '08bdcfa1fdab81562054af0f8f19ce1f' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4815 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4815) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4815 AND sql_query IS NULL AND MD5(nama) = 'f593a7f5fc5a861a5167575d16ac4272' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4816 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4816) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4816 AND sql_query IS NULL AND MD5(nama) = '45ca44db7ebe7983cfa856cf66db7f57' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4817 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4817) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4817 AND sql_query IS NULL AND MD5(nama) = 'd6e4ba964641df56e4a656ea7a82c465' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4818 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4818) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4818 AND sql_query IS NULL AND MD5(nama) = '21cc76c71a34432ac8e1a8d533b05ab3' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4819 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4819) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4819 AND sql_query IS NULL AND MD5(nama) = 'a112dc59aaaf0a17f53e80c39bea8a56' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4820 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4820) AS panjang, 11045 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4820 AND MD5(sql_query) = 'd7e3d5dbf6ca3153eedaf1445d2944e0' AND MD5(nama) = 'b816850270c2972fbaa6757e731292f8' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4821 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4821) AS panjang, 11145 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4821 AND MD5(sql_query) = '0350d259b3356acce32f5467bf8efe0d' AND MD5(nama) = 'd3cbb59c0a29aa7ecf3c1fd2772c90ed' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4822 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4822) AS panjang, 44789 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4822 AND MD5(sql_query) = 'ca7057ba44c1d8aff42147f5b1abe68c' AND MD5(nama) = '05f27731aaef0c08c5eb668b75a43434' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4823 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4823) AS panjang, 4861 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4823 AND MD5(sql_query) = '01027c770602ef6049f9989f2f5492c0' AND MD5(nama) = '0ed4adf8f451ac7e7d4bc4569e06bd75' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4824 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4824) AS panjang, 7886 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4824 AND MD5(sql_query) = 'f64e74825022fc621ee58dd0f34c167d' AND MD5(nama) = 'cdecd34fa0149a0b18ed15dd42390939' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4825 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4825) AS panjang, 8321 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4825 AND MD5(sql_query) = 'cd44ff7511aa5637a03f9d261fe09c81' AND MD5(nama) = '64f3c6f1e6f591ed7ebba21306089868' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4826 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4826) AS panjang, 3982 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4826 AND MD5(sql_query) = 'c6a88cdd3a8e9e01a719f2d7f45a79d8' AND MD5(nama) = 'b5826a07d264063eb07c7bc19e4947aa' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4827 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4827) AS panjang, 8092 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4827 AND MD5(sql_query) = '8ad8f590746cd6cbaf75e919ead3c7c0' AND MD5(nama) = '1bb09b2164a3e9e127a21ba475630d59' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4828 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4828) AS panjang, 3978 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4828 AND MD5(sql_query) = '64047b36b89f235e18714e1dff9fa404' AND MD5(nama) = '9c0c9b0d3b242427c103a341a000f367' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4829 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4829) AS panjang, 16370 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4829 AND MD5(sql_query) = '71fa8b4668f76daccbb434f23f673140' AND MD5(nama) = 'c4e48a16944181fda0e46fc5700fa21b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4830 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4830) AS panjang, 16370 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4830 AND MD5(sql_query) = '5a67b4a265feee7496e5874d6a1cea87' AND MD5(nama) = '714e6606ec0ff0dee747431f022aec15' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4831 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4831) AS panjang, 2678 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4831 AND MD5(sql_query) = 'f4365eda2c2de2faac657a46f8de0dc1' AND MD5(nama) = '4902e7f1222a13faf75ea495309aaa31' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4832 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4832) AS panjang, 4346 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4832 AND MD5(sql_query) = 'a3633d5b1648b98e58eb2dd5452293a3' AND MD5(nama) = '58800b69d8e3f405d2e1b6a1712346d9' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4833 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4833) AS panjang, 20011 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4833 AND MD5(sql_query) = '05db056b48bcdced3c4b9d9f09e5e5aa' AND MD5(nama) = '531079c9811131cae00dd7d50d5699dc' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4834 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4834) AS panjang, 20011 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4834 AND MD5(sql_query) = 'd45f3c7acf1969e74314553000f2a11e' AND MD5(nama) = '028c4e2c71cfd5d9bfdee4eec8cca969' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4835 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4835) AS panjang, 10557 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4835 AND MD5(sql_query) = '46daeb8298587d443231da6a71d0e07b' AND MD5(nama) = '78e39d1fcc4c9d2a91855316e4aa89c2' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4836 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4836) AS panjang, 3964 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4836 AND MD5(sql_query) = '15ba2e637e2ef5c1e1f530f054c3bceb' AND MD5(nama) = '0739adead45ad658cd017fde6e05551b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4837 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4837) AS panjang, 6976 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4837 AND MD5(sql_query) = '321da3dd6316b08c28896b76bb79574f' AND MD5(nama) = 'c08c014540754eb1f4552ac792d4c48b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4838 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4838) AS panjang, 4128 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4838 AND MD5(sql_query) = '1cf915157dab1aee9b5586438a83e2a3' AND MD5(nama) = 'ebc6fce74a57dcde565ec73700008e5d' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4839 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4839) AS panjang, 3983 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4839 AND MD5(sql_query) = '4c25887cc61c35725c78c77bf319995c' AND MD5(nama) = '95b5bd490ce58d2de6abf99c02bf65ff' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4840 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4840) AS panjang, 6976 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4840 AND MD5(sql_query) = '6fa7cd66a2bc0c2715f44327d7b677ba' AND MD5(nama) = '84fac7820c3022cba40d2e0d1eabfd42' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4841 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4841) AS panjang, 4128 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4841 AND MD5(sql_query) = '3c4c26ad82120cc0bea686cb208feab7' AND MD5(nama) = 'd8b5b1170563dca544be36be9917d931' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4842 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4842) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4842 AND sql_query IS NULL AND MD5(nama) = '195ca6e3b687a32e1a6ba2f7b5b53a8f' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4843 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4843) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4843 AND sql_query IS NULL AND MD5(nama) = '8a23f499a3487343f5da569bbdaeb830' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4844 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4844) AS panjang, NULL AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4844 AND sql_query IS NULL AND MD5(nama) = '8a2f2ce3b1721f0e2e9b0bf8c1e2129e' AND data_type = 'data_teks') AS cocok
UNION ALL
SELECT 4845 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4845) AS panjang, 3831 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4845 AND MD5(sql_query) = 'e46aa04d194903d63394139fb184f8eb' AND MD5(nama) = 'e31c0c1c02e044729d6049d4fed272d4' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4846 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4846) AS panjang, 3831 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4846 AND MD5(sql_query) = 'd4348bb9a6be648c63780a21f6f47467' AND MD5(nama) = '63b5a47e004082f530a1aadf73deef47' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4847 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4847) AS panjang, 3831 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4847 AND MD5(sql_query) = '7885a8a301dfd88688ddb4cf8229bceb' AND MD5(nama) = '1dd6c59db64ef2c403c0bdf3d5eaaa56' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4848 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4848) AS panjang, 619 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4848 AND MD5(sql_query) = '1a4a3ec7c99c4357d3e7082497ea0359' AND MD5(nama) = 'cf4c38f959741f776cdc414e374cc17b' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 4849 AS no_var, (SELECT LENGTH(sql_query) FROM abt_variabel WHERE no_var = 4849) AS panjang, 608 AS panjang_harap, (SELECT COUNT(*) FROM abt_variabel WHERE no_var = 4849 AND MD5(sql_query) = 'b02103ba1e5ffb0822d3a356fc3e2c96' AND MD5(nama) = 'f24eb02849b93da1d85bddf45639a8f8' AND data_type = 'data_sql') AS cocok
UNION ALL
SELECT 0 AS no_var, NULL AS panjang, NULL AS panjang_harap, IF((SELECT COUNT(*) FROM abt_variabel WHERE no_var BETWEEN 4780 AND 4849) = 70, 1, 0) AS cocok
) c;
