# -*- coding: utf-8 -*-
"""Bangun paket ABT abt-ket-saksi-kata-30okt dari definisi isian_rtf_ket_saksi yang terpasang (dump server 28 Okt 15.44).

Masalah: isian_rtf_ket_saksi (paket I3/x6, dipakai variabel 9259-9265 = keterangan saksi putusan Derry) meniru
str_ireplace PHP ABT: 'saya' -> 'saksi' dan 'ya, ' -> '' diganti di MANA SAJA, juga di tengah kata. Akibatnya jawaban
"saya tidak mengetahuinya, yang saya tahu ..." tercetak "saksi tidak mengetahuinyang saksi tahu ..." dan "Iya, saya ..."
tercetak "isaksi ...". Diukur di dump server: 1.468 jawaban (631 perkara) memuat "...ya, " di ujung kata.
Perbaikan: 'saya' dan 'ya, ' hanya diganti sebagai KATA UTUH (fungsi baru isian_rtf_ganti_kata), "Iya, " di awal jawaban
dibuang seperti "Ya, ". Selain dua baris itu definisi fungsi SAMA PERSIS.
pakai: python bangun_paket.py <berkas body lama (routine_definition)>  -> ../paket-satker/*.sql
"""
import hashlib, io, os, sys

SINI = os.path.dirname(os.path.abspath(__file__))
PK = os.path.join(SINI, '..', 'paket-satker')
N = 'abt-ket-saksi-kata-30okt'
lama = io.open(sys.argv[1], encoding='utf-8', newline='').read().rstrip('\r\n')
MD5_LAMA = hashlib.md5(lama.encode('utf-8')).hexdigest()

KEPALA = ("CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_ket_saksi`(pid INT, sk VARCHAR(40)) RETURNS longtext CHARSET utf8mb4\n"
          "    READS SQL DATA\n    SQL SECURITY INVOKER\n")
KOM_LAMA = "    COMMENT 'I3+X6: keterangan saksi ABT seperti list_keterangan TANPA ganti baris di ujung dan TANPA kalimat penutup (sudah cukup dst.)'\n"
KOM_BARU = "    COMMENT 'I3+X6+K30: keterangan saksi ABT seperti list_keterangan TANPA ganti baris di ujung, TANPA kalimat penutup, saya/ya kata utuh'\n"

A = "        SET t = isian_rtf_iganti(t, 'saya', 'saksi');\n        SET t = isian_rtf_iganti(t, 'ya, ', '');\n"
B = ("        IF LOWER(LEFT(t, 5)) = 'iya, ' THEN\n          SET t = SUBSTRING(t, 6);\n        END IF;\n"
     "        SET t = isian_rtf_ganti_kata(t, 'saya', 'saksi');\n        SET t = isian_rtf_ganti_kata(t, 'ya, ', '');\n")
nl = '\r\n' if '\r\n' in lama else '\n'
a, b = A.replace('\n', nl), B.replace('\n', nl)
assert lama.count(a) == 1, 'dua baris ganti lama tidak ditemukan tepat sekali'
baru = lama.replace(a, b)

