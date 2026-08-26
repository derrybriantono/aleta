-- Setup PostgreSQL untuk Portal ALETA / Manajemen Surat.
-- Jalankan sebagai DBA/superuser PostgreSQL setelah mengganti placeholder password.
-- Schema/tabel aplikasi dibuat oleh migrasi/bootstrap Portal ALETA, bukan oleh script ini.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aleta') THEN
    CREATE ROLE aleta LOGIN PASSWORD 'CHANGE_ME_POSTGRES_ALETA_STRONG_PASSWORD';
  END IF;
END
$$;

SELECT 'CREATE DATABASE aleta OWNER aleta'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aleta')\gexec

GRANT ALL PRIVILEGES ON DATABASE aleta TO aleta;

-- Setelah database dibuat:
-- 1. Set DATABASE_URL=postgresql://aleta:CHANGE_ME_POSTGRES_ALETA_STRONG_PASSWORD@postgres:5432/aleta
-- 2. Jalankan aplikasi Portal ALETA atau migrasi/bootstrap sesuai pola project.
-- 3. Pastikan tabel Manajemen Surat seperti letters, dispositions, attachments,
--    users, roles, module_visibility, settings, dan audit tables berada di database ini.
