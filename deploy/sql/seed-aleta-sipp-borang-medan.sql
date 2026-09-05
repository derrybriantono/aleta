-- =============================================================================
-- Peta kolom formulir SIPP -> aleta_sipp_borang_medan
--
-- Inilah yang menghidupkan tombol "Kerjakan": selama peta ini kosong, borang
-- dianggap belum siap dan tombolnya sengaja mati (lihat borangSiap pada
-- penunjukan-pengisian.ts).
--
-- =============================================================================
-- DARI MANA SELEKTOR INI BERASAL
-- =============================================================================
--
-- BUKAN tebakan. Setiap "penunjuk" di bawah dibaca langsung dari berkas view
-- SIPP yang berjalan di server (/var/www/html/SIPP), pada 3 September 2026:
--
--   data-umum : application/views/perkara_tab/edit_data_umum.php
--   pmh       : application/views/perkara_tab/penetapan/edit_majelis_v.php
--   ppp       : application/views/perkara_tab/penetapan/edit_panitera_v.php
--   pjs       : application/views/perkara_tab/penetapan/edit_juru_sita_v.php
--   phs       : application/views/perkara_tab/penetapan/edit_sidang_pertama_v.php
--
-- Formulir tambah dan sunting memakai view yang SAMA (f_add_majelis pun memuat
-- edit_majelis_v), jadi peta ini berlaku untuk keduanya.
--
-- "penunjuk" adalah selektor CSS yang diteruskan apa adanya ke
-- document.querySelector di jembatan.js. Karena itu formatnya "#id", kecuali
-- pilihan_majelis yang id-nya ("model_hakim") ambigu dengan label di
-- dekatnya - untuk itu dipakai selektor name yang pasti.
--
-- "jenis" menentukan cara mengisi (lihat isiMedan):
--   kaya    -> CKEditor  (posita_text, petitum_text)
--   pilih   -> <select> / select2
--   tanggal -> datepicker jQuery UI
--   teks    -> input/textarea biasa
--
-- "wajib" menandai kolom yang HARUS ada penunjuknya agar borang dianggap siap.
-- Kolom yang muncul bersyarat (anggota majelis hanya saat majelis, data nikah
-- hanya pada perceraian, nilai sengketa hanya pada alur tertentu) ditandai
-- TIDAK wajib - penunjuknya tetap disediakan, tetapi ketidakhadirannya di
-- halaman bukan berarti petanya belum lengkap.
--
-- Idempoten: dijalankan berulang kali menghasilkan keadaan yang sama.
-- =============================================================================

INSERT INTO aleta_sipp_borang_medan (borang, medan, penunjuk, jenis, wajib, catatan, updated_at, updated_by) VALUES

-- ---------- DATA UMUM (perkara, perkara_data_pernikahan, perkara_obyek_sengketa) ----------
('data-umum', 'klasifikasi',            '#klasifikasi',            'pilih',   1, 'Klasifikasi/jenis perkara', now()::text, 'seed'),
('data-umum', 'no_surat',               '#no_surat',               'teks',    1, 'Nomor surat gugatan/permohonan', now()::text, 'seed'),
('data-umum', 'tgl_surat',              '#tgl_surat',              'tanggal', 1, 'Tanggal surat gugatan/permohonan', now()::text, 'seed'),
('data-umum', 'obyek_gugatan',          '#obyek_gugatan',          'teks',    1, 'Obyek sengketa (textarea biasa, bukan CKEditor)', now()::text, 'seed'),
-- PENTING: instance CKEditor bernama "posita"/"petitum", BUKAN
-- "posita_text"/"petitum_text". Yang berakhiran _text hanyalah <td> pembungkus
-- (ckeditor->editor("posita",...) pada edit_data_umum.php membuat elemen ber-id
-- "posita"). Menunjuk ke td-nya membuat isiMedan mencari
-- CKEDITOR.instances["posita_text"] yang tidak ada, lalu diam-diam gagal.
('data-umum', 'posita',                 '#posita',                 'kaya',    1, 'Posita - kotak CKEditor (instance "posita")', now()::text, 'seed'),
('data-umum', 'petitum',                '#petitum',                'kaya',    1, 'Petitum - kotak CKEditor (instance "petitum")', now()::text, 'seed'),
('data-umum', 'nilai_sengketa',         '#nilai_sengketa',         'teks',    0, 'Hanya muncul pada alur perkara tertentu', now()::text, 'seed'),
('data-umum', 'pihak_dipublikasikan',   '#aktif',                  'pilih',   0, 'Pihak Dipublikasikan; id di halaman = "aktif", punya nilai bawaan', now()::text, 'seed'),
('data-umum', 'tgl_nikah',              '#tgl_nikah',              'tanggal', 0, 'Perkara perceraian', now()::text, 'seed'),
('data-umum', 'tgl_kutipan_akta_nikah', '#tgl_kutipan_akta_nikah', 'tanggal', 0, 'Perkara perceraian', now()::text, 'seed'),
('data-umum', 'no_kutipan_akta_nikah',  '#no_kutipan_akta_nikah',  'teks',    0, 'Perkara perceraian', now()::text, 'seed'),
('data-umum', 'ref_kua',                '#ref_kua',                'pilih',   0, 'KUA tempat nikah; select2', now()::text, 'seed'),