GANTI_KATA = r"""CREATE DEFINER=CURRENT_USER FUNCTION `isian_rtf_ganti_kata`(t LONGTEXT CHARSET latin1, cari VARCHAR(20) CHARSET latin1, ganti VARCHAR(20) CHARSET latin1) RETURNS longtext CHARSET latin1
    NO SQL
    DETERMINISTIC
    SQL SECURITY INVOKER
    COMMENT 'K30: ganti KATA UTUH tanpa beda besar-kecil (huruf sebelum, dan sesudah bila kata berakhir huruf, bukan a-z)'
BEGIN
  DECLARE low LONGTEXT CHARSET latin1;
  DECLARE o LONGTEXT CHARSET latin1 DEFAULT '';
  DECLARE i INT DEFAULT 1;
  DECLARE j INT;
  DECLARE n INT;
  DECLARE ah INT;
  DECLARE sb VARCHAR(1) CHARSET latin1;
  DECLARE ss VARCHAR(1) CHARSET latin1;
  IF t IS NULL THEN
    RETURN NULL;
  END IF;
  SET n = CHAR_LENGTH(cari);
  SET ah = IF(LOWER(RIGHT(cari, 1)) REGEXP '^[a-z]$', 1, 0);
  SET low = LOWER(t);
  lp: LOOP
    SET j = LOCATE(BINARY LOWER(cari), BINARY low, i);
    IF j = 0 THEN
      SET o = CONCAT(o, SUBSTRING(t, i));
      LEAVE lp;
    END IF;
    SET sb = IF(j > 1, SUBSTRING(low, j - 1, 1), ' ');
    SET ss = IF(j + n <= CHAR_LENGTH(low), SUBSTRING(low, j + n, 1), ' ');
    IF sb REGEXP '^[a-z]$' OR (ah = 1 AND ss REGEXP '^[a-z]$') THEN
      SET o = CONCAT(o, SUBSTRING(t, i, j + n - i));
    ELSE
      SET o = CONCAT(o, SUBSTRING(t, i, j - i), ganti);
    END IF;
    SET i = j + n;
  END LOOP;
  RETURN o;
END"""


def tulis(nama, isi):
    with io.open(os.path.join(PK, nama), 'w', encoding='utf-8', newline='\n') as f:
        f.write(isi)


os.makedirs(PK, exist_ok=True)
tulis(N + '-FUNGSI.sql',
      "-- Paket ABT \"%s\": dua fungsi (1 baru, 1 diganti; nama dan tanda tangan sama). Dijalankan pasang-satker.sh SESUDAH PRASYARAT.\n"
      "DROP FUNCTION IF EXISTS `isian_rtf_ganti_kata`;\nDELIMITER ;;\n%s;;\nDELIMITER ;\n"
      "DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`;\nDELIMITER ;;\n%s%s%s;;\nDELIMITER ;\n" % (N, GANTI_KATA, KEPALA, KOM_BARU, baru))
tulis(N + '-FUNGSI-LAMA.sql',
      "-- Paket ABT \"%s\": PULIH - isian_rtf_ket_saksi persis seperti sebelum paket (md5 definisi %s); fungsi baru dihapus.\n"
      "DROP FUNCTION IF EXISTS `isian_rtf_ket_saksi`;\nDELIMITER ;;\n%s%s%s;;\nDELIMITER ;\nDROP FUNCTION IF EXISTS `isian_rtf_ganti_kata`;\n" % (N, MD5_LAMA, KEPALA, KOM_LAMA, lama))
MD5_BARU = hashlib.md5(baru.encode('utf-8')).hexdigest()
tulis(N + '-PRASYARAT.sql',
      "-- PRASYARAT %s (BACA SAJA). Satu baris A|B|C|D:\n"
      "--  A = isian_rtf_ket_saksi ada (1) | B = isian_rtf_ganti_kata ada (0 sebelum, 1 sesudah)\n"
      "--  C = definisi isian_rtf_ket_saksi = versi x6 terpasang (md5 %s, nama basis disamakan) (1 sebelum, 0 sesudah)\n"
      "--  D = definisi = versi paket ini (md5 %s) (0 sebelum, 1 sesudah)\n"
      "-- Pasang bila 1|0|1|0; pasang ulang bila 1|1|0|1; selain itu berhenti tanpa mengubah apa pun.\n"
      "SELECT CONCAT_WS('|',\n"
      " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'),\n"
      " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ganti_kata'),\n"
      " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'\n"
      "    AND MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) = '%s'),\n"
      " (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_type='FUNCTION' AND routine_name='isian_rtf_ket_saksi'\n"
      "    AND MD5(REPLACE(routine_definition, CONCAT(DATABASE(), '.abt_'), 'aps_badilag.abt_')) = '%s')\n"
      ") AS prasyarat;\n" % (N, MD5_LAMA, MD5_BARU, MD5_LAMA, MD5_BARU))
tulis('harap.txt', '1|0|1|0\n1|1|0|1\n')
print('md5 lama', MD5_LAMA, 'md5 baru', MD5_BARU)
