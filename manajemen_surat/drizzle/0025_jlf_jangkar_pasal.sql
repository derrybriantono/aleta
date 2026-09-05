-- =============================================================================
-- Jangkar kutipan pasal (C3) dan sebutan yang dapat disalin ke putusan.
--
-- =============================================================================
-- MENGAPA KOLOM TERSENDIRI, BUKAN DI DALAM METADATA
-- =============================================================================
--
-- Jangkar dipakai putusan untuk merujuk balik ke pasalnya. Rujukan itu harus
-- dapat DICARI - "pertimbangan mana saja yang menyebut Pasal 39 ayat (2)?" -
-- dan pencarian di dalam JSONB tidak dapat berindeks dengan sederhana maupun
-- berjalan pada basis data dalam memori yang dipakai saat Postgres tidak ada.
--
-- =============================================================================
-- SEBUTAN DISIMPAN, TIDAK DIHITUNG ULANG
-- =============================================================================
--
-- "Pasal 39 ayat (2) huruf f" dihitung dari susunan induknya saat penguraian.
-- Menghitungnya ulang tiap kali dibaca menuntut seluruh bagian peraturan ikut
-- dimuat hanya untuk menampilkan satu kutipan - dan pada peraturan berisi
-- ratusan pasal itu terasa pada tiap pembukaan halaman.
-- =============================================================================

ALTER TABLE jlf_regulation_sections ADD COLUMN IF NOT EXISTS anchor TEXT NOT NULL DEFAULT '';
ALTER TABLE jlf_regulation_sections ADD COLUMN IF NOT EXISTS citation_label TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_jlf_sections_anchor ON jlf_regulation_sections(anchor);
CREATE INDEX IF NOT EXISTS idx_jlf_sections_regulation ON jlf_regulation_sections(regulation_id, sort_order);
