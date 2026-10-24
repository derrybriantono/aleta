import { randomUUID } from "node:crypto";

import { getEffectiveRoleId } from "@/lib/permissions";
import type { AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { antreSaldo, saldoPengguna, terapkanMutasi } from "@/server/modules/aleta-ai/saldo";
import { getUsersFromDb } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - KUOTA HIBAH PER PERAN (tahap 4, opsional)
 * ============================================================================
 *
 * Super Admin dapat memberi setiap peran kuota rupiah per bulan
 * (aleta_ai_kuota_peran). Kuota TIDAK disimpan sebagai angka terpisah: tiap
 * pemberian adalah satu mutasi "kuota" di buku mutasi dengan rujukan
 * kuota:<YYYY-MM>:<peran>, sehingga saldo tetap = jumlah mutasi.
 *
 * Pemberian berlangsung malas (saat pengguna memakai ALETA Ai atau membuka
 * Dompet pada bulan itu) atau serentak oleh Super Admin; keduanya idempoten:
 * satu pengguna menerima kuota satu peran paling banyak sekali per bulan.
 * Super Admin tidak menerima kuota (sudah gratis).
 *
 * KUOTA HANGUS DI AKHIR BULAN (keputusan pengguna 24 Okt 2026):
 *   - kuota dipakai LEBIH DULU: potongan giliran sesudah kuota diberikan pada
 *     bulan itu mengurangi kuota sebelum saldo isi;
 *   - sisa kuota bulan lalu ditarik dengan mutasi "kuota-hangus" (rujukan
 *     kuota-hangus:<YYYY-MM>) pada kegiatan pertama sesudah pergantian bulan
 *     WITA, SEBELUM kuota bulan baru diberikan; tidak melebihi saldo;
 *   - saldo isi/manual tidak pernah ikut hangus;
 *   - sekali per pengguna per bulan (aman dipanggil ganda): bila sisa 0, tetap
 *     ditulis penanda bernilai Rp0 (tidak tampil di mutasi).
 */

export const BATAS_KUOTA_RP = 10_000_000;

export type KuotaPeran = { peranId: string; kuotaBulananRp: number };

const teks = (n: unknown) => String(n ?? "").trim();

export async function bacaKuotaPeran(db: AletaDatabase): Promise<KuotaPeran[]> {
  const baris = await db.queryAll<{ peran_id: string; kuota_bulanan_rp: number | string }>(`SELECT peran_id, kuota_bulanan_rp FROM aleta_ai_kuota_peran ORDER BY peran_id`);
  return baris.map((b) => ({ peranId: b.peran_id, kuotaBulananRp: Number(b.kuota_bulanan_rp) || 0 }));
}

/** Super Admin. Kuota 0 = menghapus kuota peran itu. */
export async function simpanKuotaPeran(db: AletaDatabase, olehId: string, daftar: KuotaPeran[]): Promise<KuotaPeran[]> {
  if (!Array.isArray(daftar)) throw new ApiError(400, "Daftar kuota tidak sah.");
  const bersih = daftar.map((k) => {
    const peranId = teks(k?.peranId);
    const rp = Math.trunc(Number(k?.kuotaBulananRp));
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(peranId)) throw new ApiError(400, "Peran tidak sah.");
    if (peranId === "super-admin") throw new ApiError(400, "Super Admin sudah gratis; tidak perlu kuota.");
    if (!Number.isFinite(rp) || rp < 0 || rp > BATAS_KUOTA_RP) throw new ApiError(400, `Kuota peran ${peranId} harus antara Rp0 dan Rp${BATAS_KUOTA_RP.toLocaleString("id-ID")}.`);
    return { peranId, kuotaBulananRp: rp };
  });
  const sekarang = new Date().toISOString();
  for (const k of bersih) {
    if (k.kuotaBulananRp === 0) {
      await db.run(`DELETE FROM aleta_ai_kuota_peran WHERE peran_id = ?`, [k.peranId]);
      continue;
    }
    const hasil = await db.run(`UPDATE aleta_ai_kuota_peran SET kuota_bulanan_rp = ?, diubah_oleh = ?, diubah_at = ? WHERE peran_id = ?`, [k.kuotaBulananRp, olehId, sekarang, k.peranId]);
    if (!hasil.changes) {
      await db.run(`INSERT INTO aleta_ai_kuota_peran (peran_id, kuota_bulanan_rp, diubah_oleh, diubah_at) VALUES (?, ?, ?, ?)`, [k.peranId, k.kuotaBulananRp, olehId, sekarang]);
    }
  }
  if (bersih.length) {
    await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "admin.kuota", hasil: "ok", ringkas: `Kuota: ${bersih.map((k) => `${k.peranId}=Rp${k.kuotaBulananRp}`).join(", ")}` });
  }
  return bacaKuotaPeran(db);
}

