import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

/**
 * ============================================================================
 * TANDA TANGAN ALETA PUSAT (Ed25519) - dasar kepercayaan satker ke Pusat
 * ============================================================================
 *
 * Satker menerima dari Pusat: manifest pembaruan, izin fitur, dan (Tahap 1)
 * tiket masuk super admin global. Semuanya bisa mengubah perilaku satker,
 * jadi satker hanya mempercayai isi yang TANDA TANGANNYA cocok dengan kunci
 * publik Pusat yang dipasang operator di env ALETA_PUSAT_KUNCI_PUBLIK (PEM;
 * "\n" literal diterima). Tanpa kunci itu, semua isi dari Pusat DITOLAK -
 * http biasa pun aman karena yang dipercaya tanda tangan, bukan salurannya.
 *
 * Kunci pribadi Pusat TIDAK PERNAH ada di kode satker; fungsi tandatangani()
 * hanya untuk Pusat dan uji.
 */

/** JSON baku: kunci objek diurutkan, tanpa spasi - dua sisi menghasilkan bita yang sama. */
export function kanonik(nilai: unknown): string {
  if (nilai === null || typeof nilai !== "object") return JSON.stringify(nilai === undefined ? null : nilai);
  if (Array.isArray(nilai)) return `[${nilai.map((x) => kanonik(x)).join(",")}]`;
  const o = nilai as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${kanonik(o[k])}`)
    .join(",")}}`;
}

export function normalkanPem(pem: string): string {
  return String(pem ?? "").replace(/\\n/g, "\n").trim();
}

/** Tanda tangan base64 atas kanonik(nilai). Hanya untuk Pusat dan uji. */
export function tandatangani(nilai: unknown, kunciPribadiPem: string): string {
  return sign(null, Buffer.from(kanonik(nilai), "utf8"), createPrivateKey(normalkanPem(kunciPribadiPem))).toString("base64");
}

/** true hanya bila tanda tangan sah. Kunci/tanda tangan rusak = false (tidak melempar). */
export function periksaTandatangan(nilai: unknown, tandatanganBase64: string, kunciPublikPem: string): boolean {
  try {
    if (!kunciPublikPem || !tandatanganBase64) return false;
    return verify(null, Buffer.from(kanonik(nilai), "utf8"), createPublicKey(normalkanPem(kunciPublikPem)), Buffer.from(tandatanganBase64, "base64"));
  } catch {
    return false;
  }
}

/** Kunci publik Pusat dari env; "" bila belum dipasang. */
export function kunciPublikPusat(): string {
  return normalkanPem(process.env.ALETA_PUSAT_KUNCI_PUBLIK ?? "");
}
