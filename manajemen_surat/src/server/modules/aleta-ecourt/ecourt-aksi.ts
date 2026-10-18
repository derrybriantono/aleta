/**
 * Sesi e-Court PRIBADI dan aksi e-Court per perkara - sisi portal
 * (perbaikan 1 Okt 2026: E9, E10, E11, 16b; kontrak K5 dan K6).
 *
 * ============================================================================
 * IDENTITAS SELALU DARI AKUN YANG LOGIN
 * ============================================================================
 *
 * penggunaId dan nama yang diteruskan ke bot SELALU actor.id / actor.name dari
 * sesi portal, tidak pernah dari badan permintaan. Bot memakai keduanya untuk
 * memilih sesi e-Court milik orang itu sendiri dan memeriksa keanggotaan
 * majelis.
 *
 * ============================================================================
 * RAHASIA YANG LEWAT, TIDAK TINGGAL
 * ============================================================================
 *
 * Sandi e-Court (sambung sesi) dan passphrase TTE hanya diteruskan ke bot
 * dalam satu permintaan. Modul ini tidak menyimpannya, tidak mencatatnya ke
 * aleta_ecourt_aksi_jejak maupun audit_logs, dan tidak meneruskan pesan galat
 * mentah dari jalur yang membawanya. Dijaga src/test/ecourt-aksi-1okt.test.ts.
 */

import { type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

// ---------------------------------------------------------------------------
// Gerbang ke bot - sengaja mandiri dari whatsapp-gateway-client.ts supaya
// berkas bersama itu tidak disunting paralel. Alamat dan tokennya sama.
// ---------------------------------------------------------------------------

function alamatBot(): string {
  return (process.env.ALETA_BOT_BASE_URL || process.env.ALETA_BOT_RUNTIME_URL || "http://127.0.0.1:3003").replace(
    /\/$/,
    ""
  );
}

function tokenBot(): string {
  return process.env.ALETA_BOT_INTERNAL_API_TOKEN || process.env.ALETA_BOT_INTERNAL_TOKEN || "";
}

/** Aksi yang membuka peramban di bot: login, verifikasi, TTE, unggah. */
export const BATAS_PERAMBAN_MS = Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_PERAMBAN_MS || 120_000);
const BATAS_BIASA_MS = Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_MS || 8000);

export type HasilBot<T> = { ok: true; data: T } | { ok: false; alasan: string; status?: number; tidakAda?: boolean };

/**
 * Memanggil bot. Pesan galat jaringan TIDAK memuat badan permintaan - fetch
 * tidak memasukkannya, dan pesan yang dipulangkan disusun di sini.
 */
export async function panggilBot<T>(
  jalur: string,
  { method = "GET", body, batasMs = BATAS_BIASA_MS }: { method?: string; body?: unknown; batasMs?: number } = {}
): Promise<HasilBot<T>> {
  const pengendali = new AbortController();
  const waktu = setTimeout(() => pengendali.abort(), batasMs);
  try {
    const kepala: Record<string, string> = { "Content-Type": "application/json" };
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    const respons = await fetch(`${alamatBot()}/internal/aleta-bot${jalur}`, {
      method,
      headers: kepala,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: pengendali.signal,
      cache: "no-store",
    });
    const teks = await respons.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(teks) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        status: respons.status,
        tidakAda: respons.status === 404,
        alasan:
          respons.status === 404
            ? "fitur_belum_tersedia_di_server"
            : `bot_menjawab_http_${respons.status}`,
      };
    }
    if (!respons.ok && json.ok !== false) {
      return { ok: false, status: respons.status, alasan: String(json.alasan ?? json.error ?? `http_${respons.status}`) };
    }
    return { ok: true, data: json as T };
  } catch (galat) {
    const nama = galat instanceof Error ? galat.name : "";
    return {
      ok: false,
      alasan: nama === "AbortError" || nama === "TimeoutError" ? "bot_tidak_menjawab_tepat_waktu" : "bot_tidak_terjangkau",
    };
  } finally {
    clearTimeout(waktu);
  }
}

