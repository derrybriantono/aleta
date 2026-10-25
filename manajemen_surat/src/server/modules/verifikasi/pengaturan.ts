import type { AletaDatabase } from "@/server/db/client";
import { bacaSetelanJson, simpanSetelanSistem } from "@/server/modules/kesehatan/setelan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * PENGATURAN VERIFIKASI DUA LANGKAH (E5, admin 6 - 25 Okt 2026)
 * ============================================================================
 *
 * MATI bawaan (keputusan Derry 24 Okt): DUA saklar terpisah, OTP WhatsApp dan
 * authenticator. Selama keduanya mati, TIDAK ADA pengguna yang dimintai kode -
 * perilaku masuk persis seperti sebelumnya. Pengguna boleh mendaftarkan
 * authenticator lebih dulu; kodenya baru ditagih setelah Super Admin menyalakan.
 *
 * Aturan per peran (bila salah satu saklar menyala):
 *   wajib       Super Admin/Admin bawaan: kode diminta di perangkat baru atau
 *               dari luar jaringan kantor.
 *   luar-kantor hakim/pejabat bawaan: kode HANYA diminta dari luar jaringan kantor.
 *   opsional    peran lain bawaan: kode diminta hanya bila orangnya sendiri
 *               sudah mendaftarkan authenticator (perangkat baru / luar kantor).
 *   mati        tidak pernah.
 * "Percayai perangkat ini" menahan kode selama MASA_TEPERCAYA_HARI (30 hari).
 *
 * Passkey (WebAuthn) hanya sah di HTTPS atau localhost; selama ALETA berjalan
 * lewat http, passkeyTersedia() = false dan tidak ada yang menawarkannya.
 *
 * Tersimpan di aleta_ekstensi_setelan (*sistem*, tanpa migrasi).
 */
export const KUNCI_VERIFIKASI = "verifikasi:pengaturan";

export type AturanVerifikasi = "wajib" | "luar-kantor" | "opsional" | "mati";
export const ATURAN_SAH: readonly AturanVerifikasi[] = ["wajib", "luar-kantor", "opsional", "mati"];

export const MASA_TEPERCAYA_HARI_BAWAAN = 30;
export const MASA_TEPERCAYA_HARI_MAKS = 90;
export const SUBNET_KANTOR_BAWAAN: readonly string[] = ["192.168.10.0/24", "192.168.9.0/24", "127.0.0.1/32", "::1/128"];

/** Peran yang bawaannya "luar-kantor": hakim dan pejabat. */
export const PERAN_PEJABAT: readonly string[] = ["hakim", "ketua", "wakil-ketua", "sekretaris", "panitera", "panitera-muda", "kasubag", "pejabat-struktural"];

export type PengaturanVerifikasi = {
  otpWhatsapp: boolean;
  authenticator: boolean;
  /** Aturan per roleId; peran tanpa entri memakai aturanBawaanPeran. */
  aturanPeran: Record<string, AturanVerifikasi>;
  subnetKantor: string[];
  masaTepercayaHari: number;
  diubahOleh: string;
  diubahPada: string;
};

export const PENGATURAN_VERIFIKASI_BAWAAN: PengaturanVerifikasi = {
  otpWhatsapp: false,
  authenticator: false,
  aturanPeran: {},
  subnetKantor: [...SUBNET_KANTOR_BAWAAN],
  masaTepercayaHari: MASA_TEPERCAYA_HARI_BAWAAN,
  diubahOleh: "",
  diubahPada: "",
};

export function aturanBawaanPeran(roleId: string): AturanVerifikasi {
  if (roleId === "super-admin" || roleId === "admin") return "wajib";
  if (PERAN_PEJABAT.includes(roleId)) return "luar-kantor";
  return "opsional";
}

export function aturanUntukPeran(p: PengaturanVerifikasi, roleId: string): AturanVerifikasi {
  return p.aturanPeran[roleId] ?? aturanBawaanPeran(roleId);
}

export function saklarMenyala(p: Pick<PengaturanVerifikasi, "otpWhatsapp" | "authenticator">): boolean {
  return p.otpWhatsapp || p.authenticator;
}

