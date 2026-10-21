#!/bin/bash
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
cd D:/Aplikasi/aleta/tmp/w30
set -e
mysql -u root --default-character-set=latin1 < x7/sipp_x7.sql
mysql -u root --default-character-set=latin1 <<'SQL'
DROP DATABASE IF EXISTS aps_badilag_x7; CREATE DATABASE aps_badilag_x7 DEFAULT CHARSET latin1; USE aps_badilag_x7;
CREATE TABLE `abt_keterangan_saksi` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT, `perkara_id` bigint(20) DEFAULT NULL, `sidang_id` bigint(20) DEFAULT NULL, `penanya_id` char(1) DEFAULT NULL,
  `saksi_id` int(11) DEFAULT NULL, `urutan_pertanyaan` int(11) DEFAULT NULL, `pertanyaan` text, `jawaban` text, `diinput_oleh` varchar(30) DEFAULT NULL,
  `diinput_tanggal` datetime DEFAULT NULL, `diperbaharui_oleh` varchar(30) DEFAULT NULL, `diperbaharui_tanggal` datetime DEFAULT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `perkara_id` (`perkara_id`,`sidang_id`,`saksi_id`,`urutan_pertanyaan`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
CREATE TABLE `abt_keterangan_terdakwa` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT, `perkara_id` bigint(20) DEFAULT NULL, `sidang_id` bigint(20) DEFAULT NULL, `penanya_id` char(1) DEFAULT NULL,
  `pihak_id` int(11) DEFAULT NULL, `urutan_pertanyaan` int(11) DEFAULT NULL, `pertanyaan` text, `jawaban` text, `diinput_oleh` varchar(30) DEFAULT NULL,
  `diinput_tanggal` datetime DEFAULT NULL, `diperbaharui_oleh` varchar(30) DEFAULT NULL, `diperbaharui_tanggal` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
LOAD DATA LOCAL INFILE 'D:/Aplikasi/aleta/tmp/w30/x7/ks_sampel.tsv' INTO TABLE abt_keterangan_saksi CHARACTER SET utf8 IGNORE 1 LINES (id, perkara_id, sidang_id, saksi_id, urutan_pertanyaan, pertanyaan, jawaban);
LOAD DATA LOCAL INFILE 'D:/Aplikasi/aleta/tmp/w30/x7/td.tsv' INTO TABLE abt_keterangan_terdakwa CHARACTER SET utf8 IGNORE 1 LINES (id, perkara_id, sidang_id, penanya_id, pihak_id, urutan_pertanyaan, pertanyaan, jawaban);
SELECT COUNT(*) FROM abt_keterangan_saksi; SELECT COUNT(*) FROM abt_keterangan_terdakwa;
SQL
# 20 fungsi persis server (lama) lalu paket x6 (FUNGSI.sql x6, nama basis diganti)
sed 's/aps_badilag_x6\./aps_badilag_x7./g; s/aps_badilag\./aps_badilag_x7./g' lab/fungsi_lab.sql | mysql -u root --default-character-set=latin1 aps_badilag_x7
sed 's/aps_badilag\./aps_badilag_x7./g' /d/aleta-dev/wt/w35/abt-paket/x6-penutup-saksi-21okt/paket-satker/abt-x6-penutup-saksi-21okt-FUNGSI.sql | mysql -u root --default-character-set=latin1 aps_badilag_x7
# isian_rtf_keterangan: fungsi_lab.sql memuat versi server (sebelum x7)
mysql -u root -N aps_badilag_x7 -e "select count(*) from information_schema.routines where routine_schema='aps_badilag_x7'; SELECT MD5(REPLACE(routine_definition, 'aps_badilag_x7.abt_', 'aps_badilag.abt_')) FROM information_schema.routines WHERE routine_schema='aps_badilag_x7' AND routine_name='isian_rtf_keterangan'"
echo LAB-X7-SIAP
