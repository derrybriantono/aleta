import crypto from "node:crypto";

import { type AletaDatabase } from "@/server/db/client";
import { ipKlien, rantaiXff, rujukanSesi } from "@/server/modules/perangkat/jaringan";
import { bacaUa, namaPerangkat } from "@/server/modules/perangkat/ua";

/**
 * ============================================================================
 * JEJAK MASUK & PERANGKAT (23 Okt 2026)
 * ============================================================================
 *
 * Satu tabel peristiwa (aleta_jejak_masuk) untuk seluruh jalur masuk, ditulis
 * BERSAMA - bukan menggantikan - audit_logs dan aleta_masuk_jejak yang lama.
 *
 * Yang TIDAK pernah ditulis: token sesi, id sesi mentah, kata sandi. Sesi
 * dirujuk lewat sesi_ref (hash pendek, lihat rujukanSesi). Akun yang tidak
 * dikenal dicatat dengan identitas tersamar ("bu***").
 *
 * Pencatatan TIDAK PERNAH menggagalkan masuk: pemanggil di jalur masuk
 * memakai catatPeristiwaAman, yang menelan galatnya ke log server.
 */

export const PERISTIWA_MASUK = [
  "MASUK",
  "MASUK_GAGAL",
  "MASUK_DITOLAK_BATAS_PERANGKAT",
  "KELUAR",
  "SESI_DICABUT",
  "SESI_KEDALUWARSA",
  "PERANGKAT_BARU",
  "IP_BERUBAH",
] as const;
export type PeristiwaMasuk = (typeof PERISTIWA_MASUK)[number];

export const JALUR_MASUK = ["email", "sipp", "sipp-sesi"] as const;

/** "/sign-in/email" -> "email"; jalur lain dipulangkan tanpa garis miring depan. */
export function jalurDariPath(path: string | null | undefined) {
  const p = String(path ?? "");
  if (p.endsWith("/sign-in/sipp-sesi")) return "sipp-sesi";
  if (p.endsWith("/sign-in/sipp")) return "sipp";
  if (p.endsWith("/sign-in/email")) return "email";
  return p.replace(/^\/+/, "").slice(0, 40);
}

// ─── Setelan ─────────────────────────────────────────────────────────────────

export type SetelanJejak = {
  retensiHari: number;
  jamKerjaMulai: string;
  jamKerjaSelesai: string;
  hariKerja: number[];
  catatAkunWindows: boolean;
};

export const SETELAN_BAWAAN: SetelanJejak = {
  retensiHari: 365,
  jamKerjaMulai: "07:30",
  jamKerjaSelesai: "17:00",
  hariKerja: [1, 2, 3, 4, 5],
  catatAkunWindows: false,
};

export async function bacaSetelanJejak(db: AletaDatabase): Promise<SetelanJejak> {
  const hasil: SetelanJejak = { ...SETELAN_BAWAAN, hariKerja: [...SETELAN_BAWAAN.hariKerja] };
  try {
    const baris = await db.queryAll<{ kunci: string; nilai: string }>("SELECT kunci, nilai FROM aleta_setelan_jejak_masuk", []);
    for (const b of baris) {
      if (b.kunci === "retensi_hari") {
        const n = Math.round(Number(b.nilai));
        if (Number.isFinite(n) && n >= 30 && n <= 3650) hasil.retensiHari = n;
      } else if (b.kunci === "jam_kerja_mulai" && /^\d{2}:\d{2}$/.test(b.nilai)) hasil.jamKerjaMulai = b.nilai;
      else if (b.kunci === "jam_kerja_selesai" && /^\d{2}:\d{2}$/.test(b.nilai)) hasil.jamKerjaSelesai = b.nilai;
      else if (b.kunci === "hari_kerja") {
        const hari = b.nilai.split(",").map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
        if (hari.length) hasil.hariKerja = hari;
      } else if (b.kunci === "catat_akun_windows") hasil.catatAkunWindows = b.nilai === "1";
    }
  } catch {
    /* tabel belum ada: bawaan */
  }
  return hasil;
}