/** Passkey hanya dengan HTTPS (atau localhost). Selama http: tidak tersedia. */
export function passkeyTersedia(asal: string | null | undefined): boolean {
  try {
    const u = new URL(String(asal ?? ""));
    return u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CIDR
// ---------------------------------------------------------------------------

function ipv4KeAngka(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const b = m.slice(1).map(Number);
  if (b.some((x) => x > 255)) return null;
  return ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
}

/** Bentuk "a.b.c.d/n" atau "::1/128" (IPv6 hanya dicocokkan persis). */
export function cidrSah(teks: string): boolean {
  const t = String(teks ?? "").trim();
  const [ip, panjang] = t.split("/");
  if (ip.includes(":")) return /^[0-9a-f:]+$/i.test(ip) && (panjang === undefined || (/^\d+$/.test(panjang) && Number(panjang) <= 128));
  const angka = ipv4KeAngka(ip);
  if (angka === null) return false;
  return panjang === undefined || (/^\d+$/.test(panjang) && Number(panjang) <= 32);
}

export function ipDalamCidr(ip: string, cidr: string): boolean {
  const [dasar, panjangTeks] = String(cidr).trim().split("/");
  if (ip.includes(":") || dasar.includes(":")) return ip.toLowerCase() === dasar.toLowerCase();
  const a = ipv4KeAngka(ip);
  const b = ipv4KeAngka(dasar);
  if (a === null || b === null) return false;
  const panjang = panjangTeks === undefined ? 32 : Number(panjangTeks);
  if (!Number.isInteger(panjang) || panjang < 0 || panjang > 32) return false;
  if (panjang === 0) return true;
  const topeng = (0xffffffff << (32 - panjang)) >>> 0;
  return ((a & topeng) >>> 0) === ((b & topeng) >>> 0);
}

/** IP kosong/tak terbaca = DI LUAR kantor (lebih ketat). */
export function ipDiKantor(ip: string, subnet: readonly string[]): boolean {
  const bersih = String(ip ?? "").trim();
  if (!bersih) return false;
  return subnet.some((c) => ipDalamCidr(bersih, c));
}

// ---------------------------------------------------------------------------
// Bersihkan / baca / simpan
// ---------------------------------------------------------------------------

export function bersihkanPengaturanVerifikasi(masukan: unknown): PengaturanVerifikasi {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : {};
  const aturanPeran: Record<string, AturanVerifikasi> = {};
  if (x.aturanPeran && typeof x.aturanPeran === "object") {
    for (const [peran, aturan] of Object.entries(x.aturanPeran as Record<string, unknown>)) {
      if (/^[a-z0-9_-]{1,60}$/i.test(peran) && (ATURAN_SAH as readonly unknown[]).includes(aturan)) aturanPeran[peran] = aturan as AturanVerifikasi;
    }
  }
  const subnetMentah = Array.isArray(x.subnetKantor) ? x.subnetKantor.map((s) => String(s ?? "").trim()).filter(Boolean) : [...SUBNET_KANTOR_BAWAAN];
  const subnetKantor = Array.from(new Set(subnetMentah.filter(cidrSah))).slice(0, 20);
  const hari = Number(x.masaTepercayaHari);
  return {
    otpWhatsapp: x.otpWhatsapp === true,
    authenticator: x.authenticator === true,
    aturanPeran,
    subnetKantor,
    masaTepercayaHari: Number.isInteger(hari) && hari >= 1 && hari <= MASA_TEPERCAYA_HARI_MAKS ? hari : MASA_TEPERCAYA_HARI_BAWAAN,
    diubahOleh: String(x.diubahOleh ?? "").slice(0, 120),
    diubahPada: String(x.diubahPada ?? "").slice(0, 40),
  };
}

/** Validasi untuk penyimpanan: nilai yang salah ditolak, bukan dibuang diam-diam. */
export function periksaMasukanVerifikasi(masukan: unknown) {
  const x = masukan && typeof masukan === "object" ? (masukan as Record<string, unknown>) : null;
  if (!x) throw new ApiError(400, "Pengaturan verifikasi tidak sah.");
  if (x.subnetKantor !== undefined) {
    if (!Array.isArray(x.subnetKantor)) throw new ApiError(400, "Daftar jaringan kantor harus berupa daftar.");
    const salah = x.subnetKantor.map((s) => String(s ?? "").trim()).filter((s) => s && !cidrSah(s));
    if (salah.length) throw new ApiError(400, `Jaringan kantor tidak sah: ${salah.slice(0, 3).join(", ")}. Contoh yang benar: 192.168.10.0/24.`);
  }
  if (x.aturanPeran !== undefined && x.aturanPeran && typeof x.aturanPeran === "object") {
    for (const [peran, aturan] of Object.entries(x.aturanPeran as Record<string, unknown>)) {
      if (!(ATURAN_SAH as readonly unknown[]).includes(aturan)) throw new ApiError(400, `Aturan untuk peran ${peran} tidak sah.`);
    }
  }
  if (x.masaTepercayaHari !== undefined) {
    const h = Number(x.masaTepercayaHari);
    if (!Number.isInteger(h) || h < 1 || h > MASA_TEPERCAYA_HARI_MAKS) throw new ApiError(400, `Masa perangkat tepercaya 1 sampai ${MASA_TEPERCAYA_HARI_MAKS} hari.`);
  }
}

const singgah: { pada: number; nilai: PengaturanVerifikasi | null } = { pada: 0, nilai: null };
const SINGGAH_MS = 5000;

export function kosongkanSinggahVerifikasi() {
  singgah.pada = 0;
  singgah.nilai = null;
}

export async function bacaPengaturanVerifikasi(db: AletaDatabase, { tanpaSinggah = false } = {}): Promise<PengaturanVerifikasi> {
  if (!tanpaSinggah && singgah.nilai && Date.now() - singgah.pada < SINGGAH_MS) return singgah.nilai;
  const tersimpan = await bacaSetelanJson<PengaturanVerifikasi>(db, KUNCI_VERIFIKASI);
  const nilai = bersihkanPengaturanVerifikasi({ ...PENGATURAN_VERIFIKASI_BAWAAN, ...(tersimpan ?? {}) });
  singgah.nilai = nilai;
  singgah.pada = Date.now();
  return nilai;
}

export async function simpanPengaturanVerifikasi(
  db: AletaDatabase,
  masukan: unknown,
  oleh: { id: string; nama: string },
  kini: Date = new Date()
): Promise<{ sebelum: PengaturanVerifikasi; sesudah: PengaturanVerifikasi }> {
  periksaMasukanVerifikasi(masukan);
  const sebelum = await bacaPengaturanVerifikasi(db, { tanpaSinggah: true });
  const sesudah = bersihkanPengaturanVerifikasi({
    ...sebelum,
    ...(masukan as Record<string, unknown>),
    diubahOleh: oleh.nama || oleh.id,
    diubahPada: kini.toISOString(),
  });
  await simpanSetelanSistem(db, KUNCI_VERIFIKASI, JSON.stringify(sesudah), kini.toISOString());
  kosongkanSinggahVerifikasi();
  return { sebelum, sesudah };
}
