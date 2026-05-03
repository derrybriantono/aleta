# ALETA Office Server Deployment Runbook

Release: ALETA Full Internal Launch - 0.1.0-beta.5 Operational

## Scope

Runbook ini untuk menjalankan ALETA sebagai aplikasi internal kantor:

- Portal ALETA dan Manajemen Surat.
- Pusat Tugas, Patch Notes, Panduan, Pusat Masukan.
- Admin monitoring sesuai role.
- ALETA Bot runtime dan WhatsApp gateway monitoring.

Runbook ini bukan aktivasi WhatsApp production automation penuh. Broadcast, notifikasi pihak eksternal, mass resend, scheduler/reminder production, dan botEnabled permanen tetap memakai gate terpisah.

## Prasyarat Server

- Windows Server/Windows desktop kantor yang stabil.
- Node.js dan npm tersedia.
- Database reachable dari server.
- File `.env` portal dan bot sudah disiapkan tanpa membagikan secret.
- Port 3000 untuk portal dan 3003 untuk ALETA Bot tidak dipakai aplikasi lain.
- Chrome/Puppeteer dapat berjalan untuk WhatsApp gateway.
- Folder `.wwebjs_auth` tidak dihapus dan tidak direset.
- Backup database tersedia sebelum hari pertama operasional.

## Start

Jalankan dari PowerShell:

```powershell
cd D:\aleta
.\scripts\start-aleta-office.ps1
.\scripts\status-aleta-office.ps1
```

## Stop Aman

```powershell
cd D:\aleta
.\scripts\stop-aleta-office.ps1
```

Script stop hanya mencari proses yang command line-nya mengarah ke folder ALETA. Jangan gunakan kill semua Node kecuali kondisi darurat dan sudah dipastikan tidak ada proses lain yang penting.

## Restart Aman

```powershell
cd D:\aleta
.\scripts\restart-aleta-office-safe.ps1
```

Restart tidak logout WhatsApp, tidak menghapus session, dan tidak mengganti session name.

## Validasi Setelah Start

```powershell
node scripts\aleta-office-server-readiness.mjs
node scripts\aleta-preflight.mjs
node scripts\aleta-smoke-dry-run.mjs
```

Status minimum untuk operasional internal:

- Portal reachable.
- ALETA Bot reachable.
- WhatsApp tidak browser_locked.
- Worker aktif.
- Queue failed 0.
- Dead-letter aktif 0.
- Approval pending 0.
- Scheduler/reminder production tetap disabled/dry_run kecuali gate production terpisah sudah PASS.

## Catatan Jaringan

- Akses internal kantor diarahkan ke port portal 3000 atau reverse proxy resmi.
- Port 3003 sebaiknya hanya internal/server-local atau dibatasi firewall.
- Jangan expose endpoint internal ALETA Bot ke publik.

