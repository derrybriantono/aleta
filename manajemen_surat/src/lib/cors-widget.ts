/**
 * CORS untuk widget ekstensi di halaman SIPP/ABT (K7, rantai F2, 25 Okt 2026).
 *
 * Halaman SIPP dan ABT dilayani di port 80, sama dengan ALETA. Peramban hanya membuka 6
 * sambungan per host:port, jadi polling widget antre di belakang SIPP/ABT sendiri (antrean
 * 26-56 dtk pernah terukur). Port 8008 (deploy/apache/aleta-8008.conf) memberi ALETA 6
 * sambungan sendiri. Skrip konten di halaman SIPP/ABT meminta ke 8008 sebagai permintaan
 * lintas asal, jadi portal harus menjawabnya dengan kepala CORS.
 *
 * MATI BAWAAN: tanpa ALETA_CORS_ASAL_WIDGET tidak ada kepala CORS yang pernah ditambahkan
 * dan perilaku portal sama persis seperti sebelumnya.
 *
 *   ALETA_CORS_ASAL_WIDGET   daftar asal halaman SIPP/ABT dipisah koma,
 *                            mis. "http://192.168.10.10"
 *
 * Batas yang disengaja:
 *   - hanya untuk permintaan yang MASUK lewat port tambahan (ALETA_PORT_PORTAL_TAMBAHAN,
 *     bawaan 8008); di port 80 tidak berbuat apa-apa;
 *   - hanya jalur /api/;
 *   - hanya GET/HEAD/OPTIONS yang diizinkan lintas asal - tulisan tetap di port 80;
 *   - asal harus cocok persis dengan daftar (tidak ada "*", karena kuki ikut dikirim).
 *
 * Tidak mengubah kuki: SameSite dan Secure tidak disentuh (port tidak membedakan "situs",
 * jadi kuki sesi yang sama ikut terkirim ke 8008).
 */

export type KeputusanCors = {
  /** Jawab langsung 204 (pra-pemeriksaan) tanpa meneruskan ke rute. */
  jawabLangsung: boolean;
  headers: Record<string, string>;
};

export type MasukanCors = {
  metode: string;
  asal: string | null;
  /** Kepala Host, atau X-Forwarded-Host bila ada. */
  host: string | null;
  /** Jalur sudah tanpa awalan /aleta. */
  jalur: string;
  mintaMetode: string | null;
  mintaKepala: string | null;
};

type Env = Record<string, string | undefined>;

const METODE_BOLEH = "GET, HEAD, OPTIONS";

function bersihAsal(x: string): string {
  return x.trim().replace(/\/+$/, "");
}

export function asalWidgetDiizinkan(env: Env = process.env): string[] {
  return (env.ALETA_CORS_ASAL_WIDGET ?? "")
    .split(",")
    .map(bersihAsal)
    .filter((x) => /^https?:\/\/[^/\s]+$/.test(x));
}

/** Sama dengan portPortalTambahan() di lib/auth.ts (disalin agar proxy tidak memuat Better Auth). */
export function portTambahan(env: Env = process.env): string[] {
  const mentah = env.ALETA_PORT_PORTAL_TAMBAHAN;
  const teks = mentah === undefined ? "8008" : mentah;
  return teks
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^\d{2,5}$/.test(x) && x !== "80" && x !== "443");
}

function portDariHost(host: string | null): string {
  const h = String(host ?? "").trim();
  const m = /:(\d{2,5})$/.exec(h);
  return m ? m[1] : "";
}

export function keputusanCors(masukan: MasukanCors, env: Env = process.env): KeputusanCors | null {
  const diizinkan = asalWidgetDiizinkan(env);
  if (diizinkan.length === 0) return null;
  const asal = masukan.asal ? bersihAsal(masukan.asal) : "";
  if (!asal || !diizinkan.includes(asal)) return null;
  if (!masukan.jalur.startsWith("/api/")) return null;
  if (!portTambahan(env).includes(portDariHost(masukan.host))) return null;

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": asal,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
  const metode = masukan.metode.toUpperCase();
  if (metode === "OPTIONS" && masukan.mintaMetode) {
    headers["Access-Control-Allow-Methods"] = METODE_BOLEH;
    const diminta = (masukan.mintaKepala ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^[A-Za-z0-9-]{1,60}$/.test(x))
      .slice(0, 12);
    headers["Access-Control-Allow-Headers"] = diminta.length > 0 ? diminta.join(", ") : "Content-Type, Accept";
    headers["Access-Control-Max-Age"] = "600";
    return { jawabLangsung: true, headers };
  }
  return { jawabLangsung: false, headers };
}
