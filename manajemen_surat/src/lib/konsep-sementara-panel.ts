/**
 * ============================================================================
 * KONSEP SEMENTARA DI PANEL "BLANGKO ABT BY DERRY BRIANTONO"
 * ============================================================================
 *
 * "Konsep sementara" = perkara yang di Jadwal Sidang diberi "tunjuk
 * konseptor" (tabel aleta_konseptor_sementara, migrasi 0046). Satu sumber
 * saja: panel TIDAK menebak konseptor dari tempat lain.
 *
 * Yang dihitung di sini hanya: tunjukan itu milik akun yang sedang dilihat
 * atau bukan.
 *   - "Semua akun" (admin tanpa "Lihat sebagai", atau pelihat seluruh
 *     satker): setiap tunjukan dihitung.
 *   - Akun tertentu ("Lihat sebagai" atau pengguna biasa): hanya tunjukan yang
 *     menyebut akun itu. Aturannya sama dengan checklist (tunjukanMilikSaya):
 *     bila tunjukan menyebut username SIPP, username itu yang menentukan;
 *     bila hanya nama, nama dibandingkan setelah gelar dibuang. "Lihat
 *     sebagai" hanya membawa nama, jadi dibandingkan lewat nama.
 *
 * Murni (tanpa basis data) supaya dapat diuji.
 */
import { tunjukanMilikSaya } from "@/lib/checklist-milestone";
import { bandingkanKonseptor, type KonseptorSementara } from "@/lib/konseptor-sementara";

export type KonsepSementaraPanel = {
  nama: string;
  pengguna: string;
  ditetapkanOleh: string;
  /** Benar bila tunjukan ini termasuk "konsep sementara" bagi akun yang sedang dilihat. */
  milikAkun: boolean;
};

export type AcuanKonsep = {
  /** Pelihat seluruh perkara tanpa menyempitkan ke satu akun: semua tunjukan dihitung. */
  semua: boolean;
  /** Nama akun pilihan "Lihat sebagai" (hanya admin); kosong bila tidak memakainya. */
  sebagaiNama?: string;
  /** Username SIPP milik pengguna yang sedang masuk. */
  usernames?: string[];
  /** Nama pengguna yang sedang masuk. */
  nama?: string[];
};

export function milikAkunKonsep(
  t: Pick<KonseptorSementara, "nama" | "pengguna">,
  acuan: AcuanKonsep
): boolean {
  if (!String(t.nama ?? "").trim()) return false;
  if (acuan.semua) return true;
  const sebagai = String(acuan.sebagaiNama ?? "").trim();
  if (sebagai) {
    const banding = bandingkanKonseptor({ nama: t.nama }, [{ nama: sebagai }]);
    return banding.adaTunjukan && banding.adaSipp && !banding.berbeda;
  }
  return tunjukanMilikSaya(t, { usernames: acuan.usernames ?? [], nama: acuan.nama ?? [] });
}

/** Tunjukan (menurut perkaraId) -> bentuk ringkas untuk panel; perkara tanpa tunjukan tidak ikut. */
export function petakanKonsepSementara(
  peta: Record<string, KonseptorSementara>,
  acuan: AcuanKonsep
): Record<string, KonsepSementaraPanel> {
  const hasil: Record<string, KonsepSementaraPanel> = {};
  for (const [id, t] of Object.entries(peta)) {
    if (!String(t?.nama ?? "").trim()) continue;
    hasil[id] = {
      nama: String(t.nama).trim(),
      pengguna: String(t.pengguna ?? "").trim(),
      ditetapkanOleh: String(t.ditetapkanOleh ?? "").trim(),
      milikAkun: milikAkunKonsep(t, acuan),
    };
  }
  return hasil;
}
