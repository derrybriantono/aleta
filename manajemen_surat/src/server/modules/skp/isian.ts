import {
  PESAN_PERIODE_BELUM_DIMULAI,
  mulaiPeriodeSkpJabatan,
  periodeSkpJabatanSah,
} from "@/lib/eviden-skp-unduh";
import { rhkJabatanSkp } from "@/lib/skp-jabatan-katalog";
import type {
  AktorSkp,
  BuktiIsianSkp,
  IsianManualSkp,
  JabatanSkp,
  KunciPeriodeSkpJabatan,
  StatusIsianSkp,
} from "@/lib/skp-jabatan-tipe";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { bolehTinjauSkp } from "@/server/modules/skp/hak";
import { bacaKeadaanPegawai, hakPegawai } from "@/server/modules/skp/pegawai";
import { angkaAtauNull, bacaJsonAman, pastikanTeks, sekarangIso, tanggalIsiSah, teksAtauNull } from "@/server/modules/skp/umum";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * ISIAN MANUAL SKP (aleta_skp_isian) - indikator yang tidak terbaca dari SIPP
 * ============================================================================
 *
 * Alur: draf -> diajukan -> disetujui.
 *   - HANYA pemilik yang membuat, mengubah, dan mengajukan isiannya.
 *   - Isian diajukan hanya bila bernilai dan membawa paling sedikit satu
 *     bukti; angka tanpa bukti tidak masuk dokumen yang ditandatangani.
 *   - Atasan langsung, Ketua, Panitera, Super Admin, atau Admin menyetujui
 *     atau mengembalikan (menjadi draf dengan catatan) - bukan pemiliknya.
 *   - Isian berstatus diajukan/disetujui terkunci bagi pemilik; domain
 *     menghitung hanya isian selain draf.
 */

type BarisIsian = {
  id: string;
  user_id: string;
  periode: string;
  tahun: number;
  kunci_rhk: string;
  kunci_indikator: string;
  nilai: number | null;
  nilai_teks: string;
  catatan: string;
  bukti_json: string;
  status: string;
  diisi_oleh_id: string;
  diajukan_pada: string;
  ditinjau_oleh_id: string;
  ditinjau_pada: string;
  catatan_tinjauan: string;
  dibuat_pada: string;
  diperbarui_pada: string;
};

const KOLOM = `id, user_id, periode, tahun, kunci_rhk, kunci_indikator, nilai, nilai_teks, catatan, bukti_json, status,
  diisi_oleh_id, diajukan_pada, ditinjau_oleh_id, ditinjau_pada, catatan_tinjauan, dibuat_pada, diperbarui_pada`;

export function petakanIsian(b: BarisIsian): IsianManualSkp {
  const status: StatusIsianSkp = b.status === "disetujui" ? "disetujui" : b.status === "diajukan" ? "diajukan" : "draf";
  return {
    id: b.id,
    userId: b.user_id,
    periode: b.periode as KunciPeriodeSkpJabatan,
    tahun: Number(b.tahun),
    kunciRhk: b.kunci_rhk,
    kunciIndikator: b.kunci_indikator,
    nilai: angkaAtauNull(b.nilai),
    nilaiTeks: b.nilai_teks,
    catatan: b.catatan,
    bukti: bacaJsonAman<BuktiIsianSkp[]>(b.bukti_json, []),
    status,
    diisiOlehId: b.diisi_oleh_id,
    diajukanPada: teksAtauNull(b.diajukan_pada),
    ditinjauOlehId: teksAtauNull(b.ditinjau_oleh_id),
    ditinjauPada: teksAtauNull(b.ditinjau_pada),
    catatanTinjauan: b.catatan_tinjauan,
    dibuatPada: b.dibuat_pada,
    diperbaruiPada: b.diperbarui_pada,
  };
}

export async function bacaIsian(
  db: AletaDatabase,
  saring: { userId: string; tahun?: number; periode?: string }
): Promise<IsianManualSkp[]> {
  const where = ["user_id = ?"];
  const param: Array<string | number> = [saring.userId];
  if (saring.tahun !== undefined) {
    where.push("tahun = ?");
    param.push(saring.tahun);
  }
  if (saring.periode) {
    where.push("periode = ?");
    param.push(saring.periode);
  }
  const baris = await db.queryAll<BarisIsian>(
    `SELECT ${KOLOM} FROM aleta_skp_isian WHERE ${where.join(" AND ")} ORDER BY periode ASC, kunci_rhk ASC, kunci_indikator ASC`,
    param
  );
  return baris.map(petakanIsian);
}

async function bacaSatu(db: AletaDatabase, id: string): Promise<IsianManualSkp> {
  const baris = await db.queryOne<BarisIsian>(`SELECT ${KOLOM} FROM aleta_skp_isian WHERE id = ?`, [id]);
  if (!baris) throw new ApiError(404, "Isian manual tidak ditemukan.");
  return petakanIsian(baris);
}

