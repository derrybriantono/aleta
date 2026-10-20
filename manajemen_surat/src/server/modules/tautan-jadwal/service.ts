import { createHash, randomBytes } from "node:crypto";

import { golonganPengguna } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { getUserByIdFromDb, getUsersFromDb } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { alamatIpPeramban } from "@/server/shared/request";

/**
 * ============================================================================
 * TAUTAN JADWAL SIDANG  -  TAMPILAN TANPA AKUN (20 Oktober 2026)
 * ============================================================================
 *
 * Permintaan pengguna: Jadwal Sidang yang cukup dibuka lewat alamat, tanpa
 * masuk akun. Tombol tunda | putus tetap MENULIS ke SIPP - tercatat atas
 * panitera pengganti perkara itu (aturan 7 Okt: penginput tunda dan putusan =
 * PP), siapa pun yang menekannya. Karena itu halaman yang menulis ke SIPP ini
 * dijaga berlapis:
 *
 *   1. RAHASIA panjang acak (32 byte acak kriptografis = 43 karakter), dibuat
 *      dan dicabut Super Admin/Admin. Di basis data hanya HASH sha256-nya;
 *      rahasia asli hanya tampak SEKALI, saat dibuat.
 *   2. Hanya dari jaringan kantor (10.x, 172.16-31.x, 192.168.x) - di luar itu
 *      ditolak, bahkan sebelum rahasianya diperiksa.
 *   3. Rahasia yang tidak dikenal, dicabut, atau kedaluwarsa: ditolak tanpa
 *      membocorkan jadwal.
 *   4. JEJAK JUJUR: tiap tindakan menulis tercatat dengan sumber "tautan
 *      jadwal: <nama>", alamat IP, waktu, perkara, dan jenis tindakan - di
 *      tabel jejak tautan dan di audit_logs.
 *   5. Hanya RUTE di daftar izin (RUTE_TAUTAN) yang dapat dipakai, dan
 *      tindakan dijalankan atas akun yang diwakili tautan (golongan PP,
 *      panitera, atau panitera muda - tidak pernah hakim, pimpinan, admin),
 *      sehingga matriks peran yang sudah ada tetap menjadi pagar kedua.
 *   6. Batas laju per tautan (60 tindakan menulis per jam) dan saklar
 *      "matikan semua tautan".
 */

export { HEADER_TAUTAN_JADWAL } from "@/lib/jadwal-tampil-url";
export const BATAS_AKSI_PER_JAM = 60;
const POLA_RAHASIA = /^[A-Za-z0-9_-]{32,128}$/;

/** Golongan yang boleh diwakili tautan. Hakim, pimpinan, dan admin TIDAK pernah. */
export const GOLONGAN_WAKIL_TAUTAN = ["pp", "panitera", "panmud"] as const;

const MENIT = 60 * 1000;

// ============================================================================
// DAFTAR IZIN RUTE
// ============================================================================

type MetodeTautan = "GET" | "POST";

/**
 * Rute yang boleh dipanggil dengan rahasia tautan. Selain ini -> 403.
 * Kuncinya jalur sesudah /api/ ; nilainya metode yang diizinkan.
 *
 * Yang SENGAJA tidak ada: antrian-ambil dan panggil (memanggil / mengambil
 * nomor), kasir, penetapan-kembali, ecourt-aksi dan berkas (unduh, TTE,
 * verifikasi), relaas massal, pengaturan apa pun, dan semua yang khusus
 * hakim/pimpinan (unggah putusan, penetapan).
 */
