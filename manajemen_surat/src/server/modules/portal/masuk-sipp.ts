/**
 * ============================================================================
 * MASUK ALETA DENGAN AKUN SIPP (7 Okt 2026, rencana disetujui 6 Okt malam)
 * ============================================================================
 *
 * Rencana: D:/aleta-dev/kerja/masuk-satu-akun-sipp/RENCANA.md. Petugas cukup
 * ingat SATU nama pengguna + password - milik SIPP. ALETA mencocokkannya ke
 * sys_users SIPP lewat bot (operasi jembatan "user.verifikasiSandi", murni
 * membaca), dengan rumus sidik SIPP sendiri (aleta_bot/utils/sidikSandiSipp.js).
 *
 * ============================================================================
 * YANG DISIMPAN ALETA: HANYA TAUTANNYA
 * ============================================================================
 *
 * Tautan akun ALETA <-> akun SIPP adalah yang SUDAH ADA: kredensial SIPP di
 * Manajemen Akun (external_app_credentials, app 'sipp', aktif), dengan aturan
 * kepemilikan yang sama dengan Penetapan kembali dan Court Calendar
 * (akunSippMilik / tentukanPemilikSipp). Tidak ada tautan kedua.
 *
 * Password yang diketik di layar masuk TIDAK disimpan di mana pun oleh modul
 * ini: tidak di basis data, tidak di jejak, tidak di audit, tidak di log, dan
 * tidak dipulangkan dalam jawaban. Ia hanya lewat ke bot untuk dicocokkan, lalu
 * ke pemeriksa password ALETA bila SIPP tidak cocok.
 *
 * ============================================================================
 * FITUR LAMA TIDAK DIKURANGI
 * ============================================================================
 *
 *   - Akun tanpa tautan SIPP (Super Admin, pegawai non-perkara): keputusannya
 *     "bukan-sipp", dan layar masuk melanjutkan jalur lama (lookup + password
 *     ALETA) PERSIS seperti sebelumnya.
 *   - Akun bertautan yang mengetik password ALETA-nya: tetap masuk (lewat
 *     "aleta"). Hanya password SIPP yang terbukti cocok yang boleh diteruskan
 *     ke ekstensi untuk isi otomatis.
 *   - Bot/SIPP tidak terjangkau: password ALETA tetap berlaku. Bot yang mati
 *     tidak boleh mengunci seluruh kantor.
 *
 * ============================================================================
 * AKUN SIPP NONAKTIF = ALETA TERTUTUP
 * ============================================================================
 *
 * Diblokir (sys_users.block) atau kedaluwarsa (user_expired lewat) - SIPP
 * sendiri menolak keduanya - membuat masuk ALETA ditolak, termasuk lewat
 * password ALETA. Satu pengecualian: Super Admin tetap dapat masuk dengan
 * password ALETA-nya, supaya pemegang kunci tidak ikut terkunci dan dapat
 * mencabut tautannya (tercatat jujur di jejak).
 *
 * ============================================================================
 * BATAS PERCOBAAN
 * ============================================================================
 *
 * Pemeriksaannya hanya MEMBACA sys_users, jadi tidak pernah mengunci akun SIPP
 * dan tidak menulis apa pun ke SIPP (tanpa tanda ALETA di audit SIPP). Meski
 * begitu ALETA tidak boleh menjadi alat menebak password SIPP: percobaan salah
 * dibatasi dua lapis - per alamat+identitas (lingkup "login" yang sama dengan
 * masuk lama) dan per username SIPP dari alamat mana pun.
 */

import { type NextRequest } from "next/server";

import { ApiError } from "@/server/shared/errors";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";

export type PenggunaMasuk = { id: string; roleId: string; name?: string };

export type JawabanVerifikasiSipp =
  | { ok: false; error?: string }
  | {
      ok: true;
      data?: {
        ditemukan?: boolean;
        cocok?: boolean;
        diblokir?: boolean;
        kedaluwarsa?: boolean;
        sippUserId?: string;
      };
    };

export type HasilJejak = "berhasil" | "ditolak" | "dibatasi";

/** Satu baris aleta_masuk_jejak - TIDAK ADA ruas password. */
export type BarisJejakMasuk = {
  aletaUserId: string | null;
  identitas: string;
  usernameSipp: string;
  sippUserId: string;
  lewat: "sipp" | "aleta" | "";
  hasil: HasilJejak;
  alasan: string;
  alamatIp: string;
  agenPeramban: string;
};

