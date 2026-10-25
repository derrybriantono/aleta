import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { type UserPersona } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { langkahKeduaTerdaftar } from "@/server/modules/keamanan/kait";
import { bacaSetelanAwalan, benar, bulatDalam, tulisSetelan } from "@/server/modules/keamanan/setelan";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";
import { hashSecret } from "@/server/shared/security";

/**
 * ============================================================================
 * PENGAMAN AKSI ADMIN (25 Okt 2026, Bagian 6c) - saklar MATI bawaan
 * ============================================================================
 *
 * Aksi yang berdampak besar (mengubah hak peran, mengangkat Admin/Super Admin,
 * mengubah masa simpan audit, menghapus banyak baris, memulihkan cadangan,
 * mengubah batas perangkat/jaringan, ...) meminta tiga hal sebelum dijalankan:
 *
 *   1. SANDI ULANG pelaku (diperiksa terhadap hash akunnya, dengan pembatas laju);
 *   2. KATA KONFIRMASI yang diketik (mis. UBAH HAK) - mencegah klik tak sengaja;
 *   3. bila diaktifkan dan kaitnya terpasang: KODE LANGKAH KEDUA (WhatsApp/
 *      authenticator, rantai E5). Tanpa pendaftar kait, langkah ini dilewati.
 *
 * Selama saklar mati, tegakkanPengaman TIDAK berbuat apa pun - perilaku semua
 * rute persis seperti dulu. Saklar mati tidak menyentuh basis data lebih dari
 * satu pembacaan setelan.
 *
 * Kiriman: header x-aleta-pengaman-sandi / -ketik / -kode (bukan badan, supaya
 * berlaku untuk POST, PUT, PATCH, dan DELETE; header tidak ikut tercatat di log
 * Apache). Tanpa kiriman -> 403 berisi details { alasan: "pengaman_aksi", ... }
 * yang dibaca klien untuk memunculkan kotak konfirmasi lalu mengulang permintaan.
 *
 * Semua hasil (diminta, salah, lolos) tercatat lewat appendAuditLog. Sandi tidak
 * pernah dicatat, dikembalikan, atau ditulis ke log.
 */

export const HEADER_PENGAMAN = {
  sandi: "x-aleta-pengaman-sandi",
  ketik: "x-aleta-pengaman-ketik",
  kode: "x-aleta-pengaman-kode",
} as const;

export type AksiBerdampak = {
  label: string;
  /** Kata yang harus diketik pelaku. */
  kataKonfirmasi: string;
  keterangan: string;
  /** false = rute pemanggilnya belum ada di ALETA (menyambung ke fitur lain); katalog tetap memuatnya. */
  tersambung: boolean;
};

export const KATALOG_PENGAMAN = {
  "peran.ubah-hak": {
    label: "Mengubah hak peran atau akses menu",
    kataKonfirmasi: "UBAH HAK",
    keterangan: "Satu tombol dapat membuka atau menutup aplikasi bagi seluruh pegawai satu peran.",
    tersambung: true,
  },
  "akun.angkat-admin": {
    label: "Mengangkat Admin atau Super Admin",
    kataKonfirmasi: "ANGKAT ADMIN",
    keterangan: "Admin dan Super Admin dapat melihat dan mengubah hampir semua yang ada di ALETA.",
    tersambung: true,
  },
  "audit.ubah-retensi": {
    label: "Mengubah masa simpan riwayat masuk (audit)",
    kataKonfirmasi: "UBAH AUDIT",
    keterangan: "Memperpendek masa simpan menghapus jejak lama saat pembersihan berikutnya.",
    tersambung: true,
  },
  "hapus.massal": {
    label: "Menghapus banyak berkas atau baris sekaligus",
    kataKonfirmasi: "HAPUS MASSAL",
    keterangan: "Penghapusan berkas perkara tidak dapat ditarik kembali.",
    tersambung: true,
  },
  "cadangan.pulihkan": {
    label: "Memulihkan cadangan",
    kataKonfirmasi: "PULIHKAN",
    keterangan: "Memulihkan cadangan menimpa data yang sedang berjalan. (Belum ada tombol pulihkan di ALETA; dipakai begitu ada.)",
    tersambung: false,
  },
  "perangkat.ubah-batas": {
    label: "Mengubah batas perangkat",
    kataKonfirmasi: "UBAH BATAS",
    keterangan: "Batas yang terlalu kecil mengeluarkan banyak pegawai dari ALETA sekaligus.",
    tersambung: true,
  },
  "jaringan.ubah-batas": {
    label: "Mengubah batas jaringan",
    kataKonfirmasi: "UBAH JARINGAN",
    keterangan: "Aturan jaringan yang salah dapat mengunci pegawai dari luar kantor.",
    tersambung: true,
  },
  "sandi.ubah-kebijakan": {
    label: "Mengubah kebijakan sandi",
    kataKonfirmasi: "UBAH SANDI",
    keterangan: "Kebijakan baru berlaku untuk seluruh pegawai pada penggantian sandi berikutnya.",
    tersambung: true,
  },
  "pengaman.ubah": {
    label: "Mengubah pengaman aksi admin",
    kataKonfirmasi: "UBAH PENGAMAN",
    keterangan: "Mematikan pengaman membuka kembali aksi berdampak besar tanpa konfirmasi.",
    tersambung: true,
  },
  "lihat-sebagai": {
    label: "Lihat sebagai pengguna lain",
    kataKonfirmasi: "LIHAT SEBAGAI",
    keterangan: "Melihat ALETA dengan mata pengguna lain. (Menyambung ke fitur Lihat sebagai begitu digabung.)",
    tersambung: false,
  },
  "otp.nyalakan": {
    label: "Menyalakan verifikasi dua langkah (OTP)",
    kataKonfirmasi: "NYALAKAN OTP",
    keterangan: "Pegawai tanpa nomor WhatsApp yang benar dapat terkunci. (Menyambung ke OTP begitu digabung.)",
    tersambung: false,
  },
} as const satisfies Record<string, AksiBerdampak>;