/** Mengambil jawaban berkas (unduh) dari bot apa adanya. */
export async function ambilBerkasBot(jalur: string): Promise<Response | null> {
  const pengendali = new AbortController();
  const waktu = setTimeout(() => pengendali.abort(), BATAS_PERAMBAN_MS);
  try {
    const kepala: Record<string, string> = {};
    const token = tokenBot();
    if (token) kepala["x-aleta-internal-token"] = token;
    return await fetch(`${alamatBot()}/internal/aleta-bot${jalur}`, {
      headers: kepala,
      signal: pengendali.signal,
      cache: "no-store",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(waktu);
  }
}

// ---------------------------------------------------------------------------
// Kalimat untuk layar - alasan bot (kode) menjadi kalimat petugas.
// ---------------------------------------------------------------------------

export const KALIMAT_ALASAN: Record<string, string> = {
  fitur_belum_tersedia_di_server: "Fitur ini belum tersedia di server (ALETA Bot belum diperbarui).",
  bot_tidak_terjangkau: "ALETA Bot belum dapat dihubungi.",
  bot_tidak_menjawab_tepat_waktu: "ALETA Bot tidak menjawab tepat waktu. Coba lagi sebentar lagi.",
  konfirmasi_belum_diberikan: "Tindakan belum dikonfirmasi.",
  sesi_pribadi_belum_tersambung:
    "Sesi e-Court akun Anda belum tersambung. Sambungkan di Integrasi e-Court > Sesi e-Court saya.",
  sesi_pribadi_kedaluwarsa: "Sesi e-Court akun Anda sudah habis. Masuk lagi di Integrasi e-Court > Sesi e-Court saya.",
  sesi_hakim_belum_tersambung:
    "Sesi e-Court akun hakim Anda belum tersambung. Sambungkan (peran Hakim) di Integrasi e-Court > Sesi e-Court saya.",
  sesi_panitera_belum_tersambung:
    "Sesi e-Court akun panitera Anda belum tersambung. Sambungkan (peran Panitera) di Integrasi e-Court > Sesi e-Court saya.",
  sesi_habis: "Sesi e-Court Anda ternyata sudah habis. Masuk lagi di Integrasi e-Court > Sesi e-Court saya.",
  bukan_hakim_terdaftar: "Akun ALETA Anda tidak terdaftar sebagai hakim.",
  bukan_anggota_majelis: "Anda bukan anggota majelis perkara ini.",
  alamat_perkara_belum_dikenal:
    "Halaman perkara ini di e-Court belum dikenal ALETA. Jalankan penarikan perkara ini lebih dulu (Integrasi e-Court > Penarikan).",
  dokumen_tidak_ditemukan: "Dokumen itu tidak ditemukan di arsip ALETA.",
  passphrase_kosong: "Passphrase TTE belum diisi.",
  berkas_bukan_pdf: "Berkas salinan putusan harus PDF.",
  // Audit jejak 18 Okt 2026: tidak satu kata ALETA yang dikirim ke e-Court.
  teks_menyebut_aleta: "Isian \"Keterangan verifikasi\" memuat kata 'ALETA'; hapus dulu sebelum dikirim ke e-Court.",
  isi_berkas_menyebut_aleta: "Berkas salinan putusan memuat kata 'ALETA' di dalam isinya; hapus dulu sebelum diunggah ke e-Court.",
  berkas_terlalu_besar: "Berkas terlalu besar (paling besar 20 MB).",
  batas_aksi_per_jam: "Batas aksi e-Court per jam untuk akun Anda tercapai. Coba lagi nanti.",
  aksi_lain_masih_berjalan: "Aksi e-Court Anda yang lain masih berjalan. Tunggu sampai selesai.",
  server_sibuk_coba_sebentar_lagi: "Server sedang mengerjakan aksi e-Court lain. Coba sebentar lagi.",
  tte_belum_terbukti: "Tombol TTE sudah ditekan, tetapi tanda tangan belum terbaca di e-Court. Periksa di e-Court.",
  unggah_belum_terbukti: "Berkas sudah dikirim, tetapi salinan putusan belum terbaca di e-Court. Periksa di e-Court.",
  verifikasi_belum_terbukti: "Verifikasi sudah dikirim, tetapi statusnya belum berubah di e-Court. Periksa di e-Court.",
  login_ditolak_ecourt: "e-Court menolak login. Periksa surel, sandi, dan kode captcha.",
  sesi_login_kedaluwarsa: "Formulir login sudah kedaluwarsa. Mulai lagi.",
  email_atau_sandi_kosong: "Surel dan sandi e-Court wajib diisi.",
  // Butir 20 (5 Okt 2026) - akun e-Court milik tiap pengguna.
  akun_ecourt_belum_diisi:
    "Anda belum menyimpan akun e-Court milik Anda sendiri. Isi surel dan sandi akun e-Court Anda di Integrasi e-Court > Sesi e-Court saya > Akun e-Court saya, lalu tekan Uji masuk (cukup ketik captcha). ALETA tidak memakai akun e-Court orang lain.",
  sesi_habis_akun_tersimpan:
    "Akun e-Court Anda tersimpan, tetapi sesinya belum tersambung atau sudah habis. Tekan Uji masuk di Integrasi e-Court > Sesi e-Court saya - cukup ketik captcha.",
  akun_sipp_milik_pengguna_lain:
    "Akun SIPP yang sedang terbuka tersimpan atas nama pengguna ALETA lain, bukan akun ALETA yang sedang masuk di peramban ini. Tindakan e-Court dihentikan supaya tidak tercatat atas nama orang yang salah - masuk ALETA dengan akun Anda sendiri.",
  email_kosong: "Surel akun e-Court wajib diisi.",
  sandi_kosong: "Sandi akun e-Court wajib diisi.",
  surel_berganti_sandi_wajib: "Surel berganti - ketik juga sandi akun e-Court yang baru.",
  pengguna_atau_peran_tidak_sah: "Peran e-Court tidak dikenali.",
};

export function kalimatAlasan(alasan: string | undefined | null): string {
  const kode = String(alasan || "");
  if (!kode) return "";
  if (KALIMAT_ALASAN[kode]) return KALIMAT_ALASAN[kode];
  const awal = kode.split(":")[0];
  if (KALIMAT_ALASAN[awal]) return KALIMAT_ALASAN[awal];
  return kode.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Jejak aksi (0055)
// ---------------------------------------------------------------------------

export type AksiJejak =
  | "sambung"
  | "putus"
  | "periksa"
  | "unduh"
  | "verifikasi"
  | "verifikasi_kering"
  | "tte"
  | "unggah_salinan"
  | "login_wa";

/**
 * Mencatat satu aksi. Bentuk masukannya SENGAJA tidak punya tempat untuk
 * rahasia; `alasan` disaring lagi terhadap `rahasia` supaya pantulan pesan
 * e-Court pun tidak membawanya masuk.
 */
export async function catatJejakAksi(
  db: AletaDatabase,
  masukan: {
    penggunaId: string;
    penggunaNama?: string;
    aksi: AksiJejak;
    peranEcourt?: string;
    akunEcourt?: string;
    nomorPerkara?: string;
    sasaran?: string;
    hasil: "berhasil" | "gagal" | "ditolak";
    alasan?: string;
    alamatIp?: string;
  },
  rahasia: Array<string | undefined | null> = []
) {
  const sapu = (teks: unknown) => {
    let s = String(teks ?? "");
    for (const r of rahasia) if (r) s = s.split(String(r)).join("***");
    return s.slice(0, 300);
  };
  const id = await nextPrefixedId(db, "aleta_ecourt_aksi_jejak", "eaj");
  const sekarang = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO aleta_ecourt_aksi_jejak (id, pengguna_id, pengguna_nama, aksi, peran_ecourt, akun_ecourt, nomor_perkara, sasaran, hasil, alasan, alamat_ip, lewat, dibuat_pada) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALETA', ?)"
    )
    .run(
      id,
      masukan.penggunaId,
      sapu(masukan.penggunaNama),
      masukan.aksi,
      sapu(masukan.peranEcourt),
      sapu(masukan.akunEcourt),
      sapu(masukan.nomorPerkara),
      sapu(masukan.sasaran),
      masukan.hasil,
      sapu(masukan.alasan),
      sapu(masukan.alamatIp),
      sekarang
    );
  // Tindakan TULIS ke e-Court juga masuk audit_logs bersama, supaya jejak
  // satu orang terbaca di satu tempat dengan pekerjaannya yang lain.
  if (masukan.aksi === "verifikasi" || masukan.aksi === "tte" || masukan.aksi === "unggah_salinan") {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: masukan.penggunaId,
      action: `ECOURT_${masukan.aksi.toUpperCase()}_LEWAT_SESI_PRIBADI`,
      entityType: "ecourt_perkara",
      entityId: sapu(masukan.nomorPerkara) || "-",
      payload: {
        hasil: masukan.hasil,
        alasan: sapu(masukan.alasan),
        akunEcourt: sapu(masukan.akunEcourt),
        sasaran: sapu(masukan.sasaran),
        alamatIp: sapu(masukan.alamatIp),
        lewat: "ALETA",
      },
    });
  }
  return id;
}

