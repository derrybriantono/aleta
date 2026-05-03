# ALETA Panduan Penggunaan Update - 0.1.0-beta.6

Tanggal: 2026-05-03

## Ringkasan

Panduan Penggunaan ALETA diperbarui agar selaras dengan rilis internal `0.1.0-beta.6`. Pembaruan ini menambahkan arahan penggunaan untuk login 1 klik, Portal ALETA, Manajemen Surat, Pusat Tugas, Pusat Masukan, Patch Notes, ALETA Bot dan WhatsApp, Safe Sending Window, monitoring admin, rollback/safe mode, Asisten Hakim, PLH/PLT, dan status produksi saat ini.

Patch Notes `0.1.0-beta.6` sudah tersedia dari pembaruan sebelumnya dan tidak dihapus.

## File Panduan Yang Diubah

- `D:\aleta\manajemen_surat\src\lib\user-guides.ts`
- `D:\aleta\manajemen_surat\src\app\(portal)\panduan\page.tsx`

## Bagian Panduan Yang Ditambahkan

1. Login
   - User cukup login satu kali.
   - Setelah berhasil, user diarahkan ke `/portal`.
   - Tombol login yang sedang loading tidak perlu diklik berulang.
   - Error login dibaca dari pesan yang tampil.
   - Akun diblokir/tidak aktif diarahkan untuk menghubungi Super Admin.

2. Portal ALETA
   - Modul tampil sesuai hak akses.
   - Data berat dapat dimuat bertahap di background.
   - Menu yang sudah tampil tetap bisa digunakan saat sebagian kartu/status masih loading.

3. Manajemen Surat
   - Cara membuka Dashboard Manajemen Surat.
   - Cara masuk ke Surat Masuk dan Surat Keluar.
   - Cara melihat detail surat.
   - Cara membuat dan melihat disposisi.
   - Cara membaca status tugas dan Pusat Tugas.
   - Cara menggunakan filter/search dan export bila tersedia.

4. Pusat Tugas
   - Tugas berasal dari Manajemen Surat, disposisi, approval, feedback, atau ALETA Bot sesuai role.
   - Badge urgent/terlambat diprioritaskan.
   - Jika tugas sudah dikerjakan tetapi masih tampil, user diarahkan refresh atau cek status read/seen.

5. Pusat Masukan
   - User dapat mengirim laporan bug, saran fitur, dan usulan aplikasi baru.
   - Masukan akan dibaca admin.
   - User diingatkan tidak memasukkan data rahasia/sensitif berlebihan.

6. Patch Notes
   - User dapat melihat riwayat perubahan aplikasi.
   - Versi terbaru dicatat sebagai `0.1.0-beta.6`.
   - Patch Notes menjelaskan fitur baru, perbaikan, dan risiko tersisa.

7. ALETA Bot dan WhatsApp
   - WhatsApp Gateway connected dan dapat dimonitor admin.
   - Pengiriman WhatsApp internal terbatas sudah berhasil diuji.
   - WhatsApp Production Automation belum aktif final sampai canary production PASS dalam Safe Sending Window.
   - User biasa tidak perlu scan QR atau menghubungkan WhatsApp.
   - Admin memantau WhatsApp, worker, queue, dead-letter, approval pending, dan guard pengiriman.

8. Safe Sending Window
   - Jam aman pengiriman WhatsApp: `07:30-21:00`.
   - Di luar jam tersebut, sistem dapat menahan pengiriman.
   - Canary/production WhatsApp harus dilakukan dalam jam aman.

9. Monitoring Admin
   - Admin/Super Admin memantau WhatsApp, worker, queue, dead-letter, approval pending, AI Bridge, scheduler/reminder, botEnabled, dan Safe Sending Window.

10. Rollback / Safe Mode
   - Jika ada masalah WhatsApp, set `botEnabled=false`, pastikan scheduler/reminder `disabled/dry_run`, jangan resend otomatis, cek dead-letter, dan cek queue failed.
   - SOP yang dirujuk:
     - `aleta-sop-whatsapp-disconnected.md`
     - `aleta-sop-dead-letter.md`
     - `aleta-sop-queue-failed.md`
     - `aleta-sop-rollback-safe-mode.md`

11. Asisten Hakim
   - Asisten Hakim berisi link AI pendukung seperti ChatGPT, Gemini, Claude, atau AI lain yang dikonfigurasi admin.
   - Akses bergantung pada role/user.
   - Super Admin dapat mengatur link dan visibility sesuai fitur admin yang tersedia.

12. PLH/PLT
   - PLH/PLT dijelaskan sebagai penugasan sementara.
   - Hak akses berlaku selama periode aktif.
   - Penugasan dibuat oleh pejabat/admin berwenang.
   - PLH/PLT tidak otomatis memberi kewenangan strategis seperti pengaturan RBAC atau WhatsApp production.

13. Status Produksi Saat Ini
   - Aplikasi ALETA internal boleh digunakan.
   - Office Server Launch: GO.
   - WhatsApp Gateway: connected.
   - WhatsApp Production Automation: menunggu canary dalam Safe Sending Window.
   - Broadcast, external notification, dan mass resend tetap approval-gated.

## Bagian Panduan Yang Direvisi

- Struktur kategori panduan diperluas agar lebih sesuai dengan modul ALETA saat ini:
  - Mulai Menggunakan ALETA
  - Manajemen Surat
  - Pusat Tugas
  - ALETA Bot & WhatsApp
  - Asisten Hakim
  - Admin Monitoring
  - Patch Notes & Masukan
  - Safe Mode / Rollback
  - Status Produksi
- Perhitungan jumlah panduan per kategori dibuat dinamis agar kategori baru tidak hilang dari halaman `/panduan`.

## Hal Yang Sengaja Tidak Diklaim

- Tidak mengklaim WhatsApp Production Automation sudah aktif final.
- Tidak mengklaim canary production sudah PASS.
- Tidak mengklaim fitur pagination surat 5/10/25/50/100/Semua sebagai bagian panduan ini.
- Tidak mengklaim perubahan PLH/PLT baru di luar panduan umum penugasan sementara.
- Tidak mengklaim broadcast bebas; broadcast tetap approval-gated.

## Validasi

- `npx tsc --noEmit --pretty false`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm test`: PASS, 59/59 tests

## Risiko Tersisa

- Panduan perlu terus diselaraskan jika WhatsApp Production Automation sudah melewati canary dan benar-benar diaktifkan.
- Jika pagination Surat dan perubahan PLH/PLT sudah difinalisasi sebagai rilis resmi, panduan terkait bisa diperinci lagi.
- Konten panduan masih berupa panduan ringkas; bila diperlukan dapat ditambah ilustrasi langkah demi langkah per role.