export const RUTE_TAUTAN: Readonly<Record<string, readonly MetodeTautan[]>> = {
  "jadwal-tautan/sesi": ["GET"],
  // Bacaan Jadwal Sidang
  "aleta-ecourt/sidang": ["GET"],
  "aleta-ecourt/sidang/disidang": ["GET"],
  "aleta-ecourt/sidang/kalender": ["GET"],
  "aleta-ecourt/sidang/verifikasi-ecourt": ["GET"],
  "aleta-ecourt/antrian": ["GET"],
  "aleta-ecourt/antrian/kehadiran": ["GET"],
  "aleta-ecourt/hakim": ["GET"],
  "aleta-ecourt/pandu-saksi": ["GET"],
  "aleta-ecourt/agen-h7": ["GET"],
  // Tombol yang diizinkan: tunda | putus, Court Calendar, mediator, dan tombol kolom kanan
  "aleta-ecourt/sidang-tunda": ["GET", "POST"],
  "aleta-ecourt/sidang-putus": ["GET", "POST"],
  "aleta-ecourt/sidang-ikrar-isi": ["POST"],
  "aleta-ecourt/sidang/court-calendar": ["GET", "POST"],
  "aleta-ecourt/sidang/mediator": ["GET", "POST"],
  "aleta-ecourt/sidang/selesai": ["GET", "POST"],
  "aleta-ecourt/sidang/skors": ["GET", "POST"],
  "aleta-ecourt/sidang/berjalan": ["POST"],
  "aleta-ecourt/keterangan-perkara": ["GET", "POST"],
  "aleta-ecourt/konseptor-sementara": ["GET", "POST"],
  "aleta-ecourt/konseptor-langkah": ["GET", "POST"],
};