export const rujukanKuota = (bulan: string, peranId: string) => `kuota:${bulan}:${peranId}`;
export const rujukanKuotaHangus = (bulan: string) => `kuota-hangus:${bulan}`;

const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Awal bulan (WITA) sebagai ISO UTC; `geser` bulan ke depan. */
function awalBulanIso(bulan: string, geser = 0): string {
  const [t, b] = bulan.split("-").map(Number) as [number, number];
  const n = t * 12 + (b - 1) + geser;
  return new Date(`${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}-01T00:00:00+08:00`).toISOString();
}

/** "31 Okt 2026": hari terakhir bulan itu (kuota hangus sesudahnya). */
export function tanggalHangus(bulan: string): string {
  const [t, b] = bulan.split("-").map(Number) as [number, number];
  return `${new Date(Date.UTC(t, b, 0)).getUTCDate()} ${NAMA_BULAN[b - 1]} ${t}`;
}

export type RincianKuota = { bulan: string; diberikanRp: number; terpakaiRp: number; sisaRp: number; hangus: string };

/**
 * Kuota satu bulan: diberikan, terpakai (potongan giliran sesudah kuota
 * diberikan, dalam bulan itu - kuota dipakai lebih dulu), dan sisa (tidak
 * lebih dari saldo sekarang).
 */
export async function rincianKuota(db: AletaDatabase, penggunaId: string, bulan: string): Promise<RincianKuota> {
  const kuota = await db.queryAll<{ jumlah_rp: number | string; dibuat_at: string }>(
    `SELECT jumlah_rp, dibuat_at FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jenis = 'kuota' AND rujukan_id LIKE ?`,
    [penggunaId, `kuota:${bulan}:%`]
  );
  const diberikanRp = kuota.reduce((n, k) => n + Number(k.jumlah_rp), 0);
  if (!(diberikanRp > 0)) return { bulan, diberikanRp: 0, terpakaiRp: 0, sisaRp: 0, hangus: tanggalHangus(bulan) };
  const sejak = kuota.map((k) => k.dibuat_at).sort()[0] as string;
  const potong = await db.queryOne<{ n: number | string | null }>(
    `SELECT COALESCE(SUM(jumlah_rp), 0) AS n FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jenis = 'potong' AND dibuat_at >= ? AND dibuat_at < ?`,
    [penggunaId, sejak, awalBulanIso(bulan, 1)]
  );
  const terpakaiRp = Math.min(diberikanRp, -Number(potong?.n ?? 0));
  const saldo = await saldoPengguna(db, penggunaId);
  return { bulan, diberikanRp, terpakaiRp, sisaRp: Math.max(0, Math.min(diberikanRp - terpakaiRp, saldo)), hangus: tanggalHangus(bulan) };
}

/**
 * Menarik sisa kuota SEMUA bulan sebelum bulan `sekarang` yang belum ditarik.
 * Dipanggil di dalam antrean saldo pengguna. Kembalian = rupiah yang hangus.
 */
