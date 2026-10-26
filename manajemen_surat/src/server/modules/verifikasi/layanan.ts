import crypto, { randomInt } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import {
  aturanUntukPeran,
  bacaPengaturanVerifikasi,
  ipDiKantorEfektif,
  saklarMenyala,
  type PengaturanVerifikasi,
} from "@/server/modules/verifikasi/pengaturan";
import { dekripsiRahasia, enkripsiRahasia, hashKode } from "@/server/modules/verifikasi/rahasia";
import { buatRahasiaTotp, langkahDariWaktu, periksaKodeTotp, uriOtpauth } from "@/server/modules/verifikasi/totp";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * VERIFIKASI DUA LANGKAH: LAYANAN (E5, admin 6 - 25 Okt 2026)
 * ============================================================================
 *
 * Kait masuk (perangkat/kait-auth.ts) memanggil putuskanMasuk SESUDAH password
 * terbukti benar. Bila kode diperlukan, sesi TIDAK dibuat; yang diterbitkan
 * adalah tiket (10 menit). Layar masuk lalu meminta kode lewat tiket itu
 * (/api/portal/verifikasi/*, tanpa sesi), dan sesudah lolos mengulang masuk -
 * kali ini kait menemukan catatan "lolos" untuk akun + perangkat itu.
 *
 * SALURAN KODE: OTP WhatsApp (6 angka, 5 menit, sekali kirim per 60 detik, lima
 * kali per tiket), authenticator TOTP, atau kode cadangan dari admin. Lima
 * kesalahan menghanguskan tiket. Semua hasil tercatat di audit.
 *
 * GAGAL TERBUKA: gangguan basis data atau akun yang tidak punya cara menerima
 * kode TIDAK mengunci siapa pun di luar; kejadiannya dicatat.
 */
export const MASA_TANTANGAN_MENIT = 10;
export const MASA_KODE_WA_MENIT = 5;
export const JEDA_KIRIM_DETIK = 60;
export const MAKS_KIRIM_PER_TANTANGAN = 5;
export const MAKS_PERCOBAAN = 5;
export const MASA_LOLOS_SEKALI_MENIT = 5;
export const JUMLAH_KODE_CADANGAN = 8;

export type MetodeVerifikasi = "whatsapp" | "authenticator" | "cadangan";

export const PESAN_TANTANGAN: Record<string, string> = {
  "tidak-dikenal": "Permintaan kode tidak dikenal. Silakan masuk lagi.",
  kedaluwarsa: "Waktu memasukkan kode (10 menit) sudah habis. Silakan masuk lagi.",
  selesai: "Verifikasi ini sudah selesai. Silakan masuk lagi.",
  "perangkat-lain": "Permintaan kode ini milik perangkat lain. Silakan masuk lagi dari perangkat ini.",
  terkunci: "Terlalu banyak kode yang salah. Silakan masuk lagi untuk mendapat permintaan baru.",
};

const iso = (d: Date) => d.toISOString();
const tambahMenit = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

// ---------------------------------------------------------------------------
// Data akun
// ---------------------------------------------------------------------------

type BarisAkun = { id: string; name: string; role_id: string; whatsapp_number: string };

async function akun(db: AletaDatabase, userId: string): Promise<BarisAkun | null> {
  const b = await db.queryOne<BarisAkun>("SELECT id, name, role_id, whatsapp_number FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
  return b ?? null;
}

const nomorSah = (n: string) => String(n ?? "").replace(/\D/g, "").length >= 8;

export function samarkanNomor(n: string): string {
  const d = String(n ?? "").replace(/\D/g, "");
  return d.length < 6 ? "" : `${d.slice(0, 4)}${"*".repeat(Math.max(0, d.length - 7))}${d.slice(-3)}`;
}

type BarisAuthenticator = { user_id: string; rahasia_enc: string; aktif: number | string | boolean; dibuat_pada: string; aktif_pada: string; langkah_terakhir: number | string };

async function barisAuthenticator(db: AletaDatabase, userId: string): Promise<BarisAuthenticator | null> {
  return (await db.queryOne<BarisAuthenticator>("SELECT * FROM aleta_verifikasi_authenticator WHERE user_id = ?", [userId])) ?? null;
}

const aktifBenar = (v: unknown) => Number(v) === 1 || v === true;

export async function authenticatorAktif(db: AletaDatabase, userId: string): Promise<boolean> {
  const b = await barisAuthenticator(db, userId);
  return Boolean(b && aktifBenar(b.aktif));
}

export async function sisaKodeCadangan(db: AletaDatabase, userId: string): Promise<number> {
  const b = await db.queryOne<{ n: number | string }>("SELECT COUNT(*) AS n FROM aleta_verifikasi_kode_cadangan WHERE user_id = ? AND dipakai_pada = ''", [userId]);
  return Number(b?.n ?? 0);
}

// ---------------------------------------------------------------------------
// Perangkat tepercaya dan "lolos"
// ---------------------------------------------------------------------------

export type JenisLolos = "sekali" | "tepercaya";

export async function catatLolos(db: AletaDatabase, m: { userId: string; perangkatId: string; jenis: JenisLolos; metode: string; sampai: Date; kini?: Date }) {
  await db.run(
    `INSERT INTO aleta_verifikasi_lolos (user_id, perangkat_id, jenis, metode, dibuat_pada, sampai) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, perangkat_id, jenis) DO UPDATE SET metode = excluded.metode, dibuat_pada = excluded.dibuat_pada, sampai = excluded.sampai`,
    [m.userId, m.perangkatId, m.jenis, m.metode, iso(m.kini ?? new Date()), iso(m.sampai)]
  );
}

export async function adaLolos(db: AletaDatabase, userId: string, perangkatId: string, jenis: JenisLolos, kini: Date): Promise<boolean> {
  if (!perangkatId) return false;
  const b = await db.queryOne<{ sampai: string }>("SELECT sampai FROM aleta_verifikasi_lolos WHERE user_id = ? AND perangkat_id = ? AND jenis = ?", [userId, perangkatId, jenis]);
  return Boolean(b && Date.parse(b.sampai) > kini.getTime());
}

/** Lolos 'sekali' dipakai tepat sekali (atomik). */
export async function pakaiLolosSekali(db: AletaDatabase, userId: string, perangkatId: string, kini: Date): Promise<boolean> {
  if (!perangkatId) return false;
  const r = await db.run("DELETE FROM aleta_verifikasi_lolos WHERE user_id = ? AND perangkat_id = ? AND jenis = 'sekali' AND sampai > ?", [userId, perangkatId, iso(kini)]);
  return r.changes >= 1;
}

export type PerangkatTepercaya = { perangkatId: string; metode: string; dibuatPada: string; sampai: string };

export async function daftarPerangkatTepercaya(db: AletaDatabase, userId: string, kini: Date = new Date()): Promise<PerangkatTepercaya[]> {
  const baris = await db.queryAll<{ perangkat_id: string; metode: string; dibuat_pada: string; sampai: string }>(
    "SELECT perangkat_id, metode, dibuat_pada, sampai FROM aleta_verifikasi_lolos WHERE user_id = ? AND jenis = 'tepercaya' AND sampai > ? ORDER BY dibuat_pada DESC",
    [userId, iso(kini)]
  );
  return baris.map((b) => ({ perangkatId: b.perangkat_id, metode: b.metode, dibuatPada: b.dibuat_pada, sampai: b.sampai }));
}

export async function cabutPerangkatTepercaya(db: AletaDatabase, userId: string, perangkatId?: string): Promise<number> {
  const r = perangkatId
    ? await db.run("DELETE FROM aleta_verifikasi_lolos WHERE user_id = ? AND perangkat_id = ? AND jenis = 'tepercaya'", [userId, perangkatId])
    : await db.run("DELETE FROM aleta_verifikasi_lolos WHERE user_id = ? AND jenis = 'tepercaya'", [userId]);
  return r.changes;
}

// ---------------------------------------------------------------------------
// Keputusan: apakah masuk ini perlu kode?
// ---------------------------------------------------------------------------

export type KeputusanMasuk =
  | { perlu: false; sebab: "saklar-mati" | "aturan-mati" | "dalam-kantor" | "tepercaya" | "lolos-sekali" | "tanpa-metode" | "tidak-didaftarkan" | "akun-tak-dikenal" }
  | { perlu: true; sebab: "perangkat-baru" | "luar-kantor"; metode: MetodeVerifikasi[] };

/** Metode yang SAAT INI sah untuk akun ini (saklar menyala DAN akun punya sarananya). */
export async function metodeTersedia(db: AletaDatabase, p: PengaturanVerifikasi, a: BarisAkun): Promise<MetodeVerifikasi[]> {
  const m: MetodeVerifikasi[] = [];
  if (p.authenticator && (await authenticatorAktif(db, a.id))) m.push("authenticator");
  if (p.otpWhatsapp && nomorSah(a.whatsapp_number)) m.push("whatsapp");
  if (m.length > 0 && (await sisaKodeCadangan(db, a.id)) > 0) m.push("cadangan");
  return m;
}

/**
 * Putusan murni atas keadaan sekarang. `konsumsi` = bila ada catatan lolos
 * 'sekali', pakai (hanya kait masuk yang mengonsumsi; pemeriksaan tampilan tidak).
 */
export async function putuskanMasuk(
  db: AletaDatabase,
  m: { userId: string; perangkatId: string; ip: string; kini?: Date; konsumsi?: boolean }
): Promise<KeputusanMasuk> {
  const kini = m.kini ?? new Date();
  const p = await bacaPengaturanVerifikasi(db);
  if (!saklarMenyala(p)) return { perlu: false, sebab: "saklar-mati" };

  const a = await akun(db, m.userId);
  if (!a) return { perlu: false, sebab: "akun-tak-dikenal" };

  if (m.konsumsi ? await pakaiLolosSekali(db, m.userId, m.perangkatId, kini) : await adaLolos(db, m.userId, m.perangkatId, "sekali", kini)) {
    return { perlu: false, sebab: "lolos-sekali" };
  }

  const aturan = aturanUntukPeran(p, a.role_id);
  if (aturan === "mati") return { perlu: false, sebab: "aturan-mati" };
  const punyaAuthenticator = p.authenticator && (await authenticatorAktif(db, a.id));
  if (aturan === "opsional" && !punyaAuthenticator) return { perlu: false, sebab: "tidak-didaftarkan" };

  if (await adaLolos(db, m.userId, m.perangkatId, "tepercaya", kini)) return { perlu: false, sebab: "tepercaya" };

  const diKantor = await ipDiKantorEfektif(db, m.ip, p);
  if (aturan === "luar-kantor" && diKantor) return { perlu: false, sebab: "dalam-kantor" };

  const metode = await metodeTersedia(db, p, a);
  if (metode.length === 0) return { perlu: false, sebab: "tanpa-metode" };
  return { perlu: true, sebab: diKantor ? "perangkat-baru" : "luar-kantor", metode };
}

// ---------------------------------------------------------------------------
// Tantangan (tiket)
// ---------------------------------------------------------------------------

const hashTiket = (tiket: string) => crypto.createHash("sha256").update(String(tiket ?? "")).digest("hex");

export async function terbitkanTantangan(db: AletaDatabase, m: { userId: string; perangkatId: string; jalur: string; kini?: Date }): Promise<string> {
  const kini = m.kini ?? new Date();
  const tiket = crypto.randomBytes(24).toString("base64url");
  await db.run(
    "INSERT INTO aleta_verifikasi_tantangan (id, user_id, perangkat_id, jalur, dibuat_pada, kedaluwarsa_pada) VALUES (?, ?, ?, ?, ?, ?)",
    [hashTiket(tiket), m.userId, m.perangkatId, m.jalur, iso(kini), iso(tambahMenit(kini, MASA_TANTANGAN_MENIT))]
  );
  return tiket;
}

type BarisTantangan = {
  id: string;
  user_id: string;
  perangkat_id: string;
  jalur: string;
  dibuat_pada: string;
  kedaluwarsa_pada: string;
  percobaan: number | string;
  kode_wa_hash: string;
  kode_wa_kedaluwarsa: string;
  kirim_terakhir: string;
  jumlah_kirim: number | string;
  selesai_pada: string;
};

export type PeriksaTantangan = { sah: true; baris: BarisTantangan } | { sah: false; sebab: keyof typeof PESAN_TANTANGAN };

export async function periksaTantangan(db: AletaDatabase, tiket: string, perangkatId: string, kini: Date = new Date()): Promise<PeriksaTantangan> {
  const b = await db.queryOne<BarisTantangan>("SELECT * FROM aleta_verifikasi_tantangan WHERE id = ?", [hashTiket(tiket)]);
  if (!b) return { sah: false, sebab: "tidak-dikenal" };
  if (b.selesai_pada) return { sah: false, sebab: "selesai" };
  if (Date.parse(b.kedaluwarsa_pada) <= kini.getTime()) return { sah: false, sebab: "kedaluwarsa" };
  if (b.perangkat_id && b.perangkat_id !== perangkatId) return { sah: false, sebab: "perangkat-lain" };
  if (Number(b.percobaan) >= MAKS_PERCOBAAN) return { sah: false, sebab: "terkunci" };
  return { sah: true, baris: b };
}

/** Yang dilihat layar masuk: metode apa yang tersedia dan nomor WhatsApp tersamar. */
export async function infoTantangan(db: AletaDatabase, tiket: string, perangkatId: string, kini: Date = new Date()) {
  const t = await periksaTantangan(db, tiket, perangkatId, kini);
  if (!t.sah) throw new ApiError(400, PESAN_TANTANGAN[t.sebab], { kode: `VERIFIKASI_${t.sebab.toUpperCase().replace(/-/g, "_")}` });
  const p = await bacaPengaturanVerifikasi(db);
  const a = await akun(db, t.baris.user_id);
  if (!a) throw new ApiError(400, PESAN_TANTANGAN["tidak-dikenal"]);
  return {
    metode: await metodeTersedia(db, p, a),
    nomor: samarkanNomor(a.whatsapp_number),
    masaTepercayaHari: p.masaTepercayaHari,
    sisaPercobaan: MAKS_PERCOBAAN - Number(t.baris.percobaan),
  };
}

export type KirimWa = (m: { nomor: string; nama: string; pesan: string; kunci: string }) => Promise<void>;

async function kirimWaBawaan(m: { nomor: string; nama: string; pesan: string; kunci: string }) {
  const { sendPortalWhatsappMessage } = await import("@/server/modules/whatsapp/portal-whatsapp-sender");
  const h = await sendPortalWhatsappMessage({
    sourceFeature: "verifikasi_dua_langkah",
    entityType: "user",
    entityId: m.kunci,
    eventType: "kode_masuk",
    recipientNumber: m.nomor,
    recipientName: m.nama,
    message: m.pesan,
    category: "employee",
    priority: 1,
  });
  if (!h.ok || h.status === "skipped") throw new Error(h.message || "WhatsApp tidak mengirim pesan.");
}

/** Mengirim kode WhatsApp untuk sebuah tantangan. Jeda 60 detik, paling banyak 5 kali. */
export async function kirimKodeWhatsapp(
  db: AletaDatabase,
  tantangan: BarisTantangan,
  opsi: { kirim?: KirimWa; kini?: Date } = {}
): Promise<{ nomor: string; berlakuMenit: number }> {
  const kini = opsi.kini ?? new Date();
  const p = await bacaPengaturanVerifikasi(db);
  if (!p.otpWhatsapp) throw new ApiError(400, "Kode lewat WhatsApp sedang tidak dipakai. Pilih cara lain.");
  const a = await akun(db, tantangan.user_id);
  if (!a || !nomorSah(a.whatsapp_number)) throw new ApiError(400, "Akun ini belum punya nomor WhatsApp. Pilih cara lain atau minta kode cadangan dari admin.");
  if (Number(tantangan.jumlah_kirim) >= MAKS_KIRIM_PER_TANTANGAN) throw new ApiError(429, "Kode WhatsApp sudah dikirim terlalu sering. Silakan masuk lagi nanti.");
  if (tantangan.kirim_terakhir && kini.getTime() - Date.parse(tantangan.kirim_terakhir) < JEDA_KIRIM_DETIK * 1000) {
    throw new ApiError(429, `Tunggu ${JEDA_KIRIM_DETIK} detik sebelum meminta kode lagi.`);
  }
  const kode = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const pesan =
    `Kode masuk ALETA Anda: *${kode}*. Berlaku ${MASA_KODE_WA_MENIT} menit. ` +
    "Jangan bagikan kode ini kepada siapa pun, termasuk admin. Abaikan pesan ini bila Anda tidak sedang masuk.";
  // Dicatat SEBELUM dikirim; gagal kirim membatalkan kodenya.
  await db.run(
    "UPDATE aleta_verifikasi_tantangan SET kode_wa_hash = ?, kode_wa_kedaluwarsa = ?, kirim_terakhir = ?, jumlah_kirim = jumlah_kirim + 1 WHERE id = ?",
    [hashKode(tantangan.user_id, "wa", kode), iso(tambahMenit(kini, MASA_KODE_WA_MENIT)), iso(kini), tantangan.id]
  );
  try {
    await (opsi.kirim ?? kirimWaBawaan)({ nomor: a.whatsapp_number, nama: a.name, pesan, kunci: tantangan.id.slice(0, 12) });
  } catch {
    await db.run("UPDATE aleta_verifikasi_tantangan SET kode_wa_hash = '', kode_wa_kedaluwarsa = '' WHERE id = ?", [tantangan.id]);
    throw new ApiError(502, "WhatsApp belum dapat mengirim kode. Pilih cara lain atau minta kode cadangan dari admin.");
  }
  return { nomor: samarkanNomor(a.whatsapp_number), berlakuMenit: MASA_KODE_WA_MENIT };
}

// ---------------------------------------------------------------------------
// Memeriksa kode
// ---------------------------------------------------------------------------

async function cocokAuthenticator(db: AletaDatabase, userId: string, kode: string, kini: Date): Promise<boolean> {
  const b = await barisAuthenticator(db, userId);
  if (!b || !aktifBenar(b.aktif)) return false;
  let rahasia: string;
  try {
    rahasia = dekripsiRahasia(b.rahasia_enc);
  } catch {
    return false;
  }
  const langkah = periksaKodeTotp(rahasia, kode, kini, Number(b.langkah_terakhir));
  if (langkah === null) return false;
  // Atomik: hanya satu pemakaian per langkah.
  const r = await db.run("UPDATE aleta_verifikasi_authenticator SET langkah_terakhir = ? WHERE user_id = ? AND langkah_terakhir < ?", [langkah, userId, langkah]);
  return r.changes === 1;
}

function bersihkanKodeCadangan(kode: string) {
  return String(kode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function cocokKodeCadangan(db: AletaDatabase, userId: string, kode: string, kini: Date): Promise<boolean> {
  const bersih = bersihkanKodeCadangan(kode);
  if (bersih.length < 8) return false;
  const r = await db.run("UPDATE aleta_verifikasi_kode_cadangan SET dipakai_pada = ? WHERE user_id = ? AND kode_hash = ? AND dipakai_pada = ''", [
    iso(kini),
    userId,
    hashKode(userId, "cadangan", bersih),
  ]);
  return r.changes === 1;
}

function cocokKodeWa(t: BarisTantangan, kode: string, kini: Date): boolean {
  const bersih = String(kode ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(bersih) || !t.kode_wa_hash) return false;
  if (Date.parse(t.kode_wa_kedaluwarsa) <= kini.getTime()) return false;
  const a = Buffer.from(hashKode(t.user_id, "wa", bersih));
  const b = Buffer.from(t.kode_wa_hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Inti: memeriksa satu kode untuk satu tantangan. Menambah hitungan percobaan bila salah. */
async function cekKode(db: AletaDatabase, t: BarisTantangan, metode: MetodeVerifikasi, kode: string, kini: Date): Promise<boolean> {
  const p = await bacaPengaturanVerifikasi(db);
  let cocok = false;
  if (metode === "whatsapp") cocok = p.otpWhatsapp && cocokKodeWa(t, kode, kini);
  else if (metode === "authenticator") cocok = p.authenticator && (await cocokAuthenticator(db, t.user_id, kode, kini));
  else if (metode === "cadangan") cocok = (p.authenticator || p.otpWhatsapp) && (await cocokKodeCadangan(db, t.user_id, kode, kini));
  if (!cocok) await db.run("UPDATE aleta_verifikasi_tantangan SET percobaan = percobaan + 1 WHERE id = ?", [t.id]);
  return cocok;
}

async function catatAudit(db: AletaDatabase, userId: string, action: string, payload: Record<string, unknown>) {
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: userId,
      action,
      entityType: "users",
      entityId: userId,
      payload,
    });
  } catch {
    /* audit tidak boleh menahan masuk */
  }
}

/**
 * Lewat layar masuk: periksa kode, dan bila benar catat "lolos" untuk akun +
 * perangkat itu (sekali 5 menit; tepercaya bila dicentang).
 */
export async function selesaikanTantangan(
  db: AletaDatabase,
  m: { tiket: string; perangkatId: string; metode: MetodeVerifikasi; kode: string; percayai: boolean; kini?: Date }
): Promise<{ lolos: true; tepercayaSampai: string }> {
  const kini = m.kini ?? new Date();
  const t = await periksaTantangan(db, m.tiket, m.perangkatId, kini);
  if (!t.sah) throw new ApiError(400, PESAN_TANTANGAN[t.sebab], { kode: `VERIFIKASI_${t.sebab.toUpperCase().replace(/-/g, "_")}` });
  if (!["whatsapp", "authenticator", "cadangan"].includes(m.metode)) throw new ApiError(400, "Cara verifikasi tidak dikenal.");
  const benar = await cekKode(db, t.baris, m.metode, m.kode, kini);
  if (!benar) {
    await catatAudit(db, t.baris.user_id, "VERIFIKASI_GAGAL", { metode: m.metode, jalur: t.baris.jalur });
    const sisa = Math.max(0, MAKS_PERCOBAAN - Number(t.baris.percobaan) - 1);
    throw new ApiError(400, sisa > 0 ? `Kode salah atau sudah tidak berlaku. Sisa percobaan ${sisa}.` : PESAN_TANTANGAN.terkunci, {
      kode: sisa > 0 ? "VERIFIKASI_KODE_SALAH" : "VERIFIKASI_TERKUNCI",
      sisaPercobaan: sisa,
    });
  }
  const sel = await db.run("UPDATE aleta_verifikasi_tantangan SET selesai_pada = ? WHERE id = ? AND selesai_pada = ''", [iso(kini), t.baris.id]);
  if (sel.changes !== 1) throw new ApiError(400, PESAN_TANTANGAN.selesai);
  await catatLolos(db, { userId: t.baris.user_id, perangkatId: t.baris.perangkat_id, jenis: "sekali", metode: m.metode, sampai: tambahMenit(kini, MASA_LOLOS_SEKALI_MENIT), kini });
  let tepercayaSampai = "";
  if (m.percayai && t.baris.perangkat_id) {
    const p = await bacaPengaturanVerifikasi(db);
    const sampai = new Date(kini.getTime() + p.masaTepercayaHari * 86_400_000);
    await catatLolos(db, { userId: t.baris.user_id, perangkatId: t.baris.perangkat_id, jenis: "tepercaya", metode: m.metode, sampai, kini });
    tepercayaSampai = iso(sampai);
  }
  await catatAudit(db, t.baris.user_id, "VERIFIKASI_LOLOS", { metode: m.metode, jalur: t.baris.jalur, tepercaya: Boolean(tepercayaSampai) });
  return { lolos: true, tepercayaSampai };
}

// ---------------------------------------------------------------------------
// Authenticator: daftar, konfirmasi, hapus
// ---------------------------------------------------------------------------

export async function mulaiPendaftaranAuthenticator(db: AletaDatabase, user: { id: string; username?: string; name?: string }, kini: Date = new Date()) {
  const ada = await barisAuthenticator(db, user.id);
  if (ada && aktifBenar(ada.aktif)) throw new ApiError(409, "Authenticator sudah terpasang. Hapus yang lama lebih dulu bila ingin menggantinya.");
  const rahasia = buatRahasiaTotp();
  await db.run(
    `INSERT INTO aleta_verifikasi_authenticator (user_id, rahasia_enc, aktif, dibuat_pada, aktif_pada, langkah_terakhir) VALUES (?, ?, 0, ?, '', -1)
     ON CONFLICT (user_id) DO UPDATE SET rahasia_enc = excluded.rahasia_enc, aktif = 0, dibuat_pada = excluded.dibuat_pada, aktif_pada = '', langkah_terakhir = -1`,
    [user.id, enkripsiRahasia(rahasia), iso(kini)]
  );
  return { rahasia, uri: uriOtpauth(rahasia, user.username || user.name || user.id) };
}

export async function konfirmasiAuthenticator(db: AletaDatabase, userId: string, kode: string, kini: Date = new Date()) {
  const b = await barisAuthenticator(db, userId);
  if (!b) throw new ApiError(400, "Mulai pendaftaran authenticator lebih dulu.");
  if (aktifBenar(b.aktif)) throw new ApiError(409, "Authenticator sudah aktif.");
  const langkah = periksaKodeTotp(dekripsiRahasia(b.rahasia_enc), kode, kini);
  if (langkah === null) throw new ApiError(400, "Kode salah. Pastikan jam HP Anda tepat, lalu coba kode berikutnya.");
  await db.run("UPDATE aleta_verifikasi_authenticator SET aktif = 1, aktif_pada = ?, langkah_terakhir = ? WHERE user_id = ?", [iso(kini), langkah, userId]);
  await catatAudit(db, userId, "AUTHENTICATOR_AKTIF", {});
}

/** Menghapus authenticator + semua perangkat tepercayanya (dipakai pemilik akun, atau admin bila HP hilang). */
export async function hapusAuthenticator(db: AletaDatabase, userId: string, oleh: string): Promise<void> {
  await db.run("DELETE FROM aleta_verifikasi_authenticator WHERE user_id = ?", [userId]);
  await cabutPerangkatTepercaya(db, userId);
  await catatAudit(db, userId, "AUTHENTICATOR_DIHAPUS", { oleh });
}

/** Pemilik akun menghapus authenticator: harus membuktikan kode yang berlaku bila sudah aktif. */
export async function hapusAuthenticatorSendiri(db: AletaDatabase, userId: string, kode: string, kini: Date = new Date()) {
  const b = await barisAuthenticator(db, userId);
  if (!b) return;
  if (aktifBenar(b.aktif)) {
    const benar = (await cocokAuthenticator(db, userId, kode, kini)) || (await cocokKodeCadangan(db, userId, kode, kini));
    if (!benar) throw new ApiError(400, "Masukkan kode authenticator (atau kode cadangan) yang berlaku untuk menghapusnya.");
  }
  await hapusAuthenticator(db, userId, userId);
}

// ---------------------------------------------------------------------------
// Kode cadangan
// ---------------------------------------------------------------------------

const ABJAD_CADANGAN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function kodeCadanganBaru(): string {
  let k = "";
  for (let i = 0; i < 10; i += 1) k += ABJAD_CADANGAN[randomInt(0, ABJAD_CADANGAN.length)];
  return k;
}

export function formatKodeCadangan(k: string): string {
  return `${k.slice(0, 5)}-${k.slice(5)}`;
}

/** Mengganti kode cadangan akun: yang lama hangus, yang baru ditampilkan SEKALI. */
export async function buatKodeCadangan(db: AletaDatabase, userId: string, olehId: string, kini: Date = new Date()): Promise<string[]> {
  await db.run("DELETE FROM aleta_verifikasi_kode_cadangan WHERE user_id = ?", [userId]);
  const kode: string[] = [];
  for (let i = 0; i < JUMLAH_KODE_CADANGAN; i += 1) {
    const k = kodeCadanganBaru();
    kode.push(formatKodeCadangan(k));
    await db.run("INSERT INTO aleta_verifikasi_kode_cadangan (id, user_id, kode_hash, dibuat_pada, dibuat_oleh) VALUES (?, ?, ?, ?, ?)", [
      crypto.randomUUID(),
      userId,
      hashKode(userId, "cadangan", k),
      iso(kini),
      olehId,
    ]);
  }
  await catatAudit(db, userId, "KODE_CADANGAN_DIBUAT", { oleh: olehId, jumlah: kode.length });
  return kode;
}

// ---------------------------------------------------------------------------
// Ringkasan untuk layar
// ---------------------------------------------------------------------------

export async function statusAkunVerifikasi(db: AletaDatabase, userId: string, kini: Date = new Date()) {
  const [b, tepercaya, sisa, a, p] = await Promise.all([
    barisAuthenticator(db, userId),
    daftarPerangkatTepercaya(db, userId, kini),
    sisaKodeCadangan(db, userId),
    akun(db, userId),
    bacaPengaturanVerifikasi(db),
  ]);
  return {
    authenticatorAktif: Boolean(b && aktifBenar(b.aktif)),
    authenticatorMenunggu: Boolean(b && !aktifBenar(b.aktif)),
    kodeCadanganSisa: sisa,
    perangkatTepercaya: tepercaya,
    nomorWhatsapp: samarkanNomor(a?.whatsapp_number ?? ""),
    saklar: { otpWhatsapp: p.otpWhatsapp, authenticator: p.authenticator },
    aturan: a ? aturanUntukPeran(p, a.role_id) : "mati",
  };
}

// ---------------------------------------------------------------------------
// KAIT UNTUK PENGAMAN AKSI ADMIN (R6 / Admin 13) - antarmuka sederhana
// ---------------------------------------------------------------------------

/**
 * Apakah aksi berdampak besar akun ini boleh/harus ditambah kode kedua? True
 * hanya bila salah satu saklar menyala DAN akun punya sarana (authenticator
 * aktif atau nomor WhatsApp). Selama kedua saklar mati: false - tidak ada kode.
 */
export async function kodeKeduaTersedia(db: AletaDatabase, userId: string): Promise<boolean> {
  const p = await bacaPengaturanVerifikasi(db);
  if (!saklarMenyala(p)) return false;
  const a = await akun(db, userId);
  if (!a) return false;
  return (await metodeTersedia(db, p, a)).some((x) => x !== "cadangan");
}

/** Menerbitkan tiket kode untuk sebuah aksi (tanpa perangkat); mengirim kode WhatsApp bila diminta. */
export async function mintaKodeKedua(
  db: AletaDatabase,
  userId: string,
  opsi: { kirimWhatsapp?: boolean; kirim?: KirimWa; kini?: Date } = {}
): Promise<{ tiket: string; metode: MetodeVerifikasi[]; nomor: string }> {
  const kini = opsi.kini ?? new Date();
  const p = await bacaPengaturanVerifikasi(db);
  const a = await akun(db, userId);
  if (!a) throw new ApiError(404, "Akun tidak ditemukan.");
  const metode = await metodeTersedia(db, p, a);
  if (metode.length === 0) throw new ApiError(400, "Verifikasi dua langkah belum dinyalakan atau akun ini belum punya cara menerima kode.");
  const tiket = await terbitkanTantangan(db, { userId, perangkatId: "", jalur: "aksi", kini });
  let nomor = "";
  if (opsi.kirimWhatsapp && metode.includes("whatsapp")) {
    const t = await periksaTantangan(db, tiket, "", kini);
    if (t.sah) nomor = (await kirimKodeWhatsapp(db, t.baris, { kirim: opsi.kirim, kini })).nomor;
  }
  return { tiket, metode, nomor };
}

/** Memeriksa kode kedua untuk aksi. Salah = ApiError 400 dan hitungan percobaan naik; benar = true (sekali pakai). */
export async function periksaKodeKedua(
  db: AletaDatabase,
  m: { userId: string; tiket: string; metode: MetodeVerifikasi; kode: string; kini?: Date }
): Promise<true> {
  const kini = m.kini ?? new Date();
  const t = await periksaTantangan(db, m.tiket, "", kini);
  if (!t.sah || t.baris.user_id !== m.userId || t.baris.jalur !== "aksi") throw new ApiError(400, "Permintaan kode tidak sah atau sudah habis. Minta kode baru.");
  if (!(await cekKode(db, t.baris, m.metode, m.kode, kini))) {
    await catatAudit(db, m.userId, "VERIFIKASI_GAGAL", { metode: m.metode, jalur: "aksi" });
    throw new ApiError(400, "Kode salah atau sudah tidak berlaku.");
  }
  await db.run("UPDATE aleta_verifikasi_tantangan SET selesai_pada = ? WHERE id = ?", [iso(kini), t.baris.id]);
  await catatAudit(db, m.userId, "VERIFIKASI_LOLOS", { metode: m.metode, jalur: "aksi" });
  return true;
}

/**
 * Langkah kedua untuk pengaman aksi admin (Bagian 6c), disambungkan lewat keamanan/kait.ts.
 * HANYA authenticator (kode 6 angka dari aplikasi di HP) dan kode cadangan: kode WhatsApp butuh tiket yang
 * dikirim lebih dulu dan kotak konfirmasi pengaman tidak punya tahap itu, jadi tidak ditawarkan di sini.
 * Tersedia hanya bila saklar authenticator menyala DAN akun itu sudah mendaftarkan authenticator; selebihnya
 * pengaman memakai sandi ulang + kata konfirmasi saja (tidak ada yang terkunci).
 */
export async function authenticatorUntukAksiTersedia(db: AletaDatabase, userId: string): Promise<boolean> {
  const p = await bacaPengaturanVerifikasi(db);
  if (!p.authenticator) return false;
  return authenticatorAktif(db, userId);
}

/** Memeriksa kode authenticator atau kode cadangan untuk satu aksi. Benar = true (kode sekali pakai); salah = false. */
export async function periksaKodeAuthenticatorAksi(db: AletaDatabase, userId: string, kode: string, kini: Date = new Date()): Promise<boolean> {
  if (!(await authenticatorUntukAksiTersedia(db, userId))) return false;
  const bersih = String(kode ?? "").replace(/\s+/g, "");
  const benar = /^\d{6}$/.test(bersih) ? await cocokAuthenticator(db, userId, bersih, kini) : await cocokKodeCadangan(db, userId, kode, kini);
  await catatAudit(db, userId, benar ? "VERIFIKASI_LOLOS" : "VERIFIKASI_GAGAL", { metode: /^\d{6}$/.test(bersih) ? "authenticator" : "cadangan", jalur: "aksi" });
  return benar;
}

/** Hanya untuk uji. */
export const _untukUji = { langkahDariWaktu };