/** Jalur permintaan -> kunci daftar izin (tanpa basePath, tanpa garis miring penutup). */
export function kunciRuteTautan(jalur: string): string {
  let hasil = String(jalur || "").split("?")[0];
  hasil = hasil.replace(/^\/aleta(?=\/)/, "").replace(/\/+$/, "");
  return hasil.replace(/^\/api\//, "");
}

export function ruteTautanBoleh(jalur: string, metode: string): boolean {
  const izin = RUTE_TAUTAN[kunciRuteTautan(jalur)];
  return Boolean(izin && (izin as readonly string[]).includes(String(metode).toUpperCase()));
}

/** Nama tindakan yang terbaca manusia, untuk jejak. */
const NAMA_AKSI: Record<string, string> = {
  "aleta-ecourt/sidang-tunda": "tunda sidang",
  "aleta-ecourt/sidang-putus": "putus perkara",
  "aleta-ecourt/sidang-ikrar-isi": "isi form ikrar talak",
  "aleta-ecourt/sidang/court-calendar": "Court Calendar",
  "aleta-ecourt/sidang/mediator": "mediator",
  "aleta-ecourt/sidang/selesai": "tandai selesai",
  "aleta-ecourt/sidang/skors": "skors sidang",
  "aleta-ecourt/sidang/berjalan": "tandai sedang berjalan",
  "aleta-ecourt/keterangan-perkara": "keterangan perkara",
  "aleta-ecourt/konseptor-sementara": "tunjuk konseptor",
  "aleta-ecourt/konseptor-langkah": "checklist draf putusan",
};

// ============================================================================
// JARINGAN KANTOR
// ============================================================================

/** 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 saja. */
export function ipJaringanKantor(ip: string): boolean {
  const cocok = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(ip || "").trim());
  if (!cocok) return false;
  const [a, b, c, d] = cocok.slice(1).map(Number);
  if ([a, b, c, d].some((x) => x > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * Alamat peminta. Produksi: wajib terbaca DAN pribadi. Di luar produksi
 * (pengembangan lokal tanpa proksi) alamat yang tidak terbaca dianggap lokal.
 */
export function alamatSahJaringanKantor(ip: string): boolean {
  if (!ip) return process.env.NODE_ENV !== "production";
  return ipJaringanKantor(ip) || (process.env.NODE_ENV !== "production" && /^127\./.test(ip));
}

// ============================================================================
// RAHASIA
// ============================================================================

export function buatRahasia(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRahasia(rahasia: string): string {
  return createHash("sha256").update(String(rahasia), "utf8").digest("hex");
}

// ============================================================================
// BARIS DAN KETERANGAN
// ============================================================================

type BarisTautan = {
  id: string;
  nama: string;
  hash_rahasia: string;
  bertindak_sebagai: string;
  bertindak_nama: string;
  berlaku_sampai: string;
  dicabut_pada: string;
  dicabut_oleh: string;
  dibuat_oleh: string;
  dibuat_nama: string;
  dibuat_pada: string;
  terakhir_dipakai: string;
  terakhir_ip: string;
  jumlah_pakai: number;
};

export type TautanRingkas = {
  id: string;
  nama: string;
  kode: string;
  bertindakSebagaiId: string;
  bertindakSebagaiNama: string;
  berlakuSampai: string;
  dicabutPada: string;
  keadaan: "aktif" | "dicabut" | "kedaluwarsa";
  dibuatNama: string;
  dibuatPada: string;
  terakhirDipakai: string;
  terakhirIp: string;
  jumlahPakai: number;
  aksiSejamTerakhir: number;
};

function keadaanTautan(baris: BarisTautan, sekarang: Date): TautanRingkas["keadaan"] {
  if (baris.dicabut_pada) return "dicabut";
  if (baris.berlaku_sampai && new Date(baris.berlaku_sampai).getTime() < sekarang.getTime()) return "kedaluwarsa";
  return "aktif";
}

function teksBersih(nilai: unknown, panjang: number): string {
  return String(nilai ?? "").replace(/\s+/g, " ").trim().slice(0, panjang);
}

export function golonganWakilBoleh(pengguna: UserPersona): boolean {
  const golongan = golonganPengguna(pengguna);
  return golongan.length > 0 && golongan.every((g) => (GOLONGAN_WAKIL_TAUTAN as readonly string[]).includes(g));
}

/** Tanggal (YYYY-MM-DD) atau waktu ISO -> akhir hari (zona server) sebagai ISO; salah -> galat. */
function akhirMasaBerlaku(nilai: unknown): string {
  const teks = String(nilai ?? "").trim();
  if (!teks) return "";
  const tanggal = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teks);
  const waktu = tanggal
    ? new Date(Number(tanggal[1]), Number(tanggal[2]) - 1, Number(tanggal[3]), 23, 59, 59)
    : new Date(teks);
  if (Number.isNaN(waktu.getTime())) throw new ApiError(400, "Masa berlaku tidak terbaca. Isi tanggal berakhir atau kosongkan.");
  if (waktu.getTime() < Date.now()) throw new ApiError(400, "Masa berlaku sudah lewat. Isi tanggal yang akan datang atau kosongkan.");
  return waktu.toISOString();
}

// ============================================================================
// SAKLAR
// ============================================================================

export async function bacaSaklarMati(db: AletaDatabase): Promise<boolean> {
  try {
    const baris = await db.queryOne<{ mati: number }>(`SELECT mati FROM aleta_tautan_jadwal_saklar WHERE id = 1`);
    return Number(baris?.mati ?? 0) === 1;
  } catch {
    // Tidak terbaca = TERTUTUP: lebih baik semua tautan berhenti daripada terbuka tanpa saklarnya.
    return true;
  }
}

export async function setSaklarMati(db: AletaDatabase, actorUserId: string | null | undefined, mati: boolean) {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "mematikan atau menyalakan tautan jadwal sidang");
  const sekarang = new Date().toISOString();
  await db.run(`DELETE FROM aleta_tautan_jadwal_saklar WHERE id = 1`);
  await db.run(`INSERT INTO aleta_tautan_jadwal_saklar (id, mati, diubah_oleh, diubah_pada) VALUES (1, ?, ?, ?)`, [
    mati ? 1 : 0,
    aktor.id,
    sekarang,
  ]);
  await auditAdmin(db, aktor.id, mati ? "TAUTAN_JADWAL_DIMATIKAN" : "TAUTAN_JADWAL_DINYALAKAN", "saklar", { mati });
  return { mati };
}

async function auditAdmin(db: AletaDatabase, aktorId: string, action: string, entityId: string, payload: unknown) {
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "audit"),
      actorUserId: aktorId,
      action,
      entityType: "tautan_jadwal",
      entityId,
      payload,
    });
  } catch {
    /* jejak audit gagal tidak boleh menggagalkan pengelolaan */
  }
}

// ============================================================================
// PENGELOLAAN (Super Admin / Admin)
// ============================================================================