function bersihkanBukti(nilai: unknown): BuktiIsianSkp[] {
  if (nilai === undefined || nilai === null) return [];
  if (!Array.isArray(nilai)) throw new ApiError(400, "Bukti harus berupa daftar.");
  if (nilai.length > 20) throw new ApiError(400, "Bukti paling banyak 20 butir.");
  return nilai.map((b, i) => {
    const o = (b ?? {}) as Record<string, unknown>;
    const judul = pastikanTeks(o.judul, `Judul bukti ${i + 1}`, 200);
    if (!judul) throw new ApiError(400, `Bukti ${i + 1} wajib diberi judul.`);
    const rujukan = pastikanTeks(o.rujukan, `Rujukan bukti ${i + 1}`, 500) || null;
    const tanggalTeks = String(o.tanggal ?? "").trim();
    const tanggal = tanggalTeks ? tanggalIsiSah(tanggalTeks) : null;
    if (tanggalTeks && !tanggal) throw new ApiError(400, `Tanggal bukti ${i + 1} harus berbentuk YYYY-MM-DD.`);
    return { judul, rujukan, tanggal };
  });
}

export type MasukanIsianSkp = {
  userId?: string | null;
  periode: string;
  tahun: number;
  kunciRhk: string;
  kunciIndikator: string;
  nilai?: number | string | null;
  nilaiTeks?: string;
  catatan?: string;
  bukti?: unknown;
};

/** Membuat/memperbarui isian DRAF milik aktor sendiri. */
export async function simpanIsian(db: AletaDatabase, aktor: AktorSkp, m: MasukanIsianSkp): Promise<IsianManualSkp> {
  const userId = String(m.userId ?? "").trim() || aktor.userId;
  if (userId !== aktor.userId) {
    throw new ApiError(403, "Isian manual hanya dapat diisi oleh pegawai yang bersangkutan.");
  }
  const tahun = Number(m.tahun);
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) throw new ApiError(400, "Tahun harus empat angka antara 2000 dan 2100.");
  const periode = String(m.periode ?? "").trim().toLowerCase();
  if (!periodeSkpJabatanSah(periode)) throw new ApiError(400, "Periode harus b01 sampai b12, tw1, tw2, tw3, tw4, atau tahun.");
  if (mulaiPeriodeSkpJabatan(periode, tahun) > waktuPengadilan().tanggal) throw new ApiError(400, PESAN_PERIODE_BELUM_DIMULAI);

  const pegawai = await bacaKeadaanPegawai(db, userId, null);
  if (!pegawai) throw new ApiError(404, "Pegawai tidak ditemukan.");
  const jabatan = [pegawai.jabatanUtama, ...pegawai.jabatanTambahan].filter((j): j is JabatanSkp => Boolean(j));
  const rhk = jabatan.flatMap((j) => rhkJabatanSkp(j)).find((r) => r.kunci === m.kunciRhk);
  const indikator = rhk?.indikator.find((i) => i.kunci === m.kunciIndikator);
  if (!rhk || !indikator) {
    throw new ApiError(400, "RHK atau indikator itu tidak ada pada jabatan pegawai ini.");
  }

  const nilai = angkaAtauNull(m.nilai);
  if (m.nilai !== null && m.nilai !== undefined && m.nilai !== "" && nilai === null) throw new ApiError(400, "Nilai harus angka.");
  if (nilai !== null && nilai < 0) throw new ApiError(400, "Nilai tidak boleh negatif.");
  const nilaiTeks = pastikanTeks(m.nilaiTeks, "Bunyi nilai", 120) || (nilai === null ? "" : String(nilai));
  const catatan = pastikanTeks(m.catatan, "Catatan", 2000);
  const bukti = bersihkanBukti(m.bukti);
  const sekarang = sekarangIso();

  return withTransaction(db, async (tx) => {
    const ada = await tx.queryOne<BarisIsian>(
      `SELECT ${KOLOM} FROM aleta_skp_isian WHERE user_id = ? AND periode = ? AND tahun = ? AND kunci_rhk = ? AND kunci_indikator = ?`,
      [userId, periode, tahun, rhk.kunci, indikator.kunci]
    );
    let id: string;
    if (ada) {
      if (ada.status !== "draf") {
        throw new ApiError(409, "Isian ini sudah diajukan dan terkunci; minta atasan mengembalikannya bila perlu diubah.");
      }
      id = ada.id;
      await tx.run(
        `UPDATE aleta_skp_isian SET nilai = ?, nilai_teks = ?, catatan = ?, bukti_json = ?, diisi_oleh_id = ?, diperbarui_pada = ? WHERE id = ?`,
        [nilai, nilaiTeks, catatan, JSON.stringify(bukti), aktor.userId, sekarang, id]
      );
    } else {
      id = await nextPrefixedId(tx, "aleta_skp_isian", "skpisi");
      await tx.run(
        `INSERT INTO aleta_skp_isian
           (id, user_id, periode, tahun, kunci_rhk, kunci_indikator, nilai, nilai_teks, catatan, bukti_json, status,
            diisi_oleh_id, dibuat_pada, diperbarui_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draf', ?, ?, ?)`,
        [id, userId, periode, tahun, rhk.kunci, indikator.kunci, nilai, nilaiTeks, catatan, JSON.stringify(bukti), aktor.userId, sekarang, sekarang]
      );
    }
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.userId,
      action: "SKP_ISIAN_SIMPAN",
      entityType: "skp_isian",
      entityId: id,
      payload: { periode, tahun, kunciRhk: rhk.kunci, kunciIndikator: indikator.kunci, jumlahBukti: bukti.length, baru: !ada },
    });
    return bacaSatu(tx, id);
  });
}

