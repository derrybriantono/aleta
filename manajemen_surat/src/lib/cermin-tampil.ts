/**
 * Tampilan tanda Cermin Perkara di layar (A5, 25 Okt 2026).
 *
 * "Cermin · diperbarui 14.05": daftar/hitungan dibaca dari salinan keadaan
 * perkara SIPP di ALETA, bukan langsung dari SIPP. Tanpa label teknis.
 */
export function jamCermin(iso: string | null | undefined): string {
  if (!iso) return "-";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(t)
    .replace(":", ".");
}

export const KETERANGAN_CERMIN =
  "Dibaca dari salinan keadaan perkara SIPP di ALETA (Cermin Perkara). Keterangan yang harus langsung, seperti antrian dan kehadiran, tetap langsung dari sumbernya.";

export function teksCermin(cermin: { diperbaruiPada: string | null } | null | undefined): string {
  return cermin ? `Cermin · diperbarui ${jamCermin(cermin.diperbaruiPada)}` : "";
}
