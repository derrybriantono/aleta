/**
 * ALETA Ai - DOMPET SATKER: aturan pakai (murni, 1 Nov 2026).
 *
 * Aturan menentukan siapa boleh memotong dompet satker dan berapa batas bulanannya:
 *   - aturan PENGGUNA mengalahkan aturan peran (boleh atau tidak, dan batasnya);
 *   - tanpa aturan pengguna: aturan peran dari peran utama dan peran tambahan; boleh bila salah satu mengizinkan,
 *     batasnya yang paling longgar (0 = tanpa batas paling longgar);
 *   - ATURAN BAWAAN (keputusan 88): bila tidak ada aturan pengguna maupun aturan peran yang mengena, SEMUA peran boleh
 *     memakai dompet satker tanpa batas bulanan; Super Admin menambah batas atau larangan lewat aturan khusus;
 *   - Super Admin tidak ditagih sama sekali (bukan urusan dompet).
 * Batas bulanan pada aturan peran berlaku untuk TIAP pengguna peran itu; pada aturan pengguna berlaku untuk pengguna itu.
 */

export type SasaranAturan = "peran" | "pengguna";

export type AturanSatker = { sasaran: SasaranAturan; sasaranId: string; boleh: boolean; batasBulananRp: number };

export type HakSatker = {
  boleh: boolean;
  /** 0 = tanpa batas bulanan. */
  batasBulananRp: number;
  sumber: "pengguna" | "peran" | "bawaan";
  alasan?: string;
};

export const PESAN_TANPA_HAK_SATKER = "Anda belum diberi hak memakai saldo satker. Pakai saldo Anda sendiri atau hubungi Super Admin.";
export const PESAN_SATKER_HABIS = "Saldo satker habis. Pakai saldo Anda sendiri atau hubungi Super Admin untuk mengisinya.";
export const PESAN_BATAS_SATKER_PENGGUNA = "Batas pemakaian saldo satker Anda bulan ini sudah tercapai. Pakai saldo Anda sendiri atau hubungi Super Admin.";

export function hakSatker(aturan: readonly AturanSatker[], pelaku: { id: string; peranId: string; peranTambahan?: readonly string[] }): HakSatker {
  const milikPengguna = aturan.find((a) => a.sasaran === "pengguna" && a.sasaranId === pelaku.id);
  if (milikPengguna) {
    return milikPengguna.boleh
      ? { boleh: true, batasBulananRp: Math.max(0, milikPengguna.batasBulananRp), sumber: "pengguna" }
      : { boleh: false, batasBulananRp: 0, sumber: "pengguna", alasan: PESAN_TANPA_HAK_SATKER };
  }
  const peran = new Set([pelaku.peranId, ...(pelaku.peranTambahan ?? [])].filter(Boolean));
  const cocok = aturan.filter((a) => a.sasaran === "peran" && peran.has(a.sasaranId) && a.boleh);
  if (cocok.length) {
    const tanpaBatas = cocok.some((a) => !(a.batasBulananRp > 0));
    return { boleh: true, batasBulananRp: tanpaBatas ? 0 : Math.max(...cocok.map((a) => a.batasBulananRp)), sumber: "peran" };
  }
  // Ada aturan untuk peran-peran ini tetapi semuanya melarang: dilarang. Tidak ada aturan yang mengena: bawaan (boleh, tanpa batas).
  if (aturan.some((a) => a.sasaran === "peran" && peran.has(a.sasaranId))) return { boleh: false, batasBulananRp: 0, sumber: "peran", alasan: PESAN_TANPA_HAK_SATKER };
  return { boleh: true, batasBulananRp: 0, sumber: "bawaan" };
}

/** Sisa batas bulanan (null = tanpa batas). */
export const sisaBatas = (batasBulananRp: number, terpakaiRp: number): number | null => (batasBulananRp > 0 ? Math.max(0, batasBulananRp - terpakaiRp) : null);
