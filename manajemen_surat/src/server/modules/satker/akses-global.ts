import { createHash } from "node:crypto";

import {
  AKSI_AKSES_GLOBAL,
  BATAS_PEMBERITAHUAN_AKSES,
  HARI_TAMPIL_PEMBERITAHUAN,
  JENIS_ENTITAS_AKSES_GLOBAL,
  adalahSuperAdminGlobal,
  bentukPayloadAkses,
  daftarPenandaGlobal,
  type CaraAksesGlobal,
  type CatatanAksesGlobal,
} from "@/lib/super-admin-global";
import type { AletaDatabase } from "@/server/db/client";
import { bacaKodeSatker } from "@/server/modules/satker/identitas";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * JEJAK AKSES SUPER ADMIN GLOBAL (banyak satker, Tahap 0)
 * ============================================================================
 *
 * Aturannya di lib/super-admin-global.ts. Di sini: mendeteksi sesi akun global
 * yang BARU terlihat, mencatatnya ke audit_logs (tabel jejak yang sudah ada,
 * tampil di Jejak Audit), dan menyediakan daftar akses terbaru untuk
 * pemberitahuan admin satker (tasks/service.ts - "pemberitahuan portal").
 *
 * Dipanggil dari shared/auth.resolveActorUserId, yang dilewati SETIAP rute
 * ber-sesi - jadi tidak ada jalan masuk yang melewatinya, apa pun cara sesi itu
 * lahir (formulir masuk, masuk dengan akun SIPP, panggilan API langsung).
 *
 * GAGAL KE SISI TERTUTUP: bila jejaknya tidak dapat ditulis, fungsi MELEMPAR
 * dan sesi akun global itu tidak diterima. (Kebalikan dari saklar fitur, yang
 * gagal ke sisi menyala.) Akun biasa tidak terpengaruh sama sekali.
 */

const MASA_SINGGAH_PENANDA_MS = 60_000;
const BATAS_SESI_DIINGAT = 2000;

const singgahAkun = new Map<string, { global: boolean; username: string; nama: string; sampai: number }>();
const sudahDicatat = new Set<string>();
const sedangDicatat = new Map<string, Promise<void>>();

/** Hanya untuk uji. */
export function kosongkanSinggahAksesGlobal() {
  singgahAkun.clear();
  sudahDicatat.clear();
  sedangDicatat.clear();
}

export function penandaGlobalTerpasang(): string[] {
  return daftarPenandaGlobal(process.env.ALETA_SUPER_ADMIN_GLOBAL);
}

type BarisAkun = { id: string; username: string; name: string; role_id: string; is_active: number | string | null };

async function akunGlobal(db: AletaDatabase, penanda: string[], userId: string) {
  const kini = Date.now();
  const lama = singgahAkun.get(userId);
  if (lama && lama.sampai > kini) return lama;
  const baris = await db.queryOne<BarisAkun>("SELECT id, username, name, role_id, is_active FROM users WHERE id = ? AND deleted_at IS NULL", [userId]);
  const hasil = {
    global: adalahSuperAdminGlobal(penanda, baris ? { id: baris.id, username: baris.username, roleId: baris.role_id, isActive: baris.is_active } : null),
    username: String(baris?.username ?? ""),
    nama: String(baris?.name ?? ""),
    sampai: kini + MASA_SINGGAH_PENANDA_MS,
  };
  singgahAkun.set(userId, hasil);
  if (singgahAkun.size > 500) singgahAkun.clear();
  return hasil;
}

/** Kunci jejak per sesi: hash, bukan id sesi mentah. */
export function kunciSesiJejak(sessionId: string, userId: string) {
  const dasar = String(sessionId || "").trim() || `tanpa-sesi:${userId}`;
  return `ses-${createHash("sha256").update(dasar).digest("hex").slice(0, 24)}`;
}

export type MasukanAkses = {
  userId: string;
  sessionId: string;
  alamatIp: string;
  agenPengguna: string;
  cara?: CaraAksesGlobal;
};

