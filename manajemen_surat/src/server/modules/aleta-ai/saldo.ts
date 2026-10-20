import { randomUUID } from "node:crypto";

import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - SALDO DAN BUKU MUTASI
 * ============================================================================
 *
 * ATURAN INTI: tidak ada perubahan angka saldo tanpa baris mutasi. Satu-satunya
 * jalan mengubah aleta_ai_saldo adalah terapkanMutasi(), yang dalam SATU
 * transaksi menambah baris aleta_ai_mutasi dan menggeser saldo; saldo karena itu
 * selalu sama dengan jumlah seluruh mutasi (verifikasiSaldo() menjaganya).
 *
 * Jenis mutasi (jumlah bertanda; positif menambah saldo):
 *   isi      +  Super Admin mengisi saldo (tahap 5: QRIS)
 *   kuota    +  kuota hibah per peran (tercatat sebagai mutasi)
 *   tahan    -  dana ditahan sebelum giliran berjalan
 *   lepas    +  dana tahanan dikembalikan utuh saat giliran selesai
 *   potong   -  biaya aktual giliran itu
 *   koreksi  +/- koreksi manual Super Admin
 *
 * Satu giliran: tahan(-T) ... lepas(+T) lalu potong(-C). Bersih = -C; bila
 * gagal sebelum ada keluaran, hanya tahan(-T) lalu lepas(+T) = 0.
 * Pasangan lepas+potong ditulis dalam satu transaksi, dan hanya sekali per
 * rujukan (idempoten) sehingga pemanggilan ganda tidak menggandakan apa pun.
 */

export type JenisMutasi = "isi" | "kuota" | "tahan" | "lepas" | "potong" | "koreksi";

export type Mutasi = {
  id: string;
  jenis: JenisMutasi;
  jumlahRp: number;
  saldoSetelah: number;
  rujukanId: string;
  catatan: string;
  waktu: string;
};

const teks = (n: unknown) => String(n ?? "").trim();
const sekarangIso = () => new Date().toISOString();

/** Memakai transaksi yang sudah berjalan bila ada (tanpa savepoint); membuka transaksi baru bila tidak. */
function dalamTransaksi<T>(db: AletaDatabase, kerja: (tx: AletaDatabase) => Promise<T>): Promise<T> {
  return db.isTransactionClient() ? kerja(db) : withTransaction(db, kerja);
}

async function pastikanBaris(db: AletaDatabase, penggunaId: string) {
  const ada = await db.queryOne<{ pengguna_id: string }>(`SELECT pengguna_id FROM aleta_ai_saldo WHERE pengguna_id = ?`, [penggunaId]);
  if (ada) return;
  try {
    await db.run(`INSERT INTO aleta_ai_saldo (pengguna_id, saldo_rp, diubah_at) VALUES (?, 0, ?)`, [penggunaId, sekarangIso()]);
  } catch {
    /* dibuat bersamaan oleh permintaan lain */
  }
}

export async function saldoPengguna(db: AletaDatabase, penggunaId: string): Promise<number> {
  const baris = await db.queryOne<{ saldo_rp: number | string }>(`SELECT saldo_rp FROM aleta_ai_saldo WHERE pengguna_id = ?`, [teks(penggunaId)]);
  return baris ? Number(baris.saldo_rp) : 0;
}

type MasukanMutasi = {
  penggunaId: string;
  jenis: JenisMutasi;
  /** Bertanda. */
  jumlahRp: number;
  rujukanId?: string;
  catatan?: string;
  olehId?: string;
  /** false (bawaan): mutasi negatif yang membuat saldo < 0 ditolak. */
  bolehNegatif?: boolean;
};

