/**
 * ============================================================================
 * EMAIL DAN PERSETUJUAN e-COURT PARA PIHAK - UNTUK LAYAR JADWAL SIDANG
 * ============================================================================
 *
 * Perbaikan 2 Oktober 2026 malam (butir 1f). Bahan aturan tunda karena
 * ketidakhadiran (@/lib/bawaan-tunda, tundaKetidakhadiran) dan keterangan
 * ringkas di Rincian Jadwal Sidang / borang tunda:
 *
 *     "Email tergugat: ada · persetujuan e-Court: setuju"
 *
 * Datanya dari bot (sidangKontakService) lewat /api/aleta-ecourt/sidang/
 * pihak-elektronik - TANPA alamat email: data pribadi, dan yang dibutuhkan
 * hanya ada/tidaknya. Yang tidak terbaca disebut tidak terbaca beserta sebabnya;
 * tidak ditebak.
 */
import { apiPath } from "@/lib/base-path";
import type { KontakPihak, PersetujuanEcourt } from "@/lib/bawaan-tunda";

const PERSETUJUAN_VALID: readonly PersetujuanEcourt[] = ["setuju", "tidak_setuju", "belum", "tidak-diketahui"];

/** Membuka jawaban rute menjadi KontakPihak - null bila bentuknya tidak dikenali (bot lama). */
export function bacaBentukKontak(mentah: unknown): KontakPihak | null {
  if (!mentah || typeof mentah !== "object") return null;
  const k = mentah as Record<string, unknown>;
  const penggugat = (k.penggugat ?? {}) as Record<string, unknown>;
  const tergugat = (k.tergugat ?? {}) as Record<string, unknown>;
  if (typeof k.ecourtTerbaca !== "boolean") return null;
  const persetujuan = PERSETUJUAN_VALID.includes(tergugat.persetujuan as PersetujuanEcourt)
    ? (tergugat.persetujuan as PersetujuanEcourt)
    : "tidak-diketahui";
  return {
    ecourtTerbaca: k.ecourtTerbaca,
    sebab: typeof k.sebab === "string" ? k.sebab : "",
    penggugat: {
      adaEmail: penggugat.adaEmail === true,
      sumber: penggugat.sumber === "sipp" || penggugat.sumber === "ecourt" ? penggugat.sumber : "",
    },
    tergugat: { adaEmail: tergugat.adaEmail === true, persetujuan },
    ...(typeof k.terakhirTerlihat === "string" && k.terakhirTerlihat ? { terakhirTerlihat: k.terakhirTerlihat } : {}),
  };
}

/** Membaca kontak satu perkara. null = tidak terbaca (jaringan, bot lama, bot mati) - bukan "tidak punya email". */
export async function bacaKontakPihak(perkaraId: number | string): Promise<KontakPihak | null> {
  try {
    const balasan = await fetch(
      apiPath(`/api/aleta-ecourt/sidang/pihak-elektronik?perkaraId=${encodeURIComponent(String(perkaraId))}`),
      { cache: "no-store" }
    );
    const isi = ((await balasan.json().catch(() => ({}))) as { data?: Record<string, unknown> }).data ?? {};
    if (isi.available === false || isi.ok === false) return null;
    return bacaBentukKontak(isi.kontak);
  } catch {
    return null;
  }
}

const SEBUTAN_PERSETUJUAN: Record<PersetujuanEcourt, string> = {
  setuju: "setuju",
  tidak_setuju: "tidak setuju",
  belum: "belum membuat persetujuan",
  "tidak-diketahui": "tidak diketahui",
};

/**
 * Keterangan ringkas satu baris. `dua` = sebutan pihak kedua ("Tergugat" /
 * "Termohon"), `satu` = pihak pertama.
 */
export function kalimatKontak(kontak: KontakPihak | null | undefined, dua = "Tergugat", satu = "Penggugat"): string {
  const d = dua.toLowerCase();
  const s = satu.toLowerCase();
  if (!kontak) return `Email ${d} dan persetujuan e-Court belum dapat dibaca - tanggal tunda memakai aturan tanpa email.`;
  if (!kontak.ecourtTerbaca) {
    return `Email ${d}: tidak diketahui · persetujuan e-Court: tidak terbaca${kontak.sebab ? ` (${kontak.sebab})` : ""} - tanggal tunda memakai aturan tanpa email.`;
  }
  const bagian = [
    `Email ${d}: ${kontak.tergugat.adaEmail ? "ada" : "tidak ada"}`,
    `persetujuan e-Court: ${SEBUTAN_PERSETUJUAN[kontak.tergugat.persetujuan]}`,
    `email ${s}: ${kontak.penggugat.adaEmail ? `ada${kontak.penggugat.sumber ? ` (${kontak.penggugat.sumber === "sipp" ? "SIPP" : "e-Court"})` : ""}` : "tidak ada"}`,
  ];
  return `${bagian.join(" · ")}${kontak.terakhirTerlihat ? ` · e-Court terbaca ${kontak.terakhirTerlihat}` : ""}.`;
}
