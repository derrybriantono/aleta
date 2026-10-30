-- Perkara TERPADAT tiruan di salinan sipp_sr30 (BUKAN server): untuk menyetel tinggi baris sampul sebesar mungkin yang masih satu lembar.
-- 9730 (cerai talak, 15 sidang, 7 agenda/alasan dua baris): alamat panjang, pekerjaan panjang, kuasa P dan T bernama panjang, 3 anak.
-- 9782 (itsbat, permohonan): alamat Pemohon I/II berbeda dan panjang, kuasa, 15 sidang (salinan dari 9730).
-- 10225 (kewarisan 26 pihak): kuasa T, 4 turut tergugat, 1 intervensi, 15 sidang (salinan dari 9730).
-- 9571 (ahli waris 32 pihak, permohonan): 15 sidang (salinan dari 9730).
SET @al1 = 'Jalan Trans Sulawesi Kilometer Dua Puluh Tiga Nomor 145, RT 004 RW 002, Dusun III Lembah Hijau, Desa Tolongano, Kecamatan Banawa Selatan, Kabupaten Donggala, Provinsi Sulawesi Tengah';
SET @al2 = 'Lorong Masjid Nurul Huda Nomor 7, RT 012 RW 005, Dusun II Polege, Kelurahan Kabonga Besar, Kecamatan Banawa, Kabupaten Donggala, Provinsi Sulawesi Tengah, Domisili elektronik: contoh@gmail.com';
UPDATE perkara_pihak1 SET alamat = @al1 WHERE perkara_id IN (9730, 9782);
UPDATE perkara_pihak2 SET alamat = @al2 WHERE perkara_id IN (9730, 10225);
UPDATE perkara_pihak1 SET alamat = @al2 WHERE perkara_id = 9782 AND urutan = (SELECT u FROM (SELECT MAX(urutan) u FROM perkara_pihak1 WHERE perkara_id = 9782) x);
UPDATE pihak SET pekerjaan = 'Pegawai Negeri Sipil pada Dinas Pendidikan dan Kebudayaan Kabupaten Donggala'
 WHERE id IN (SELECT pihak_id FROM (SELECT pihak_id FROM perkara_pihak1 WHERE perkara_id IN (9730, 9782) UNION SELECT pihak_id FROM perkara_pihak2 WHERE perkara_id IN (9730, 10225)) y);
DELETE FROM perkara_pengacara WHERE perkara_id IN (9730, 9782) OR (perkara_id = 10225 AND pihak_ke = 2);
INSERT INTO perkara_pengacara (perkara_id, pihak_ke, pihak_id, urutan, pengacara_id, nama, alamat, aktif)
VALUES (9730, 1, 0, 1, 0, 'Dr. Muhammad Syahrir Abdullah Rahman, S.H., M.H., C.L.A.', '-', 'Y'),
       (9730, 2, 0, 1, 0, 'Hj. Siti Nurhaliza Andi Mappaturung, S.H., M.Kn.', '-', 'Y'),
       (9782, 1, 0, 1, 0, 'Dr. Muhammad Syahrir Abdullah Rahman, S.H., M.H., C.L.A.', '-', 'Y'),
       (10225, 2, 0, 1, 0, 'Hj. Siti Nurhaliza Andi Mappaturung, S.H., M.Kn.', '-', 'Y');
DELETE FROM perkara_anak_pihak WHERE perkara_id = 9730;
INSERT INTO perkara_anak_pihak (perkara_id, nama_anak, anak_ke, diasuh_oleh, tanggal_lahir)
VALUES (9730, 'Muhammad Rizky Ramadhan bin Syamsuddin', 1, 1, '2012-03-04'), (9730, 'Nur Aisyah Putri binti Syamsuddin', 2, 1, '2015-07-09'), (9730, 'Ahmad Fauzan bin Syamsuddin', 3, 2, '2019-01-21');
-- 15 sidang (salinan 9730) untuk perkara lain
DROP TEMPORARY TABLE IF EXISTS t_js;
CREATE TEMPORARY TABLE t_js AS SELECT * FROM perkara_jadwal_sidang WHERE perkara_id = 9730;
DELETE FROM perkara_jadwal_sidang WHERE perkara_id IN (9782, 10225, 9571);
UPDATE t_js SET id = id + 900000000, perkara_id = 9782; INSERT INTO perkara_jadwal_sidang SELECT * FROM t_js;
UPDATE t_js SET id = id + 1000000, perkara_id = 10225; INSERT INTO perkara_jadwal_sidang SELECT * FROM t_js;
UPDATE t_js SET id = id + 1000000, perkara_id = 9571; INSERT INTO perkara_jadwal_sidang SELECT * FROM t_js;
-- turut tergugat (4) dan intervensi (1) untuk 10225: salinan baris tergugat
DELETE FROM perkara_pihak4 WHERE perkara_id = 10225;
DELETE FROM perkara_pihak3 WHERE perkara_id = 10225;
INSERT INTO perkara_pihak4 (perkara_id, urutan, pihak_id, jenis_pihak_id, nama, alamat)
SELECT 10225, n, 0, 1, CONCAT('Turut Tergugat Contoh Nama Panjang Ke-', n), @al2 FROM (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4) x;
INSERT INTO perkara_pihak3 (perkara_id, urutan, pihak_id, jenis_pihak_id, nama, alamat) VALUES (10225, 1, 0, 1, 'Pihak Intervensi Contoh Nama Panjang', @al1);