export async function bacaJejakPengguna(db: AletaDatabase, penggunaId: string, batas = 30) {
  const baris = await db
    .prepare(
      "SELECT id, aksi, peran_ecourt, akun_ecourt, nomor_perkara, sasaran, hasil, alasan, dibuat_pada FROM aleta_ecourt_aksi_jejak WHERE pengguna_id = ? ORDER BY dibuat_pada DESC LIMIT " +
        Math.max(1, Math.min(200, Math.floor(batas)))
    )
    .all(penggunaId);
  return (baris as Array<Record<string, unknown>>).map((b) => ({
    id: String(b.id),
    aksi: String(b.aksi),
    peranEcourt: String(b.peran_ecourt ?? ""),
    akunEcourt: String(b.akun_ecourt ?? ""),
    nomorPerkara: String(b.nomor_perkara ?? ""),
    sasaran: String(b.sasaran ?? ""),
    hasil: String(b.hasil),
    alasan: String(b.alasan ?? ""),
    dibuatPada: String(b.dibuat_pada),
  }));
}

// ---------------------------------------------------------------------------
// Riwayat login e-Court lewat WhatsApp (0074, 18 Okt 2026) - HANYA Super Admin & Admin
// ---------------------------------------------------------------------------

/** pengguna_id baris jejak login WhatsApp: bukan pengguna ALETA, jadi tak pernah masuk riwayat per pengguna. */
export const PENGGUNA_LOGIN_WA = "whatsapp";