/** Satu-satunya jalan mengubah saldo. Mengembalikan null bila saldo tidak cukup. */
export async function terapkanMutasi(db: AletaDatabase, m: MasukanMutasi): Promise<{ saldoSetelah: number; mutasiId: string } | null> {
  const penggunaId = teks(m.penggunaId);
  const jumlah = Math.trunc(m.jumlahRp);
  if (!penggunaId) throw new ApiError(400, "Pengguna tidak sah.");
  if (!Number.isFinite(jumlah) || jumlah === 0) throw new ApiError(400, "Jumlah mutasi tidak sah.");

  return dalamTransaksi(db, async (tx) => {
    await pastikanBaris(tx, penggunaId);
    const sekarang = sekarangIso();
    const syarat = jumlah < 0 && !m.bolehNegatif ? ` AND saldo_rp + ? >= 0` : "";
    const parameter = [jumlah, sekarang, penggunaId, ...(syarat ? [jumlah] : [])];
    const hasil = await tx.run(`UPDATE aleta_ai_saldo SET saldo_rp = saldo_rp + ?, diubah_at = ? WHERE pengguna_id = ?${syarat}`, parameter);
    if (!hasil.changes) return null;
    const saldoSetelah = await saldoPengguna(tx, penggunaId);
    const mutasiId = `aim-${randomUUID()}`;
    await tx.run(
      `INSERT INTO aleta_ai_mutasi (id, pengguna_id, jenis, jumlah_rp, saldo_setelah, rujukan_id, catatan, oleh_id, dibuat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mutasiId, penggunaId, m.jenis, jumlah, saldoSetelah, teks(m.rujukanId), teks(m.catatan).slice(0, 300), teks(m.olehId), sekarang]
    );
    return { saldoSetelah, mutasiId };
  });
}

/** Tahan dana sebelum giliran. false = saldo tidak cukup (tidak ada yang berubah). */
export async function tahanDana(db: AletaDatabase, penggunaId: string, jumlahRp: number, rujukanId: string): Promise<boolean> {
  if (jumlahRp <= 0) return true;
  const hasil = await terapkanMutasi(db, { penggunaId, jenis: "tahan", jumlahRp: -jumlahRp, rujukanId, catatan: "Dana ditahan untuk giliran" });
  return hasil !== null;
}

/** Menambah tahanan yang sudah ada (naik tingkat). false = saldo tidak cukup. */
export async function tambahTahanan(db: AletaDatabase, penggunaId: string, tambahanRp: number, rujukanId: string): Promise<boolean> {
  return tahanDana(db, penggunaId, tambahanRp, rujukanId);
}

async function totalTahanan(db: AletaDatabase, penggunaId: string, rujukanId: string): Promise<{ tahan: number; sudahLepas: boolean }> {
  const baris = await db.queryAll<{ jenis: string; jumlah_rp: number | string }>(
    `SELECT jenis, jumlah_rp FROM aleta_ai_mutasi WHERE pengguna_id = ? AND rujukan_id = ? AND jenis IN ('tahan', 'lepas')`,
    [penggunaId, rujukanId]
  );
  let tahan = 0;
  let sudahLepas = false;
  for (const b of baris) {
    if (b.jenis === "tahan") tahan += -Number(b.jumlah_rp);
    if (b.jenis === "lepas") sudahLepas = true;
  }
  return { tahan, sudahLepas };
}

/**
 * Menutup satu giliran: seluruh tahanan dilepas lalu biaya aktual dipotong
 * (tidak melebihi saldo yang ada; sisa yang tak tertagih dilaporkan). Idempoten
 * per rujukan.
 */
export async function selesaikanTahanan(
  db: AletaDatabase,
  penggunaId: string,
  rujukanId: string,
  tagihRp: number
): Promise<{ dipotongRp: number; tidakTertagihRp: number; saldoSetelah: number; sudahDiproses: boolean }> {
  return dalamTransaksi(db, async (tx) => {
    const { tahan, sudahLepas } = await totalTahanan(tx, penggunaId, rujukanId);
    if (sudahLepas) return { dipotongRp: 0, tidakTertagihRp: 0, saldoSetelah: await saldoPengguna(tx, penggunaId), sudahDiproses: true };

    let saldo = await saldoPengguna(tx, penggunaId);
    if (tahan > 0) {
      const lepas = await terapkanMutasi(tx, { penggunaId, jenis: "lepas", jumlahRp: tahan, rujukanId, catatan: "Tahanan dilepas" });
      saldo = lepas?.saldoSetelah ?? saldo;
    } else {
      // Tanpa tahanan (Super Admin gratis): tetap tandai selesai agar idempoten.
      await tx.run(
        `INSERT INTO aleta_ai_mutasi (id, pengguna_id, jenis, jumlah_rp, saldo_setelah, rujukan_id, catatan, oleh_id, dibuat_at)
         VALUES (?, ?, 'lepas', 0, ?, ?, 'Tanpa tahanan', '', ?)`,
        [`aim-${randomUUID()}`, penggunaId, saldo, rujukanId, sekarangIso()]
      );
    }

    const diminta = Math.max(0, Math.trunc(tagihRp));
    const dipotong = Math.min(diminta, Math.max(0, saldo));
    if (dipotong > 0) {
      const potong = await terapkanMutasi(tx, { penggunaId, jenis: "potong", jumlahRp: -dipotong, rujukanId, catatan: "Biaya giliran" });
      saldo = potong?.saldoSetelah ?? saldo;
    }
    return { dipotongRp: dipotong, tidakTertagihRp: diminta - dipotong, saldoSetelah: saldo, sudahDiproses: false };
  });
}

type BarisMutasi = { id: string; jenis: string; jumlah_rp: number | string; saldo_setelah: number | string; rujukan_id: string; catatan: string; dibuat_at: string };

export async function daftarMutasi(db: AletaDatabase, penggunaId: string, batas = 100): Promise<Mutasi[]> {
  const baris = await db.queryAll<BarisMutasi>(
    `SELECT id, jenis, jumlah_rp, saldo_setelah, rujukan_id, catatan, dibuat_at FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jumlah_rp <> 0 ORDER BY dibuat_at DESC, id DESC LIMIT ?`,
    [teks(penggunaId), Math.min(500, Math.max(1, batas))]
  );
  return baris.map((b) => ({
    id: b.id,
    jenis: b.jenis as JenisMutasi,
    jumlahRp: Number(b.jumlah_rp),
    saldoSetelah: Number(b.saldo_setelah),
    rujukanId: b.rujukan_id,
    catatan: b.catatan,
    waktu: b.dibuat_at,
  }));
}

/** Saldo harus = jumlah mutasi. Dipakai uji dan pemeriksaan berkala. */
export async function verifikasiSaldo(db: AletaDatabase, penggunaId: string): Promise<{ saldo: number; jumlahMutasi: number; seimbang: boolean }> {
  const saldo = await saldoPengguna(db, penggunaId);
  const baris = await db.queryOne<{ total: number | string | null }>(`SELECT COALESCE(SUM(jumlah_rp), 0) AS total FROM aleta_ai_mutasi WHERE pengguna_id = ?`, [teks(penggunaId)]);
  const jumlahMutasi = Number(baris?.total ?? 0);
  return { saldo, jumlahMutasi, seimbang: saldo === jumlahMutasi };
}

export const BATAS_ISI_SALDO_RP = 100_000_000;

/** Super Admin mengisi saldo (tahap 1: manual; QRIS di tahap 5). */
export async function isiSaldo(
  db: AletaDatabase,
  olehId: string,
  masukan: { penggunaId: string; jumlahRp: number; catatan?: string },
  penggunaAda: (id: string) => Promise<boolean>
): Promise<{ saldoRp: number }> {
  const penggunaId = teks(masukan.penggunaId);
  const jumlah = Math.trunc(Number(masukan.jumlahRp));
  if (!penggunaId) throw new ApiError(400, "Pilih pengguna yang diisi saldonya.");
  if (!Number.isFinite(jumlah) || jumlah < 1 || jumlah > BATAS_ISI_SALDO_RP) {
    throw new ApiError(400, `Jumlah isi saldo harus antara Rp1 dan Rp${BATAS_ISI_SALDO_RP.toLocaleString("id-ID")}.`);
  }
  if (!(await penggunaAda(penggunaId))) throw new ApiError(404, "Pengguna tidak ditemukan.");
  const hasil = await terapkanMutasi(db, { penggunaId, jenis: "isi", jumlahRp: jumlah, catatan: teks(masukan.catatan) || "Isi saldo manual", olehId });
  if (!hasil) throw new ApiError(500, "Saldo gagal diisi.");
  await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "saldo.isi", hasil: "ok", biayaRp: jumlah, ringkas: `Isi saldo ${penggunaId}: Rp${jumlah}` });
  return { saldoRp: hasil.saldoSetelah };
}
