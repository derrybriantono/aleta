# ALETA Patch Notes 0.1.0-beta.6

Tanggal: 2026-05-03

## Status

PASS

## Ringkasan

Patch Notes baru untuk `0.1.0-beta.6` sudah ditambahkan ke sistem Patch Notes ALETA sebagai entry paling atas.

Judul rilis:

`ALETA 0.1.0-beta.6 - Full Internal Launch & WhatsApp Production Guard`

## File Patch Notes Yang Diubah

- `D:\aleta\manajemen_surat\src\lib\patch-notes.ts`
- `D:\aleta\manajemen_surat\src\app\(portal)\patch-notes\page.tsx`
- `D:\aleta\manajemen_surat\src\test\patch-notes.test.ts`

## Cara Ditampilkan Di UI

Halaman `/patch-notes` membaca `PATCH_NOTES` dari `src/lib/patch-notes.ts`.

Perubahan yang dilakukan:

- `APP_VERSION` dinaikkan ke `0.1.0-beta.6`.
- `APP_VERSION_LABEL` diperbarui ke status Full Internal Operational Launch Ready.
- Entry `0.1.0-beta.6` ditambahkan pada urutan pertama `PATCH_NOTES`.
- Halaman `/patch-notes` sekarang menampilkan detail section tambahan jika patch note memiliki field `details`.

## Patch Notes Lama

Patch notes lama tetap ada.

Versi lama yang tetap dipertahankan:

- `0.1.0-beta.5`
- `0.1.0-beta.4`
- `0.1.0-beta.3`
- `0.1.0-beta.2`
- `0.1.0-beta.1`

## Isi Utama Rilis

Rilis `0.1.0-beta.6` memuat:

- Full Internal Operational Launch readiness.
- WhatsApp Gateway stabilization.
- Queue, dead-letter, dan approval cleanup.
- Automated preflight dan smoke dry-run.
- Pilot WhatsApp internal 1 pesan dan pilot kecil 3 penerima.
- Office Server Launch Readiness.
- WhatsApp Production Guard.
- Data hygiene nomor WhatsApp 42/42 eligible.
- Production risk gate dan shadow-run PASS.
- Cap, rate limit, dan approval gate.
- Public Q&A safe mode.
- Login 1 klik dan portal performance fix.
- Validasi.
- Status akhir rilis.
- Risiko tersisa dan langkah lanjutan.
- Not Yet Included / Pending Execution.

## Pernyataan Penting

Patch notes tidak mengklaim WhatsApp Production Automation sudah aktif final.

Yang dicatat:

- Risk gate PASS.
- Shadow-run PASS.
- Data hygiene 42/42 eligible PASS.
- Canary production belum dijalankan karena di luar Safe Sending Window.
- Final activation menunggu canary PASS pada Safe Sending Window 07:30-21:00.

## Validasi

- `npx tsc --noEmit --pretty false`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 59/59 tests

## Risiko Tersisa

- Rilis ini hanya menambahkan patch notes dan tidak menjalankan canary WhatsApp production.
- WhatsApp Full Production Automation tetap belum final aktif sampai canary production PASS.
- Bagian `Not Yet Included / Pending Execution` sengaja menjaga patch notes tetap jujur untuk pekerjaan yang belum punya laporan final.

## Hal Yang Sengaja Tidak Dilakukan

- Tidak mengaktifkan WhatsApp production.
- Tidak mengaktifkan `botEnabled`.
- Tidak mengaktifkan scheduler/reminder.
- Tidak mengirim WhatsApp.
- Tidak menghapus patch notes lama.
- Tidak mengubah RBAC atau data user.
