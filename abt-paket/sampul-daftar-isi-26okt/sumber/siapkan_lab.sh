#!/bin/bash
# Menyiapkan basis uji LAPTOP aps_badilag_s1 (bukan server): salinan abt_variabel dari aps_badilag_ag0 (= server 26 Okt), abt_data_teks kosong,
# abt_menu dari aps_badilag lab + baris 991 (Form Bantu PTSP) seperti di server. Tidak menyentuh server.
# Pakai:  bash sumber/siapkan_lab.sh [nama_basis]
M="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin/mysql.exe"
DB="${1:-aps_badilag_s1}"
"$M" -h 127.0.0.1 -u root --default-character-set=latin1 -e "
DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB DEFAULT CHARSET latin1;
CREATE TABLE $DB.abt_variabel LIKE aps_badilag_ag0.abt_variabel;
INSERT INTO $DB.abt_variabel SELECT * FROM aps_badilag_ag0.abt_variabel;
CREATE TABLE $DB.abt_data_teks LIKE aps_badilag_ag0.abt_data_teks;
CREATE TABLE $DB.abt_data_tanggal LIKE aps_badilag_ag0.abt_data_teks;
CREATE TABLE $DB.abt_menu LIKE aps_badilag.abt_menu;
INSERT INTO $DB.abt_menu SELECT * FROM aps_badilag.abt_menu;
REPLACE INTO $DB.abt_menu (id,nama,nama_alias,direktori,parent_direktori,proses_id_min,proses_id_max,perkara_id_min,perkara_id_max,perkara_id_referensi,user_cek,user_grup_id,user_top_id,user_validator)
 VALUES (991,'Form Bantu PTSP','Form Pelayanan Terpadu Satu Pintu (PTSP)','99 PTSP','derry_briantono',20,1000,15,17,'alur_perkara_id',0,'30|500|430|1000|1010|1020|1032|1001|1011','1|10|30',NULL);
REPLACE INTO $DB.abt_menu (id,nama,nama_alias,direktori,parent_direktori,proses_id_min,proses_id_max,perkara_id_min,perkara_id_max,perkara_id_referensi,user_cek,user_grup_id,user_top_id,user_validator)
 VALUES (995,'Blangko Jurusita Donggala','Blangko Jurusita Donggala','BLANGKO_JURUSITA_DONGGALA','_blangko_abt',0,0,NULL,NULL,NULL,0,NULL,NULL,NULL);
"
"$M" -h 127.0.0.1 -u root -N -e "SELECT COUNT(*) FROM $DB.abt_variabel; SELECT MAX(id) FROM $DB.abt_menu;"
