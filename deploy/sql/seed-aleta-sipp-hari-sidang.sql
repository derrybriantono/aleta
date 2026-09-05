-- =============================================================================
-- Hari sidang tiap majelis -> aleta_sipp_hari_sidang
--
-- Dipakai menghitung tanggal sidang pertama (PHS): hari majelisnya, sesudah
-- jeda minimal dari pendaftaran terpenuhi. Selama kosong, PHS tidak dapat
-- mengusulkan tanggal dan berkata jujur "hari sidang majelis belum diatur".
--
-- =============================================================================
-- DARI MANA HARI INI BERASAL
-- =============================================================================
--
-- Diturunkan dari RIWAYAT SIDANG NYATA di SIPP: hari dalam pekan pada sidang
-- pertama tiap perkara tahun 2026, dikelompokkan menurut kode ketua majelisnya.
-- Dikonfirmasi Ketua Pengadilan pada 3 September 2026.
--
--   A  (Ketua Fahri)     Rabu   - riwayat terbelah Rabu/Kamis; bulan-bulan
--                                 terakhir condong Rabu, dikonfirmasi Rabu
--   B  (Ketua Sudarmin)  Selasa - 73% dari 215 sidang, cocok dengan perkara 545
--   C1 (Ketua Himawan)   Senin  - 93% dari 253 sidang
--
-- C2 (Idris) dan C3 (Derry) TIDAK diisi: pada data 2026 keduanya selalu duduk
-- sebagai anggota, tak pernah memimpin majelis sendiri. Hari sidang mengikuti
-- ketua majelisnya (A/B/C1).
--
-- Konvensi "hari" = getDay() JavaScript: 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu,
-- 4=Kamis, 5=Jumat, 6=Sabtu. Terverifikasi lewat perkara 545 (Majelis B,
-- daftar Selasa 2026-09-01 -> sidang Selasa 2026-09-15).
--
-- panitera_kode sengaja dikosongkan: penetapan panitera pengganti (PPP) akan
-- menampilkan seluruh calon aktif sampai penautan panitera-per-majelis diisi
-- terpisah. Mengosongkannya lebih jujur daripada menebak.
--
-- Idempoten.
-- =============================================================================

INSERT INTO aleta_sipp_hari_sidang (majelis_kode, hari, panitera_kode, keterangan, updated_at, updated_by) VALUES
  ('A',  3, '', 'Ketua Fahri - dari riwayat sidang 2026, dikonfirmasi Rabu',   now()::text, 'derivasi'),
  ('B',  2, '', 'Ketua Sudarmin - 73% Selasa, cocok perkara 545',              now()::text, 'derivasi'),
  ('C1', 1, '', 'Ketua Himawan - 93% Senin',                                   now()::text, 'derivasi')
ON CONFLICT (majelis_kode) DO UPDATE SET
  hari       = EXCLUDED.hari,
  keterangan = EXCLUDED.keterangan,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by;