export async function daftarTautan(db: AletaDatabase, actorUserId: string | null | undefined) {
  await pastikanAdminIstimewa(db, actorUserId, "melihat tautan jadwal sidang");
  const sekarang = new Date();
  const baris = await db.queryAll<BarisTautan>(`SELECT * FROM aleta_tautan_jadwal ORDER BY dibuat_pada DESC LIMIT 200`);
  const sejam = new Date(sekarang.getTime() - 60 * MENIT).toISOString();
  const tautan: TautanRingkas[] = [];
  for (const b of baris) {
    const hitung = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM aleta_tautan_jadwal_jejak WHERE tautan_id = ? AND waktu >= ?`,
      [b.id, sejam]
    );
    tautan.push({
      id: b.id,
      nama: b.nama,
      kode: b.hash_rahasia.slice(0, 6),
      bertindakSebagaiId: b.bertindak_sebagai,
      bertindakSebagaiNama: b.bertindak_nama,
      berlakuSampai: b.berlaku_sampai,
      dicabutPada: b.dicabut_pada,
      keadaan: keadaanTautan(b, sekarang),
      dibuatNama: b.dibuat_nama,
      dibuatPada: b.dibuat_pada,
      terakhirDipakai: b.terakhir_dipakai,
      terakhirIp: b.terakhir_ip,
      jumlahPakai: Number(b.jumlah_pakai) || 0,
      aksiSejamTerakhir: Number(hitung?.n ?? 0),
    });
  }
  const pengguna = await getUsersFromDb(db);
  const calon = pengguna
    .filter((u) => u.isActive && golonganWakilBoleh(u))
    .map((u) => ({ id: u.id, nama: u.name, golongan: golonganPengguna(u)[0] ?? "" }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return { tautan, calon, mati: await bacaSaklarMati(db), batasAksiPerJam: BATAS_AKSI_PER_JAM };
}

/** Membuat tautan. Rahasia aslinya DIKEMBALIKAN SEKALI dan tidak disimpan. */
export async function buatTautan(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  masukan: { nama?: unknown; bertindakSebagai?: unknown; berlakuSampai?: unknown }
) {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "membuat tautan jadwal sidang");
  const nama = teksBersih(masukan.nama, 80);
  if (!nama) throw new ApiError(400, "Nama tautan wajib diisi, mis. Meja PP Ruang 1.");
  const wakil = await getUserByIdFromDb(db, teksBersih(masukan.bertindakSebagai, 120));
  if (!wakil || !wakil.isActive) {
    throw new ApiError(400, "Pilih akun yang diwakili tautan (panitera pengganti, panitera, atau panitera muda yang aktif).");
  }
  if (!golonganWakilBoleh(wakil)) {
    throw new ApiError(400, "Tautan hanya boleh mewakili panitera pengganti, panitera, atau panitera muda - tidak untuk hakim, pimpinan, atau admin.");
  }
  const berlakuSampai = akhirMasaBerlaku(masukan.berlakuSampai);

  const rahasia = buatRahasia();
  const id = await nextPrefixedId(db, "aleta_tautan_jadwal", "tjd");
  const sekarang = new Date().toISOString();
  await db.run(
    `INSERT INTO aleta_tautan_jadwal (id, nama, hash_rahasia, bertindak_sebagai, bertindak_nama, berlaku_sampai,
       dicabut_pada, dicabut_oleh, dibuat_oleh, dibuat_nama, dibuat_pada, terakhir_dipakai, terakhir_ip, jumlah_pakai)
     VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, '', '', 0)`,
    [id, nama, hashRahasia(rahasia), wakil.id, wakil.name, berlakuSampai, aktor.id, aktor.name, sekarang]
  );
  await auditAdmin(db, aktor.id, "TAUTAN_JADWAL_DIBUAT", id, { nama, bertindakSebagai: wakil.id, berlakuSampai });
  return { id, nama, rahasia, alamat: `/jadwal/${rahasia}` };
}

export async function cabutTautan(db: AletaDatabase, actorUserId: string | null | undefined, id: unknown) {
  const aktor = await pastikanAdminIstimewa(db, actorUserId, "mencabut tautan jadwal sidang");
  const kunci = teksBersih(id, 120);
  const baris = await db.queryOne<BarisTautan>(`SELECT * FROM aleta_tautan_jadwal WHERE id = ?`, [kunci]);
  if (!baris) throw new ApiError(404, "Tautan tidak ditemukan.");
  if (!baris.dicabut_pada) {
    await db.run(`UPDATE aleta_tautan_jadwal SET dicabut_pada = ?, dicabut_oleh = ? WHERE id = ?`, [
      new Date().toISOString(),
      aktor.id,
      kunci,
    ]);
    await auditAdmin(db, aktor.id, "TAUTAN_JADWAL_DICABUT", kunci, { nama: baris.nama });
  }
  return { id: kunci, dicabut: true };
}

// ============================================================================
// PEMERIKSAAN SAAT DIPAKAI
// ============================================================================

export type AktorTautan = {
  tautan: { id: string; nama: string; berlakuSampai: string };
  aktor: UserPersona;
  ip: string;
};

type PermintaanTautan = Request & { nextUrl: { pathname: string; searchParams: URLSearchParams } };

/**
 * Memeriksa rahasia pada satu permintaan. Urutan SENGAJA: jaringan kantor ->
 * bentuk rahasia -> saklar -> rahasia dikenal -> dicabut/kedaluwarsa -> rute
 * diizinkan -> akun yang diwakili -> batas laju + jejak. Semua penolakan
 * melempar ApiError; tidak ada yang mengembalikan data jadwal.
 */
export async function periksaTautan(db: AletaDatabase, request: PermintaanTautan, rahasia: string): Promise<AktorTautan> {
  const ip = alamatIpPeramban(request);
  if (!alamatSahJaringanKantor(ip)) {
    throw new ApiError(403, "Tautan jadwal sidang hanya dapat dibuka dari jaringan kantor.");
  }
  if (!POLA_RAHASIA.test(String(rahasia || ""))) {
    throw new ApiError(401, "Tautan ini tidak berlaku.");
  }
  if (await bacaSaklarMati(db)) {
    throw new ApiError(403, "Tautan jadwal sidang sedang dimatikan oleh admin.");
  }
  const baris = await db.queryOne<BarisTautan>(`SELECT * FROM aleta_tautan_jadwal WHERE hash_rahasia = ?`, [hashRahasia(rahasia)]);
  if (!baris) throw new ApiError(401, "Tautan ini tidak berlaku.");
  const keadaan = keadaanTautan(baris, new Date());
  if (keadaan === "dicabut") throw new ApiError(401, "Tautan ini sudah dicabut oleh admin.");
  if (keadaan === "kedaluwarsa") throw new ApiError(401, "Masa berlaku tautan ini sudah berakhir.");

  const jalur = request.nextUrl.pathname;
  const metode = request.method.toUpperCase();
  if (!ruteTautanBoleh(jalur, metode)) {
    throw new ApiError(403, "Tindakan ini tidak tersedia lewat tautan jadwal sidang.");
  }

  const aktor = await getUserByIdFromDb(db, baris.bertindak_sebagai);
  if (!aktor || !aktor.isActive || !golonganWakilBoleh(aktor)) {
    throw new ApiError(403, "Akun yang diwakili tautan ini tidak lagi aktif. Minta admin membuat tautan baru.");
  }

  const tautan = { id: baris.id, nama: baris.nama, berlakuSampai: baris.berlaku_sampai };

  // Hanya TINDAKAN MENULIS yang dibatasi dan dicatat.
  if (metode !== "GET") {
    const sejam = new Date(Date.now() - 60 * MENIT).toISOString();
    const hitung = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM aleta_tautan_jadwal_jejak WHERE tautan_id = ? AND waktu >= ?`,
      [baris.id, sejam]
    );
    if (Number(hitung?.n ?? 0) >= BATAS_AKSI_PER_JAM) {
      throw new ApiError(429, `Terlalu banyak tindakan lewat tautan ini (batas ${BATAS_AKSI_PER_JAM} per jam). Coba lagi nanti.`);
    }
    await catatAksiTautan(db, request, { tautan, aktor, ip });
  }
  return { tautan, aktor, ip };
}

