import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getEffectiveRoleId } from "@/lib/permissions";
import { hakAbtHpUntuk } from "@/server/modules/aleta-abt/hak-hp";
import type { AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PENJAGA SIMPAN DAN CETAK DI LAYAR CETAK ALETA ABT (5 Nov 2026, Tahap 5; keputusan 206)
 * ============================================================================
 *
 * Syarat sebuah permintaan cetak/simpan di layar baru:
 *   1. akun yang masuk adalah Super Admin (peran berlaku, "Lihat sebagai akun" tidak membukanya) - SELALU, diputuskan di server;
 *   2. DAN salah satu dari
 *        a. tanda berumur pendek: layar mengambilnya setelah mengenali ekstensi di PC (penanda <html data-aleta-ekstensi>
 *           yang dipasang skrip jembatan ekstensi), berlaku 10 menit dan terikat pada akun itu; ATAU
 *        b. hak ALETA ABT di HP menyala untuk akun itu (saklar admin; bawaan Super Admin menyala) - untuk perangkat tanpa ekstensi.
 *
 * TANDA BUKAN KUNCI KEAMANAN. Siapa pun yang sudah menjadi Super Admin dapat memintanya, dan penanda ekstensi di layar dapat
 * dipalsukan. Pengaman utamanya tetap akun (butir 1). Tanda hanya menjawab "permintaan ini datang dari PC yang berekstensi",
 * supaya kelak, ketika peran lain dibuka, cetak dari PC mengikuti ekstensi dan cetak dari HP mengikuti saklar HP.
 * Tanda disahkan HMAC dengan rahasia peladen; tanpa BETTER_AUTH_SECRET dipakai rahasia acak per proses (peladen dimulai ulang
 * = tanda lama tak berlaku, layar mengambil yang baru).
 */

export const UMUR_TANDA_MS = 10 * 60 * 1000;
export const NAMA_KEPALA_TANDA = "x-aleta-abt-tanda";
const POLA_VERSI = /^\d{1,4}(\.\d{1,5}){1,3}$/;

const rahasiaProses = randomBytes(32);
const kunci = () => {
  const dariLingkungan = process.env.BETTER_AUTH_SECRET?.trim();
  return dariLingkungan ? Buffer.from(`aleta-abt-tanda:${dariLingkungan}`) : rahasiaProses;
};

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const tandai = (isi: string) => createHmac("sha256", kunci()).update(isi).digest("base64url");

export function buatTanda(userId: string, versiEkstensi: string, sekarang = Date.now()): { tanda: string; berlakuSampai: number } {
  const versi = String(versiEkstensi ?? "").trim();
  if (!POLA_VERSI.test(versi)) throw new ApiError(400, "Ekstensi ALETA tidak terdeteksi di peramban ini.");
  const berlakuSampai = sekarang + UMUR_TANDA_MS;
  const isi = b64(JSON.stringify({ u: String(userId), e: versi, x: berlakuSampai }));
  return { tanda: `${isi}.${tandai(isi)}`, berlakuSampai };
}

export type PeriksaTanda = { sah: true; versiEkstensi: string } | { sah: false; sebab: "kosong" | "rusak" | "kedaluwarsa" | "akun-lain" };

export function periksaTanda(tanda: string | null | undefined, userId: string, sekarang = Date.now()): PeriksaTanda {
  const t = String(tanda ?? "").trim();
  if (!t) return { sah: false, sebab: "kosong" };
  const titik = t.indexOf(".");
  if (titik <= 0 || t.length > 600) return { sah: false, sebab: "rusak" };
  const isi = t.slice(0, titik);
  const tanda2 = Buffer.from(t.slice(titik + 1));
  const benar = Buffer.from(tandai(isi));
  if (tanda2.length !== benar.length || !timingSafeEqual(tanda2, benar)) return { sah: false, sebab: "rusak" };
  let o: { u?: unknown; e?: unknown; x?: unknown };
  try {
    o = JSON.parse(Buffer.from(isi, "base64url").toString("utf8"));
  } catch {
    return { sah: false, sebab: "rusak" };
  }
  if (!(typeof o.x === "number") || sekarang > o.x) return { sah: false, sebab: "kedaluwarsa" };
  if (String(o.u) !== String(userId)) return { sah: false, sebab: "akun-lain" };
  return { sah: true, versiEkstensi: String(o.e ?? "") };
}

export type Penjaga = { lewat: "ekstensi" | "hp"; versiEkstensi: string };

/**
 * Putusan penjaga. Melempar ApiError 403 dengan sebab yang dapat dibaca petugas; tidak pernah diam-diam lolos.
 * `roleId` = peran berlaku akun (getEffectiveRoleId).
 */
export async function jagaCetakAletaAbt(
  db: AletaDatabase,
  akun: Parameters<typeof getEffectiveRoleId>[0] & { id: string },
  tanda: string | null | undefined,
  sekarang = Date.now()
): Promise<Penjaga> {
  const roleId = String(getEffectiveRoleId(akun) ?? "");
  if (roleId !== "super-admin") throw new ApiError(403, "Layar cetak ALETA ABT hanya untuk Super Admin.");
  const t = periksaTanda(tanda, String(akun.id), sekarang);
  if (t.sah) return { lewat: "ekstensi", versiEkstensi: t.versiEkstensi };
  const hak = await hakAbtHpUntuk(db, { id: String(akun.id), roleId });
  if (hak.terbuka) return { lewat: "hp", versiEkstensi: "" };
  throw new ApiError(403, "Cetak dari layar ini memerlukan ekstensi ALETA di PC, atau hak ALETA ABT di HP yang menyala untuk akun Anda.");
}