-- ---------- PMH (perkara_penetapan, perkara_hakim_pn, perkara_smartmajelis) ----------
('pmh', 'tgl_penetapan_majelis', '#tgl_penetapan_majelis',         'tanggal', 1, 'Tanggal penetapan majelis', now()::text, 'seed'),
('pmh', 'pilihan_majelis',       'select[name="pilihan_majelis"]', 'pilih',   1, 'majelis atau tunggal - menentukan cabang isian berikutnya', now()::text, 'seed'),
('pmh', 'jenis_acara',           '#jenis_acara',                   'pilih',   0, 'Acara biasa/cepat; ada nilai bawaan', now()::text, 'seed'),
('pmh', 'hakim_ketua',           '#hakim_ketua',                   'pilih',   1, 'select2', now()::text, 'seed'),
('pmh', 'hakim_anggota1',        '#hakim_anggota1',                'pilih',   0, 'Hanya saat susunan majelis', now()::text, 'seed'),
('pmh', 'hakim_anggota2',        '#hakim_anggota2',                'pilih',   0, 'Hanya saat susunan majelis', now()::text, 'seed'),
('pmh', 'hakim_anggota3',        '#hakim_anggota3',                'pilih',   0, 'Anggota tambahan bila ada', now()::text, 'seed'),
('pmh', 'hakim_anggota4',        '#hakim_anggota4',                'pilih',   0, 'Anggota tambahan bila ada', now()::text, 'seed'),
('pmh', 'hakim_tunggal',         '#hakim_tunggal',                 'pilih',   0, 'Hanya saat hakim tunggal', now()::text, 'seed'),

-- ---------- PPP (perkara_penetapan, perkara_panitera_pn) ----------
('ppp', 'tgl_penunjukan_panitera', '#tgl_penunjukan_panitera', 'tanggal', 1, 'Tanggal penunjukan panitera pengganti', now()::text, 'seed'),
('ppp', 'panitera1',               '#panitera1',               'pilih',   1, 'Panitera pengganti; select2', now()::text, 'seed'),
('ppp', 'panitera2',               '#panitera2',               'pilih',   0, 'Panitera pengganti kedua bila ada', now()::text, 'seed'),
('ppp', 'panitera3',               '#panitera3',               'pilih',   0, 'Panitera pengganti ketiga bila ada', now()::text, 'seed'),

-- ---------- PJS (perkara_penetapan, perkara_jurusita) ----------
('pjs', 'tgl_penunjukan_juru_sita', '#tgl_penunjukan_juru_sita', 'tanggal', 1, 'Tanggal penunjukan juru sita', now()::text, 'seed'),
('pjs', 'juru_sita1',               '#juru_sita1',               'pilih',   1, 'Juru sita; select2', now()::text, 'seed'),
('pjs', 'juru_sita2',               '#juru_sita2',               'pilih',   0, 'Juru sita kedua bila ada', now()::text, 'seed'),
('pjs', 'juru_sita3',               '#juru_sita3',               'pilih',   0, 'Juru sita ketiga bila ada', now()::text, 'seed'),

-- ---------- PHS (perkara_penetapan, perkara_jadwal_sidang) ----------
('phs', 'tgl_penetapan_sidang_pertama', '#tgl_penetapan_sidang_pertama', 'tanggal', 1, 'Tanggal penetapan hari sidang', now()::text, 'seed'),
('phs', 'tgl_sidang_pertama',           '#tgl_sidang_pertama',           'tanggal', 1, 'Tanggal sidang pertama', now()::text, 'seed'),
('phs', 'jam_sidang_pertama',           '#jam_sidang_pertama',           'teks',    1, 'Jam sidang, format jam:menit', now()::text, 'seed'),
('phs', 'isi_agenda_sidang',            '#isi_agenda_sidang',            'teks',    1, 'Agenda sidang (textarea)', now()::text, 'seed'),
('phs', 'ruangan',                      '#ruangan',                      'pilih',   1, 'Ruang sidang', now()::text, 'seed'),
('phs', 'ini_rj',                       '#ini_rj',                       'pilih',   0, 'Dua elemen ber-id sama (select + hidden), muncul bersyarat', now()::text, 'seed')

ON CONFLICT (borang, medan) DO UPDATE SET
  penunjuk   = EXCLUDED.penunjuk,
  jenis      = EXCLUDED.jenis,
  wajib      = EXCLUDED.wajib,
  catatan    = EXCLUDED.catatan,
  updated_at = EXCLUDED.updated_at,
  updated_by = EXCLUDED.updated_by;