export type DepsMasukSipp = {
  /** Akun ALETA aktif untuk identitas yang diketik - aturan lookup lama. */
  cariPengguna: (identitas: string) => Promise<PenggunaMasuk | null>;
  /** Username SIPP yang SAH milik pengguna ini (akunSippMilik). */
  akunSippMilik: (userId: string) => Promise<string[]>;
  verifikasiSipp: (usernameSipp: string, sandi: string) => Promise<JawabanVerifikasiSipp>;
  verifikasiSandiAleta: (userId: string, sandi: string) => Promise<boolean>;
  catatJejak: (baris: BarisJejakMasuk) => Promise<void>;
};

export type KonteksMasuk = {
  /** Hanya header-nya yang dibaca (alamat IP untuk batas percobaan). */
  headers: Headers;
};

export type KeputusanMasuk =
  | { jenis: "bukan-sipp"; sebab: "dimatikan" | "tidak-ditemukan" | "tanpa-tautan" }
  | { jenis: "masuk"; userId: string; lewat: "sipp" | "aleta"; usernameSipp: string; catatan: string }
  | { jenis: "tolak"; status: 400 | 401 | 403 | 429; kode: string; pesan: string };

// ---------------------------------------------------------------------------
// Batas per username SIPP - dari alamat mana pun.
// ---------------------------------------------------------------------------

export const BATAS_SIPP = { maksGagal: 8, jendelaMs: 15 * 60 * 1000, tahanMs: 15 * 60 * 1000 } as const;
const batasSipp = new Map<string, { gagal: number; mulai: number; tahanSampai: number }>();

function kunciSipp(username: string) {
  return username.trim().toLowerCase();
}

function wadahSipp(username: string, kini: number) {
  const kunci = kunciSipp(username);
  let w = batasSipp.get(kunci);
  if (!w) {
    w = { gagal: 0, mulai: kini, tahanSampai: 0 };
    batasSipp.set(kunci, w);
  }
  if (w.tahanSampai > 0 && w.tahanSampai <= kini) {
    w.gagal = 0;
    w.tahanSampai = 0;
    w.mulai = kini;
  }
  if (kini - w.mulai > BATAS_SIPP.jendelaMs) {
    w.gagal = 0;
    w.mulai = kini;
  }
  return w;
}

function sippDitahan(username: string) {
  return wadahSipp(username, Date.now()).tahanSampai > Date.now();
}

function catatGagalSipp(username: string) {
  const kini = Date.now();
  const w = wadahSipp(username, kini);
  w.gagal += 1;
  if (w.gagal >= BATAS_SIPP.maksGagal) w.tahanSampai = kini + BATAS_SIPP.tahanMs;
}

/** Hanya untuk uji. */
export function kosongkanBatasMasukSipp() {
  batasSipp.clear();
}

// ---------------------------------------------------------------------------

export function masukSippDinyalakan(env: Record<string, string | undefined> = process.env) {
  const nilai = String(env.ALETA_MASUK_SIPP ?? "").trim().toLowerCase();
  return !(nilai === "0" || nilai === "false" || nilai === "mati" || nilai === "off");
}

function alamatIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 80);
}

const PESAN_DIBATASI = "Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.";
const PESAN_SANDI_SALAH = "Password tidak cocok dengan akun SIPP maupun akun ALETA.";

function pesanSippNonaktif(diblokir: boolean) {
  return diblokir
    ? "Akun SIPP Anda sedang diblokir, sehingga akses ALETA ikut tertutup. Hubungi admin SIPP."
    : "Masa berlaku akun SIPP Anda sudah habis, sehingga akses ALETA ikut tertutup. Hubungi admin SIPP.";
}

/**
 * Memutuskan satu permintaan masuk. Tidak membuat sesi - itu pekerjaan
 * pemanggil (masuk-sipp-plugin.ts) bila jawabannya "masuk".
 */
