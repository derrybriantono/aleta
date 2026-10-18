# CLAUDE.md — ALETA: hemat token, tetap benar

Prioritas: **hasil benar/terverifikasi > hemat token > cepat.** Jangan hemat token dengan melewati verifikasi.

## Pilih model & effort (oleh pengguna: pemilih model / `/model`, dan pengaturan effort)
| Kasus di ALETA | Model | Effort |
| :--- | :--- | :--- |
| Insiden/data rusak di SIPP-ABT, forensik, pemulihan server | Opus 5.5 (`/model opus`) | max |
| Rancang fitur besar, debugging lintas portal-bot-ekstensi, aturan hukum (deteksi alasan, amar, penetapan), tinjau sebelum rilis | Opus 5.5 | high (Plan Mode, `Shift+Tab`) |
| Kode yang MENULIS ke SIPP/ABT, transaksi, migrasi Drizzle, paket ABT (MariaDB 5.5) | Sonnet 5.5 (`/model sonnet`) | high |
| Fitur & perbaikan harian (panel ekstensi, rute portal, layanan bot) | Sonnet 5.5 | medium |
| Ubahan UI/teks kecil, catatan rilis, dokumen ide | Sonnet 5.5 | low |
| Rutin: satu berkas uji, git, salin rilis, papan kemajuan, cari berkas | Haiku 5.5 (`/model haiku`) | low |
| Subagen: penelusuran (Explore) → Haiku 5.5 low; pengerjaan kode → Sonnet 5.5 high | — | — |

Naikkan effort bila hasil pertama salah; jangan turunkan di bawah "high" untuk kode yang menulis ke SIPP/ABT.

Kebersihan sesi (dijalankan pengguna): `/compact` saat percakapan panjang, `/clear` saat ganti tugas, `/resume` untuk melanjutkan sesi.

## Struktur & perintah
- `manajemen_surat/` portal Next.js · `aleta_bot/` bot Node · `ekstensi-sipp/` ekstensi Chrome MV3. Jalankan npm dari `manajemen_surat/`.
- Typecheck: `npx tsc --noEmit` · Lint: `npm run lint`
- Uji: **berkas sasaran saja** `npx vitest run src/test/<berkas>.test.ts`. Uji penuh hanya lewat skill `periksa-uji` (`node scripts/periksa-uji.mjs`), wajib hijau sebelum commit rilis — jangan diulang-ulang.
- Rilis ekstensi: skill `rilis-ekstensi` (`node scripts/rilis-ekstensi.mjs`) — jangan ketik ulang langkahnya.
- Jangan naikkan `APP_VERSION` portal.
- **Drive C: = SSD 128 GB, D: = hardisk.** Di luar `C:\aleta\` jangan menulis ke C: (TMP/TEMP = `D:\Aplikasi\aleta\tmp`). Pengecualian (disetujui 17 Okt): uji penuh dan `tsc` boleh dari salinan kerja SSD `C:\aleta\kerja` (git worktree terpisah, detached) dengan TMP/TEMP `C:\aleta\tmp` (otomatis bila cwd di C:, atau env `ALETA_UJI_TMP`). Sisa C: wajib ≥ 10 GB.

## Papan "kemajuan kerja ALETA" — WAJIB selalu hidup & selalu diperbarui
- Alamat http://localhost:8787 (konfigurasi preview `kemajuan-aleta` = `node D:/aleta-dev/kerja/kemajuan/server.js`).
  Di awal sesi dan sebelum memperbarui: periksa `curl -s localhost:8787/data`; bila mati, nyalakan (`preview_start kemajuan-aleta`).
- Data: `D:/aleta-dev/kerja/kemajuan/rencana/<sesi>.json` → `paket[].tahap[].langkah[]` (`id, judul, status: selesai|jalan|menunggu, persen, menit, catatan`).
  Ubah lewat skrip Python (baca–ubah–tulis JSON utuh, `ensure_ascii=False`), bukan suntingan tangan.
- Perbarui SETIAP: tugas/agen mulai atau selesai, commit/rilis/paket, hasil uji (hijau/merah), keputusan pengguna, dan saat pengguna bertanya kemajuan. Catatan berisi jam + fakta (commit, angka uji), bukan perkiraan kosong.
- Tiap langkah juga mencatat `model` (mis. "Opus 5.5"), `effort` (low|medium|high|max), `pelaku` ("sesi utama" / "agen X") dan
  `token` (angka `subagent_tokens` dari laporan selesai agen; kosong bila tidak terukur - jangan menebak). Model & effort sesi:
  `get_session self`; agen mewarisi pengaturan sesi kecuali diberi lain. Papan menjumlahkan token per tahap.
- Langkah `menunggu` atau rencana yang belum diperintahkan: `menit: 0, persen: 0` (tidak ikut perkiraan selesai). Persen `jalan` dari kemajuan nyata (commit/berkas), bukan tebakan.
- Sesudah menulis, pastikan `/data` memuat perubahan.

## Aturan kerja hemat token
- **Langsung ke perubahan**: beri kode/diff dan hasil verifikasi; tanpa pengantar atau teori kecuali diminta.
- **Konteks sempit**: baca hanya berkas/bagian yang dituju (Grep dulu, lalu Read dengan offset/limit); jangan menampilkan log panjang — saring (`tail`, `grep`) ke baris yang relevan.
- **Tanpa keluaran tak diminta**: jangan membuat dokumen, diagram, atau berkas pembantu kecuali diminta.
- Jawab pengguna dalam **bahasa Indonesia**.

## Pola commit
Subjek singkat bergaya conventional, bahasa Indonesia; badan 1–3 baris menjelaskan SEBAB (bukan kronologi); akhiri dengan baris `Co-Authored-By`.
- Baik: `fix(kasir): usulan jurnal putus memuat biaya pemberitahuan putusan`
- Buruk: `Saya sudah memperbarui logika kasir karena sebelumnya ada yang salah...`

## Tim agen (`.claude/agents/`) — kapan WAJIB dipanggil
Sesi utama = perencana/koordinator. Delegasikan sesuai tabel; agen melapor ke sesi utama, sesi utama yang memperbarui papan kemajuan
(`pelaku` = "agen <nama>").
| Keadaan | Agen |
| :--- | :--- |
| Kode menulis ke SIPP/ABT, transaksi, kasir, migrasi Drizzle | `penjaga-sipp` (mengerjakan/memeriksa) |
| Logika hukum: alasan, amar, penetapan, ikrar, BAS, tenggat, dasar hukum | `ahli-hukum` (memeriksa) |
| Fitur/perbaikan `aleta_bot/` | `bot-whatsapp` |
| Fitur/perbaikan/rilis `ekstensi-sipp/` | `ekstensi-chrome` |
| Usulan atau perubahan tampilan | `ui-ux` — tampilan TIDAK diubah tanpa permintaan pengguna; setiap saran wajib disertai mockup HTML |
| Auth/hak akses, rute API baru, data pribadi, sebelum rilis besar | `keamanan` (memeriksa) |
| Uji sasaran / uji penuh sebelum commit rilis | `penguji` |
| Sesudah perubahan selesai, SEBELUM commit | `peninjau` — commit hanya bila PUTUSAN: LOLOS |
- Satu berkas hanya boleh disunting satu agen pada satu waktu. Agen pemeriksa (`peninjau`, `keamanan`, `ahli-hukum`, `penguji`) tidak menyunting.
- Tugas kecil (teks/satu baris) tidak perlu agen selain `peninjau`. Jangan memanggil agen yang tidak relevan — tiap agen memakan token.
