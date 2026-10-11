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
      data: { jenisAsli: "Cerai Gugat", blangko: "Putusan Cerai Gugat", blangkoLain: ["Putusan CG"] },
      urutan: 0,
    },
    {
      kunci: "cerai talak",
      nilai: "[01] [Kabul Verstek] Cerai (Format Lengkap)",
      data: { jenisAsli: "Cerai Talak", blangko: "Putusan Cerai Talak", blangkoLain: ["Putusan CT"] },
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
        blangkoLain: ["Putusan HB"],
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
        blangkoLain: ["Putusan Waris"],
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
        blangkoLain: ["Putusan Poligami"],
        catatan: "paket ABT abt-blangko-gugatan-lain - varian: [98] [Cabut] Permohonan - P & T Hadir Sebelum Jawaban",
      },
      urutan: 6,
    },
    /* === AKHIR 4B === */
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
