import crypto from "node:crypto";

/**
 * ============================================================================
 * AUTHENTICATOR TOTP (RFC 6238) - E5, 25 Okt 2026
 * ============================================================================
 *
 * Tanpa pustaka tambahan: HMAC-SHA1, langkah 30 detik, 6 angka, rahasia 20
 * byte (160 bit) berkode Base32 - bentuk yang dipahami Google Authenticator,
 * Microsoft Authenticator, Aegis, dan sejenisnya. Satu rahasia boleh dipindai
 * di lebih dari satu HP.
 *
 * Fungsi di sini MURNI (waktu masuk sebagai argumen) supaya dapat diuji
 * dengan vektor uji resmi RFC 6238.
 */

const ABJAD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const LANGKAH_DETIK = 30;
export const JUMLAH_ANGKA = 6;
/** Toleransi selisih jam: satu langkah sebelum dan sesudah. */
export const JENDELA_LANGKAH = 1;

export function base32Enkode(data: Buffer): string {
  let bit = 0;
  let nilai = 0;
  let hasil = "";
  for (const b of data) {
    nilai = (nilai << 8) | b;
    bit += 8;
    while (bit >= 5) {
      hasil += ABJAD[(nilai >>> (bit - 5)) & 31];
      bit -= 5;
    }
  }
  if (bit > 0) hasil += ABJAD[(nilai << (5 - bit)) & 31];
  return hasil;
}

export function base32Dekode(teks: string): Buffer {
  const bersih = teks.toUpperCase().replace(/[\s=-]/g, "");
  let bit = 0;
  let nilai = 0;
  const keluar: number[] = [];
  for (const huruf of bersih) {
    const i = ABJAD.indexOf(huruf);
    if (i < 0) throw new Error("Rahasia Base32 tidak sah.");
    nilai = (nilai << 5) | i;
    bit += 5;
    if (bit >= 8) {
      keluar.push((nilai >>> (bit - 8)) & 255);
      bit -= 8;
    }
  }
  return Buffer.from(keluar);
}

export function buatRahasiaTotp(): string {
  return base32Enkode(crypto.randomBytes(20));
}

/** Kode untuk satu langkah waktu (counter). */
export function kodeTotpLangkah(rahasiaBase32: string, langkah: number, angka = JUMLAH_ANGKA): string {
  const kunci = base32Dekode(rahasiaBase32);
  const penghitung = Buffer.alloc(8);
  penghitung.writeBigUInt64BE(BigInt(Math.max(0, Math.floor(langkah))));
  const h = crypto.createHmac("sha1", kunci).update(penghitung).digest();
  const o = h[h.length - 1] & 15;
  const biner = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(biner % 10 ** angka).padStart(angka, "0");
}

export function langkahDariWaktu(kini: Date): number {
  return Math.floor(kini.getTime() / 1000 / LANGKAH_DETIK);
}

export function kodeTotp(rahasiaBase32: string, kini: Date, angka = JUMLAH_ANGKA): string {
  return kodeTotpLangkah(rahasiaBase32, langkahDariWaktu(kini), angka);
}

function samaAman(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Memeriksa kode terhadap langkah sekarang +- JENDELA_LANGKAH. Mengembalikan
 * nomor langkah yang cocok (untuk menolak pemakaian ulang kode yang sama), atau
 * null bila tidak cocok / bukan 6 angka. `langkahTerakhir` = langkah yang sudah
 * terpakai: langkah <= itu ditolak (kode tidak boleh dipakai dua kali).
 */
export function periksaKodeTotp(rahasiaBase32: string, kode: string, kini: Date, langkahTerakhir = -1): number | null {
  const bersih = String(kode ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(bersih)) return null;
  const sekarang = langkahDariWaktu(kini);
  let cocok: number | null = null;
  for (let d = -JENDELA_LANGKAH; d <= JENDELA_LANGKAH; d += 1) {
    const langkah = sekarang + d;
    if (langkah <= langkahTerakhir) continue;
    if (samaAman(kodeTotpLangkah(rahasiaBase32, langkah), bersih)) cocok = langkah;
  }
  return cocok;
}

/** URI otpauth:// untuk kode QR dan pemasukan manual. */
export function uriOtpauth(rahasiaBase32: string, akun: string, penerbit = "ALETA"): string {
  const label = `${penerbit}:${akun}`;
  const param = new URLSearchParams({ secret: rahasiaBase32, issuer: penerbit, algorithm: "SHA1", digits: String(JUMLAH_ANGKA), period: String(LANGKAH_DETIK) });
  return `otpauth://totp/${encodeURIComponent(label)}?${param.toString()}`;
}
