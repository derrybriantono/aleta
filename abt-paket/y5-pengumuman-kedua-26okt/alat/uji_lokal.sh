#!/bin/bash
# Uji lokal alur SQL paket y5 di MySQL XAMPP laptop (basis sementara y5u_tmp berisi SATU baris abt_variabel 7063 = isi lama server 26 Okt;
# dibuang di akhir). Urutan: PASANG -> PERIKSA -> PASANG ulang (0 baris) -> PULIH -> md5 kembali = server -> PASANG lagi -> buang basis.
# Query 7063 BARU sendiri diukur di server (alat/uji_server.py, baca saja); skrip ini hanya menguji berkas SQL paket.
export TMP='D:\Aplikasi\aleta\tmp' TEMP='D:\Aplikasi\aleta\tmp'
export PATH="/d/Satker Asal/Website PA Bungku/xampp/mysql/bin:$PATH"
AKAR=$(cd "$(dirname "$0")/.." && pwd)
PK="$AKAR/paket-satker"
N=abt-y5-pengumuman-kedua-26okt
M="mysql -h127.0.0.1 -u root --default-character-set=latin1"
$M -e "DROP DATABASE IF EXISTS y5u_tmp; CREATE DATABASE y5u_tmp DEFAULT CHARACTER SET latin1;"
$M y5u_tmp -e "CREATE TABLE abt_variabel (no_var int(4) unsigned zerofill NOT NULL DEFAULT 0000, nama varchar(200) NOT NULL DEFAULT '', data_type char(20) DEFAULT NULL, data_tabel varchar(100) DEFAULT NULL, data_kolom varchar(100) DEFAULT NULL, urutan_data int(2) unsigned DEFAULT NULL, referensi int(4) unsigned zerofill DEFAULT NULL, sql_query text, default_data text, multi_sidang char(50) DEFAULT NULL, locked tinyint(1) NOT NULL, modifier varchar(30) DEFAULT NULL, modified timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (no_var)) ENGINE=MyISAM DEFAULT CHARSET=latin1;"
LAMA_HEX=$(python -c "import sys;print(open(sys.argv[1],'rb').read().hex())" "$AKAR/sumber/7063-lama-server-26okt.sql")
$M y5u_tmp -e "INSERT INTO abt_variabel (no_var,nama,data_type,sql_query,locked,modifier) VALUES (7063,'WAKTU PANGGILAN RADIO OTOMATIS','data_sql',0x$LAMA_HEX,0,'admin'), (7064,'baris lain','data_teks','x',0,'admin');"
ringkas() { $M -N y5u_tmp -e "SELECT no_var, MD5(sql_query), modifier FROM abt_variabel ORDER BY no_var" | tr '\n' ' '; echo; }
echo "awal      : $(ringkas)"
echo "== 1. PASANG";   $M -N y5u_tmp < "$PK/$N-PASANG.sql"
echo "== 2. PERIKSA";  $M -N y5u_tmp < "$PK/$N-PERIKSA.sql"
echo "sesudah   : $(ringkas)"
echo "== 3. PASANG ulang (harus 0 baris)"; $M -N y5u_tmp < "$PK/$N-PASANG.sql"
echo "== 4. PULIH";    $M -N y5u_tmp < "$PK/$N-PULIH.sql"
echo "pulih     : $(ringkas)"
echo "== 5. PASANG lagi"; $M -N y5u_tmp < "$PK/$N-PASANG.sql"; $M -N y5u_tmp < "$PK/$N-PERIKSA.sql"
echo "akhir     : $(ringkas)"
$M -e "DROP DATABASE y5u_tmp;"
