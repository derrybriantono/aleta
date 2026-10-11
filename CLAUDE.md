# CLAUDE.md — ALETA: hemat token, tetap benar

Prioritas: **hasil benar/terverifikasi > hemat token > cepat.** Jangan hemat token dengan melewati verifikasi.

## Pilih model (oleh pengguna, lewat pemilih model / `/model`)
| Tugas | Model | Catatan |
| :--- | :--- | :--- |
| Arsitektur, debugging sulit, keputusan berisiko | Opus 5.5 (`/model opus`) | Rencanakan dulu (Plan Mode, `Shift+Tab`) |
| Coding harian, fitur, perbaikan | Sonnet 5.5 (`/model sonnet`) | Bawaan untuk sebagian besar tugas |
| Rutin: uji tunggal, git, skrip kecil | Haiku 4.5 (`/model haiku`) | Langsung kerjakan, tanpa teori |

Kebersihan sesi (dijalankan pengguna): `/compact` saat percakapan panjang, `/clear` saat ganti tugas, `/resume` untuk melanjutkan sesi.

## Struktur & perintah
- `manajemen_surat/` portal Next.js · `aleta_bot/` bot Node · `ekstensi-sipp/` ekstensi Chrome MV3. Jalankan npm dari `manajemen_surat/`.
- Typecheck: `npx tsc --noEmit` · Lint: `npm run lint`
- Uji: **berkas sasaran saja** `npx vitest run src/test/<berkas>.test.ts`. Uji penuh hanya lewat skill `periksa-uji` (`node scripts/periksa-uji.mjs`), wajib hijau sebelum commit rilis — jangan diulang-ulang.
- Rilis ekstensi: skill `rilis-ekstensi` (`node scripts/rilis-ekstensi.mjs`) — jangan ketik ulang langkahnya.
- Jangan naikkan `APP_VERSION` portal. Jangan menulis ke drive C: (TMP/TEMP = `D:\Aplikasi\aleta\tmp`).

## Aturan kerja hemat token
- **Langsung ke perubahan**: beri kode/diff dan hasil verifikasi; tanpa pengantar atau teori kecuali diminta.
- **Konteks sempit**: baca hanya berkas/bagian yang dituju (Grep dulu, lalu Read dengan offset/limit); jangan menampilkan log panjang — saring (`tail`, `grep`) ke baris yang relevan.
- **Tanpa keluaran tak diminta**: jangan membuat dokumen, diagram, atau berkas pembantu kecuali diminta.
- Jawab pengguna dalam **bahasa Indonesia**.

## Pola commit
Subjek singkat bergaya conventional, bahasa Indonesia; badan 1–3 baris menjelaskan SEBAB (bukan kronologi); akhiri dengan baris `Co-Authored-By`.
- Baik: `fix(kasir): usulan jurnal putus memuat biaya pemberitahuan putusan`
- Buruk: `Saya sudah memperbarui logika kasir karena sebelumnya ada yang salah...`