/** Pemilik mengajukan isian drafnya. Wajib bernilai dan berbukti. */
export async function ajukanIsian(db: AletaDatabase, aktor: AktorSkp, id: string): Promise<IsianManualSkp> {
  const isian = await bacaSatu(db, id);
  if (isian.userId !== aktor.userId) throw new ApiError(403, "Isian manual hanya dapat diajukan oleh pegawai yang bersangkutan.");
  if (isian.status !== "draf") throw new ApiError(409, "Isian ini sudah diajukan.");
  if (isian.nilai === null) throw new ApiError(400, "Isian belum bernilai; isi nilainya sebelum diajukan.");
  if (isian.bukti.length === 0) throw new ApiError(400, "Isian harus membawa paling sedikit satu bukti dukung sebelum diajukan.");
  const sekarang = sekarangIso();
  return withTransaction(db, async (tx) => {
    await tx.run(
      `UPDATE aleta_skp_isian SET status = 'diajukan', diajukan_pada = ?, ditinjau_oleh_id = '', ditinjau_pada = '', catatan_tinjauan = '', diperbarui_pada = ?
        WHERE id = ? AND status = 'draf'`,
      [sekarang, sekarang, id]
    );
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.userId,
      action: "SKP_ISIAN_AJUKAN",
      entityType: "skp_isian",
      entityId: id,
      payload: { periode: isian.periode, tahun: isian.tahun, kunciRhk: isian.kunciRhk, kunciIndikator: isian.kunciIndikator },
    });
    return bacaSatu(tx, id);
  });
}

/** Atasan langsung/Ketua/Panitera/Admin menyetujui atau mengembalikan isian yang diajukan. */
export async function tinjauIsian(
  db: AletaDatabase,
  aktor: AktorSkp,
  id: string,
  keputusan: "setujui" | "kembalikan",
  catatanTinjauan: string
): Promise<IsianManualSkp> {
  if (keputusan !== "setujui" && keputusan !== "kembalikan") throw new ApiError(400, "Keputusan harus setujui atau kembalikan.");
  const isian = await bacaSatu(db, id);
  const pegawai = await bacaKeadaanPegawai(db, isian.userId, null);
  if (!pegawai) throw new ApiError(404, "Pegawai pemilik isian tidak ditemukan.");
  if (!bolehTinjauSkp(aktor, hakPegawai(pegawai))) {
    throw new ApiError(403, "Hanya atasan langsung, Ketua, Panitera, atau administrator yang dapat meninjau isian ini.");
  }
  if (isian.status !== "diajukan") throw new ApiError(409, "Hanya isian yang berstatus diajukan yang dapat ditinjau.");
  const catatan = pastikanTeks(catatanTinjauan, "Catatan tinjauan", 2000);
  if (keputusan === "kembalikan" && !catatan) throw new ApiError(400, "Isian yang dikembalikan wajib disertai catatan alasannya.");
  const sekarang = sekarangIso();
  const status: StatusIsianSkp = keputusan === "setujui" ? "disetujui" : "draf";
  return withTransaction(db, async (tx) => {
    await tx.run(
      `UPDATE aleta_skp_isian SET status = ?, ditinjau_oleh_id = ?, ditinjau_pada = ?, catatan_tinjauan = ?, diperbarui_pada = ?
        WHERE id = ? AND status = 'diajukan'`,
      [status, aktor.userId, sekarang, catatan, sekarang, id]
    );
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: aktor.userId,
      action: keputusan === "setujui" ? "SKP_ISIAN_SETUJUI" : "SKP_ISIAN_KEMBALIKAN",
      entityType: "skp_isian",
      entityId: id,
      payload: { pemilik: isian.userId, periode: isian.periode, tahun: isian.tahun, kunciRhk: isian.kunciRhk, kunciIndikator: isian.kunciIndikator },
    });
    return bacaSatu(tx, id);
  });
}
