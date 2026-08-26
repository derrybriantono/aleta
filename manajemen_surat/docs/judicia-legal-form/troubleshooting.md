# Troubleshooting JLF

## SIPP Connection Failed

- Cek `JLF_SIPP_PROVIDER`.
- Jika `aleta_bot_bridge`, cek `JLF_SIPP_BRIDGE_BASE_URL` atau `ALETA_BOT_BASE_URL`.
- Pada Docker/CentOS, hindari `127.0.0.1` untuk bridge jika ALETA Bot berada di service/container berbeda. Gunakan nama service Docker, misalnya `http://aleta_bot:3003`.
- Pastikan bridge hanya menerima operasi terdaftar.

Perintah cek cepat di server:

```bash
cd /var/www/html/aleta
docker-compose config --services
docker-compose exec portal sh -lc 'printenv | grep -E "JLF_SIPP|ALETA_BOT|SIPP"'
docker-compose exec portal sh -lc 'wget -qO- http://aleta_bot:3003/internal/aleta-bot/jlf/sipp/query || true'
docker-compose logs --tail=120 portal
docker-compose logs --tail=120 aleta_bot
```

Ganti `portal` dan `aleta_bot` sesuai nama service pada `docker-compose config --services`.

## Provider Disabled

Status disabled berarti portal tidak menghubungi SIPP. Ini default aman.

## ALETA Bot Bridge Unavailable

Cek runtime ALETA Bot, token internal, network antar service, dan status uji koneksi database SIPP di menu ALETA Bot. Jika JLF menampilkan pesan fallback localhost, berarti URL bridge belum diset eksplisit di environment container portal.

## Missing Token

Jika JLF menampilkan `missing_token`, endpoint bridge sudah ditemukan tetapi request dari portal belum membawa token internal. Samakan token pada service `portal` dan `aleta_bot`.

Contoh di `.env.production`:

```bash
ALETA_BOT_INTERNAL_API_TOKEN=isi-token-kuat-yang-sama
ALETA_BOT_INTERNAL_TOKEN=isi-token-kuat-yang-sama
JLF_SIPP_BRIDGE_TOKEN=isi-token-kuat-yang-sama
```

Setelah itu recreate kedua service:

```bash
docker-compose up -d --force-recreate portal aleta_bot
```

## Placeholder Tidak Terbaca

- Pastikan placeholder legacy berbentuk `#0001#`.
- Pastikan placeholder modern berbentuk `{{key}}`.
- DOCX compressed XML belum didukung penuh tanpa parser khusus.

## Variabel Kosong

- Cek mapping template-variable.
- Cek source type dan source key.
- Isi manual value jika source SIPP belum tersedia.
- Gunakan fallback untuk variabel opsional.

## Generate Gagal

- Pastikan template active.
- Pastikan template punya versi file.
- Pastikan variabel required terisi.
- DOCX full rendering belum aktif.

## AI Disabled

- Cek AI global ALETA.
- Cek `jlf.ai.enabled`.
- Cek permission `judicia_legal_form.ai.use`.

## AI Global Unavailable

Cek `ai_global_settings` dan koneksi provider global. JLF tidak punya provider terpisah.

## WhatsApp Failed

- Cek gateway global.
- Cek `jlf.whatsapp.enabled`.
- Cek event toggle.
- Lihat `jlf_whatsapp_notification_logs`.

## Peraturan Belum Verified

AI legal analysis verified-only tidak memakai peraturan `unverified/needs_review/rejected`.

## Account Link Conflict

Conflict terjadi jika lebih dari satu kandidat kuat ditemukan. Admin harus memilih manual.
