# ALETA Backend

Backend ALETA sekarang memakai PostgreSQL sebagai database utama untuk arsitektur Hybrid Modular Monolith.

## Menjalankan PostgreSQL lokal

1. Salin `.env.example` menjadi `.env.local`
2. Jalankan `npm run db:up`
3. Jalankan aplikasi dengan `npm run dev`

Default koneksi lokal:

- Database: `aleta`
- User: `postgres`
- Password: `postgres`
- Port host: `54329`
- Port container: `5432`

Connection string default:

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/aleta
```

## Script penting

- `npm run db:up` untuk menyalakan PostgreSQL lokal
- `npm run db:down` untuk mematikan PostgreSQL lokal
- `npm run db:logs` untuk melihat log database
- `npm run db:generate` untuk generate migration Drizzle
- `npm run db:migrate` untuk menjalankan migration ke PostgreSQL
- `npm run db:seed` untuk seed data domain ALETA + auth
- `npm run db:studio` untuk membuka Drizzle Studio di port `4983`
- `npm run test` untuk test penuh
- `npm run build` untuk build produksi

## Catatan migrasi

- Seed backend mengikuti frontend terbaru sebagai source of truth.
- AI endpoint tetap verify-before-save dan tidak menulis draft AI langsung ke database.
- Test backend memakai `pg-mem` agar tetap cepat, tetapi runtime aplikasi memakai PostgreSQL sungguhan lewat `DATABASE_URL`.
