# ALETA Bot/WhatsApp JLF

JLF memakai ALETA Bot/WhatsApp Gateway global. JLF tidak membuat gateway baru dan tidak menyimpan token WhatsApp baru.

## Event

- `document_waiting_validation`
- `document_approved`
- `document_rejected`
- `document_change_requested`
- `document_finalized`
- `document_ready`
- `regulation_needs_review`
- `account_link_pending`
- `ai_analysis_completed`

## Pesan Aman

Pesan harus ringkas dan tidak memuat isi perkara lengkap, data pribadi pihak, atau file dokumen.

Contoh:

- `Dokumen menunggu validasi di ALETA Judicia (Legal Form). Silakan login ke ALETA untuk melihat detail.`
- `Dokumen telah disetujui. Silakan login ke ALETA untuk tindak lanjut.`

Link harus menuju ALETA dan tetap memerlukan login/otorisasi.

## Log

Log JLF disimpan di `jlf_whatsapp_notification_logs`, termasuk status, event, masked phone, preview aman, gateway provider, dan error message jika ada.

## Troubleshooting

- Gateway disabled: aktifkan gateway global ALETA Bot.
- JLF notification disabled: aktifkan `jlf.whatsapp.enabled`.
- Event disabled: aktifkan toggle event spesifik.
- Pesan gagal: cek log JLF dan status gateway global.