async function hanguskanKuotaLalu(db: AletaDatabase, penggunaId: string, sekarang: Date): Promise<number> {
  const bulanIni = tanggalLokal(sekarang).slice(0, 7);
  const baris = await db.queryAll<{ jenis: string; rujukan_id: string }>(
    `SELECT jenis, rujukan_id FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jenis IN ('kuota', 'kuota-hangus')`,
    [penggunaId]
  );
  const sudah = new Set(baris.filter((b) => b.jenis === "kuota-hangus").map((b) => b.rujukan_id));
  const bulanKuota = [...new Set(baris.filter((b) => b.jenis === "kuota").map((b) => b.rujukan_id.split(":")[1] ?? ""))]
    .filter((b) => /^\d{4}-\d{2}$/.test(b) && b < bulanIni && !sudah.has(rujukanKuotaHangus(b)))
    .sort();
  let total = 0;
  for (const bulan of bulanKuota) {
    const r = await rincianKuota(db, penggunaId, bulan);
    if (r.sisaRp > 0) {
      await terapkanMutasi(db, { penggunaId, jenis: "kuota-hangus", jumlahRp: -r.sisaRp, rujukanId: rujukanKuotaHangus(bulan), catatan: `Sisa kuota ${bulan} hangus` });
      total += r.sisaRp;
    } else {
      // Penanda Rp0 supaya bulan itu tidak diperiksa lagi (tidak mengubah saldo).
      await db.run(
        `INSERT INTO aleta_ai_mutasi (id, pengguna_id, jenis, jumlah_rp, saldo_setelah, rujukan_id, catatan, oleh_id, dibuat_at) VALUES (?, ?, 'kuota-hangus', 0, ?, ?, 'Kuota habis terpakai', '', ?)`,
        [`aim-${randomUUID()}`, penggunaId, await saldoPengguna(db, penggunaId), rujukanKuotaHangus(bulan), new Date().toISOString()]
      );
    }
  }
  return total;
}

/**
 * Memberi kuota bulan ini kepada pelaku bila perannya berkuota dan belum
 * menerimanya. Kembalian = rupiah yang diberikan sekarang (0 bila tidak ada /
 * sudah). Tidak pernah melempar (kuota tidak boleh menggagalkan giliran).
 */
export async function pastikanKuotaBulanIni(db: AletaDatabase, pelaku: Pick<PelakuAi, "id" | "peranId" | "superAdmin">, sekarang: Date = new Date()): Promise<number> {
  if (!pelaku.id) return 0;
  try {
    // Sisa kuota bulan lalu hangus lebih dulu - juga bila peran itu kini tidak berkuota lagi.
    await antreSaldo(pelaku.id, () => hanguskanKuotaLalu(db, pelaku.id, sekarang));
    if (pelaku.superAdmin || !pelaku.peranId) return 0;
    const baris = await db.queryOne<{ kuota_bulanan_rp: number | string }>(`SELECT kuota_bulanan_rp FROM aleta_ai_kuota_peran WHERE peran_id = ?`, [pelaku.peranId]);
    const rp = Math.trunc(Number(baris?.kuota_bulanan_rp ?? 0));
    if (!(rp > 0)) return 0;
    const bulan = tanggalLokal(sekarang).slice(0, 7);
    const rujukan = rujukanKuota(bulan, pelaku.peranId);
    return await antreSaldo(pelaku.id, async () => {
      const ada = await db.queryOne<{ id: string }>(`SELECT id FROM aleta_ai_mutasi WHERE pengguna_id = ? AND jenis = 'kuota' AND rujukan_id = ? LIMIT 1`, [pelaku.id, rujukan]);
      if (ada) return 0;
      await terapkanMutasi(db, { penggunaId: pelaku.id, jenis: "kuota", jumlahRp: rp, rujukanId: rujukan, catatan: `Kuota hibah ${bulan} (peran ${pelaku.peranId})` });
      return rp;
    });
  } catch {
    return 0;
  }
}

/** Super Admin: beri kuota bulan ini ke SEMUA pengguna aktif yang perannya berkuota (idempoten). */
export async function berikanKuotaSemua(db: AletaDatabase, olehId: string, sekarang: Date = new Date()): Promise<{ penerima: number; totalRp: number }> {
  let penerima = 0;
  let totalRp = 0;
  for (const u of await getUsersFromDb(db)) {
    if (!u.isActive) continue;
    const peranId = String(getEffectiveRoleId(u) ?? u.roleId ?? "");
    const rp = await pastikanKuotaBulanIni(db, { id: String(u.id), peranId, superAdmin: peranId === "super-admin" }, sekarang);
    if (rp > 0) {
      penerima += 1;
      totalRp += rp;
    }
  }
  await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "admin.kuota.berikan", hasil: "ok", biayaRp: totalRp, ringkas: `Kuota bulan ${tanggalLokal(sekarang).slice(0, 7)}: ${penerima} pengguna` });
  return { penerima, totalRp };
}
