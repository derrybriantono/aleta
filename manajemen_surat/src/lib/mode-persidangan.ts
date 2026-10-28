/**
 * ============================================================================
 * PERSIDANGAN ELEKTRONIK ATAU HYBRID PER PIHAK (28 Oktober 2026)
 * ============================================================================
 *
 * Permintaan pengguna: di rincian Jadwal Sidang dan Status Perkara, tiap pihak
 * disebut "persidangan elektronik" bila persetujuan saluran elektronik di
 * e-Court CENTANG HIJAU dan ADA email; "persidangan hybrid" bila tidak ada
 * email dan persetujuan SILANG MERAH. Kombinasi lain (setuju tanpa email,
 * menolak tetapi beremail, belum menjawab) tidak memenuhi syarat elektronik -
 * juga hybrid, dengan sebabnya disebut. Persetujuan yang TIDAK TERBACA (bukan
 * perkara e-Court, pihak belum ditarik) tidak diberi label: tidak ditebak.
 * Kuasa tidak diberi label sendiri (persetujuannya milik pihak yang diwakili).
 */

export type StatusElitigasi = "ya" | "tidak" | "belum" | "tidak-diketahui" | "tidak-berlaku";

export type ModePersidangan = {
  mode: "elektronik" | "hybrid";
  teks: string;
  /** Keterangan singkat untuk title (arahkan tetikus). */
  sebab: string;
};

export function modePersidangan(baris: {
  jenis?: string;
  email?: { nilai?: string | null } | null;
  elitigasi?: { status?: StatusElitigasi | string } | null;
}): ModePersidangan | null {
  if (!baris || baris.jenis === "kuasa") return null;
  const status = String(baris.elitigasi?.status ?? "tidak-diketahui");
  if (status !== "ya" && status !== "tidak" && status !== "belum") return null;
  const adaEmail = Boolean(String(baris.email?.nilai ?? "").trim());
  if (status === "ya" && adaEmail) {
    return { mode: "elektronik", teks: "persidangan elektronik", sebab: "Persetujuan saluran elektronik e-Court: setuju, dan email tersedia." };
  }
  const sebab =
    status === "ya"
      ? "Persetujuan e-Court setuju, tetapi email belum ada."
      : status === "tidak"
        ? `Persetujuan saluran elektronik e-Court: tidak setuju${adaEmail ? " (walau email ada)" : ", dan email tidak ada"}.`
        : `Belum membuat persetujuan saluran elektronik di e-Court${adaEmail ? "" : ", dan email tidak ada"}.`;
  return { mode: "hybrid", teks: "persidangan hybrid", sebab };
}
