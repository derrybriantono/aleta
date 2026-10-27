import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AletaDatabase } from "@/server/db/client";
import { maskApiKey } from "@/server/shared/security";

/**
 * ============================================================================
 * KUNCI API TERSIMPAN (Pengaturan AI) - ENKRIPSI AES-256-GCM
 * ============================================================================
 *
 * Kolom ai_providers.api_key dulu tersimpan polos. Kini disimpan sebagai
 *   "enc:ai1:<iv base64url>:<tag base64url>:<isi base64url>".
 *
 * KUNCI: diturunkan (HKDF-SHA256, label tetap) dari BETTER_AUTH_SECRET - rahasia
 * sesi/auth yang SUDAH wajib di server produksi (env_file .env.production,
 * preflight "error" bila kosong, dibuat installer). Tidak ada env baru. Di luar
 * produksi, berkas data/.better-auth-secret (rahasia yang sama dipakai auth)
 * ikut dibaca bila ada; berkas itu TIDAK dibuat di sini.
 *
 * ATURAN KESELAMATAN:
 *  - nilai polos lama tetap terbaca (kompatibel mundur) dan dienkripsi ulang
 *    secara malas (bungkusUlangKunciPolos) saat dibaca/disimpan;
 *  - rahasia tidak ada -> simpan polos + peringatan; TIDAK pernah membuat
 *    kunci baru diam-diam dan tidak pernah menghapus kunci;
 *  - rahasia berganti / nilai rusak -> KunciTakTerbacaError (galat jelas),
 *    bukan kunci kosong diam-diam. Pemanggil di jalur daftar menandai
 *    koneksi "kunci tak terbaca"; jalur pakai/simpan melempar ApiError.
 *  - isi kunci tidak pernah ditulis ke log atau galat.
 */

export const AWALAN_KUNCI_API = "enc:ai1:";
export const PESAN_KUNCI_TAK_TERBACA =
  "Kunci API tersimpan tidak dapat dibuka karena rahasia server berubah. Isi ulang kunci API koneksi ini.";

export class KunciTakTerbacaError extends Error {
  constructor(message = PESAN_KUNCI_TAK_TERBACA) {
    super(message);
    this.name = "KunciTakTerbacaError";
  }
}

let sudahPeringatan = false;

let rahasiaUji: string | null | undefined;
/** Hanya untuk uji: string/null menggantikan pembacaan rahasia server; undefined = pembacaan asli. */
export function setRahasiaUntukUji(nilai: string | null | undefined) {
  rahasiaUji = nilai;
}

/** Rahasia aplikasi, atau null bila tidak tersedia. Tidak membuat apa pun. */
export function rahasiaAplikasiAi(): string | null {
  if (rahasiaUji !== undefined) return rahasiaUji;
  const dariEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (dariEnv) return dariEnv;
  // Berkas lokal hanya di luar produksi: di produksi ia hidup di lapisan
  // container dan hilang tiap build, sehingga kunci tersandi jadi yatim.
  if (process.env.NODE_ENV === "production") return null;
  try {
    const berkas = path.join(process.cwd(), "data", ".better-auth-secret");
    if (fs.existsSync(berkas)) {
      const isi = fs.readFileSync(berkas, "utf8").trim();
      if (isi) return isi;
    }
  } catch {
    /* dianggap tidak ada */
  }
  return null;
}

function kunciTurunan(rahasia: string): Buffer {
  return Buffer.from(hkdfSync("sha256", rahasia, "aleta-ai-kunci-api", "pengaturan-ai-api-key-v1", 32));
}

export function kunciApiTerenkripsi(nilai: string | null | undefined): boolean {
  return String(nilai ?? "").startsWith(AWALAN_KUNCI_API);
}

/**
 * Siapkan nilai untuk disimpan. Sudah terenkripsi -> apa adanya. Rahasia tidak
 * ada -> polos (dengan satu peringatan per proses).
 */
export function enkripsiKunciApi(polos: string): string {
  const teks = String(polos ?? "");
  if (!teks || kunciApiTerenkripsi(teks)) return teks;
  const rahasia = rahasiaAplikasiAi();
  if (!rahasia) {
    if (!sudahPeringatan) {
      sudahPeringatan = true;
      console.warn(
        "[ai] Rahasia server tidak tersedia: kunci API Pengaturan AI disimpan tanpa enkripsi. Isi rahasia server lalu simpan ulang."
      );
    }
    return teks;
  }
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunciTurunan(rahasia), iv);
  const isi = Buffer.concat([c.update(teks, "utf8"), c.final()]);
  return `${AWALAN_KUNCI_API}${iv.toString("base64url")}:${c.getAuthTag().toString("base64url")}:${isi.toString("base64url")}`;
}

/**
 * Buka nilai tersimpan. Polos lama -> apa adanya. Terenkripsi tetapi tidak
 * dapat dibuka -> KunciTakTerbacaError (tanpa memuat nilainya).
 */
export function dekripsiKunciApi(tersimpan: string | null | undefined): string {
  const nilai = String(tersimpan ?? "");
  if (!kunciApiTerenkripsi(nilai)) return nilai;
  const rahasia = rahasiaAplikasiAi();
  if (!rahasia) throw new KunciTakTerbacaError();
  const [iv, tag, isi] = nilai.slice(AWALAN_KUNCI_API.length).split(":");
  if (!iv || !tag || !isi) throw new KunciTakTerbacaError();
  try {
    const d = createDecipheriv("aes-256-gcm", kunciTurunan(rahasia), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(isi, "base64url")), d.final()]).toString("utf8");
  } catch {
    throw new KunciTakTerbacaError();
  }
}

/** Seperti dekripsiKunciApi tetapi tanpa melempar: untuk jalur daftar/tampilan. */
export function bacaKunciApiAman(tersimpan: string | null | undefined): { kunci: string; tidakTerbaca: boolean } {
  try {
    return { kunci: dekripsiKunciApi(tersimpan), tidakTerbaca: false };
  } catch (error) {
    if (error instanceof KunciTakTerbacaError) return { kunci: "", tidakTerbaca: true };
    throw error;
  }
}

/**
 * Enkripsi ulang secara malas baris yang masih polos. Best-effort: galat
 * diabaikan (penyimpanan polos tetap berfungsi). Penjaga `api_key = ?` pada
 * WHERE mencegah menimpa kunci yang baru saja diganti pihak lain.
 */
export async function bungkusUlangKunciPolos(
  db: Pick<AletaDatabase, "prepare">,
  baris: Array<{ id: string; api_key: string | null | undefined }>
): Promise<number> {
  let jumlah = 0;
  for (const b of baris) {
    const polos = String(b.api_key ?? "");
    if (!polos.trim() || kunciApiTerenkripsi(polos)) continue;
    const sandi = enkripsiKunciApi(polos);
    if (sandi === polos) return jumlah; // rahasia tidak ada: tidak ada yang bisa dilakukan
    try {
      const hasil = await db
        .prepare(`UPDATE ai_providers SET api_key = ?, masked_api_key = ? WHERE id = ? AND api_key = ?`)
        .run(sandi, maskApiKey(polos), b.id, polos);
      if (Number((hasil as { changes?: number } | undefined)?.changes ?? 1) > 0) jumlah += 1;
    } catch {
      /* dicoba lagi pada pembacaan berikutnya */
    }
  }
  return jumlah;
}

/** Hanya untuk uji. */
export function setelUlangPeringatanKunciApi() {
  sudahPeringatan = false;
}
