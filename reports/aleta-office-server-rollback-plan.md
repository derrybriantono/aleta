# ALETA Office Server Rollback Plan

## Rollback Aplikasi Internal

1. Informasikan admin/operator bahwa ALETA masuk safe mode.
2. Jalankan:

```powershell
cd D:\aleta
.\scripts\stop-aleta-office.ps1
```

3. Jika hanya portal bermasalah, hentikan portal dan biarkan database tidak diubah.
4. Jika hanya ALETA Bot bermasalah, hentikan ALETA Bot. Jangan hapus `.wwebjs_auth`.
5. Jalankan backup/restore database hanya dari backup resmi dan setelah disetujui admin.

## Rollback WhatsApp Safe Mode

- Set `botEnabled=false`.
- Set `notificationsEnabled=false`.
- Set `dispositionDeadlineReminder.enabled=false`.
- Set `dispositionDeadlineReminder.scheduler.enabled=false`.
- Jangan resend dead-letter otomatis.
- Jangan logout/reset WhatsApp kecuali diputuskan manual oleh Super Admin.

## Trigger Rollback

- Queue failed > 0 yang tidak bisa dijelaskan.
- Dead-letter aktif > 0.
- Terindikasi salah penerima.
- Terindikasi kirim ganda.
- WhatsApp `browser_locked` atau stuck initializing.
- Scheduler/reminder production aktif tanpa gate.

