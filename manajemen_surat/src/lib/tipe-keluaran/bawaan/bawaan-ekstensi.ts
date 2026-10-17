import type { Cermin } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * CERMIN BAWAAN EKSTENSI (K10) - disalin PERSIS dari sumbernya
 * ============================================================================
 *
 * Sumber                                   Daftar
 *   ekstensi-sipp/konten.js CALON_MEDAN_PANEL   putusan.medan-borang
 *     (+ MEDAN_PINTU di berkas yang sama -> data.pintu)
 *   ekstensi-sipp/panel-alat.js ALAT_PETA_BAWAAN  putusan.peta-blangko
 *   ekstensi-sipp/panel-alat.js ALAT_PADANAN_JENIS putusan.padanan-jenis
 *   ekstensi-sipp/abt.js DAFTAR_ALASAN_SDG       bas.saksi.alasan-pilihan
 *
 * JANGAN menyunting nilai di sini tanpa menyunting sumbernya. Uji
 * tipe-keluaran-cermin-ekstensi.test.ts MENJALANKAN ketiga berkas ekstensi itu
 * (node:vm) dan membandingkannya deep-equal dengan cermin ini; selisih satu
 * huruf pun membuatnya merah. Nilai yang berlaku bagi pengguna sesudah ada
 * tambahan tangan dihitung portal (gabung.ts), bukan di sini.
 *
 * Bentuk tiap daftar:
 *   putusan.medan-borang   kunci 'putusan-akhir', nilai = label medan,
 *                          data {penunjuk, banyak?, pintu?}
 *   putusan.peta-blangko   kunci = jenis baku, nilai = berkas blangko,
 *                          data {jenisAsli, blangko?, blangkoLain?, catatan?}
 *                          ('bawaan: true' pada sumber = asal 'bawaan')
 *   putusan.padanan-jenis  kunci = jenis baku, nilai = satu nama lain
 *   bas.saksi.alasan-pilihan kunci = kunci ciri, nilai = labelnya (sumbernya
 *                          satu string yang menjadi keduanya)
 */