export async function putuskanMasukSipp(
  deps: DepsMasukSipp,
  masukan: { identitas: string; sandi: string },
  konteks: KonteksMasuk,
  env: Record<string, string | undefined> = process.env
): Promise<KeputusanMasuk> {
  if (!masukSippDinyalakan(env)) return { jenis: "bukan-sipp", sebab: "dimatikan" };

  const identitas = String(masukan.identitas ?? "").trim().slice(0, 200);
  // SIPP memangkas password (form_validation 'trim'); layar masuk ALETA juga.
  const sandi = String(masukan.sandi ?? "").trim();
  if (!identitas || !sandi) {
    return { jenis: "tolak", status: 400, kode: "MASUKAN_KOSONG", pesan: "Masukkan identitas akun dan password." };
  }

  // assertRateLimit dkk. hanya membaca header permintaan.
  const permintaan = { headers: konteks.headers } as unknown as NextRequest;
  const ip = alamatIp(konteks.headers);
  const agen = (konteks.headers.get("user-agent") ?? "").slice(0, 240);
  const jejak = (baris: Omit<BarisJejakMasuk, "identitas" | "alamatIp" | "agenPeramban">) =>
    deps
      .catatJejak({ ...baris, identitas, alamatIp: ip, agenPeramban: agen })
      // Jejak yang gagal ditulis tidak boleh membatalkan masuk yang sah -
      // tetapi kegagalannya disebut, tanpa isi permintaan.
      .catch((galat) => {
        console.warn("[ALETA MASUK SIPP] jejak masuk tidak tertulis:", galat instanceof Error ? galat.message : "tidak diketahui");
      });

  try {
    assertRateLimit("login", permintaan, identitas);
  } catch (galat) {
    if (galat instanceof ApiError && galat.status === 429) {
      await jejak({ aletaUserId: null, usernameSipp: "", sippUserId: "", lewat: "", hasil: "dibatasi", alasan: "batas_percobaan" });
      return { jenis: "tolak", status: 429, kode: "DIBATASI", pesan: PESAN_DIBATASI };
    }
    throw galat;
  }

  const pengguna = await deps.cariPengguna(identitas);
  if (!pengguna) return { jenis: "bukan-sipp", sebab: "tidak-ditemukan" };

  const milik = await deps.akunSippMilik(pengguna.id);
  if (milik.length !== 1) return { jenis: "bukan-sipp", sebab: "tanpa-tautan" };
  const usernameSipp = milik[0];

  if (sippDitahan(usernameSipp)) {
    await jejak({ aletaUserId: pengguna.id, usernameSipp, sippUserId: "", lewat: "", hasil: "dibatasi", alasan: "batas_percobaan_sipp" });
    return { jenis: "tolak", status: 429, kode: "DIBATASI", pesan: PESAN_DIBATASI };
  }

  const gagal = async (alasan: string, sippUserId: string, pesan: string, status: 401 | 403 = 401): Promise<KeputusanMasuk> => {
    recordRateLimitFailure("login", permintaan, identitas);
    catatGagalSipp(usernameSipp);
    await jejak({ aletaUserId: pengguna.id, usernameSipp, sippUserId, lewat: "", hasil: "ditolak", alasan });
    return { jenis: "tolak", status, kode: status === 403 ? "SIPP_NONAKTIF" : "SANDI_SALAH", pesan };
  };

  const berhasil = async (lewat: "sipp" | "aleta", sippUserId: string, alasan: string, catatan: string): Promise<KeputusanMasuk> => {
    clearRateLimit("login", permintaan, identitas);
    batasSipp.delete(kunciSipp(usernameSipp));
    await jejak({ aletaUserId: pengguna.id, usernameSipp, sippUserId, lewat, hasil: "berhasil", alasan });
    return { jenis: "masuk", userId: pengguna.id, lewat, usernameSipp, catatan };
  };

  const jawaban = await deps.verifikasiSipp(usernameSipp, sandi);

  if (!jawaban.ok) {
    // Bot/SIPP tidak terjangkau BUKAN berarti passwordnya salah.
    if (await deps.verifikasiSandiAleta(pengguna.id, sandi)) {
      return berhasil("aleta", "", "sipp_tak_terjangkau", "SIPP belum dapat dihubungi; masuk memakai password ALETA.");
    }
    return gagal(
      "sipp_tak_terjangkau",
      "",
      "SIPP belum dapat dihubungi untuk mencocokkan password, dan password ini tidak cocok dengan password ALETA. Coba lagi sebentar lagi."
    );
  }

  const data = jawaban.data ?? {};
  const sippUserId = String(data.sippUserId ?? "").slice(0, 40);

  if (data.ditemukan && (data.diblokir || data.kedaluwarsa)) {
    const sebab = data.diblokir ? "sipp_diblokir" : "sipp_kedaluwarsa";
    const sandiAletaBenar = await deps.verifikasiSandiAleta(pengguna.id, sandi);
    // Keadaan "nonaktif" hanya disebut kepada yang membuktikan dirinya pemilik
    // akun (password SIPP atau ALETA benar) - urutan SIPP sendiri: password
    // dulu, baru blokir. Penebak hanya mendapat "password salah" (9 Okt 2026).
    if (!data.cocok && !sandiAletaBenar) {
      return gagal("sandi_salah", sippUserId, PESAN_SANDI_SALAH);
    }
    if (pengguna.roleId === "super-admin" && sandiAletaBenar) {
      return berhasil("aleta", sippUserId, `${sebab}_super_admin`, "Akun SIPP tertaut sedang nonaktif; Super Admin masuk memakai password ALETA.");
    }
    return gagal(sebab, sippUserId, pesanSippNonaktif(data.diblokir === true), 403);
  }

  if (data.ditemukan && data.cocok) {
    return berhasil("sipp", sippUserId, "sandi_sipp_cocok", "");
  }

  // Tidak cocok dengan SIPP (atau username SIPP-nya sudah tidak terdaftar):
  // password ALETA tetap berlaku - fitur lama tidak dikurangi.
  if (await deps.verifikasiSandiAleta(pengguna.id, sandi)) {
    return berhasil(
      "aleta",
      sippUserId,
      data.ditemukan ? "sandi_aleta" : "sipp_tidak_terdaftar",
      data.ditemukan ? "" : "Username SIPP tertaut tidak ditemukan di SIPP; masuk memakai password ALETA."
    );
  }
  return gagal(data.ditemukan ? "sandi_salah" : "sipp_tidak_terdaftar", sippUserId, PESAN_SANDI_SALAH);
}

