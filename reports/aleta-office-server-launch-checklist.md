# ALETA Office Server Launch Checklist

## Sebelum Launch

- [ ] Backup database berhasil.
- [ ] `.env` portal tersedia dan secret tidak dicetak ke dokumen.
- [ ] `.env` ALETA Bot tersedia dan token internal cocok dengan portal.
- [ ] `node --version` dan `npm --version` terbaca.
- [ ] `npm run build` portal PASS.
- [ ] `npm test` portal PASS.
- [ ] `node --check` file ALETA Bot PASS.
- [ ] Port 3000 dan 3003 tidak konflik.
- [ ] `node scripts\aleta-office-server-readiness.mjs` PASS/WARN non-blocking.
- [ ] `node scripts\aleta-preflight.mjs` tidak FAIL.
- [ ] `node scripts\aleta-smoke-dry-run.mjs` PASS.

## Saat Launch

- [ ] Jalankan `.\scripts\start-aleta-office.ps1`.
- [ ] Jalankan `.\scripts\status-aleta-office.ps1`.
- [ ] Verifikasi portal bisa dibuka dari jaringan internal.
- [ ] Verifikasi Admin ALETA Bot monitoring bisa dibuka oleh role berwenang.
- [ ] Pastikan `botEnabled=false` kecuali ada gate production yang benar-benar GO.
- [ ] Pastikan scheduler/reminder production tidak aktif.

## Setelah Launch

- [ ] Pantau queue pending/processing/failed.
- [ ] Pantau dead-letter aktif.
- [ ] Pantau approval pending.
- [ ] Pantau WhatsApp connected/disconnected.
- [ ] Pantau feedback user hari pertama.
- [ ] Jangan resend otomatis item gagal.