export type KodeAksiBerdampak = keyof typeof KATALOG_PENGAMAN;

export type SetelanPengaman = {
  aktif: boolean;
  /** Aksi yang dijaga bila saklar menyala (bawaan semua). */
  aksi: Record<KodeAksiBerdampak, boolean>;
  /** Hapus massal: lebih dari ini = berdampak besar. */
  batasHapus: number;
  /** Minta kode langkah kedua bila kaitnya terpasang dan aktor punya cara memberinya. */
  langkahKedua: boolean;
};

export const BATAS_HAPUS_BAWAAN = 20;

export function kodeAksiBerdampak(): KodeAksiBerdampak[] {
  return Object.keys(KATALOG_PENGAMAN) as KodeAksiBerdampak[];
}

export async function bacaPengaman(db: AletaDatabase): Promise<SetelanPengaman> {
  const b = await bacaSetelanAwalan(db, "pengaman.");
  const aksi = {} as Record<KodeAksiBerdampak, boolean>;
  for (const kode of kodeAksiBerdampak()) aksi[kode] = benar(b[`pengaman.aksi.${kode}`], true);
  return {
    aktif: benar(b["pengaman.aktif"], false),
    aksi,
    batasHapus: bulatDalam(b["pengaman.hapus_batas"], 1, 100_000, BATAS_HAPUS_BAWAAN),
    langkahKedua: benar(b["pengaman.langkah_kedua"], false),
  };
}

export type UbahPengaman = {
  aktif?: boolean;
  aksi?: Partial<Record<KodeAksiBerdampak, boolean>>;
  batasHapus?: number;
  langkahKedua?: boolean;
};

export async function simpanPengaman(db: AletaDatabase, ubah: UbahPengaman, olehId: string, kini = new Date()) {
  const pasangan: Array<[string, string]> = [];
  if (ubah.aktif !== undefined) pasangan.push(["pengaman.aktif", ubah.aktif ? "1" : "0"]);
  if (ubah.langkahKedua !== undefined) pasangan.push(["pengaman.langkah_kedua", ubah.langkahKedua ? "1" : "0"]);
  if (ubah.batasHapus !== undefined) {
    const n = Number(ubah.batasHapus);
    if (!Number.isFinite(n) || Math.round(n) !== n || n < 1 || n > 100_000) throw new Error("Batas hapus massal harus bilangan bulat 1-100000.");
    pasangan.push(["pengaman.hapus_batas", String(n)]);
  }
  if (ubah.aksi) {
    for (const [kode, nilai] of Object.entries(ubah.aksi)) {
      if (!(kode in KATALOG_PENGAMAN)) throw new Error(`Aksi pengaman "${kode.slice(0, 40)}" tidak dikenal.`);
      pasangan.push([`pengaman.aksi.${kode}`, nilai ? "1" : "0"]);
    }
  }
  if (pasangan.length) await tulisSetelan(db, pasangan, olehId, kini);
  return bacaPengaman(db);
}

// ─── Penegakan ───────────────────────────────────────────────────────────────

export const ALASAN_PENGAMAN = "pengaman_aksi";

export type PermintaanPengaman = {
  alasan: typeof ALASAN_PENGAMAN;
  kode: KodeAksiBerdampak;
  label: string;
  kataKonfirmasi: string;
  perluKodeKedua: boolean;
  /** Kalimat mengapa percobaan sebelumnya ditolak (kosong pada permintaan pertama). */
  salah: string;
};

