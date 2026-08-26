-- Setup MySQL/MariaDB untuk pemisahan ALETA Bot dan SIPP.
-- Jalankan sebagai DBA/root MySQL setelah mengganti placeholder password.
-- Script ini TIDAK menghapus tabel apa pun.

-- 1. Database internal ALETA Bot.
-- Semua tabel aleta_bot_* harus berada di database ini, bukan di database SIPP.
CREATE DATABASE IF NOT EXISTS `aleta_bot`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'aleta_bot_user'@'%'
  IDENTIFIED BY 'CHANGE_ME_ALETA_BOT_STRONG_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX
  ON `aleta_bot`.*
  TO 'aleta_bot_user'@'%';

-- 2. User read-only untuk membaca database SIPP.
-- Ganti `SIPP` jika nama schema SIPP di server berbeda.
CREATE USER IF NOT EXISTS 'sipp_readonly_user'@'%'
  IDENTIFIED BY 'CHANGE_ME_SIPP_READONLY_STRONG_PASSWORD';

GRANT SELECT
  ON `SIPP`.*
  TO 'sipp_readonly_user'@'%';

FLUSH PRIVILEGES;

-- 3. Validasi cepat setelah login sebagai user masing-masing:
-- USE aleta_bot;
-- SHOW TABLES;
--
-- 4. Buat seluruh tabel internal ALETA Bot:
-- mysql -u aleta_bot_user -p aleta_bot < deploy/sql/schema-aleta-bot-mysql.sql
--
-- Login sebagai sipp_readonly_user:
-- USE SIPP;
-- SELECT COUNT(*) FROM perkara;
-- CREATE TABLE should_fail_test (id INT); -- harus gagal untuk user read-only.
