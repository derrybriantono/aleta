import { bersihkanIzinPusat, saluranSah, type IzinPusat, type SaluranSatker } from "@/lib/fitur-satker";

/**
 * ============================================================================
 * KANAL PEMBARUAN SATKER <-> ALETA PUSAT - KONTRAK (Tahap 0)
 * ============================================================================
 *
 * Satker MENARIK ke Pusat; Pusat tidak pernah menembak masuk ke jaringan
 * satker. "Mendorong pembaruan" = Pusat menerbitkan manifest dan satker
 * mengambilnya saat cek berikutnya (admin satker tetap menerapkan paketnya
 * lewat jalur yang sudah ada: system-update + skrip host).
 *
 *   saluran    "stabil" | "uji-coba", PER SATKER (diatur Super Admin satker,
 *              kelak dikunci Pusat lewat izin).
 *   alamat     alamat dasar ALETA Pusat, dapat diatur; KOSONG bila belum ada
 *              (Donggala sekarang) - cek pembaruan lalu "belum diatur", bukan galat.
 *
 *   POST {alamat}/api/pusat/v1/cek     (kontrak untuk Tahap 1, dibangun di Pusat)
 *     header  x-aleta-satker-kunci: <kunci satker dari Pusat; env ALETA_PUSAT_KUNCI, tidak di basis data>
 *     badan   PermintaanCekPusat   (kode satker, instalasi, saluran, versi terpasang - tanpa data perkara/pegawai)
 *     jawab   JawabanCekPusat      (manifest + izin fitur + tanda tangan Pusat atas manifest/izin)
 *
 * Manifest per komponen (portal, ekstensi, bot) mengikuti bentuk manifest
 * pembaruan portal yang sudah ada (version/downloadUrl/packageSha256 di
 * server/modules/system-update) - hanya dibungkus per saluran dan komponen.
 * Mekanisme pembaruan ekstensi (update_url -> updates.xml -> .crx) TIDAK
 * berubah; saluran satker hanya menentukan versi mana yang boleh ditawarkan.
 */

export const SKEMA_PUSAT = 1;

export type KomponenPembaruan = "portal" | "ekstensi" | "bot";
export const KOMPONEN_PEMBARUAN: readonly KomponenPembaruan[] = ["portal", "ekstensi", "bot"];

export type RilisKomponen = {
  versi: string;
  dirilis?: string;
  /** Versi terpasang minimum agar paket ini dapat diterapkan langsung. */
  minimalVersi?: string;
  catatan?: string[];
  unduh?: { alamat: string; sha256: string; ukuranByte?: number };
};

export type ManifestPusat = {
  skema: number;
  diterbitkan: string;
  saluran: Record<SaluranSatker, Partial<Record<KomponenPembaruan, RilisKomponen>>>;
};

export type PermintaanCekPusat = {
  skema: number;
  satker: { kode: string; nama: string; instalasiId: string };
  saluran: SaluranSatker;
  /** Versi yang terpasang di satker; komponen yang tidak ada dikosongkan. */
  versi: Partial<Record<KomponenPembaruan, string>>;
  waktu: string;
};

export type JawabanCekPusat = {
  skema: number;
  manifest: ManifestPusat;
  /** Plafon fitur untuk satker ini (opsional; lihat lib/fitur-satker IzinPusat). */
  izin: IzinPusat;
  /** Saluran yang dipaksakan Pusat untuk satker ini (opsional). */
  saluranDipaksa: SaluranSatker | null;
  pesan: string;
  /** Tanda tangan Ed25519 (base64) atas {manifest, izin, saluranDipaksa}; diperiksa server, bukan lib ini. */
  tandatangan: string;
};

export class GalatKanalPembaruan extends Error {}

const teks = (x: unknown) => String(x ?? "").trim();

/**
 * Alamat dasar Pusat: "" (belum ada) atau http/https tanpa sandi, kueri, atau
 * fragmen; garis miring akhir dibuang. http biasa DITERIMA (jaringan satker),
 * https dianjurkan bila tersedia.
 */
