import {
  KUNCI_ABT_HP,
  bersihkanPengaturanAbtHp,
  hakAbtHp,
  hakPeranAbtHp,
  pilihanPenggunaAbtHp,
  terapkanUbahanAbtHp,
  type HakAbtHp,
  type PilihanPengguna,
  type UbahanAbtHp,
} from "@/lib/aleta-abt-hp";
import { roles } from "@/lib/mock-data";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * Hak ALETA ABT di HP (5 Nov 2026) - disimpan di aleta_ekstensi_setelan (tanpa migrasi),
 * pengguna_id "*sistem*", kunci KUNCI_ABT_HP. Aturannya di @/lib/aleta-abt-hp.
 * Tidak ada yang ditulis ke SIPP/ABT.
 */
const PENGGUNA_SISTEM = "*sistem*";

export async function bacaPengaturanAbtHp(db: AletaDatabase) {
  try {
    const baris = await db.queryOne<{ nilai: string }>(
      "SELECT nilai FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?",
      [PENGGUNA_SISTEM, KUNCI_ABT_HP]
    );
    return bersihkanPengaturanAbtHp(baris ? baris.nilai : null);
  } catch {
    // Tidak terbaca = bawaan (hanya Super Admin).
    return bersihkanPengaturanAbtHp(null);
  }
}

/** Hak efektif satu akun yang sedang masuk (peran berlaku, bukan peran tertulis). */
export async function hakAbtHpUntuk(db: AletaDatabase, akun: { id: string; roleId: string }): Promise<HakAbtHp> {
  return hakAbtHp({ roleId: akun.roleId, userId: akun.id }, await bacaPengaturanAbtHp(db));
}

export type BarisPenggunaAbtHp = { id: string; nama: string; peran: string; pilihan: PilihanPengguna; terbuka: boolean };

/** Layar admin: semua peran dengan keadaannya + pengguna hasil pencarian (atau yang sudah punya pilihan sendiri). */
export async function bacaLayarAbtHp(db: AletaDatabase, cari = "") {
  const p = await bacaPengaturanAbtHp(db);
  const peran = roles.map((r) => {
    const h = hakPeranAbtHp(r.id, p);
    return { id: r.id as string, nama: r.name, menyala: h.terbuka, sumber: h.sumber };
  });

  const kata = String(cari || "").trim().toLowerCase();
  const idTersimpan = Object.keys(p.pengguna);
  let baris: Array<Record<string, unknown>> = [];
  try {
    if (kata.length >= 2) {
      const pola = `%${kata}%`;
      baris = await db.queryAll<Record<string, unknown>>(
        "SELECT id, name, role_id FROM users WHERE deleted_at IS NULL AND is_active = 1 " +
          "AND (LOWER(name) LIKE ? OR LOWER(username) LIKE ?) ORDER BY name ASC LIMIT 20",
        [pola, pola]
      );
    } else if (!kata && idTersimpan.length) {
      baris = await db.queryAll<Record<string, unknown>>(
        `SELECT id, name, role_id FROM users WHERE deleted_at IS NULL AND id IN (${idTersimpan.map(() => "?").join(", ")}) ORDER BY name ASC`,
        idTersimpan
      );
    }
  } catch {
    baris = [];
  }
  const pengguna: BarisPenggunaAbtHp[] = baris.map((b) => {
    const id = String(b.id);
    const roleId = String(b.role_id ?? "");
    return {
      id,
      nama: String(b.name ?? ""),
      peran: roleId,
      pilihan: pilihanPenggunaAbtHp(id, p),
      terbuka: hakAbtHp({ roleId, userId: id }, p).terbuka,
    };
  });
  return { peran, pengguna, diubahOleh: p.diubahOleh, diubahPada: p.diubahPada };
}

/** Simpan satu ubahan (Super Admin - diperiksa rute) dan catat di audit. */
export async function simpanUbahanAbtHp(db: AletaDatabase, aktor: { id: string; name?: string | null }, ubahan: UbahanAbtHp) {
  if (ubahan.jenis === "peran" && !roles.some((r) => r.id === ubahan.id)) throw new ApiError(400, "Peran tidak dikenal.");
  if (ubahan.jenis === "pengguna") {
    const ada = await db.queryOne<{ id: string }>("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [String(ubahan.id)]);
    if (!ada) throw new ApiError(400, "Pengguna tidak dikenal. Cari lagi lalu pilih ulang.");
  }
  const sekarang = new Date().toISOString();
  await withTransaction(db, async (tx) => {
    const lama = await bacaPengaturanAbtHp(tx);
    let baru;
    try {
      baru = terapkanUbahanAbtHp(lama, ubahan, aktor.name || aktor.id, sekarang);
    } catch (e) {
      throw new ApiError(400, (e as Error).message);
    }
    await tx
      .prepare(
        "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
      )
      .run(PENGGUNA_SISTEM, KUNCI_ABT_HP, JSON.stringify(baru), sekarang);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.id,
      action: "UPDATE_ALETA_ABT_HP",
      entityType: "aleta_ekstensi_setelan",
      entityId: `${PENGGUNA_SISTEM}:${KUNCI_ABT_HP}`,
      payload: { ubahan },
      createdAt: sekarang,
    });
  });
  return { ok: true, ...(await bacaLayarAbtHp(db)) };
}
