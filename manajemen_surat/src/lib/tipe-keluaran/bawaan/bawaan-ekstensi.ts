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
    { kunci: "itsbat nikah", nilai: "[01] [Kabul] IN", data: { jenisAsli: "Itsbat Nikah" }, urutan: 2 },
    {
      kunci: "dispensasi kawin",
      nilai: "[01] [Kabul] DK - (Anak P Cewek) Hamil",
      data: {
        jenisAsli: "Dispensasi Kawin",
        catatan: "nama dari server - varian cowok: [01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil",
      },
      urutan: 3,
    },
    /* === 4B 11 Okt === cermin blok Object.assign(ALAT_PETA_BAWAAN, ...) panel-alat.js (paket ABT abt-blangko-gugatan-lain) */
    {
      kunci: "harta bersama",
      nilai: "[02a] [Kabul] HB - T Tidak Hadir Setelah Mediasi",
      data: {
        jenisAsli: "Harta Bersama",
        blangko: "Putusan Harta Bersama",
        blangkoLain: ["Putusan HB", "HB - Putusan"],
        catatan:
          "paket ABT abt-blangko-gugatan-lain - varian: [97] [Perdamaian] Akta Perdamaian; [98] [Cabut] Gugatan - P & T Hadir Sebelum Jawaban",
      },
      urutan: 4,
    },
    {
      kunci: "kewarisan",
      nilai: "[01] [Kabul] Kewarisan - Kontradiktur",
      data: {
        jenisAsli: "Kewarisan",
        blangko: "Putusan Kewarisan",
        blangkoLain: ["Putusan Waris", "Waris - Putusan"],
        catatan: "paket ABT abt-blangko-gugatan-lain - varian: [97] [Perdamaian] Akta Perdamaian",
      },
      urutan: 5,
    },
    {
      kunci: "poligami",
      nilai: "[01] [Kabul] Izin Poligami",
      data: {
        jenisAsli: "Izin Poligami",
        blangko: "Putusan Izin Poligami",
        blangkoLain: ["Putusan Poligami", "Poligami - Putusan"],
        catatan: "paket ABT abt-blangko-gugatan-lain - varian: [98] [Cabut] Permohonan - P & T Hadir Sebelum Jawaban",
      },
      urutan: 6,
    },
    /* === AKHIR 4B === */
    /* === P 12 Okt === cermin blok alatPetaStatusCerai panel-alat.js (blangko cerai per status putusan; paket ABT abt-cerai-lengkap) */
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
      data: { jenisAsli: "Cerai Gugat", statusAsli: "Ditolak", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG", "CG - Putusan"] },
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
      kunci: "cerai talak|dikabulkan|verstek",
      nilai: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 16,
    },
    {
      kunci: "cerai talak|dikabulkan",
      nilai: "[02] [Kabul] CT - F",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [01c] [Kabul] Cerai (Format Lengkap) - T Tidak Hadir Setelah Mediasi; [02a] [Kabul] CT - T Tidak Hadir Setelah Mediasi - F; [02b] [Kabul] CT - F - Mediasi Berhasil Sebagian (Kesepakatan Dimuat dalam Amar); [02] [Kabul] [Rekonvensi] CT - F (Mutah iddah nafkah anak)" },
      urutan: 17,
    },
    {
      kunci: "cerai talak|ditolak|verstek",
      nilai: "[01ab] [Tolak Verstek] Cerai - Tidak ada bukti",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Ditolak", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan SEMA 1 Tahun 2022" },
      urutan: 18,
    },
    {
      kunci: "cerai talak|ditolak",
      nilai: "[03] [Tolak] Cerai - T Tidak Hadir Setelah Mediasi - F Tidak Terbukti",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Ditolak", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 19,
    },
    {
      kunci: "cerai talak|tidak dapat diterima",
      nilai: "[98] [NO] 4. Cerai P & T Tidak Hadir - Alamat T Tidak Diketahui",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Tidak Dapat Diterima", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022); [98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah" },
      urutan: 20,
    },
    {
      kunci: "cerai talak|digugurkan",
      nilai: "[98] [Gugur] 3. Cerai P & T Tidak Hadir",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Digugurkan", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir; [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah (P Tidak Pernah Hadir)" },
      urutan: 21,
    },
    {
      kunci: "cerai talak|gugur",
      nilai: "[98] [Gugur] 3. Cerai P & T Tidak Hadir",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Gugur", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [Gugur] 3a. Cerai P Tidak Hadir & T Hadir; [98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah (P Tidak Pernah Hadir)" },
      urutan: 22,
    },
    {
      kunci: "cerai talak|dicabut",
      nilai: "[98] [Cabut] 1a. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (Alamat T Tidak Diketahui)",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dicabut", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"], catatan: "varian: [98] [Cabut] 1. Cerai P Hadir & T Tidak Hadir - Tanpa Mediasi (P & T Damai); [98] [Cabut] 2. Cerai P & T Hadir- Setelah Mediasi (Sebelum Jawaban); [98] [Cabut] 5. Cerai P Hadir & T Tidak Hadir - Setelah Pembuktian" },
      urutan: 23,
    },
    {
      kunci: "cerai talak|dicoret dari register",
      nilai: "[98] [Coret] 6. Cerai Dibatalkan dari Pendaftaran - Panjar Habis",
      data: { jenisAsli: "Cerai Talak", statusAsli: "Dicoret dari Register", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT", "CT - Putusan"] },
      urutan: 24,
    },
    /* === AKHIR P === */
    /* === T 13 Okt === cermin blok kumulasi panel-alat.js (blangko putusan perkara kumulasi; paket ABT abt-putusan-bas-lengkap) */
    {
      kunci: "cerai gugat+itsbat-nikah|dikabulkan|verstek",
      nilai: "[01aa] [Kabul Verstek] Putusan CG Kumulasi Itsbat Nikah - Format Lengkap",
      data: { jenisAsli: "Cerai Gugat Kumulasi Itsbat Nikah", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Kumulasi Itsbat Nikah", blangkoLain: ["Putusan Cerai Kumulasi Itsbat", "Cerai Kumulasi Itsbat - Putusan"], catatan: "paket ABT abt-putusan-bas-lengkap - alasan A-H lewat isian 8503 (pengganti [01aa] IN + CG - F / B & F)" },
      urutan: 25,
    },
    {
      kunci: "cerai talak+itsbat-nikah|dikabulkan|verstek",
      nilai: "[01aa] [Kabul Verstek] Putusan CT Kumulasi Itsbat Nikah - Format Lengkap",
      data: { jenisAsli: "Cerai Talak Kumulasi Itsbat Nikah", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Kumulasi Itsbat Nikah", blangkoLain: ["Putusan Cerai Kumulasi Itsbat", "Cerai Kumulasi Itsbat - Putusan"], catatan: "paket ABT abt-putusan-bas-lengkap - alasan A-H lewat isian 8503" },
      urutan: 26,
    },
    {
      kunci: "cerai gugat+hak-asuh-anak|dikabulkan|verstek",
      nilai: "[01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz",
      data: { jenisAsli: "Cerai Gugat Kumulasi Hak Asuh Anak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Gugat Kumulasi Hak Asuh Anak", blangkoLain: ["Putusan CG Kumulasi Hak Asuh", "CG Kumulasi Hak Asuh - Putusan"], catatan: "varian: [01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak - Anak Belum Mumayyiz" },
      urutan: 27,
    },
    {
      kunci: "cerai gugat+hak-asuh-anak+nafkah-anak|dikabulkan|verstek",
      nilai: "[01b] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak dan Nafkah Anak - Anak Belum Mumayyiz",
      data: { jenisAsli: "Cerai Gugat Kumulasi Hak Asuh Anak dan Nafkah Anak", statusAsli: "Dikabulkan", blangko: "Putusan Cerai Gugat Kumulasi Hak Asuh Anak", blangkoLain: ["Putusan CG Kumulasi Hak Asuh", "CG Kumulasi Hak Asuh - Putusan"], catatan: "varian: [01] [Kabul Verstek] Putusan CG Kumulasi Hak Asuh Anak - Anak Belum Mumayyiz" },
      urutan: 28,
    },
    /* === AKHIR T === */
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
