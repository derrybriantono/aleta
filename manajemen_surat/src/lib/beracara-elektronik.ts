/**
 * ============================================================================
 * BERACARA ELEKTRONIK PER PERKARA (arahan Derry 3 Nov 2026, keputusan 144)
 * ============================================================================
 *
 * SATU fungsi murni yang menjawab "perkara ini beracara bagaimana?" untuk
 * lencana di sorotan Status Perkara, baris Tergugat di Para pihak, dan baris
 * Jadwal Sidang. Kasus ujinya juga tersimpan sebagai JSON
 * (src/test/fixtures/beracara-elektronik-kasus.json) supaya ekstensi memakai
 * kasus yang sama.
 *
 * Aturan:
 *   - bukan perkara e-Court                      -> tanpa lencana (null)
 *   - Tergugat TIDAK PERNAH hadir (termasuk verstek) -> "tergugat-tidak-hadir"
 *     (BUKAN e-litigasi maupun hybrid)
 *   - SEMUA Tergugat punya WhatsApp DAN email DAN setuju beracara elektronik
 *                                                 -> "e-litigasi"
 *   - selain itu (tidak ada email / tidak setuju / tidak ada WA) -> "hybrid"
 *
 * Yang belum terbaca tidak ditebak: `tergugatPernahHadir: null` berarti belum
 * ada sidang yang kehadirannya tercatat - dinilai menurut kontaknya; daftar
 * Tergugat kosong (kontak belum terbaca) -> null.
 */

export type JenisBeracara = "e-litigasi" | "hybrid" | "tergugat-tidak-hadir";

export type TergugatBeracara = {
  nama?: string;
  email?: string | null;
  /** Nomor WhatsApp (HP). Telepon rumah tidak dihitung - dikosongkan pemanggil. */
  wa?: string | null;
  /** Persetujuan beracara elektronik di e-Court: true setuju, false menolak, null belum/tidak terbaca. */
  setujuElektronik?: boolean | null;
};

export type MasukanBeracara = {
  eCourt: boolean;
  tergugat: TergugatBeracara[];
  /** true pernah hadir, false tidak pernah (termasuk verstek), null belum ada sidang yang tercatat. */
  tergugatPernahHadir: boolean | null;
};

export type HasilBeracara = {
  jenis: JenisBeracara;
  label: string;
  /** Alasan singkat untuk tooltip; per pihak bila Tergugat lebih dari satu. */
  alasan: string;
  perPihak: Array<{ nama: string; memenuhi: boolean; alasan: string }>;
};

export const LABEL_BERACARA: Record<JenisBeracara, string> = {
  "e-litigasi": "E-Litigasi",
  hybrid: "Hybrid",
  "tergugat-tidak-hadir": "Tergugat tidak pernah hadir",
};

function alasanSatu(t: TergugatBeracara): { memenuhi: boolean; alasan: string } {
  const adaEmail = Boolean(String(t.email ?? "").trim());
  const adaWa = Boolean(String(t.wa ?? "").trim());
  const setuju = t.setujuElektronik === true;
  const bagian = [
    adaEmail ? "email ada" : "email belum ada",
    adaWa ? "WA ada" : "WA belum ada",
    setuju ? "setuju" : t.setujuElektronik === false ? "tidak setuju" : "belum menyetujui",
  ];
  return { memenuhi: adaEmail && adaWa && setuju, alasan: bagian.join(", ") };
}

export function tentukanBeracaraElektronik(masukan: MasukanBeracara): HasilBeracara | null {
  if (!masukan.eCourt) return null;
  if (masukan.tergugatPernahHadir === false) {
    return {
      jenis: "tergugat-tidak-hadir",
      label: LABEL_BERACARA["tergugat-tidak-hadir"],
      alasan: "Tergugat tidak pernah hadir di persidangan (termasuk verstek) - tidak dinilai sebagai e-litigasi maupun hybrid.",
      perPihak: [],
    };
  }
  if (masukan.tergugat.length === 0) return null;
  const banyak = masukan.tergugat.length > 1;
  const perPihak = masukan.tergugat.map((t, i) => {
    const h = alasanSatu(t);
    const nama = String(t.nama ?? "").trim() || `Tergugat ${i + 1}`;
    return { nama, ...h };
  });
  const semua = perPihak.every((p) => p.memenuhi);
  const jenis: JenisBeracara = semua ? "e-litigasi" : "hybrid";
  const alasan = banyak
    ? perPihak.map((p) => `${p.nama}: ${p.alasan}`).join("; ")
    : perPihak[0].alasan.replace(/^./, (c) => c.toUpperCase());
  return { jenis, label: LABEL_BERACARA[jenis], alasan, perPihak };
}

/** Sandi dihadiri_oleh SIPP yang menyertakan Tergugat/Termohon (pihak kedua). */
const SANDI_TERGUGAT_HADIR = new Set([1, 3, 8, 9, 11, 15]);

/**
 * Tergugat pernah hadir atau tidak, dari kehadiran sidang-sidang yang SUDAH lewat.
 * Verstek = tidak pernah hadir. Tanpa catatan kehadiran sama sekali: null.
 */
export function tergugatPernahHadirDariSandi(
  sandiSidangLalu: ReadonlyArray<number | null | undefined>,
  verstek = false
): boolean | null {
  if (verstek) return false;
  const tercatat = sandiSidangLalu.filter((x): x is number => typeof x === "number" && x > 0);
  if (tercatat.length === 0) return null;
  return tercatat.some((x) => SANDI_TERGUGAT_HADIR.has(x));
}