export function bersihkanAlamatPusat(x: unknown): string {
  const mentah = teks(x);
  if (!mentah) return "";
  let url: URL;
  try {
    url = new URL(mentah);
  } catch {
    throw new GalatKanalPembaruan("Alamat ALETA Pusat tidak sah - tulis lengkap, mis. https://pusat.contoh.id");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new GalatKanalPembaruan("Alamat ALETA Pusat harus diawali http:// atau https://");
  if (url.username || url.password) throw new GalatKanalPembaruan("Alamat ALETA Pusat tidak boleh memuat nama pengguna atau sandi.");
  if (url.search || url.hash) throw new GalatKanalPembaruan("Alamat ALETA Pusat tidak boleh memuat tanda tanya atau tanda pagar.");
  if (mentah.length > 200) throw new GalatKanalPembaruan("Alamat ALETA Pusat terlalu panjang.");
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

export type PengaturanKanal = {
  saluran: SaluranSatker;
  alamatPusat: string;
  diubahOleh: string;
  diubahPada: string;
};

export const KANAL_BAWAAN: PengaturanKanal = { saluran: "stabil", alamatPusat: "", diubahOleh: "", diubahPada: "" };

export function bersihkanPengaturanKanal(x: unknown): PengaturanKanal | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (!saluranSah(o.saluran)) return null;
  let alamat = "";
  try {
    alamat = bersihkanAlamatPusat(o.alamatPusat);
  } catch {
    alamat = "";
  }
  return { saluran: o.saluran, alamatPusat: alamat, diubahOleh: teks(o.diubahOleh).slice(0, 200), diubahPada: teks(o.diubahPada).slice(0, 40) };
}

/** Bandingkan "a.b.c" (angka saja; sisanya diabaikan). Negatif: kiri lebih lama. */
export function bandingkanVersi(kiri: string, kanan: string): number {
  const bagian = (v: string) => {
    const [utama] = teks(v).replace(/^v/i, "").split(/[-+]/, 1);
    const n = utama.split(".").map((p) => Number.parseInt(p, 10) || 0);
    return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0];
  };
  const a = bagian(kiri);
  const b = bagian(kanan);
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

const versiSah = (v: unknown) => typeof v === "string" && /^v?\d+\.\d+(\.\d+)?([-+][\w.-]+)?$/.test(v.trim());

function bersihkanRilis(x: unknown): RilisKomponen | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (!versiSah(o.versi)) return null;
  const hasil: RilisKomponen = { versi: teks(o.versi) };
  if (o.dirilis) hasil.dirilis = teks(o.dirilis).slice(0, 40);
  if (versiSah(o.minimalVersi)) hasil.minimalVersi = teks(o.minimalVersi);
  if (Array.isArray(o.catatan)) hasil.catatan = o.catatan.map((c) => teks(c).slice(0, 300)).filter(Boolean).slice(0, 20);
  const u = o.unduh as Record<string, unknown> | undefined;
  if (u && typeof u === "object") {
    const alamat = teks(u.alamat);
    const sha256 = teks(u.sha256).toLowerCase();
    // Tanpa SHA-256 yang sah, paket tidak boleh ditawarkan untuk diunduh (sama dengan system-update).
    if (/^https?:\/\//i.test(alamat) && /^[a-f0-9]{64}$/.test(sha256)) {
      hasil.unduh = { alamat: alamat.slice(0, 500), sha256 };
      const ukuran = Number(u.ukuranByte);
      if (Number.isFinite(ukuran) && ukuran > 0) hasil.unduh.ukuranByte = Math.floor(ukuran);
    }
  }
  return hasil;
}

