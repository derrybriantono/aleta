# Security Review JLF

## Critical Findings

Tidak ditemukan critical finding pada review final lokal.

## High Findings

Tidak ditemukan high finding yang belum dipatch pada area JLF.

## Medium Findings

- DOCX/PDF anonimisasi belum diproses penuh karena belum ada worker/sandbox. Saat ini aman karena TXT/RTF saja yang diproses langsung; DOCX/PDF ditolak untuk extraction.
- Direct MySQL SIPP masih placeholder. Ini aman, tetapi staging perlu bridge ALETA Bot yang benar-benar menjalankan query terdaftar/parameterized.
- E2E JLF membutuhkan sesi/dev server dan data login seed yang konsisten.

## Low Findings

- `npm run lint` masih gagal karena rule React hooks pada file lama non-JLF.
- Beberapa setting retensi baru memakai fallback runtime jika belum ada seed eksplisit.

## Patches Applied

- Hasil search SIPP dipotong server-side sesuai limit meski provider mengembalikan lebih banyak.
- Audit account sync dinormalisasi ke action final `account_link.*`.
- Manual link terhadap kandidat `suggested/conflict` kini mengubah status menjadi `linked`.
- Query account link menghindari pola `NOT IN` yang bermasalah pada pg-mem test runtime.

## Kredensial

- Tidak ada credential hardcoded JLF.
- JLF tidak menyimpan password/hash SIPP.
- Secret AI/WhatsApp/SIPP tidak ditampilkan di summary UI/log.

## SIPP

- Adapter read-only.
- Tidak ada raw SQL endpoint.
- Input search menolak pola SQL.
- Direct MySQL belum aktif tanpa izin dependency.

## Upload

- Validasi extension, MIME longgar yang dikenal, size limit.
- Executable ditolak.
- Macro VBA template ditolak.
- Storage private.
- Tidak ada shell exec dari request.

## Dokumen

- Path template/output divalidasi.
- Download authorized.
- RTF escaping aktif.
- Snapshot variabel tersimpan.

## QR

- Token random dan hash disimpan.
- Public verification minimal.
- Tidak expose file path.

## AI

- Memakai AI global ALETA.
- Bisa dimatikan.
- Permission enforced.
- Redaction dan prompt injection guard aktif.
- Legal analysis memakai JLF Legal KB dan verified-only mode jika aktif.
- Sumber dicatat.

## WhatsApp

- Memakai gateway global.
- Pesan aman dan ringkas.
- Link tetap butuh login.
- Log menyimpan preview aman.

## Audit

- Aksi penting JLF tercatat.
- Metadata sensitif dimasking.
- Akses audit dibatasi `judicia_legal_form.audit.view`.

## Remaining Risks

- Perlu penetration test dan review bridge SIPP real sebelum staging.
- Perlu load test jika template/dokumen besar.
- Perlu policy retensi production yang disahkan.