/** Menandai pemakaian (dipanggil rute sesi, sekali per pembukaan halaman). */
export async function tandaiPemakaian(db: AletaDatabase, idTautan: string, ip: string) {
  await db.run(
    `UPDATE aleta_tautan_jadwal SET terakhir_dipakai = ?, terakhir_ip = ?, jumlah_pakai = jumlah_pakai + 1 WHERE id = ?`,
    [new Date().toISOString(), ip, idTautan]
  );
}

// ============================================================================
// JEJAK
// ============================================================================

async function bacaIsiRingkas(request: Request): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.clone().json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function perkaraDariIsi(isi: Record<string, unknown>, parameter: URLSearchParams): string {
  const calon = [
    isi.nomorPerkara,
    isi.nomor,
    parameter.get("nomorPerkara"),
    parameter.get("nomor"),
    isi.perkaraId ? `perkara ${String(isi.perkaraId)}` : "",
    isi.jadwalId ? `jadwal ${String(isi.jadwalId)}` : "",
    parameter.get("jadwalId") ? `jadwal ${parameter.get("jadwalId")}` : "",
  ];
  return teksBersih(calon.find((x) => x) ?? "", 120);
}

/**
 * Menulis satu baris jejak: sumber "tautan jadwal: <nama>", IP, waktu, perkara,
 * dan tindakan. Dipanggil SEBELUM tindakannya dijalankan - tindakan yang gagal
 * di tengah jalan tetap meninggalkan jejak percobaannya.
 */