// ---------------------------------------------------------------------------
// JALUR LAMA (/sign-in/email) IKUT TERTUTUP BAGI AKUN SIPP NONAKTIF (9 Okt 2026)
// ---------------------------------------------------------------------------
//
// Layar masuk tidak memanggil /sign-in/email untuk akun bertautan, tetapi
// rutenya tetap terbuka (klien lama, ekstensi lama, panggilan langsung). Tanpa
// pemeriksaan ini pegawai yang akun SIPP-nya diblokir tetap masuk ALETA dengan
// password ALETA - aturan "AKUN SIPP NONAKTIF = ALETA TERTUTUP" bocor.
//
// Pengecualian yang SAMA dengan jalur SIPP: Super Admin tetap boleh, bot/SIPP
// tidak terjangkau = lolos (bot mati tidak mengunci kantor), dan keadaan
// "nonaktif" hanya disebut bila password ALETA-nya memang benar - password
// yang salah dibiarkan ditolak Better Auth seperti biasa.

export type DepsJalurLama = Pick<DepsMasukSipp, "akunSippMilik" | "verifikasiSipp" | "verifikasiSandiAleta" | "catatJejak">;

export async function periksaSippNonaktifJalurLama(
  deps: DepsJalurLama,
  masukan: { pengguna: PenggunaMasuk; identitas: string; sandi: string },
  konteks: KonteksMasuk,
  env: Record<string, string | undefined> = process.env
): Promise<null | { status: 403; kode: "SIPP_NONAKTIF"; pesan: string }> {
  if (!masukSippDinyalakan(env)) return null;
  const { pengguna } = masukan;
  if (pengguna.roleId === "super-admin") return null;
  const sandi = String(masukan.sandi ?? "");
  if (!sandi) return null;

  const milik = await deps.akunSippMilik(pengguna.id);
  if (milik.length !== 1) return null;
  const usernameSipp = milik[0];

  const jawaban = await deps.verifikasiSipp(usernameSipp, sandi);
  if (!jawaban.ok) return null;
  const data = jawaban.data ?? {};
  if (!data.ditemukan || !(data.diblokir || data.kedaluwarsa)) return null;
  if (!(await deps.verifikasiSandiAleta(pengguna.id, sandi))) return null;

  const sebab = data.diblokir ? "sipp_diblokir" : "sipp_kedaluwarsa";
  await deps
    .catatJejak({
      aletaUserId: pengguna.id,
      identitas: String(masukan.identitas ?? "").trim().slice(0, 200),
      usernameSipp,
      sippUserId: String(data.sippUserId ?? "").slice(0, 40),
      lewat: "aleta",
      hasil: "ditolak",
      alasan: `${sebab}_jalur_lama`,
      alamatIp: alamatIp(konteks.headers),
      agenPeramban: (konteks.headers.get("user-agent") ?? "").slice(0, 240),
    })
    .catch((galat) => {
      console.warn("[ALETA MASUK SIPP] jejak masuk tidak tertulis:", galat instanceof Error ? galat.message : "tidak diketahui");
    });
  return { status: 403, kode: "SIPP_NONAKTIF", pesan: pesanSippNonaktif(data.diblokir === true) };
}
