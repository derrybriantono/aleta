-- Stub basis `isian_data` untuk uji di ABT LAPTOP (di server `isian_data` berisi tampilan ke aleta_bot; kueri variabel ALETA 8808/8809/8870 membacanya).
-- Tanpa ini renderer lokal berhenti "ERROR Variabel #8808#/#8870#" pada blangko yang memuat variabel itu (tidak terkait paket x2).
CREATE DATABASE IF NOT EXISTS isian_data DEFAULT CHARSET latin1;
CREATE TABLE IF NOT EXISTS isian_data.ecourt_ringkasan (perkara_id bigint, kunci varchar(100), nilai text, keyakinan varchar(20)) DEFAULT CHARSET latin1;
CREATE TABLE IF NOT EXISTS isian_data.ecourt_berkas (perkara_id bigint, jenis varchar(64), nama varchar(255), tanggal date) DEFAULT CHARSET latin1;
CREATE TABLE IF NOT EXISTS isian_data.ktp_pihak (perkara_id bigint, cabang tinyint, urutan int, status varchar(16) NOT NULL DEFAULT 'tidak_terbaca', yakin varchar(8) NOT NULL DEFAULT '', tanggal_ktp date, berlaku_hingga varchar(16) NOT NULL DEFAULT '', dibaca_pada datetime NOT NULL DEFAULT '2026-01-01 00:00:00') DEFAULT CHARSET latin1;
