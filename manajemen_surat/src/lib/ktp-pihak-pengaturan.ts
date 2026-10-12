/**
 * ============================================================================
 * PENGATURAN PENARIKAN TANGGAL KTP PIHAK (12 Okt 2026, butir 11)
 * ============================================================================
 *
 * Sebelumnya penyapu latar tanggal KTP hanya dapat diatur lewat env
 * (ALETA_KTP_PIHAK_LATAR / _BATAS / _JEDA_MS) dan menuntut restart. Kini Admin
 * dan Super Admin mengaturnya dari Pengaturan > Integrasi e-Court:
 *
 *   - PENGATURAN DARI LAYAR MENANG atas env, dan berlaku tanpa restart
 *     (penyapu membaca ulang pengaturan tiap detak).
 *   - Tanpa pengaturan tersimpan, env (lalu bawaan kode) yang berlaku.
 *   - "Pakai bawaan server" menghapus pengaturan tersimpan.
 *
 * Berkas ini MURNI (tanpa basis data, tanpa fetch) - dipakai penyapu di server
 * dan layar Integrasi e-Court sekaligus, sehingga batas angkanya satu sumber.
 */

export const BATAS_PER_PUTARAN = { min: 1, maks: 10, bawaan: 2 } as const;
export const JEDA_DETIK = { min: 30, maks: 86_400, bawaan: 120 } as const;

/** Bentuk yang disimpan (aleta_ekstensi_setelan) dan dikirim ke layar. */
export type PengaturanKtpTersimpan = {
  aktif: boolean;
  /** Berkas per putaran. */
  batas: number;
  /** Jeda antar putaran, dalam detik. */
  jedaDetik: number;
  diubahOleh?: string;
  diubahPada?: string;
};

/** Pengaturan yang berlaku bagi penyapu. */
export type PengaturanKtpEfektif = {
  aktif: boolean;
  batas: number;
  jedaMs: number;
  /** Dari mana nilai ini datang. */
  sumber: "layar" | "env" | "bawaan";
};

type Env = Record<string, string | undefined>;

function jepit(nilai: number, min: number, maks: number) {
  return Math.max(min, Math.min(maks, Math.round(nilai)));
}

/** Pengaturan dari env (atau bawaan kode bila env kosong). Sama dengan perilaku 1.195.0. */
export function pengaturanKtpDariEnv(env: Env = process.env): { aktif: boolean; batas: number; jedaMs: number; adaEnv: boolean } {
  const adaEnv =
    String(env.ALETA_KTP_PIHAK_LATAR ?? "").trim() !== "" ||
    String(env.ALETA_KTP_PIHAK_BATAS ?? "").trim() !== "" ||
    String(env.ALETA_KTP_PIHAK_JEDA_MS ?? "").trim() !== "";
  return {
    aktif: String(env.ALETA_KTP_PIHAK_LATAR ?? "").trim() !== "0",
    batas: Math.max(BATAS_PER_PUTARAN.min, Math.min(BATAS_PER_PUTARAN.maks, Number(env.ALETA_KTP_PIHAK_BATAS) || BATAS_PER_PUTARAN.bawaan)),
    jedaMs: Math.max(JEDA_DETIK.min * 1000, Number(env.ALETA_KTP_PIHAK_JEDA_MS) || JEDA_DETIK.bawaan * 1000),
    adaEnv,
  };
}

/** Membersihkan masukan layar/penyimpanan; null bila bukan objek yang dapat dipakai. */
export function bersihkanPengaturanKtp(masukan: unknown): PengaturanKtpTersimpan | null {
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) return null;
  const x = masukan as Record<string, unknown>;
  if (typeof x.aktif !== "boolean") return null;
  const batas = Number(x.batas);
  const jeda = Number(x.jedaDetik);
  if (!Number.isFinite(batas) || !Number.isFinite(jeda)) return null;
  return {
    aktif: x.aktif,
    batas: jepit(batas, BATAS_PER_PUTARAN.min, BATAS_PER_PUTARAN.maks),
    jedaDetik: jepit(jeda, JEDA_DETIK.min, JEDA_DETIK.maks),
    ...(typeof x.diubahOleh === "string" ? { diubahOleh: x.diubahOleh.slice(0, 120) } : {}),
    ...(typeof x.diubahPada === "string" ? { diubahPada: x.diubahPada.slice(0, 40) } : {}),
  };
}

/** Pengaturan layar menang atas env; tanpa keduanya, bawaan kode. */
export function pengaturanKtpEfektif(env: Env, tersimpan: PengaturanKtpTersimpan | null): PengaturanKtpEfektif {
  if (tersimpan) {
    return { aktif: tersimpan.aktif, batas: tersimpan.batas, jedaMs: tersimpan.jedaDetik * 1000, sumber: "layar" };
  }
  const e = pengaturanKtpDariEnv(env);
  return { aktif: e.aktif, batas: e.batas, jedaMs: e.jedaMs, sumber: e.adaEnv ? "env" : "bawaan" };
}
