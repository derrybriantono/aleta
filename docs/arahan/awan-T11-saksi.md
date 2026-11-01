# AWAN T11 - kekurangan keterangan saksi (itsbat, cerai A/D, saksi Tergugat)

Dasar: branch `saksi-pilih` (kode saksi terbaru: perbaikan H1, katalog H2, pilih/hapus J2). Buat branch baru `awan-t11-saksi` dari `origin/saksi-pilih`, commit & push ke sana. JANGAN merge ke gabung-56, JANGAN rilis, JANGAN naikkan versi, JANGAN ubah ekstensi-berkas.ts (tanam = tugas laptop). Bahasa Indonesia (gaya commit CLAUDE.md). Tidak satu kata "Aleta" di teks naskah/SIPP/ABT. Kinerja: tidak boleh membuat panel lag (hitung sekali, cache, tanpa kerja berat saat mengetik).
Lingkungan awan: `npm ci` di manajemen_surat (dan aleta_bot bila perlu) dengan `PUPPETEER_SKIP_DOWNLOAD=true`. Uji SASARAN saja (npx vitest run src/test/<berkas>), JANGAN uji penuh. tsc --noEmit sebelum commit.
Model: Sonnet 5.5 high. Berhenti & laporkan bila biaya mendekati $45.

## 1. Itsbat nikah - isi dari posita permohonan
Butir yang sekarang selalu titik-titik karena tidak ada di SIPP: umur mempelai saat menikah, status sebelum menikah (jejaka/perawan/duda/janda), nama wali nikah & hubungannya, nama dua saksi nikah, mahar (bentuk & nilai, tunai/terutang), juga tempat/tanggal akad bila belum.
- Ambil dari teks posita permohonan itsbat (sumber posita yang sudah dipakai pengisi saksi: cari konteks posita di aleta_bot/services (isiJawabanSaksiService.js, konteksPerkaraSaksi, isiGugatanService.js) dan katalog itsbat di ekstensi-sipp/saksi-katalog/). JANGAN membuat pembaca kedua - perluas pengisi fakta yang ada.
- Pola aturan (tanpa AI), contoh bunyi posita: "pada saat menikah Pemohon I berstatus jejaka berumur 24 tahun dan Pemohon II berstatus perawan berumur 18 tahun", "wali nikah ayah kandung Pemohon II bernama ...", "disaksikan oleh dua orang saksi masing-masing bernama ... dan ...", "dengan mas kawin berupa uang Rp... dibayar tunai". Tangani variasi ejaan (umur/usia, mas kawin/mahar, perjaka/jejaka, gadis/perawan), angka huruf/angka, satu/dua pemohon, itsbat kontensius.
- Yakin tinggi -> terisi; ragu -> tetap titik-titik (jangan menebak). Nama dari posita disalin apa adanya.
- Uji: posita rekaan berbagai bentuk (min. 12 contoh) + tidak salah tangkap.

## 2. Cerai - butir huruf A dan D titik-titik pada pengetahuan "tahu berselisih, tidak tahu sebab"
Matriks agen F/H1: 576 dari 5.229 susunan. Pada pengetahuan itu, butir penyebab untuk huruf alasan A dan D (dan butir lain yang menanyakan sebab) harus berbunyi konsisten "saksi tidak mengetahui penyebabnya" (variasi kalimat untuk saksi 1 & 2), bukan titik-titik; butir yang tidak bergantung sebab tetap seperti sekarang. Sesuai keputusan 61 (tanda ⚠ bila berasal dari gugatan) dan 63/75 (arah Tolak/NO).
- Uji: jalankan matriks cerai (lihat uji saksi-perbaikan-1nov / saksi-pilih-1nov untuk pola) -> 0 titik-titik pada butir sebab untuk modus itu; modus lain tidak berubah.

## 3. Saksi Tergugat tanpa jawaban/duplik e-Court
Set "Saksi Tergugat - sesuai jawaban dan duplik" (keputusan 62) sekarang titik-titik bila naskah 12020/12024 kosong. Sumber pengganti berurutan: (a) jawaban LISAN Tergugat yang tercatat di BAS sidang jawaban (data ABT/SIPP yang sudah dibaca bot untuk BAS - cari pembaca BAS: basPerkara.js, riwayat sidang 8560-8563); (b) duplik lisan; (c) bila tidak ada sama sekali: tetap titik-titik + catatan jelas di panel "jawaban Tergugat belum ada - isi dari keterangan saksi atau pilih 'ikut membenarkan gugatan'". Teks jawaban pihak disalin apa adanya (keputusan 55), hanya dipakai untuk menyusun bunyi bantahan di mulut saksi.
- Uji: tiga keadaan (e-Court ada, hanya lisan, tidak ada).

## Laporan akhir
Pesan terakhir + `docs/arahan/awan-T11-saksi-hasil.md`: commit, berkas, angka uji (termasuk sisa titik-titik matriks sebelum/sesudah), yang belum terverifikasi (ukur atas perkara sungguhan = di laptop), perkiraan biaya.
