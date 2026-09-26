import type { Cermin } from "@/lib/tipe-keluaran/kontrak";

/**
 * ============================================================================
 * CERMIN BAWAAN PORTAL (K10) - disalin PERSIS dari sumbernya
 * ============================================================================
 *
 * Sumber: src/server/modules/aleta-ecourt/bas-kehadiran.ts BUNYI_KEHADIRAN
 *   -> bas.kehadiran.bunyi (kunci '', nilai = kalimat, urutan = urutan asli)
 *
 * Uji tipe-keluaran-cermin-ekstensi.test.ts MENGIMPOR konstanta sumbernya dan
 * membandingkannya deep-equal dengan cermin ini.
 */
export const CERMIN_PORTAL = {
  "bas.kehadiran.bunyi": [
    { kunci: "", nilai: "hadir secara pribadi", urutan: 0 },
    { kunci: "", nilai: "hadir didampingi kuasanya", urutan: 1 },
    { kunci: "", nilai: "tidak hadir, diwakili kuasanya", urutan: 2 },
    { kunci: "", nilai: "tidak hadir dan tidak pula menyuruh orang lain sebagai wakil/kuasanya", urutan: 3 },
    { kunci: "", nilai: "tidak hadir tanpa alasan yang sah", urutan: 4 },
  ],
} satisfies Cermin;
