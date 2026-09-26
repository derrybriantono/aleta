import type { Cermin } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * CERMIN BAWAAN PUTUSAN-MEDAN (K10) - disalin PERSIS dari sumbernya
 * ============================================================================
 *
 * Sumber: src/lib/usulan-medan-putusan.ts
 *   SEBUTAN_LAIN            -> putusan.sumber-hukum.sebutan
 *                              (kunci = kunci sumber hukum apa adanya, nilai =
 *                              satu sebutan; urutan = urutan kemunculan bila
 *                              seluruh sebutan dideretkan kunci demi kunci)
 *   BAWAAN_MENURUT_PERKARA  -> putusan.bawaan-medan
 *                              (kunci = label medan, nilai = label pilihan,
 *                              data {jenisPerkara}, urutan = urutan asli)
 *
 * JANGAN menyunting nilai di sini tanpa menyunting sumbernya. Uji
 * tipe-keluaran-cermin-putusan-medan.test.ts MENGIMPOR kedua konstanta itu
 * dan membandingkannya deep-equal dengan cermin ini, lalu MENJALANKAN
 * usulkanMedanPutusan dengan cermin ini sebagai daftar efektif dan menuntut
 * keluaran yang sama persis dengan tanpa daftar sama sekali.
 */
export const CERMIN_PUTUSAN_MEDAN = {
  "putusan.sumber-hukum.sebutan": [
    { kunci: "uu/pp", nilai: "undang undang nomor", urutan: 0 },
    { kunci: "uu/pp", nilai: "undang undang no", urutan: 1 },
    { kunci: "uu/pp", nilai: "peraturan pemerintah nomor", urutan: 2 },
    { kunci: "kompilasi hukum islam", nilai: "kompilasi hukum islam", urutan: 3 },
    { kunci: "kompilasi hukum islam", nilai: "khi", urutan: 4 },
    { kunci: "kompilasi hukum ekonomi syariah", nilai: "kompilasi hukum ekonomi syariah", urutan: 5 },
    { kunci: "kompilasi hukum ekonomi syariah", nilai: "khes", urutan: 6 },
    { kunci: "qanun aceh", nilai: "qanun", urutan: 7 },
    { kunci: "fiqh islam", nilai: "hukum syar i", urutan: 8 },
    { kunci: "fiqh islam", nilai: "hukum syari", urutan: 9 },
    { kunci: "fiqh islam", nilai: "fiqih", urutan: 10 },
    { kunci: "fiqh islam", nilai: "fikih", urutan: 11 },
    { kunci: "fiqh islam", nilai: "kitab fiqh", urutan: 12 },
    { kunci: "yurisprudensi", nilai: "yurisprudensi", urutan: 13 },
    { kunci: "yurisprudensi", nilai: "putusan mahkamah agung nomor", urutan: 14 },
  ],
  "putusan.bawaan-medan": [
    { kunci: "Keadaan Istri", nilai: "Suci", data: { jenisPerkara: "gugat" }, urutan: 0 },
    { kunci: "Keadaan Istri", nilai: "Tidak diketahui", data: { jenisPerkara: "talak" }, urutan: 1 },
  ],
} satisfies Cermin;
