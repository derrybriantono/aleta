DROP DATABASE IF EXISTS x2_uji_sipp;
CREATE DATABASE x2_uji_sipp DEFAULT CHARSET latin1;
USE x2_uji_sipp;
CREATE TABLE perkara_pihak3 LIKE sipp_donggala.perkara_pihak3;
CREATE TABLE pihak LIKE sipp_donggala.pihak;
CREATE TABLE agama LIKE sipp_donggala.agama;
CREATE TABLE tingkat_pendidikan LIKE sipp_donggala.tingkat_pendidikan;
CREATE TABLE perkara LIKE sipp_donggala.perkara;
INSERT INTO agama SELECT * FROM sipp_donggala.agama;
INSERT INTO tingkat_pendidikan SELECT * FROM sipp_donggala.tingkat_pendidikan;
INSERT INTO perkara SELECT * FROM sipp_donggala.perkara WHERE perkara_id IN (10070, 9729, 7883);
INSERT INTO pihak SELECT * FROM sipp_donggala.pihak WHERE id IN (SELECT pihak_id FROM sipp_donggala.perkara_pihak1 WHERE perkara_id IN (10070, 9729));
DELIMITER $$
CREATE FUNCTION get_umur(tanggal_lahir DATE, tanggal_hitung DATE) RETURNS int(4)
BEGIN
 DECLARE i INT;
 SET i = YEAR(tanggal_hitung)-YEAR(tanggal_lahir)-(DATE_FORMAT(tanggal_hitung,'%m%d')<DATE_FORMAT(tanggal_lahir,'%m%d'));
 RETURN i;
END$$
DELIMITER ;
-- baris tiruan pihak ketiga (di server/lab perkara_pihak3 kosong); lalu jalankan 6 kueri 10121-10126 (urutan pertama terpilih, bukan yang diinput lebih dulu)
INSERT INTO perkara_pihak3 (perkara_id,urutan,pihak_id,nama,alamat,jenis_intervensi_nama) VALUES
 (9729,2,34653,'Udin Bin Abide','Jl. Kedua No. 2','Voeging'),(9729,1,34654,'Muhdar Bin Abide','Jl. Pertama No. 1','Tussenkomst'),(10070,1,NULL,'Tanpa Pihak Id','Dusun Tanpa Pihak','Vrijwaring');
-- basis sementara ini (x2_uji_sipp) dihapus sesudah uji: DROP DATABASE x2_uji_sipp;