async function catat(db: AletaDatabase, aktor: UserPersona, aksi: string, kode: string, payload: Record<string, unknown>) {
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: aksi,
      entityType: "security_confirmation",
      entityId: kode,
      payload,
    });
  } catch (galat) {
    console.warn("[PENGAMAN AKSI] audit tidak tercatat:", galat instanceof Error ? galat.message : "tidak diketahui");
  }
}

function tolak(kode: KodeAksiBerdampak, perluKodeKedua: boolean, salah: string, pesan: string) {
  const a = KATALOG_PENGAMAN[kode];
  const rincian: PermintaanPengaman = { alasan: ALASAN_PENGAMAN, kode, label: a.label, kataKonfirmasi: a.kataKonfirmasi, perluKodeKedua, salah };
  return new ApiError(403, pesan, rincian);
}

/**
 * Menegakkan pengaman untuk satu aksi berdampak besar. Panggil di rute SESUDAH
 * penjaga hak (matriks peran) dan SEBELUM menulis. Tidak berbuat apa pun bila:
 *   - saklar pengaman mati, atau aksi ini dimatikan satu per satu;
 *   - aktor bukan Admin/Super Admin (penjaga hak lama yang menolak mereka);
 *   - aksi hapus massal dengan `jumlah` tidak melebihi batas.
 * Melempar ApiError 403 (details.alasan = "pengaman_aksi") bila kiriman kurang atau salah.
 */
export async function tegakkanPengaman(
  db: AletaDatabase,
  request: NextRequest | Request,
  aktor: UserPersona,
  kode: KodeAksiBerdampak,
  opsi: { jumlah?: number; rincian?: Record<string, unknown> } = {}
): Promise<void> {
  const s = await bacaPengaman(db);
  if (!s.aktif || !s.aksi[kode]) return;
  if (!isPrivilegedAdmin(aktor)) return;
  if (kode === "hapus.massal" && opsi.jumlah !== undefined && opsi.jumlah <= s.batasHapus) return;

  const kait = langkahKeduaTerdaftar();
  const perluKodeKedua = Boolean(s.langkahKedua && kait && (await kait.tersedia(db, aktor).catch(() => false)));
  const sandi = request.headers.get(HEADER_PENGAMAN.sandi) ?? "";
  const ketik = (request.headers.get(HEADER_PENGAMAN.ketik) ?? "").trim();
  const kodeKedua = (request.headers.get(HEADER_PENGAMAN.kode) ?? "").trim();
  const kata = KATALOG_PENGAMAN[kode].kataKonfirmasi;

  if (!sandi && !ketik) {
    await catat(db, aktor, "SECURITY_CONFIRM_REQUESTED", kode, { rincian: opsi.rincian ?? null });
    throw tolak(kode, perluKodeKedua, "", `${KATALOG_PENGAMAN[kode].label} meminta konfirmasi: masukkan sandi Anda dan ketik "${kata}".`);
  }

  assertRateLimit("pengaman-aksi", request as NextRequest, aktor.id);
  const baris = await db.queryOne<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL", [aktor.id]);
  const sandiBenar = Boolean(baris?.password_hash && sandi && baris.password_hash === hashSecret(sandi));
  if (!sandiBenar) {
    recordRateLimitFailure("pengaman-aksi", request as NextRequest, aktor.id);
    await catat(db, aktor, "SECURITY_CONFIRM_FAILED", kode, { sebab: "sandi" });
    throw tolak(kode, perluKodeKedua, "Sandi tidak cocok.", "Sandi yang Anda masukkan tidak cocok.");
  }
  if (ketik.toLowerCase() !== kata.toLowerCase()) {
    await catat(db, aktor, "SECURITY_CONFIRM_FAILED", kode, { sebab: "kata-konfirmasi" });
    throw tolak(kode, perluKodeKedua, "Kata konfirmasi belum sama.", `Ketik persis "${kata}" untuk melanjutkan.`);
  }
  if (perluKodeKedua && kait) {
    const kodeBenar = kodeKedua ? await kait.periksa(db, aktor, kodeKedua).catch(() => false) : false;
    if (!kodeBenar) {
      recordRateLimitFailure("pengaman-aksi", request as NextRequest, aktor.id);
      await catat(db, aktor, "SECURITY_CONFIRM_FAILED", kode, { sebab: "kode-kedua" });
      throw tolak(kode, true, kodeKedua ? "Kode tidak cocok." : "Kode belum diisi.", "Masukkan kode langkah kedua yang dikirim kepada Anda.");
    }
  }
  clearRateLimit("pengaman-aksi", request as NextRequest, aktor.id);
  await catat(db, aktor, "SECURITY_CONFIRM_PASSED", kode, { rincian: opsi.rincian ?? null, langkahKedua: perluKodeKedua });
}
