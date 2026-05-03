# ALETA Office Server Day-One Monitoring

## Interval

- 15 menit sekali selama 2 jam pertama.
- 30 menit sekali sampai akhir hari pertama.
- Setelah itu minimal pagi/siang/sore selama masa pilot.

## Pantau

- Portal reachable.
- Login user internal.
- Manajemen Surat bisa dibuka.
- Pusat Tugas bisa dibuka.
- ALETA Bot runtime reachable.
- WhatsApp status.
- Worker enabled, active timer, not paused.
- Queue pending/processing/failed.
- Dead-letter aktif.
- Approval pending.
- Policy skip.
- Feedback user.

## Threshold Tindakan

- Queue failed > 0: masuk safe mode WhatsApp dan review item.
- Dead-letter aktif > 0: jangan resend; review error dan acknowledge jika artefak validasi.
- WhatsApp disconnected: buka Status WhatsApp Gateway, jangan reset session.
- Browser locked: hentikan proses Chrome/Puppeteer lama atau restart ALETA Bot aman.
- User tidak bisa login: cek role/auth tanpa mematikan RBAC.

