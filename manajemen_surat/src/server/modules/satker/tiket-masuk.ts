import { adalahSuperAdminGlobal } from "@/lib/super-admin-global";
import { periksaTandatangan } from "@/server/shared/pusat-tanda-tangan";

/**
 * ============================================================================
 * TIKET MASUK SUPER ADMIN GLOBAL DARI ALETA PUSAT (kontrak Tahap 1)
 * ============================================================================
 *
 * Cara Derry masuk ke satker LAIN tanpa akun lokal yang dibuat satker itu:
 * Pusat menerbitkan tiket bertanda tangan Ed25519, berumur pendek, terikat ke
 * SATU satker, sekali pakai. Satker memeriksa dengan kunci publik Pusat yang
 * dipasang operator (ALETA_PUSAT_KUNCI_PUBLIK). Tiket yang sah -> sesi
 * super admin dibuat DAN jejaknya dicatat + diberitahukan admin satker
 * (akses-global.ts, cara "tiket-pusat") - tidak ada jalur tanpa jejak.
 *
 * Tahap 0 hanya menyediakan PEMERIKSAAN tiket (murni, diuji). Penukaran tiket
 * menjadi sesi dan daftar tiket yang sudah dipakai (anti ulang) dibangun di
 * Tahap 1 bersama server Pusat - lihat docs/banyak-satker/TAHAP-0.md.
 */

export const UMUR_TIKET_MAKS_MS = 10 * 60 * 1000;
const TOLERANSI_JAM_MS = 60 * 1000;

export type TiketMasukPusat = {
  skema: 1;
  jenis: "masuk-super-admin-global";
  /** Kode satker tujuan (KodePN). */
  satker: string;
  /** Username akun global (harus tercantum di penanda server). */
  sub: string;
  /** ID unik tiket - satker menolak pemakaian kedua. */
  jti: string;
  terbit: string;
  kedaluwarsa: string;
  alasan: string;
  tandatangan: string;
};

export type HasilPeriksaTiket = { ok: true; tiket: TiketMasukPusat } | { ok: false; sebab: string };

/** Isi yang ditandatangani = seluruh tiket tanpa ruas tandatangan. */
export function isiTiket(t: Omit<TiketMasukPusat, "tandatangan">) {
  return { skema: t.skema, jenis: t.jenis, satker: t.satker, sub: t.sub, jti: t.jti, terbit: t.terbit, kedaluwarsa: t.kedaluwarsa, alasan: t.alasan };
}

export function periksaTiketMasuk(
  mentah: unknown,
  konteks: { kodeSatker: string; kunciPublik: string; penanda: readonly string[]; sekarang?: Date }
): HasilPeriksaTiket {
  const tolak = (sebab: string): HasilPeriksaTiket => ({ ok: false, sebab });
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return tolak("Tiket tidak berbentuk benar.");
  const o = mentah as Record<string, unknown>;
  const teks = (x: unknown) => String(x ?? "").trim();
  if (o.skema !== 1 || o.jenis !== "masuk-super-admin-global") return tolak("Jenis tiket tidak dikenal.");
  const tiket: TiketMasukPusat = {
    skema: 1,
    jenis: "masuk-super-admin-global",
    satker: teks(o.satker),
    sub: teks(o.sub).toLowerCase(),
    jti: teks(o.jti),
    terbit: teks(o.terbit),
    kedaluwarsa: teks(o.kedaluwarsa),
    alasan: teks(o.alasan).slice(0, 300),
    tandatangan: teks(o.tandatangan),
  };
  if (!/^[\w-]{16,80}$/.test(tiket.jti)) return tolak("Tiket tidak punya penanda unik yang sah.");
  if (!konteks.kodeSatker) return tolak("Kode satker belum diatur di ALETA ini - tiket tidak dapat dicocokkan.");
  if (tiket.satker !== konteks.kodeSatker) return tolak("Tiket ini diterbitkan untuk satker lain.");
  if (!konteks.kunciPublik) return tolak("Kunci publik ALETA Pusat belum dipasang - tiket tidak dapat diperiksa.");
  if (!periksaTandatangan(isiTiket(tiket), tiket.tandatangan, konteks.kunciPublik)) return tolak("Tanda tangan tiket tidak cocok dengan kunci ALETA Pusat.");

  const terbit = Date.parse(tiket.terbit);
  const habis = Date.parse(tiket.kedaluwarsa);
  const kini = (konteks.sekarang ?? new Date()).getTime();
  if (!Number.isFinite(terbit) || !Number.isFinite(habis)) return tolak("Waktu pada tiket tidak terbaca.");
  if (habis - terbit > UMUR_TIKET_MAKS_MS) return tolak("Umur tiket melebihi batas 10 menit.");
  if (terbit > kini + TOLERANSI_JAM_MS) return tolak("Tiket bertanggal di masa depan - periksa jam server.");
  if (habis <= kini) return tolak("Tiket sudah kedaluwarsa.");
  // Akun yang dituju harus ditandai global di server INI (penanda = konfigurasi operator).
  if (!adalahSuperAdminGlobal(konteks.penanda, { username: tiket.sub, id: tiket.sub, roleId: "super-admin" })) {
    return tolak("Akun pada tiket tidak ditandai sebagai super admin global di server ini.");
  }
  return { ok: true, tiket };
}
