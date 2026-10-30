-- Paket ABT "abt-sampul-rapi-30okt" (30 Okt 2026): sampul, lampiran, daftar isi, ceklist berkas perkara Derry penuh satu halaman dan rapi; tabel dokumen dan lampiran langsung dari ABT; logo kop monokrom.
-- PULIH fungsi paket (hanya fungsi milik paket ini; PRASYARAT memastikan tidak ada fungsi lain bernama sama)
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_teks_sel;
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_baris_tabel;
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_tabel_daftar_isi;
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_tabel_ceklist;
DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_lampiran_sampul;
