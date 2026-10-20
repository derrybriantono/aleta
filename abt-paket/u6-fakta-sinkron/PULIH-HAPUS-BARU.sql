-- Pemulihan: menghapus baris yang ditambahkan paket ini. Tidak ada baris lama yang berubah.
DELETE FROM abt_variabel WHERE no_var IN (4600, 4601, 4602, 4603, 4604, 4605, 4606, 4607, 4608, 4609, 4610, 4611, 4612, 4613, 4614, 4615, 4616, 4617, 4618, 4620, 4621, 4622, 4623, 4624, 4625, 4626, 4627, 4628, 4629);
SELECT COUNT(*) AS sisa_baris_baru FROM abt_variabel WHERE no_var IN (4600, 4601, 4602, 4603, 4604, 4605, 4606, 4607, 4608, 4609, 4610, 4611, 4612, 4613, 4614, 4615, 4616, 4617, 4618, 4620, 4621, 4622, 4623, 4624, 4625, 4626, 4627, 4628, 4629);