export async function simpanSetelanJejak(db: AletaDatabase, ubah: Partial<SetelanJejak>, olehId: string) {
  const kini = new Date().toISOString();
  const pasangan: Array<[string, string]> = [];
  if (ubah.retensiHari !== undefined) {
    const n = Math.round(Number(ubah.retensiHari));
    if (!Number.isFinite(n) || n < 30 || n > 3650) throw new Error("Masa simpan riwayat harus 30-3650 hari.");
    pasangan.push(["retensi_hari", String(n)]);
  }
  for (const [k, kunci] of [["jamKerjaMulai", "jam_kerja_mulai"], ["jamKerjaSelesai", "jam_kerja_selesai"]] as const) {
    const v = ubah[k];
    if (v === undefined) continue;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) throw new Error("Jam kerja ditulis JJ:MM, misalnya 07:30.");
    pasangan.push([kunci, String(v)]);
  }
  if (ubah.hariKerja !== undefined) {
    const hari = [...new Set(ubah.hariKerja.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort();
    if (!hari.length) throw new Error("Pilih minimal satu hari kerja.");
    pasangan.push(["hari_kerja", hari.join(",")]);
  }
  if (ubah.catatAkunWindows !== undefined) pasangan.push(["catat_akun_windows", ubah.catatAkunWindows ? "1" : "0"]);
  for (const [kunci, nilai] of pasangan) {
    await db
      .prepare(
        `INSERT INTO aleta_setelan_jejak_masuk (kunci, nilai, diubah_oleh, diubah_pada) VALUES (?, ?, ?, ?)
         ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai, diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada`
      )
      .run(kunci, nilai, olehId, kini);
  }
  return bacaSetelanJejak(db);
}

// ─── Pencatatan ──────────────────────────────────────────────────────────────

type BawaHeader = { get(nama: string): string | null };

export type MasukanPeristiwa = {
  peristiwa: PeristiwaMasuk;
  alasan?: string;
  jalur?: string;
  userId?: string | null;
  /** Untuk percobaan tanpa akun yang dikenal: disamarkan sebelum disimpan. */
  identitas?: string;
  sessionId?: string | null;
  perangkatId?: string;
  headers?: BawaHeader | null;
  /** Bila tanpa headers (pencabutan oleh admin, dll.). */
  ip?: string;
  agen?: string;
  ingat?: boolean | null;
  pelaku?: { id: string; nama: string } | null;
  rincian?: Record<string, unknown>;
  waktu?: string;
};

function samarkan(teks: string) {
  const t = String(teks ?? "").trim();
  return t ? `${t.slice(0, 2)}***` : "";
}

async function identitasAkun(db: AletaDatabase, userId: string) {
  try {
    const u = await db.queryOne<{ username: string | null; name: string | null; role_id: string | null }>(
      "SELECT username, name, role_id FROM users WHERE id = ?",
      [userId]
    );
    return { username: String(u?.username ?? ""), nama: String(u?.name ?? ""), peran: String(u?.role_id ?? "") };
  } catch {
    return { username: "", nama: "", peran: "" };
  }
}

/** Satu baris peristiwa. Melempar bila basis data menolak - pakai catatPeristiwaAman di jalur masuk. */
export async function catatPeristiwa(db: AletaDatabase, m: MasukanPeristiwa) {
  const id = `jm-${crypto.randomUUID()}`;
  const waktu = m.waktu ?? new Date().toISOString();
  const agen = String(m.agen ?? m.headers?.get("user-agent") ?? "").slice(0, 400);
  const ua = bacaUa(agen);
  const userId = String(m.userId ?? "");
  const akun = userId ? await identitasAkun(db, userId) : { username: "", nama: "", peran: "" };
  let perangkat = { nama_komputer: "", mac: "", mac_sumber: "" };
  if (m.perangkatId && userId) {
    const p = await db
      .queryOne<{ nama_komputer: string; mac: string; mac_sumber: string }>(
        "SELECT nama_komputer, mac, mac_sumber FROM aleta_perangkat WHERE perangkat_id = ? AND user_id = ?",
        [m.perangkatId, userId]
      )
      .catch(() => undefined);
    if (p) perangkat = p;
  }
  await db
    .prepare(
      `INSERT INTO aleta_jejak_masuk (
        id, waktu, peristiwa, alasan, jalur, user_id, username, nama, peran, identitas_samar, sesi_ref,
        perangkat_id, ip, rantai_xff, agen, jenis_perangkat, os, peramban, model, ingat,
        nama_komputer, mac, mac_sumber, pelaku_id, pelaku_nama, rincian
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      waktu,
      m.peristiwa,
      String(m.alasan ?? "").slice(0, 200),
      String(m.jalur ?? "").slice(0, 40),
      userId,
      akun.username,
      akun.nama,
      akun.peran,
      userId ? "" : samarkan(m.identitas ?? ""),
      m.sessionId ? rujukanSesi(String(m.sessionId)) : "",
      String(m.perangkatId ?? ""),
      String(m.ip ?? ipKlien(m.headers)).slice(0, 64),
      rantaiXff(m.headers),
      agen,
      ua.jenis,
      [ua.os, ua.osVersi].filter(Boolean).join(" "),
      [ua.peramban, ua.perambanVersi].filter(Boolean).join(" "),
      ua.model,
      m.ingat === true ? "ya" : m.ingat === false ? "tidak" : "",
      perangkat.nama_komputer,
      perangkat.mac,
      perangkat.mac_sumber,
      m.pelaku?.id ?? "",
      m.pelaku?.nama ?? "",
      JSON.stringify(m.rincian ?? {}).slice(0, 2000)
    );
  void bersihkanBilaPerlu(db);
  return id;
}

export async function catatPeristiwaAman(db: AletaDatabase, m: MasukanPeristiwa) {
  try {
    return await catatPeristiwa(db, m);
  } catch (galat) {
    console.warn("[JEJAK MASUK] tidak tertulis:", m.peristiwa, galat instanceof Error ? galat.message : "tidak diketahui");
    return "";
  }
}

/**
 * Mencatat perangkat untuk akun ini. Pulang true bila (perangkat, akun) ini
 * BARU - pemanggil mencatat PERANGKAT_BARU.
 */
export async function catatPerangkat(
  db: AletaDatabase,
  m: { perangkatId: string; userId: string; headers?: BawaHeader | null; ip?: string; waktu?: string }
) {
  const waktu = m.waktu ?? new Date().toISOString();
  const agen = String(m.headers?.get("user-agent") ?? "").slice(0, 400);
  const ua = bacaUa(agen);
  const ip = String(m.ip ?? ipKlien(m.headers));
  const ada = await db.queryOne<{ id: string }>(
    "SELECT id FROM aleta_perangkat WHERE perangkat_id = ? AND user_id = ?",
    [m.perangkatId, m.userId]
  );
  if (ada) {
    await db
      .prepare(
        `UPDATE aleta_perangkat SET terakhir_dilihat = ?, ip_terakhir = ?, agen = ?, nama_terbaca = ?, jenis = ?,
           os = ?, peramban = ?, model = CASE WHEN ? <> '' THEN ? ELSE model END
         WHERE id = ?`
      )
      .run(
        waktu,
        ip,
        agen,
        namaPerangkat(ua),
        ua.jenis,
        [ua.os, ua.osVersi].filter(Boolean).join(" "),
        [ua.peramban, ua.perambanVersi].filter(Boolean).join(" "),
        ua.model,
        ua.model,
        ada.id
      );
    return false;
  }
  await db
    .prepare(
      `INSERT INTO aleta_perangkat (
        id, perangkat_id, user_id, nama_terbaca, jenis, os, peramban, model, agen, ip_terakhir,
        mac_catatan, pertama_dilihat, terakhir_dilihat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(perangkat_id, user_id) DO NOTHING`
    )
    .run(
      `pr-${crypto.randomUUID()}`,
      m.perangkatId,
      m.userId,
      namaPerangkat(ua),
      ua.jenis,
      [ua.os, ua.osVersi].filter(Boolean).join(" "),
      [ua.peramban, ua.perambanVersi].filter(Boolean).join(" "),
      ua.model,
      agen,
      ip,
      ua.jenis === "hp" || ua.jenis === "tablet" ? "tidak terbaca (HP)" : "",
      waktu,
      waktu
    );
  return true;
}

// ─── Retensi ─────────────────────────────────────────────────────────────────

let bersihTerakhir = 0;
const JEDA_BERSIH_MS = 6 * 60 * 60 * 1000;

/** Pembersihan ringan, paling sering sekali per 6 jam per proses. */
async function bersihkanBilaPerlu(db: AletaDatabase) {
  const kini = Date.now();
  if (kini - bersihTerakhir < JEDA_BERSIH_MS) return;
  bersihTerakhir = kini;
  await bersihkanJejak(db).catch(() => undefined);
}

export async function bersihkanJejak(db: AletaDatabase, sekarang = new Date()) {
  const setelan = await bacaSetelanJejak(db);
  const batas = new Date(sekarang.getTime() - setelan.retensiHari * 86_400_000).toISOString();
  const r1 = await db.run("DELETE FROM aleta_jejak_masuk WHERE waktu < ?", [batas]);
  await db.run("DELETE FROM aleta_tiket_perangkat WHERE kedaluwarsa_pada < ?", [new Date(sekarang.getTime() - 86_400_000).toISOString()]);
  // Peta sesi yang sesinya sudah tidak ada (dihapus Better Auth saat kedaluwarsa).
  await db.run("DELETE FROM aleta_sesi_perangkat WHERE session_id NOT IN (SELECT id FROM sessions)", []);
  return { jejakDihapus: r1.changes };
}

export function __setelUlangBersihUntukUji() {
  bersihTerakhir = 0;
}