export async function catatAksiTautan(
  db: AletaDatabase,
  request: PermintaanTautan,
  konteks: { tautan: { id: string; nama: string }; aktor: UserPersona; ip: string }
) {
  const kunci = kunciRuteTautan(request.nextUrl.pathname);
  const isi = await bacaIsiRingkas(request);
  const kering = kunci.endsWith("sidang-tunda") || kunci.endsWith("sidang-putus") ? isi.kering !== false : false;
  const aksi = `${NAMA_AKSI[kunci] ?? kunci}${kering ? " (uji kering)" : ""}`;
  const perkara = perkaraDariIsi(isi, request.nextUrl.searchParams ?? new URLSearchParams());
  const waktu = new Date().toISOString();
  const id = await nextPrefixedId(db, "aleta_tautan_jadwal_jejak", "tjj");
  await db.run(
    `INSERT INTO aleta_tautan_jadwal_jejak (id, tautan_id, tautan_nama, bertindak_sebagai, ip, waktu, metode, jalur, aksi, perkara)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, konteks.tautan.id, konteks.tautan.nama, konteks.aktor.id, konteks.ip, waktu, request.method.toUpperCase(), kunci, aksi, perkara]
  );
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "audit"),
      actorUserId: konteks.aktor.id,
      action: "TAUTAN_JADWAL_AKSI",
      entityType: "tautan_jadwal",
      entityId: konteks.tautan.id,
      payload: { sumber: `tautan jadwal: ${konteks.tautan.nama}`, ip: konteks.ip, aksi, perkara, jalur: kunci },
      createdAt: waktu,
    });
  } catch {
    /* tabel jejak tautan sudah menyimpannya */
  }
}

export async function jejakTautan(db: AletaDatabase, actorUserId: string | null | undefined, idTautan?: string) {
  await pastikanAdminIstimewa(db, actorUserId, "melihat jejak tautan jadwal sidang");
  return idTautan
    ? db.queryAll(`SELECT * FROM aleta_tautan_jadwal_jejak WHERE tautan_id = ? ORDER BY waktu DESC LIMIT 100`, [idTautan])
    : db.queryAll(`SELECT * FROM aleta_tautan_jadwal_jejak ORDER BY waktu DESC LIMIT 100`);
}

/**
 * Persona yang dikirim ke peramban untuk menggambar tombol sesuai hak akun yang
 * diwakili. Tanpa kata sandi, surel, nomor, NIP, atau kredensial.
 */
export function personaUntukPeramban(aktor: UserPersona) {
  return {
    id: aktor.id,
    name: aktor.name,
    roleId: aktor.roleId,
    positionId: aktor.positionId,
    additionalRoleIds: aktor.additionalRoleIds ?? [],
    isActive: true,
  };
}