export type PeristiwaLoginWa = {
  id: string;
  eventType: string;
  severity?: string;
  message?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

/**
 * Peristiwa jejak keamanan bot -> isi baris aleta_ecourt_aksi_jejak. null bila bukan peristiwa login
 * WhatsApp yang dikenal (login lewat portal sudah punya jejak per pengguna: aksi "sambung"). Murni.
 */
export function jejakDariPeristiwaLoginWa(
  p: PeristiwaLoginWa
): { sasaran: string; hasil: "berhasil" | "gagal" | "ditolak"; alasan: string } | null {
  switch (p.eventType) {
    case "ecourt_login_berhasil":
      if (p.metadata?.jalur !== "whatsapp") return null;
      return { sasaran: "Login e-Court lewat WhatsApp (jawaban captcha)", hasil: "berhasil", alasan: "" };
    case "ecourt_login_gagal":
      if (p.metadata?.jalur !== "whatsapp") return null;
      return { sasaran: "Login e-Court lewat WhatsApp (jawaban captcha)", hasil: "gagal", alasan: "login_ditolak_ecourt" };
    case "ecourt_wa_captcha_dikirim":
      return { sasaran: "Captcha e-Court dikirim ke WhatsApp Super Admin", hasil: "berhasil", alasan: "" };
    case "ecourt_wa_captcha_kedaluwarsa":
      return { sasaran: "Captcha e-Court lewat WhatsApp", hasil: "gagal", alasan: "captcha_kedaluwarsa_tanpa_jawaban" };
    case "ecourt_wa_captcha_dibatalkan":
      return { sasaran: "Captcha e-Court lewat WhatsApp", hasil: "ditolak", alasan: "dibatalkan_super_admin" };
    default:
      return null;
  }
}

/** Saat sinkron terakhir PER basis data (singleton di produksi; basis data uji baru tidak mewarisi jeda). */
const sinkronLoginWaTerakhir = new WeakMap<AletaDatabase, number>();
const JEDA_SINKRON_LOGIN_WA_MS = 30_000;

/**
 * Menyalin peristiwa login WhatsApp dari bot ke aleta_ecourt_aksi_jejak (aksi "login_wa").
 * IDEMPOTEN: id baris tetap ("eaj-wa-<id peristiwa bot>"), peristiwa yang sudah ada dilewati,
 * dan waktu baris = waktu peristiwa. Dipanggil saat Super Admin/Admin membuka riwayat e-Court;
 * berkala dibatasi (30 detik) kecuali `paksa`. Gagal menghubungi bot tidak menggagalkan layar.
 */
export async function sinkronLoginWa(
  db: AletaDatabase,
  { paksa = false }: { paksa?: boolean } = {}
): Promise<{ ok: boolean; dibaca: number; baru: number; alasan?: string }> {
  const sekarang = Date.now();
  if (!paksa && sekarang - (sinkronLoginWaTerakhir.get(db) ?? 0) < JEDA_SINKRON_LOGIN_WA_MS) {
    return { ok: true, dibaca: 0, baru: 0, alasan: "baru_disinkronkan" };
  }
  sinkronLoginWaTerakhir.set(db, sekarang);

  // Hanya peristiwa sesudah yang terakhir tersalin (mundur satu hari sebagai pengaman jam).
  const terakhir = (await db
    .prepare("SELECT MAX(dibuat_pada) AS t FROM aleta_ecourt_aksi_jejak WHERE aksi = 'login_wa'")
    .get()
    .catch(() => null)) as { t?: string | null } | null;
  let sejak = "";
  if (terakhir?.t) {
    const t = new Date(terakhir.t);
    if (!Number.isNaN(t.getTime())) sejak = new Date(t.getTime() - 24 * 3600 * 1000).toISOString();
  }
  const q = new URLSearchParams({ batas: "300" });
  if (sejak) q.set("sejak", sejak);
  const hasil = await panggilBot<{ ok?: boolean; peristiwa?: PeristiwaLoginWa[]; alasan?: string }>(`/ecourt-wa/riwayat-login?${q.toString()}`);
  if (!hasil.ok) return { ok: false, dibaca: 0, baru: 0, alasan: hasil.alasan };
  if (hasil.data.ok === false) return { ok: false, dibaca: 0, baru: 0, alasan: String(hasil.data.alasan || "bot_menolak") };

  const daftar = Array.isArray(hasil.data.peristiwa) ? hasil.data.peristiwa : [];
  let baru = 0;
  // Terlama dulu supaya urutan sisipan mengikuti urutan kejadian.
  for (const p of [...daftar].reverse()) {
    const isi = jejakDariPeristiwaLoginWa(p);
    const idBot = String(p.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    const waktu = new Date(p.createdAt);
    if (!isi || !idBot || Number.isNaN(waktu.getTime())) continue;
    const id = `eaj-wa-${idBot}`;
    const ada = await db.prepare("SELECT id FROM aleta_ecourt_aksi_jejak WHERE id = ?").get(id);
    if (ada) continue;
    await db
      .prepare(
        "INSERT INTO aleta_ecourt_aksi_jejak (id, pengguna_id, pengguna_nama, aksi, peran_ecourt, akun_ecourt, nomor_perkara, sasaran, hasil, alasan, alamat_ip, lewat, dibuat_pada) " +
          "VALUES (?, ?, ?, 'login_wa', '', '', '', ?, ?, ?, '', 'ALETA', ?)"
      )
      .run(id, PENGGUNA_LOGIN_WA, "WhatsApp", isi.sasaran.slice(0, 300), isi.hasil, isi.alasan.slice(0, 300), waktu.toISOString());
    baru += 1;
  }
  return { ok: true, dibaca: daftar.length, baru };
}

/** Jejak login WhatsApp terbaru - untuk Super Admin & Admin (pemanggil WAJIB memeriksa perannya). */
export async function bacaJejakLoginWa(db: AletaDatabase, batas = 30) {
  const baris = await db
    .prepare(
      "SELECT id, aksi, sasaran, hasil, alasan, dibuat_pada FROM aleta_ecourt_aksi_jejak WHERE aksi = 'login_wa' ORDER BY dibuat_pada DESC LIMIT " +
        Math.max(1, Math.min(200, Math.floor(batas)))
    )
    .all();
  return (baris as Array<Record<string, unknown>>).map((b) => ({
    id: String(b.id),
    aksi: String(b.aksi),
    sasaran: String(b.sasaran ?? ""),
    hasil: String(b.hasil),
    alasan: String(b.alasan ?? ""),
    dibuatPada: String(b.dibuat_pada),
  }));
}

/** Nomor perkara dari query/badan: dipangkas, dibatasi, tanpa karakter aneh. */
export function bersihkanNomor(nilai: unknown): string {
  return String(nilai ?? "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/[^\p{L}\p{N}./ -]/gu, "")
    .trim()
    .slice(0, 80);
}