/**
 * Dicatat SEKALI per sesi akun global (sesi baru = akses baru). Tidak melakukan
 * apa-apa untuk akun biasa. Melempar bila akun global dan jejaknya gagal ditulis.
 */
export async function catatAksesBilaSuperAdminGlobal(db: AletaDatabase, masukan: MasukanAkses): Promise<{ dicatat: boolean }> {
  const penanda = penandaGlobalTerpasang();
  if (!penanda.length || !masukan.userId) return { dicatat: false };

  const akun = await akunGlobal(db, penanda, masukan.userId);
  if (!akun.global) return { dicatat: false };

  const kunci = kunciSesiJejak(masukan.sessionId, masukan.userId);
  if (sudahDicatat.has(kunci)) return { dicatat: false };
  const berjalan = sedangDicatat.get(kunci);
  if (berjalan) {
    await berjalan;
    return { dicatat: false };
  }

  const tugas = (async () => {
    const ada = await db.queryOne<{ id: string }>("SELECT id FROM audit_logs WHERE action = ? AND entity_id = ? LIMIT 1", [AKSI_AKSES_GLOBAL, kunci]);
    if (!ada) {
      const catatan: CatatanAksesGlobal = {
        sesiId: kunci,
        akunId: masukan.userId,
        username: akun.username,
        nama: akun.nama,
        kodeSatker: await bacaKodeSatker(db),
        cara: masukan.cara ?? "sesi-langsung",
        alamatIp: masukan.alamatIp.slice(0, 80),
        agenPengguna: masukan.agenPengguna,
        waktu: new Date().toISOString(),
      };
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId: masukan.userId,
        action: AKSI_AKSES_GLOBAL,
        entityType: JENIS_ENTITAS_AKSES_GLOBAL,
        entityId: kunci,
        payload: bentukPayloadAkses(catatan),
        createdAt: catatan.waktu,
      });
    }
    if (sudahDicatat.size >= BATAS_SESI_DIINGAT) sudahDicatat.clear();
    sudahDicatat.add(kunci);
  })();
  sedangDicatat.set(kunci, tugas);
  try {
    await tugas;
  } finally {
    sedangDicatat.delete(kunci);
  }
  return { dicatat: true };
}

export type AksesGlobalTerbaru = {
  id: string;
  akunId: string;
  nama: string;
  username: string;
  alamatIp: string;
  cara: CaraAksesGlobal;
  waktu: string;
};

/** Akses terbaru (bawaan: 30 hari terakhir, paling banyak 10) - bahan pemberitahuan admin satker dan layar Fitur satker. */
export async function daftarAksesTerbaru(
  db: AletaDatabase,
  pilihan: { hari?: number; batas?: number; sekarang?: Date } = {}
): Promise<AksesGlobalTerbaru[]> {
  const hari = pilihan.hari ?? HARI_TAMPIL_PEMBERITAHUAN;
  const batas = Math.max(1, Math.min(pilihan.batas ?? BATAS_PEMBERITAHUAN_AKSES, 100));
  const sejak = new Date((pilihan.sekarang ?? new Date()).getTime() - hari * 86_400_000).toISOString();
  const baris = await db.queryAll<{ id: string; actor_user_id: string | null; payload_json: string | null; created_at: string }>(
    `SELECT id, actor_user_id, payload_json, created_at FROM audit_logs
      WHERE action = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ${batas}`,
    [AKSI_AKSES_GLOBAL, sejak]
  );
  return baris.map((b) => {
    let p: Record<string, unknown> = {};
    try {
      p = JSON.parse(String(b.payload_json ?? "{}")) as Record<string, unknown>;
    } catch {
      p = {};
    }
    return {
      id: String(b.id),
      akunId: String(b.actor_user_id ?? ""),
      nama: String(p.nama ?? ""),
      username: String(p.username ?? ""),
      alamatIp: String(p.alamatIp ?? ""),
      cara: p.cara === "tiket-pusat" ? "tiket-pusat" : "sesi-langsung",
      waktu: String(b.created_at),
    };
  });
}