export function bersihkanManifestPusat(x: unknown): ManifestPusat | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (Number(o.skema) !== SKEMA_PUSAT) return null;
  const mentah = (o.saluran && typeof o.saluran === "object" ? o.saluran : {}) as Record<string, unknown>;
  const saluran = { stabil: {}, "uji-coba": {} } as ManifestPusat["saluran"];
  for (const s of ["stabil", "uji-coba"] as const) {
    const isi = (mentah[s] && typeof mentah[s] === "object" ? mentah[s] : {}) as Record<string, unknown>;
    for (const k of KOMPONEN_PEMBARUAN) {
      const rilis = bersihkanRilis(isi[k]);
      if (rilis) saluran[s][k] = rilis;
    }
  }
  return { skema: SKEMA_PUSAT, diterbitkan: teks(o.diterbitkan).slice(0, 40), saluran };
}

/** Isi yang ditandatangani Pusat - urutan kunci dibakukan di server/shared/pusat-tanda-tangan. */
export function isiBertandatangan(j: { manifest?: unknown; izin?: unknown; saluranDipaksa?: unknown }) {
  return { manifest: j.manifest ?? null, izin: j.izin ?? null, saluranDipaksa: j.saluranDipaksa ?? null };
}

/** Jawaban Pusat yang bentuknya sah, atau null. Tanda tangan belum diperiksa di sini. */
export function bersihkanJawabanCek(x: unknown): JawabanCekPusat | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  const manifest = bersihkanManifestPusat(o.manifest);
  if (!manifest) return null;
  return {
    skema: SKEMA_PUSAT,
    manifest,
    izin: o.izin ? bersihkanIzinPusat(o.izin) : null,
    saluranDipaksa: saluranSah(o.saluranDipaksa) ? o.saluranDipaksa : null,
    pesan: teks(o.pesan).slice(0, 500),
    tandatangan: teks(o.tandatangan).slice(0, 200),
  };
}

export function susunPermintaanCek(
  satker: { kode: string; nama: string; instalasiId: string },
  saluran: SaluranSatker,
  versi: Partial<Record<KomponenPembaruan, string>>,
  sekarang: Date = new Date()
): PermintaanCekPusat {
  const bersih: Partial<Record<KomponenPembaruan, string>> = {};
  for (const k of KOMPONEN_PEMBARUAN) if (versiSah(versi[k])) bersih[k] = teks(versi[k]);
  return {
    skema: SKEMA_PUSAT,
    satker: { kode: teks(satker.kode).slice(0, 40), nama: teks(satker.nama).slice(0, 120), instalasiId: teks(satker.instalasiId).slice(0, 80) },
    saluran,
    versi: bersih,
    waktu: sekarang.toISOString(),
  };
}

export type KeadaanPembaruan = {
  komponen: KomponenPembaruan;
  terpasang: string;
  tersedia: string;
  adaPembaruan: boolean;
  /** Paket langsung dapat diterapkan (versi terpasang >= minimalVersi). */
  langsungDapat: boolean;
  rilis: RilisKomponen | null;
};

/** Apa yang ditawarkan manifest di saluran ini dibanding yang terpasang (murni - diuji). */
export function hitungPembaruan(
  manifest: ManifestPusat,
  saluran: SaluranSatker,
  terpasang: Partial<Record<KomponenPembaruan, string>>
): KeadaanPembaruan[] {
  const hasil: KeadaanPembaruan[] = [];
  for (const k of KOMPONEN_PEMBARUAN) {
    const sekarang = teks(terpasang[k]);
    if (!sekarang) continue;
    const rilis = manifest.saluran[saluran]?.[k] ?? null;
    const ada = Boolean(rilis) && bandingkanVersi(rilis!.versi, sekarang) > 0;
    hasil.push({
      komponen: k,
      terpasang: sekarang,
      tersedia: rilis?.versi ?? "",
      adaPembaruan: ada,
      langsungDapat: ada && (!rilis!.minimalVersi || bandingkanVersi(sekarang, rilis!.minimalVersi) >= 0),
      rilis: ada ? rilis : null,
    });
  }
  return hasil;
}
