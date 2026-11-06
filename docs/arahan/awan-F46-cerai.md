# Arahan cloud: Fitur 46 tahap cerai

Cabang kerja: `fitur-46-cerai` (dari tag `rilis-1.205.80`). Sesi cloud, model Sonnet 5.5 effort high. Laporan dan pesan commit berbahasa Indonesia.

## Tujuan

Di layar cetak ALETA ABT, alat bukti yang ada menyusun paragraf pertimbangan otomatis untuk **cerai gugat dan cerai talak**. Bunyinya berbeda menurut jenis bukti, jenis perkara, dan keadaan putusan. Fitur ini hanya untuk ALETA ABT.

## Keputusan pemilik (tidak boleh diubah)

1. **Cara masuk:** paragraf bukti pokok tertulis otomatis. Bukti yang tidak mendesak (pelengkap) tampil sebagai usulan yang bisa dipilih.
2. **Kalimat tidak dibantah:** hanya bila pihak lawan hadir. Ada toggle "Lawan membantah" yang mengubah bunyinya.
3. **Dicabut:** tergantung agenda sidang. Dicabut sebelum ada pembuktian: tidak ada paragraf. Dicabut pada agenda pembuktian kedua: bukti dari pembuktian pertama ditawarkan sebagai usulan.
4. **Sumber:** semua bunyi dari Blangko ABT by Derry, bukan dari putusan hakim lain. Untuk cerai kabul verstek pakai blangko `[Kabul Verstek] Cerai (Format Lengkap)` beserta alat buktinya. Alat bukti tetap bisa disunting dan suntingannya memengaruhi paragraf. Format menurut selera hakim DITUNDA, jangan dibuat.
5. **Urutan:** tahap ini cerai saja. Itsbat, dispensasi kawin, dan kebendaan bukan bagian tugas ini.

Bukti tanpa asli: cukup bunyi "tidak dapat dicocokkan dengan aslinya". Label kekuatan bukti tidak berubah karenanya.

## Bahan

- `docs/arahan/awan-f46-bahan-cerai.json`: alinea bukti dari 52 blangko CG dan CT (termasuk Kabul Verstek, Kabul, Tolak, Tolak Verstek, Cabut, NO) dan rumus 58 variabel yang disebutnya. Isi blangko saja, tanpa data perkara. Rumus ditulis untuk ABT, jadi tafsirkan bunyi cabangnya, jangan jalankan SQL-nya.
- Kode: `manajemen_surat/src/lib/bukti-tertulis.ts`, `src/lib/bukti-katalog.json`, `src/components/portal/bukti-aleta-abt.tsx`, `src/components/portal/cetak-aleta-abt.tsx`, `src/lib/penilai-bukti.ts`.

## Yang dibangun

1. **Hitung dulu.** `manajemen_surat/scripts/ukur-kartu-bukti.mjs`: dari bahan, jenis bukti mana yang punya bunyi pada tiap keadaan cerai. Tulis hasilnya ke laporan.
2. **Kartu aturan.** `manajemen_surat/src/lib/kartu-pertimbangan-bukti.json`: per pasangan jenis bukti (kunci katalog), jenis cerai, dan keadaan. Tiap kartu menyimpan bunyi, kategori pokok atau pelengkap, dan rujukan blangko asalnya. Penanda diganti nama kolom bukti, bukan `#nnnn#`.
3. **Penyusun murni.** `manajemen_surat/src/lib/sinkron-pertimbangan-bukti.ts`, tanpa DOM dan jaringan:
   `susunParagrafBukti({ jenisCerai, status, verstek, lawanHadir, lawanMembantah, agendaPembuktianKe, bukti })` memulangkan daftar `{ kode, kunci, bunyi, cara: "otomatis"|"usulan", asal }` dan daftar `belumAdaBunyi`.
   - Dikabulkan, verstek, kontradiktoir: paragraf penuh menurut kartu.
   - Ditolak: bukti dinilai, tidak menyimpulkan dalil terbukti.
   - Tidak Dapat Diterima: berhenti pada syarat formil.
   - Gugur, Digugurkan, Perdamaian: kosong.
   - Dicabut: menurut keputusan nomor 3.
   - Isian bukti (nomor, tanggal, penerbit, nama) diambil dari baris bukti. Isian kosong tidak ditulis sebagai titik-titik atau tebakan.
   - Jenis bukti tanpa bunyi di blangko masuk `belumAdaBunyi`. **Jangan mengarang bunyi.**
4. **Tampilan.** Di `bukti-aleta-abt.tsx`, tambah bagian "Pertimbangan dari alat bukti": paragraf otomatis, usulan yang bisa dicentang, toggle "Lawan membantah", pilihan keadaan yang terbaca, dan tombol Salin. Bahasa sehari-hari, tanpa nomor variabel di layar, memakai komponen dan token yang sudah ada.
5. **Uji.** `manajemen_surat/src/test/sinkron-pertimbangan-bukti-6nov.test.ts`: tiap keadaan di atas, toggle, dicabut per agenda, bukti disunting dan dihapus, bukti tanpa asli, jenis tanpa bunyi, dan kepatuhan bahwa bunyi kartu berasal dari bahan.

## Batasan keras

- JANGAN mengubah: `ekstensi-sipp/`, `abt-paket/`, berkas blangko, `src/server/modules/aleta-abt-cetak/naskah.ts`, `APP_VERSION`, atau migrasi basis data. Paragraf belum disisipkan ke naskah cetak: itu menunggu uji di laptop. Tahap ini berhenti pada tampilan dan Salin.
- Tidak menulis ke SIPP atau ABT. Tidak ada rute tulis baru.
- Tidak satu kata "Aleta" pada bunyi kartu, karena bunyi itu masuk naskah.
- Tanpa data perkara, nama pihak, NIK, sandi, atau kunci di repo dan laporan.
- Periksa rujukan pasal yang ditemukan. Blangko menulis Pasal 1865 KUHPerdata; bila menemukan bunyi yang mencurigakan, jangan dibetulkan diam-diam, catat di laporan.
- Tanpa rilis, tanpa merge, tanpa mengubah cabang lain.

## Cara kerja

- Di `manajemen_surat/`: `npm ci` sekali, lalu `npx vitest run src/test/<berkas>.test.ts` untuk uji sasaran saja, `npx tsc --noEmit`, dan `npx eslint <berkas yang diubah>`. Jangan menjalankan rangkaian uji penuh.
- Commit dan push ke `fitur-46-cerai` **sesudah tiap langkah**, supaya hasil tetap aman bila kuota habis. Pola: `feat(aleta-abt): ...`, badan 1 sampai 3 baris tentang sebab, akhiri dengan `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Hemat kuota. Bila tinggal sedikit atau ada yang buntu, tulis laporan, push, lalu berhenti.

## Laporan akhir

`docs/arahan/awan-F46-cerai-hasil.md`: apa yang selesai, angka uji apa adanya, jenis bukti dan keadaan yang belum punya bunyi, bunyi blangko yang mencurigakan, dan apa yang harus dicek di laptop (data SIPP, layar sungguhan, penyisipan ke naskah).