export const CERMIN_EKSTENSI = {
  "putusan.medan-borang": [
    { kunci: "putusan-akhir", nilai: "Status Putusan", data: { penunjuk: 'select[name="status_putusan"]', pintu: true }, urutan: 0 },
    { kunci: "putusan-akhir", nilai: "Putusan Verstek", data: { penunjuk: 'select[name="verstek"]' }, urutan: 1 },
    { kunci: "putusan-akhir", nilai: "Sumber Hukum", data: { penunjuk: 'input[name="sumber_hukum[]"]', banyak: true }, urutan: 2 },
    { kunci: "putusan-akhir", nilai: "Faktor Penyebab Perceraian", data: { penunjuk: 'select[name="faktor_cerai"]' }, urutan: 3 },
    {
      kunci: "putusan-akhir",
      nilai: "Faktor Penyebab Perceraian (Sekunder)",
      data: { penunjuk: 'select[name="faktor_cerai_sekunder"]' },
      urutan: 4,
    },
    { kunci: "putusan-akhir", nilai: "Status Nusyuz", data: { penunjuk: 'input[name="status_nusyuz"]' }, urutan: 5 },
    { kunci: "putusan-akhir", nilai: "Qobla/Ba'da Dukhul", data: { penunjuk: 'select[name="qobla"]', pintu: true }, urutan: 6 },
    { kunci: "putusan-akhir", nilai: "Keadaan Istri", data: { penunjuk: 'select[name="keadaan_istri"]' }, urutan: 7 },
    {
      kunci: "putusan-akhir",
      nilai: "Alasan Pengajuan Dispensasi Kawin",
      data: { penunjuk: 'select[name="alasan_dispen"]' },
      urutan: 8,
    },
    { kunci: "putusan-akhir", nilai: "Jenis Akad Syariah", data: { penunjuk: 'select[name="akad_syariah_primer"]' }, urutan: 9 },
    { kunci: "putusan-akhir", nilai: "Hasil Reskom", data: { penunjuk: 'select[name="status_reskom"]' }, urutan: 10 },
    { kunci: "putusan-akhir", nilai: "Jenis Pengakhiran", data: { penunjuk: 'select[name="pengakhiran_id"]' }, urutan: 11 },
  ],
  "putusan.peta-blangko": [
    {
      kunci: "cerai gugat",
      nilai: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
      data: { jenisAsli: "Cerai Gugat", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"] },
      urutan: 0,
    },
    {
      kunci: "cerai talak",
      nilai: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
      data: { jenisAsli: "Cerai Talak", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 1,
    },
    {
      kunci: "itsbat nikah",
      nilai: "[01] [Kabul] IN",
      data: { jenisAsli: "Itsbat Nikah" },
      urutan: 2,
    },
    {
      kunci: "dispensasi kawin",
      nilai: "[01] [Kabul] DK - (Anak P Cewek) Hamil",
      data: { jenisAsli: "Dispensasi Kawin", catatan: "nama dari server - varian cowok: [01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil" },
      urutan: 3,
    },
    /* === 4B 11 Okt === cermin blok Object.assign(ALAT_PETA_BAWAAN, ...) panel-alat.js (paket ABT abt-blangko-gugatan-lain) */
    {
      kunci: "harta bersama",
      nilai: "[02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi",
      data: { jenisAsli: "Harta Bersama", blangko: "Putusan Harta Bersama", blangkoLain: ["Putusan HB", "HB - Putusan"], catatan: "paket ABT abt-blangko-gugatan-lain - varian: [97] [Perdamaian] Akta Perdamaian; [98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban" },
      urutan: 4,
    },
    {
      kunci: "kewarisan",
      nilai: "[01] [Kabul] Kewarisan - Kontradiktur",
      data: { jenisAsli: "Kewarisan", blangko: "Putusan Kewarisan", blangkoLain: ["Putusan Waris", "Waris - Putusan"], catatan: "paket ABT abt-blangko-gugatan-lain - varian: [97] [Perdamaian] Akta Perdamaian" },
      urutan: 5,
    },
    {
      kunci: "poligami",
      nilai: "[01] [Kabul] Izin Poligami",
      data: { jenisAsli: "Izin Poligami", blangko: "Putusan Izin Poligami", blangkoLain: ["Putusan Poligami", "Poligami - Putusan"], catatan: "paket ABT abt-blangko-gugatan-lain - varian: [98] [Cabut] Permohonan - P & T Hadir Sebelum Jawaban" },
      urutan: 6,
    },
    /* === P 12 Okt === cermin blok alatPetaStatusCerai panel-alat.js (blangko cerai per status putusan; paket ABT abt-cerai-lengkap; Q3 16 Okt: + baris per KEADAAN) */
    {
      kunci: "cerai gugat|dikabulkan|verstek",
      nilai: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"] },
      urutan: 7,
    },
    {
      kunci: "cerai gugat|dikabulkan",
      nilai: "[02] [Kabul] CG - F",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi; [02a] [Kabul] CG - T Tidak Hadir Setelah Mediasi - F; [02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar)" },
      urutan: 8,
    },
    {
      kunci: "cerai gugat|ditolak|verstek",
      nilai: "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Ditolak", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan SEMA 1 Tahun 2022; [01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis" },
      urutan: 9,
    },
    {
      kunci: "cerai gugat|ditolak",
      nilai: "[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Ditolak", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) - F Tidak Terbukti" },
      urutan: 10,
    },
    {
      kunci: "cerai gugat|tidak dapat diterima",
      nilai: "[98] [NO] 4. Cerai P & T Tidak Hadir - Alamat T Tidak Diketahui",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022); [98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah" },
      urutan: 11,
    },
    {
      kunci: "cerai gugat|digugurkan",
      nilai: "[98] [Gugur] 3. Cerai P & T Tidak Hadir",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Digugurkan", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir; [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah (P Tidak Pernah Hadir)" },
      urutan: 12,
    },
    {
      kunci: "cerai gugat|gugur",
      nilai: "[98] [Gugur] 3. Cerai P & T Tidak Hadir",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Gugur", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir; [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah (P Tidak Pernah Hadir)" },
      urutan: 13,
    },
    {
      kunci: "cerai gugat|dicabut",
      nilai: "[98] [Cabut] 1a. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (Alamat T Tidak Diketahui)",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Dicabut", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [98] [Cabut] 1. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (P & T Damai); [98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban); [98] [Cabut] 5. Cerai P Hadir & T Tidak Hadir - Setelah Pembuktian" },
      urutan: 14,
    },
    {
      kunci: "cerai gugat|dicoret dari register",
      nilai: "[98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar Habis",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Dicoret dari Register", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"] },
      urutan: 15,
    },
    {
      kunci: "cerai gugat|dikabulkan|mediasi-sebagian",
      nilai: "[02b] [Kabul] CG - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar)",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [02] [Kabul] CG - F" },
      urutan: 16,
    },
    {
      kunci: "cerai gugat|dikabulkan|t-tidak-hadir-setelah-mediasi",
      nilai: "[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [02a] [Kabul] CG - T Tidak Hadir Setelah Mediasi - F" },
      urutan: 17,
    },
    {
      kunci: "cerai gugat|dicabut|sesudah-mediasi",
      nilai: "[98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban)",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Dicabut", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [98] [Cabut] 5. Cerai P Hadir & T Tidak Hadir - Setelah Pembuktian" },
      urutan: 18,
    },
    {
      kunci: "cerai gugat|tidak dapat diterima|sema-1-2022",
      nilai: "[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022)",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"] },
      urutan: 19,
    },
    {
      kunci: "cerai gugat|digugurkan|p-tidak-hadir-t-hadir",
      nilai: "[98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Digugurkan", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"] },
      urutan: 20,
    },
    {
      kunci: "cerai gugat|gugur|p-tidak-hadir-t-hadir",
      nilai: "[98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Gugur", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"] },
      urutan: 21,
    },
    {
      kunci: "cerai talak|dikabulkan|verstek",
      nilai: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 22,
    },
    {
      kunci: "cerai talak|dikabulkan",
      nilai: "[02] [Kabul] CT - F",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi; [02a] [Kabul] CT - T Tidak Hadir Setelah Mediasi - F; [02b] [Kabul] CT - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar); [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)" },
      urutan: 23,
    },
    {
      kunci: "cerai talak|ditolak|verstek",
      nilai: "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Ditolak", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan SEMA 1 Tahun 2022" },
      urutan: 24,
    },
    {
      kunci: "cerai talak|ditolak",
      nilai: "[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Ditolak", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) - F Tidak Terbukti" },
      urutan: 25,
    },
    {
      kunci: "cerai talak|tidak dapat diterima",
      nilai: "[98] [NO] 4. Cerai P & T Tidak Hadir - Alamat T Tidak Diketahui",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022); [98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah" },
      urutan: 26,
    },
    {
      kunci: "cerai talak|digugurkan",
      nilai: "[98] [Gugur] 3. Cerai P & T Tidak Hadir",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Digugurkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir; [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah (P Tidak Pernah Hadir)" },
      urutan: 27,
    },
    {
      kunci: "cerai talak|gugur",
      nilai: "[98] [Gugur] 3. Cerai P & T Tidak Hadir",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Gugur", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir; [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah (P Tidak Pernah Hadir)" },
      urutan: 28,
    },
    {
      kunci: "cerai talak|dicabut",
      nilai: "[98] [Cabut] 1a. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (Alamat T Tidak Diketahui)",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dicabut", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [Cabut] 1. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (P & T Damai); [98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban); [98] [Cabut] 5. Cerai P Hadir & T Tidak Hadir - Setelah Pembuktian" },
      urutan: 29,
    },
    {
      kunci: "cerai talak|dicoret dari register",
      nilai: "[98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar Habis",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dicoret dari Register", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 30,
    },
    {
      kunci: "cerai talak|dikabulkan|mediasi-sebagian",
      nilai: "[02b] [Kabul] CT - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar)",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [02] [Kabul] CT - F" },
      urutan: 31,
    },
    {
      kunci: "cerai talak|dikabulkan|t-tidak-hadir-setelah-mediasi",
      nilai: "[01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [02a] [Kabul] CT - T Tidak Hadir Setelah Mediasi - F" },
      urutan: 32,
    },
    {
      kunci: "cerai talak|dicabut|sesudah-mediasi",
      nilai: "[98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban)",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dicabut", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [Cabut] 5. Cerai P Hadir & T Tidak Hadir - Setelah Pembuktian" },
      urutan: 33,
    },
    {
      kunci: "cerai talak|tidak dapat diterima|sema-1-2022",
      nilai: "[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022)",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 34,
    },
    {
      kunci: "cerai talak|digugurkan|p-tidak-hadir-t-hadir",
      nilai: "[98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Digugurkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 35,
    },
    {
      kunci: "cerai talak|gugur|p-tidak-hadir-t-hadir",
      nilai: "[98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Gugur", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 36,
    },
    /* === T 13 Okt === cermin blok kumulasi panel-alat.js (blangko putusan perkara kumulasi; paket ABT abt-putusan-bas-lengkap) */
    {
      kunci: "cerai gugat+itsbat-nikah|dikabulkan|verstek",
      nilai: "[01aa] [Kabul Verstek] Putusan CG Kumulasi Itsbat Nikah - Format Lengkap",
      data: { jenisAsli: "Cerai Gugat Kumulasi Itsbat Nikah", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Kumulasi Itsbat Nikah", blangkoLain: ["Putusan Cerai Kumulasi Itsbat", "Cerai Kumulasi Itsbat - Putusan"], catatan: "paket ABT abt-putusan-bas-lengkap - alasan A-H lewat isian 8503 (pengganti [01aa] IN + CG - F / B & F)" },
      urutan: 37,
    },
    {
      kunci: "cerai talak+itsbat-nikah|dikabulkan|verstek",
      nilai: "[01aa] [Kabul Verstek] Putusan CT Kumulasi Itsbat Nikah - Format Lengkap",
      data: { jenisAsli: "Cerai Talak Kumulasi Itsbat Nikah", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Kumulasi Itsbat Nikah", blangkoLain: ["Putusan Cerai Kumulasi Itsbat", "Cerai Kumulasi Itsbat - Putusan"], catatan: "paket ABT abt-putusan-bas-lengkap - alasan A-H lewat isian 8503" },
      urutan: 38,
    },
    {
      kunci: "cerai gugat+hak-asuh-anak|dikabulkan|verstek",
      nilai: "[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz",
      data: { jenisAsli: "Cerai Gugat Kumulasi Hak Asuh Anak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Gugat Kumulasi Hak Asuh Anak", blangkoLain: ["Putusan CG Kumulasi Hak Asuh", "CG Kumulasi Hak Asuh - Putusan"], catatan: "varian: [01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak - Anak Belum Mumayyiz" },
      urutan: 39,
    },
    {
      kunci: "cerai gugat+hak-asuh-anak+nafkah-anak|dikabulkan|verstek",
      nilai: "[01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak - Anak Belum Mumayyiz",
      data: { jenisAsli: "Cerai Gugat Kumulasi Hak Asuh Anak dan Nafkah Anak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Gugat Kumulasi Hak Asuh Anak", blangkoLain: ["Putusan CG Kumulasi Hak Asuh", "CG Kumulasi Hak Asuh - Putusan"], catatan: "varian: [01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz" },
      urutan: 40,
    },
    /* === Q3 16 Okt === cermin blok permohonan & gugatan lain panel-alat.js (peta perkara L3: baris per status/keadaan; menu putusan berpasangan) */
    {
      kunci: "itsbat nikah|digugurkan",
      nilai: "[98] [Gugur] IN",
      data: { jenisAsli: "Itsbat Nikah", statusAsli: "Digugurkan", blangko: "Putusan Itsbat Nikah", blangkoLain: ["Itsbat - Putusan"] },
      urutan: 41,
    },
    {
      kunci: "itsbat nikah|gugur",
      nilai: "[98] [Gugur] IN",
      data: { jenisAsli: "Itsbat Nikah", statusAsli: "Gugur", blangko: "Putusan Itsbat Nikah", blangkoLain: ["Itsbat - Putusan"] },
      urutan: 42,
    },
    {
      kunci: "itsbat nikah|dicabut",
      nilai: "[98] [Cabut] IN",
      data: { jenisAsli: "Itsbat Nikah", statusAsli: "Dicabut", blangko: "Putusan Itsbat Nikah", blangkoLain: ["Itsbat - Putusan"] },
      urutan: 43,
    },
    {
      kunci: "itsbat nikah|ditolak",
      nilai: "[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah)",
      data: { jenisAsli: "Itsbat Nikah", statusAsli: "Ditolak", blangko: "Putusan Itsbat Nikah", blangkoLain: ["Itsbat - Putusan"] },
      urutan: 44,
    },
    {
      kunci: "itsbat nikah|tidak dapat diterima",
      nilai: "[99] [NO] IN - Dibawah Umur",
      data: { jenisAsli: "Itsbat Nikah", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Itsbat Nikah", blangkoLain: ["Itsbat - Putusan"], catatan: "varian: [99] [NO] IN - Masih Terikat Nikah Sebelumnya (Belum Cerai)" },
      urutan: 45,
    },
    {
      kunci: "itsbat nikah|tidak dapat diterima|sema-1-2022",
      nilai: "[99] [NO] Permohonan - Pemohon Tidak Hadir Lagi (SEMA 1 2022)",
      data: { jenisAsli: "Itsbat Nikah", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "keadaan: pemohon dua kali tidak hadir (SEMA 1/2022) - 9b Permohonan Umum" },
      urutan: 46,
    },
    {
      kunci: "itsbat nikah|dikabulkan|kontensius",
      nilai: "[01] [Kabul] IN Kontensius - Pasangan Meninggal, Ahli Waris Mengakui",
      data: { jenisAsli: "Itsbat Nikah Kontensius", statusAsli: "Dikabulkan", blangko: "Putusan Itsbat Nikah Kontensius", blangkoLain: ["IN Kontensius - Putusan"], catatan: "keadaan: nomor perkara Pdt.G (gugatan)" },
      urutan: 47,
    },
    {
      kunci: "itsbat nikah|dicabut|kontensius",
      nilai: "[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban",
      data: { jenisAsli: "Itsbat Nikah Kontensius", statusAsli: "Dicabut", blangko: "Putusan Itsbat Nikah Kontensius", blangkoLain: ["IN Kontensius - Putusan"], catatan: "keadaan: nomor perkara Pdt.G" },
      urutan: 48,
    },
    {
      kunci: "itsbat nikah|tidak dapat diterima|kontensius",
      nilai: "[99] [NO] IN Kontensius - P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022)",
      data: { jenisAsli: "Itsbat Nikah Kontensius", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Itsbat Nikah Kontensius", blangkoLain: ["IN Kontensius - Putusan"], catatan: "keadaan: nomor perkara Pdt.G" },
      urutan: 49,
    },
    {
      kunci: "dispensasi kawin|ditolak",
      nilai: "[03] [Tolak] DK - (Anak P Cewek) Belum Hamil",
      data: { jenisAsli: "Dispensasi Kawin", statusAsli: "Ditolak", blangko: "Putusan Dispensasi Kawin", blangkoLain: ["Diska/DK - Putusan"] },
      urutan: 50,
    },
    {
      kunci: "dispensasi kawin|dicabut",
      nilai: "[98] [Cabut] DK",
      data: { jenisAsli: "Dispensasi Kawin", statusAsli: "Dicabut", blangko: "Putusan Dispensasi Kawin", blangkoLain: ["Diska/DK - Putusan"] },
      urutan: 51,
    },
    {
      kunci: "dispensasi kawin|tidak dapat diterima",
      nilai: "[99] [NO] DK - Pemohon Tidak Hadir Lagi (SEMA 1 2022)",
      data: { jenisAsli: "Dispensasi Kawin", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Dispensasi Kawin", blangkoLain: ["Diska/DK - Putusan"] },
      urutan: 52,
    },
    {
      kunci: "dispensasi kawin|digugurkan",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Dispensasi Kawin", statusAsli: "Digugurkan", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 53,
    },
    {
      kunci: "dispensasi kawin|gugur",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Dispensasi Kawin", statusAsli: "Gugur", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 54,
    },
    {
      kunci: "penetapan ahli waris",
      nilai: "[01] [Kabul] PAW - Ahli Waris Anak Kandung (Suami-Istri dan Orang Tua Pewaris Telah Meninggal)",
      data: { jenisAsli: "Penetapan Ahli Waris", blangko: "Putusan Penetapan Ahli Waris (P3HP)", blangkoLain: ["PAW/P3HP - Putusan"], catatan: "satu susunan ahli waris (anak kandung) - susunan lain belum ada" },
      urutan: 55,
    },
    {
      kunci: "penetapan ahli waris|tidak dapat diterima",
      nilai: "[99] [NO] PAW - Permohonan Kabur (Obscuur Libel)",
      data: { jenisAsli: "Penetapan Ahli Waris", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Penetapan Ahli Waris (P3HP)", blangkoLain: ["PAW/P3HP - Putusan"] },
      urutan: 56,
    },
    {
      kunci: "penetapan ahli waris|tidak dapat diterima|sema-1-2022",
      nilai: "[99] [NO] Permohonan - Pemohon Tidak Hadir Lagi (SEMA 1 2022)",
      data: { jenisAsli: "Penetapan Ahli Waris", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "keadaan: pemohon dua kali tidak hadir (SEMA 1/2022) - 9b Permohonan Umum" },
      urutan: 57,
    },
    {
      kunci: "penetapan ahli waris|dicabut",
      nilai: "[98] [Cabut] Permohonan",
      data: { jenisAsli: "Penetapan Ahli Waris", statusAsli: "Dicabut", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 58,
    },
    {
      kunci: "penetapan ahli waris|digugurkan",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Penetapan Ahli Waris", statusAsli: "Digugurkan", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 59,
    },
    {
      kunci: "penetapan ahli waris|gugur",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Penetapan Ahli Waris", statusAsli: "Gugur", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 60,
    },
    {
      kunci: "perwalian",
      nilai: "Perwalian Anak oleh ortu kandung Kabul",
      data: { jenisAsli: "Perwalian", blangko: "Putusan Perwalian", blangkoLain: ["Perwalian - Putusan"], catatan: "tanpa tanda status di nama berkas" },
      urutan: 61,
    },
    {
      kunci: "perwalian|ditolak",
      nilai: "Perwalian Anak oleh ortu kandung Tolak Primer Kabul Subsider",
      data: { jenisAsli: "Perwalian", statusAsli: "Ditolak", blangko: "Putusan Perwalian", blangkoLain: ["Perwalian - Putusan"] },
      urutan: 62,
    },
    {
      kunci: "perwalian|dicabut",
      nilai: "[98] [Cabut] Permohonan",
      data: { jenisAsli: "Perwalian", statusAsli: "Dicabut", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 63,
    },
    {
      kunci: "perwalian|digugurkan",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Perwalian", statusAsli: "Digugurkan", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 64,
    },
    {
      kunci: "perwalian|gugur",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Perwalian", statusAsli: "Gugur", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 65,
    },
    {
      kunci: "perwalian|tidak dapat diterima",
      nilai: "[99] [NO] Permohonan - Pemohon Tidak Hadir Lagi (SEMA 1 2022)",
      data: { jenisAsli: "Perwalian", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b) - pola SEMA 1/2022" },
      urutan: 66,
    },
    {
      kunci: "lain-lain|dikabulkan",
      nilai: "[01] [Kabul] Pengangkatan Anak",
      data: { jenisAsli: "Lain-Lain (Pengangkatan Anak)", statusAsli: "Dikabulkan", blangko: "Putusan Lain-Lain (Pengangkatan Anak)", blangkoLain: ["Pengangkatan Anak - Putusan"] },
      urutan: 67,
    },
    {
      kunci: "lain-lain|dicabut",
      nilai: "[98] [Cabut] Permohonan",
      data: { jenisAsli: "Lain-Lain (Pengangkatan Anak)", statusAsli: "Dicabut", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 68,
    },
    {
      kunci: "lain-lain|digugurkan",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Lain-Lain (Pengangkatan Anak)", statusAsli: "Digugurkan", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 69,
    },
    {
      kunci: "lain-lain|gugur",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Lain-Lain (Pengangkatan Anak)", statusAsli: "Gugur", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 70,
    },
    {
      kunci: "lain-lain|tidak dapat diterima",
      nilai: "[99] [NO] Permohonan - Pemohon Tidak Hadir Lagi (SEMA 1 2022)",
      data: { jenisAsli: "Lain-Lain (Pengangkatan Anak)", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b) - pola SEMA 1/2022" },
      urutan: 71,
    },
    {
      kunci: "asal usul anak|dicabut",
      nilai: "[98] [Cabut] AUA - Setelah Pembuktian",
      data: { jenisAsli: "Asal Usul Anak", statusAsli: "Dicabut", blangko: "Putusan Asal Usul Anak", blangkoLain: ["Asal Usul Anak - Putusan"] },
      urutan: 72,
    },
    {
      kunci: "asal usul anak|tidak dapat diterima",
      nilai: "[99] [NO] AUA - Poliandri (Pemohon II Masih Terikat Perkawinan)",
      data: { jenisAsli: "Asal Usul Anak", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Asal Usul Anak", blangkoLain: ["Asal Usul Anak - Putusan"] },
      urutan: 73,
    },
    {
      kunci: "asal usul anak|digugurkan",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Asal Usul Anak", statusAsli: "Digugurkan", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 74,
    },
    {
      kunci: "asal usul anak|gugur",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Asal Usul Anak", statusAsli: "Gugur", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 75,
    },
    {
      kunci: "harta bersama|dikabulkan|kontradiktoir",
      nilai: "[01] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan",
      data: { jenisAsli: "Harta Bersama", statusAsli: "Dikabulkan", blangko: "Putusan Harta Bersama", blangkoLain: ["Putusan HB", "HB - Putusan"], catatan: "varian: [01a] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan - Rekonvensi Dikabulkan; [02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi" },
      urutan: 76,
    },
    {
      kunci: "harta bersama|perdamaian",
      nilai: "[97] [Perdamaian] Akta Perdamaian",
      data: { jenisAsli: "Harta Bersama", statusAsli: "Perdamaian", blangko: "Putusan Harta Bersama", blangkoLain: ["Putusan HB", "HB - Putusan"] },
      urutan: 77,
    },
    {
      kunci: "harta bersama|dicabut",
      nilai: "[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban",
      data: { jenisAsli: "Harta Bersama", statusAsli: "Dicabut", blangko: "Putusan Harta Bersama", blangkoLain: ["Putusan HB", "HB - Putusan"] },
      urutan: 78,
    },
    {
      kunci: "kewarisan|perdamaian",
      nilai: "[97] [Perdamaian] Akta Perdamaian",
      data: { jenisAsli: "Kewarisan", statusAsli: "Perdamaian", blangko: "Putusan Kewarisan", blangkoLain: ["Putusan Waris", "Waris - Putusan"] },
      urutan: 79,
    },
    {
      kunci: "kewarisan|dicabut",
      nilai: "[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban",
      data: { jenisAsli: "Kewarisan", statusAsli: "Dicabut", blangko: "Putusan Harta Bersama", blangkoLain: ["Putusan HB", "HB - Putusan"], catatan: "folder 4b Kewarisan tidak punya [98]; dipakai milik 4a Harta Bersama" },
      urutan: 80,
    },
    {
      kunci: "poligami|dicabut",
      nilai: "[98] [Cabut] Permohonan - P & T Hadir Sebelum Jawaban",
      data: { jenisAsli: "Izin Poligami", statusAsli: "Dicabut", blangko: "Putusan Izin Poligami", blangkoLain: ["Putusan Poligami", "Poligami - Putusan"] },
      urutan: 81,
    },
    // I2 16 Okt: penetapan wali adhal Derry (paket abt-wali-adhal, menu 113) - cermin blok I2 panel-alat.js.
    {
      kunci: "wali adhal",
      nilai: "[01] [Kabul] Wali Adhal - Wali Tidak Hadir",
      data: { jenisAsli: "Wali Adhal", blangko: "Putusan Wali Adhal", blangkoLain: ["Wali Adhal - Putusan"], catatan: "varian: [01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan" },
      urutan: 82,
    },
    {
      kunci: "wali adhal|dikabulkan",
      nilai: "[01] [Kabul] Wali Adhal - Wali Tidak Hadir",
      data: { jenisAsli: "Wali Adhal", statusAsli: "Dikabulkan", blangko: "Putusan Wali Adhal", blangkoLain: ["Wali Adhal - Putusan"], catatan: "varian: [01a] [Kabul] Wali Adhal - Wali Hadir Tetap Enggan" },
      urutan: 83,
    },
    {
      kunci: "wali adhal|ditolak",
      nilai: "[03] [Tolak] Wali Adhal - Keengganan Wali Beralasan Hukum",
      data: { jenisAsli: "Wali Adhal", statusAsli: "Ditolak", blangko: "Putusan Wali Adhal", blangkoLain: ["Wali Adhal - Putusan"] },
      urutan: 84,
    },
    {
      kunci: "wali adhal|dicabut",
      nilai: "[98] [Cabut] Wali Adhal",
      data: { jenisAsli: "Wali Adhal", statusAsli: "Dicabut", blangko: "Putusan Wali Adhal", blangkoLain: ["Wali Adhal - Putusan"] },
      urutan: 85,
    },
    {
      kunci: "wali adhal|digugurkan",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Wali Adhal", statusAsli: "Digugurkan", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 86,
    },
    {
      kunci: "wali adhal|gugur",
      nilai: "[98] [Gugur] Permohonan - Pemohon Tidak Pernah Hadir",
      data: { jenisAsli: "Wali Adhal", statusAsli: "Gugur", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b)" },
      urutan: 87,
    },
    {
      kunci: "wali adhal|tidak dapat diterima",
      nilai: "[99] [NO] Permohonan - Pemohon Tidak Hadir Lagi (SEMA 1 2022)",
      data: { jenisAsli: "Wali Adhal", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Permohonan Umum (Cabut/Gugur/NO)", blangkoLain: ["Permohonan Umum - Putusan"], catatan: "permohonan umum (9b) - pola SEMA 1/2022" },
      urutan: 88,
    },
    // F21 17 Okt: putusan hak asuh anak (Penguasaan Anak + Lain-Lain Pdt.G), pembatalan perkawinan, ekonomi syariah gugatan sederhana
    // (paket abt-hak-asuh-derry, abt-pembatalan-perkawinan-derry, abt-ekonomi-syariah-derry) - cermin blok F21 panel-alat.js.
    {
      kunci: "penguasaan anak",
      nilai: "[01] [Kabul] Hak Asuh - Kontradiktoir - Anak Belum Mumayyiz",
      data: { jenisAsli: "Penguasaan Anak", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "varian: [01a] [Kabul] Hak Asuh - T Tidak Hadir Setelah Mediasi - Anak Belum Mumayyiz; [01c] [Kabul] Hak Asuh - Kontradiktoir - Anak Mumayyiz Memilih; [01d] [Kabul] Hak Asuh - Kontradiktoir - Pemegang Hadhanah Tidak Menjamin Keselamatan Anak" },
      urutan: 89,
    },
    {
      kunci: "penguasaan anak|dikabulkan|verstek",
      nilai: "[01b] [Kabul Verstek] Hak Asuh - Anak Belum Mumayyiz",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Dikabulkan", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 90,
    },
    {
      kunci: "penguasaan anak|dikabulkan",
      nilai: "[01] [Kabul] Hak Asuh - Kontradiktoir - Anak Belum Mumayyiz",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Dikabulkan", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "varian: [01a] [Kabul] Hak Asuh - T Tidak Hadir Setelah Mediasi - Anak Belum Mumayyiz; [01c] [Kabul] Hak Asuh - Kontradiktoir - Anak Mumayyiz Memilih; [01d] [Kabul] Hak Asuh - Kontradiktoir - Pemegang Hadhanah Tidak Menjamin Keselamatan Anak" },
      urutan: 91,
    },
    {
      kunci: "penguasaan anak|dikabulkan|t-tidak-hadir-setelah-mediasi",
      nilai: "[01a] [Kabul] Hak Asuh - T Tidak Hadir Setelah Mediasi - Anak Belum Mumayyiz",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Dikabulkan", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "keadaan: T hadir mediasi lalu tidak hadir" },
      urutan: 92,
    },
    {
      kunci: "penguasaan anak|ditolak",
      nilai: "[03] [Tolak] Hak Asuh - Kontradiktoir - Kepentingan Terbaik Anak Tidak Terbukti",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Ditolak", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "varian: [03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan kepada T (Ibu, Anak Belum Mumayyiz); [03b] [Tolak Verstek] Hak Asuh - Kepentingan Terbaik Anak Tidak Terbukti" },
      urutan: 93,
    },
    {
      kunci: "penguasaan anak|perdamaian",
      nilai: "[97] [Perdamaian] Akta Perdamaian",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Perdamaian", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 94,
    },
    {
      kunci: "penguasaan anak|dicabut",
      nilai: "[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Dicabut", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 95,
    },
    {
      kunci: "penguasaan anak|digugurkan",
      nilai: "[98a] [Gugur] Gugatan - P Tidak Hadir Sidang Pertama",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Digugurkan", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 96,
    },
    {
      kunci: "penguasaan anak|gugur",
      nilai: "[98a] [Gugur] Gugatan - P Tidak Hadir Sidang Pertama",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Gugur", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 97,
    },
    {
      kunci: "penguasaan anak|tidak dapat diterima",
      nilai: "[99] [NO] Gugatan - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 98,
    },
    {
      kunci: "lain-lain|dikabulkan|hak-asuh-verstek",
      nilai: "[01b] [Kabul Verstek] Hak Asuh - Anak Belum Mumayyiz",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Dikabulkan", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "keadaan: gugatan hak asuh yang didaftarkan sebagai Lain-Lain (Pdt.G), putusan verstek" },
      urutan: 99,
    },
    {
      kunci: "lain-lain|dikabulkan|hak-asuh",
      nilai: "[01] [Kabul] Hak Asuh - Kontradiktoir - Anak Belum Mumayyiz",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Dikabulkan", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "keadaan: gugatan hak asuh yang didaftarkan sebagai Lain-Lain (Pdt.G); varian: [01a] [Kabul] Hak Asuh - T Tidak Hadir Setelah Mediasi - Anak Belum Mumayyiz; [01c] [Kabul] Hak Asuh - Kontradiktoir - Anak Mumayyiz Memilih; [01d] [Kabul] Hak Asuh - Kontradiktoir - Pemegang Hadhanah Tidak Menjamin Keselamatan Anak" },
      urutan: 100,
    },
    {
      kunci: "lain-lain|ditolak|hak-asuh",
      nilai: "[03] [Tolak] Hak Asuh - Kontradiktoir - Kepentingan Terbaik Anak Tidak Terbukti",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Ditolak", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "varian: [03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan kepada T (Ibu, Anak Belum Mumayyiz); [03b] [Tolak Verstek] Hak Asuh - Kepentingan Terbaik Anak Tidak Terbukti" },
      urutan: 101,
    },
    {
      kunci: "lain-lain|perdamaian|hak-asuh",
      nilai: "[97] [Perdamaian] Akta Perdamaian",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Perdamaian", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 102,
    },
    {
      kunci: "lain-lain|dicabut|hak-asuh",
      nilai: "[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Dicabut", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 103,
    },
    {
      kunci: "lain-lain|digugurkan|hak-asuh",
      nilai: "[98a] [Gugur] Gugatan - P Tidak Hadir Sidang Pertama",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Digugurkan", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 104,
    },
    {
      kunci: "lain-lain|gugur|hak-asuh",
      nilai: "[98a] [Gugur] Gugatan - P Tidak Hadir Sidang Pertama",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Gugur", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 105,
    },
    {
      kunci: "lain-lain|tidak dapat diterima|hak-asuh",
      nilai: "[99] [NO] Gugatan - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"] },
      urutan: 106,
    },
    {
      kunci: "pembatalan perkawinan",
      nilai: "[01] [Kabul] Pembatalan Perkawinan - Kontradiktoir",
      data: { jenisAsli: "Pembatalan Perkawinan", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"], catatan: "varian: [01a] [Kabul] Pembatalan Perkawinan - T Tidak Hadir Setelah Mediasi; [01b] [Kabul Verstek] Pembatalan Perkawinan" },
      urutan: 107,
    },
    {
      kunci: "pembatalan perkawinan|dikabulkan|verstek",
      nilai: "[01b] [Kabul Verstek] Pembatalan Perkawinan",
      data: { jenisAsli: "Pembatalan Perkawinan", statusAsli: "Dikabulkan", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"] },
      urutan: 108,
    },
    {
      kunci: "pembatalan perkawinan|dikabulkan",
      nilai: "[01] [Kabul] Pembatalan Perkawinan - Kontradiktoir",
      data: { jenisAsli: "Pembatalan Perkawinan", statusAsli: "Dikabulkan", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"], catatan: "varian: [01a] [Kabul] Pembatalan Perkawinan - T Tidak Hadir Setelah Mediasi" },
      urutan: 109,
    },
    {
      kunci: "pembatalan perkawinan|dikabulkan|t-tidak-hadir-setelah-mediasi",
      nilai: "[01a] [Kabul] Pembatalan Perkawinan - T Tidak Hadir Setelah Mediasi",
      data: { jenisAsli: "Pembatalan Perkawinan", statusAsli: "Dikabulkan", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"], catatan: "keadaan: T hadir mediasi lalu tidak hadir" },
      urutan: 110,
    },
    {
      kunci: "pembatalan perkawinan|ditolak",
      nilai: "[03] [Tolak] Pembatalan Perkawinan - Kontradiktoir - Alasan Tidak Terbukti",
      data: { jenisAsli: "Pembatalan Perkawinan", statusAsli: "Ditolak", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"] },
      urutan: 111,
    },
    {
      kunci: "pembatalan perkawinan|dicabut",
      nilai: "[98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban",
      data: { jenisAsli: "Pembatalan Perkawinan", statusAsli: "Dicabut", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"] },
      urutan: 112,
    },
    {
      kunci: "pembatalan perkawinan|digugurkan",
      nilai: "[98a] [Gugur] Pembatalan Perkawinan - P Tidak Hadir Sidang Pertama",
      data: { jenisAsli: "Pembatalan Perkawinan", statusAsli: "Digugurkan", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"] },
      urutan: 113,
    },
    {
      kunci: "pembatalan perkawinan|gugur",
      nilai: "[98a] [Gugur] Pembatalan Perkawinan - P Tidak Hadir Sidang Pertama",
      data: { jenisAsli: "Pembatalan Perkawinan", statusAsli: "Gugur", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"] },
      urutan: 114,
    },
    {
      kunci: "pembatalan perkawinan|tidak dapat diterima",
      nilai: "[99] [NO] Pembatalan Perkawinan - P Hadir Lalu 2x Tidak Hadir (SEMA 1 2022)",
      data: { jenisAsli: "Pembatalan Perkawinan", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Pembatalan Perkawinan", blangkoLain: ["Pembatalan Nikah - Putusan"] },
      urutan: 115,
    },
    {
      kunci: "ekonomi syariah",
      nilai: "[01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadir",
      data: { jenisAsli: "Ekonomi Syariah", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"], catatan: "khusus gugatan sederhana (Pdt.G.S); varian: [01b] [Kabul Verstek] ES Gugatan Sederhana - Wanprestasi - T Tidak Hadir Sidang Kedua" },
      urutan: 116,
    },
    {
      kunci: "ekonomi syariah|dikabulkan|verstek",
      nilai: "[01b] [Kabul Verstek] ES Gugatan Sederhana - Wanprestasi - T Tidak Hadir Sidang Kedua",
      data: { jenisAsli: "Ekonomi Syariah", statusAsli: "Dikabulkan", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"] },
      urutan: 117,
    },
    {
      kunci: "ekonomi syariah|dikabulkan",
      nilai: "[01] [Kabul] ES Gugatan Sederhana - Wanprestasi - P & T Hadir",
      data: { jenisAsli: "Ekonomi Syariah", statusAsli: "Dikabulkan", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"] },
      urutan: 118,
    },
    {
      kunci: "ekonomi syariah|ditolak",
      nilai: "[03] [Tolak] ES Gugatan Sederhana - Wanprestasi Tidak Terbukti",
      data: { jenisAsli: "Ekonomi Syariah", statusAsli: "Ditolak", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"] },
      urutan: 119,
    },
    {
      kunci: "ekonomi syariah|perdamaian",
      nilai: "[97] [Perdamaian] ES Gugatan Sederhana - Akta Perdamaian di Hadapan Hakim",
      data: { jenisAsli: "Ekonomi Syariah", statusAsli: "Perdamaian", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"] },
      urutan: 120,
    },
    {
      kunci: "ekonomi syariah|dicabut",
      nilai: "[98] [Cabut] ES Gugatan Sederhana - Sebelum Jawaban",
      data: { jenisAsli: "Ekonomi Syariah", statusAsli: "Dicabut", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"] },
      urutan: 121,
    },
    {
      kunci: "ekonomi syariah|digugurkan",
      nilai: "[98a] [Gugur] ES Gugatan Sederhana - P Tidak Hadir Sidang Pertama",
      data: { jenisAsli: "Ekonomi Syariah", statusAsli: "Digugurkan", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"] },
      urutan: 122,
    },
    {
      kunci: "ekonomi syariah|gugur",
      nilai: "[98a] [Gugur] ES Gugatan Sederhana - P Tidak Hadir Sidang Pertama",
      data: { jenisAsli: "Ekonomi Syariah", statusAsli: "Gugur", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"] },
      urutan: 123,
    },
    {
      kunci: "ekonomi syariah|tidak dapat diterima",
      nilai: "[99] [NO] ES Gugatan Sederhana - Tergugat Tidak Diketahui Tempat Tinggalnya",
      data: { jenisAsli: "Ekonomi Syariah", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Ekonomi Syariah", blangkoLain: ["Ekonomi Syariah - Putusan"], catatan: "Pasal 4 ayat (2) PERMA gugatan sederhana" },
      urutan: 124,
    },
    /* === I7 17 Okt === cermin blok I7 panel-alat.js (varian HB rekonvensi dikabulkan, hak asuh tolak dengan hadhanah kepada T ibu) */
    {
      kunci: "harta bersama|dikabulkan|rekonvensi-dikabulkan",
      nilai: "[01a] [Kabul] [E-Court] HB - Kontradiktoir Konvensi Rekonvensi Sita Jaminan - Rekonvensi Dikabulkan",
      data: { jenisAsli: "Harta Bersama", statusAsli: "Dikabulkan", blangko: "Putusan Harta Bersama", blangkoLain: ["Putusan HB", "HB - Putusan"], catatan: "keadaan: rekonvensi dikabulkan seluruhnya/sebagian; bawaan HB tetap [01] (rekonvensi ditolak)" },
      urutan: 125,
    },
    {
      kunci: "penguasaan anak|ditolak|hak-asuh-t-ibu",
      nilai: "[03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan kepada T (Ibu, Anak Belum Mumayyiz)",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Ditolak", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "keadaan: Tergugat ibu (anak belum mumayyiz)" },
      urutan: 126,
    },
    {
      kunci: "lain-lain|ditolak|hak-asuh-t-ibu",
      nilai: "[03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan kepada T (Ibu, Anak Belum Mumayyiz)",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Ditolak", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "keadaan: gugatan hak asuh yang didaftarkan sebagai Lain-Lain (Pdt.G), Tergugat ibu (anak belum mumayyiz)" },
      urutan: 127,
    },
    /* === I8 17 Okt === cermin blok I8 panel-alat.js (cerai ditolak kontradiktoir [03a], hak asuh tolak verstek [03b]) */
    {
      kunci: "cerai gugat|ditolak|kontradiktoir",
      nilai: "[03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) - F Tidak Terbukti",
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Ditolak", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"], catatan: "varian: [03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti" },
      urutan: 128,
    },
    {
      kunci: "cerai talak|ditolak|kontradiktoir",
      nilai: "[03a] [Tolak] Cerai - Kontradiktoir (T Hadir Jawab-Menjawab) - F Tidak Terbukti",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Ditolak", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti" },
      urutan: 129,
    },
    {
      kunci: "penguasaan anak|ditolak|verstek",
      nilai: "[03b] [Tolak Verstek] Hak Asuh - Kepentingan Terbaik Anak Tidak Terbukti",
      data: { jenisAsli: "Penguasaan Anak", statusAsli: "Ditolak", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "keadaan: Tergugat tidak pernah hadir (verstek)" },
      urutan: 130,
    },
    {
      kunci: "lain-lain|ditolak|hak-asuh-verstek",
      nilai: "[03b] [Tolak Verstek] Hak Asuh - Kepentingan Terbaik Anak Tidak Terbukti",
      data: { jenisAsli: "Lain-Lain", statusAsli: "Ditolak", blangko: "Putusan Hak Asuh Anak (Hadhanah)", blangkoLain: ["Hak Asuh - Putusan"], catatan: "keadaan: gugatan hak asuh yang didaftarkan sebagai Lain-Lain (Pdt.G), putusan verstek" },
      urutan: 131,
    },
  ],
  "putusan.padanan-jenis": [
    { kunci: "itsbat nikah", nilai: "pengesahan perkawinan/istbat nikah", urutan: 0 },
    { kunci: "itsbat nikah", nilai: "pengesahan perkawinan/itsbat nikah", urutan: 1 },
    { kunci: "itsbat nikah", nilai: "pengesahan perkawinan", urutan: 2 },
    { kunci: "itsbat nikah", nilai: "istbat nikah", urutan: 3 },
    { kunci: "itsbat nikah", nilai: "isbat nikah", urutan: 4 },
    { kunci: "penetapan ahli waris", nilai: "p3hp/penetapan ahli waris", urutan: 5 },
    { kunci: "penetapan ahli waris", nilai: "p3hp", urutan: 6 },
    { kunci: "poligami", nilai: "izin poligami", urutan: 7 },
    { kunci: "wali adhal", nilai: "wali adhol", urutan: 8 },
    { kunci: "wali adhal", nilai: "wali adlal", urutan: 9 },
  ],
  "bas.saksi.alasan-pilihan": [
    { kunci: "perselisihan terus-menerus", nilai: "perselisihan terus-menerus", urutan: 0 },
    { kunci: "kekerasan dalam rumah tangga", nilai: "kekerasan dalam rumah tangga", urutan: 1 },
    { kunci: "tidak memberi nafkah", nilai: "tidak memberi nafkah", urutan: 2 },
    { kunci: "pihak lain (wanita/pria idaman lain)", nilai: "pihak lain (wanita/pria idaman lain)", urutan: 3 },
    { kunci: "cemburu", nilai: "cemburu", urutan: 4 },
    { kunci: "obat terlarang", nilai: "obat terlarang", urutan: 5 },
    { kunci: "judi", nilai: "judi", urutan: 6 },
    { kunci: "mabuk", nilai: "mabuk", urutan: 7 },
    { kunci: "murtad/pindah agama", nilai: "murtad/pindah agama", urutan: 8 },
    { kunci: "temperamental", nilai: "temperamental", urutan: 9 },
    { kunci: "berkata kasar", nilai: "berkata kasar", urutan: 10 },
    { kunci: "bersikap kasar", nilai: "bersikap kasar", urutan: 11 },
    { kunci: "malas bekerja", nilai: "malas bekerja", urutan: 12 },
    { kunci: "tidak memiliki pekerjaan tetap", nilai: "tidak memiliki pekerjaan tetap", urutan: 13 },
    { kunci: "masalah ekonomi", nilai: "masalah ekonomi", urutan: 14 },
    { kunci: "menikah lagi", nilai: "menikah lagi", urutan: 15 },
  ],
} satisfies Cermin;
