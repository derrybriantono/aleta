# -*- coding: utf-8 -*-
"""Buat basis uji lokal aps_badilag_x1 = SALINAN PERSIS abt_variabel server (21 Okt, dari HEX baca-saja) + abt_data_teks kosong
(kerangka sama dengan server, FK ON DELETE CASCADE). Dipakai agar PRASYARAT paket x1 sama dengan server."""
import subprocess, sys

MYSQL = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
TSV = sys.argv[2] if len(sys.argv) > 2 else r'D:\Aplikasi\aleta\tmp\x1\w39\var_server_hex.tsv'
DB = sys.argv[1] if len(sys.argv) > 1 else 'aps_badilag_x9'


def sql_nilai(x, hexa=False):
    if x == 'NULL':
        return 'NULL'
    if hexa:
        return "UNHEX('%s')" % x
    return "'" + x.replace("\\", "\\\\").replace("'", "''") + "'"


baris = open(TSV, encoding='latin1', newline='').read().split('\n')
kepala = baris[0].split('\t')
out = [
    "DROP DATABASE IF EXISTS %s;" % DB,
    "CREATE DATABASE %s DEFAULT CHARSET latin1;" % DB,
    "USE %s;" % DB,
    """CREATE TABLE `abt_variabel` (
  `no_var` int(4) unsigned zerofill NOT NULL DEFAULT '0000',
  `nama` varchar(200) NOT NULL DEFAULT '',
  `data_type` char(20) DEFAULT NULL,
  `data_tabel` varchar(100) DEFAULT NULL,
  `data_kolom` varchar(100) DEFAULT NULL,
  `urutan_data` int(2) unsigned DEFAULT NULL,
  `referensi` int(4) unsigned zerofill DEFAULT NULL,
  `sql_query` text,
  `default_data` text,
  `multi_sidang` char(50) DEFAULT NULL,
  `locked` tinyint(1) NOT NULL,
  `modifier` varchar(30) DEFAULT NULL,
  `modified` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`no_var`),
  KEY `nama` (`nama`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;""",
    """CREATE TABLE `abt_data_teks` (
  `no_var` int(4) unsigned zerofill NOT NULL,
  `perkara_id` bigint(20) NOT NULL,
  `data` text,
  `modifier` varchar(30) DEFAULT NULL,
  `modified` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`no_var`,`perkara_id`),
  CONSTRAINT `FK_abt_data_teks` FOREIGN KEY (`no_var`) REFERENCES `abt_variabel` (`no_var`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;""",
    """CREATE TABLE `abt_data_tanggal` (
  `no_var` int(4) unsigned zerofill NOT NULL,
  `perkara_id` bigint(20) NOT NULL,
  `data` date DEFAULT NULL,
  `modifier` varchar(30) DEFAULT NULL,
  `modified` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`no_var`,`perkara_id`),
  CONSTRAINT `FK_abt_data_tanggal` FOREIGN KEY (`no_var`) REFERENCES `abt_variabel` (`no_var`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;""",
    "SET NAMES latin1; SET autocommit=0; SET sql_mode='';",
]
n = 0
for b in baris[1:]:
    if not b.strip():
        continue
    k = b.split('\t')
    assert len(k) == 13, (len(k), b[:80])
    no, hnama, tipe, tab, kol, urut, ref, hsql, hdef, multi, locked, modif, modified = k
    out.append("INSERT INTO abt_variabel (no_var,nama,data_type,data_tabel,data_kolom,urutan_data,referensi,sql_query,default_data,multi_sidang,locked,modifier,modified) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s);" % (
        no, sql_nilai(hnama, True), sql_nilai(tipe), sql_nilai(tab), sql_nilai(kol), urut, ref, sql_nilai(hsql, True), sql_nilai(hdef, True), sql_nilai(multi), locked, sql_nilai(modif), sql_nilai(modified)))
    n += 1
out.append("COMMIT;")
sql = '\n'.join(out)
r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1'], input=sql.encode('latin1'), capture_output=True)
print(r.stdout.decode('utf-8', 'replace'), r.stderr.decode('utf-8', 'replace'))
print('baris dimasukkan:', n)
