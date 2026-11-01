import { randomUUID } from "node:crypto";

import { PESAN_BATAS_SATKER_PENGGUNA, PESAN_SATKER_HABIS, PESAN_TANPA_HAK_SATKER, hakSatker, sisaBatas, type AturanSatker, type SasaranAturan } from "@/lib/aleta-ai/dompet-satker";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { awalBulanIso } from "@/server/modules/aleta-ai/batas";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { antreSaldo } from "@/server/modules/aleta-ai/saldo";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - DOMPET SATKER (1 Nov 2026)
 * ============================================================================
 *
 * Satu dompet bersama satker (tabel aleta_ai_satker_*, migrasi 0124) yang dapat dipotong pengguna menurut ATURAN yang
 * dikelola Super Admin (lib/aleta-ai/dompet-satker.ts). Pola dompet pengguna (saldo.ts) dipakai sebagai acuan dan TIDAK
 * diubah: tahan sebelum giliran -> lepas + potong biaya aktual, idempoten per rujukan, saldo = jumlah mutasi.
 *
 * Jenis mutasi: isi (+, oleh Super Admin), tahan (-), lepas (+), potong (-, pengguna_id/peran_id = pemakai), koreksi.
 * Pemakaian bulan ini per pengguna = jumlah "potong" sejak awal bulan WITA; itu yang dibandingkan dengan batas bulanan.
 */

export const ID_DOMPET_SATKER = "utama";
export const BATAS_ISI_SATKER_RP = 1_000_000_000;
const KUNCI_ANTRE = "__dompet-satker__";

const teks = (n: unknown) => String(n ?? "").trim();
const sekarangIso = () => new Date().toISOString();

export type JenisMutasiSatker = "isi" | "tahan" | "lepas" | "potong" | "koreksi";

export type MutasiSatker = {
  id: string;
  jenis: JenisMutasiSatker;
  jumlahRp: number;
  saldoSetelah: number;
  rujukanId: string;
  penggunaId: string;
  peranId: string;
  olehId: string;
  catatan: string;
  waktu: string;
};

function dalamTransaksi<T>(db: AletaDatabase, kerja: (tx: AletaDatabase) => Promise<T>): Promise<T> {
  return db.isTransactionClient() ? kerja(db) : withTransaction(db, kerja);
}

async function pastikanBaris(db: AletaDatabase) {
  const ada = await db.queryOne<{ id: string }>(`SELECT id FROM aleta_ai_satker_saldo WHERE id = ?`, [ID_DOMPET_SATKER]);
  if (ada) return;
  try {
    await db.run(`INSERT INTO aleta_ai_satker_saldo (id, saldo_rp, diubah_at) VALUES (?, 0, ?)`, [ID_DOMPET_SATKER, sekarangIso()]);
  } catch {
    /* dibuat bersamaan oleh permintaan lain */
  }
}

export async function saldoSatker(db: AletaDatabase): Promise<number> {
  const b = await db.queryOne<{ saldo_rp: number | string }>(`SELECT saldo_rp FROM aleta_ai_satker_saldo WHERE id = ?`, [ID_DOMPET_SATKER]);
  return b ? Number(b.saldo_rp) : 0;
}

type MasukanMutasiSatker = {
  jenis: JenisMutasiSatker;
  /** Bertanda. */
  jumlahRp: number;
  rujukanId?: string;
  penggunaId?: string;
  peranId?: string;
  olehId?: string;
  catatan?: string;
};

/** Satu-satunya jalan mengubah saldo satker. null bila mutasi negatif membuat saldo < 0 (tidak ada yang berubah). */
async function terapkanMutasiSatker(db: AletaDatabase, m: MasukanMutasiSatker): Promise<{ saldoSetelah: number; mutasiId: string } | null> {
  const jumlah = Math.trunc(m.jumlahRp);
  if (!Number.isFinite(jumlah) || jumlah === 0) throw new ApiError(400, "Jumlah mutasi tidak sah.");
  return dalamTransaksi(db, async (tx) => {
    await pastikanBaris(tx);
    const sekarang = sekarangIso();
    const syarat = jumlah < 0 ? ` AND saldo_rp + ? >= 0` : "";
    const hasil = await tx.run(`UPDATE aleta_ai_satker_saldo SET saldo_rp = saldo_rp + ?, diubah_at = ? WHERE id = ?${syarat}`, [jumlah, sekarang, ID_DOMPET_SATKER, ...(syarat ? [jumlah] : [])]);
    if (!hasil.changes) return null;
    const saldoSetelah = await saldoSatker(tx);
    const mutasiId = `ais-${randomUUID()}`;
    await tx.run(
      `INSERT INTO aleta_ai_satker_mutasi (id, jenis, jumlah_rp, saldo_setelah, rujukan_id, pengguna_id, peran_id, oleh_id, catatan, dibuat_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mutasiId, m.jenis, jumlah, saldoSetelah, teks(m.rujukanId), teks(m.penggunaId), teks(m.peranId), teks(m.olehId), teks(m.catatan).slice(0, 300), sekarang]
    );
    return { saldoSetelah, mutasiId };
  });
}

// ─── Isi saldo (Super Admin) ────────────────────────────────────────────────

export async function isiSaldoSatker(db: AletaDatabase, olehId: string, masukan: { jumlahRp: number; catatan?: string }): Promise<{ saldoRp: number }> {
  const jumlah = Math.trunc(Number(masukan.jumlahRp));
  if (!Number.isFinite(jumlah) || jumlah < 1 || jumlah > BATAS_ISI_SATKER_RP) {
    throw new ApiError(400, `Jumlah isi saldo satker harus antara Rp1 dan Rp${BATAS_ISI_SATKER_RP.toLocaleString("id-ID")}.`);
  }
  const hasil = await antreSaldo(KUNCI_ANTRE, () => terapkanMutasiSatker(db, { jenis: "isi", jumlahRp: jumlah, olehId, catatan: teks(masukan.catatan) || "Isi saldo satker" }));
  if (!hasil) throw new ApiError(500, "Saldo satker gagal diisi.");
  await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "satker.isi", hasil: "ok", biayaRp: jumlah, ringkas: `Isi saldo satker: Rp${jumlah}` });
  return { saldoRp: hasil.saldoSetelah };
}

// ─── Pemakaian (tahan -> lepas + potong) ────────────────────────────────────

type Pemakai = { id: string; peranId: string };

async function totalTahanan(db: AletaDatabase, rujukanId: string): Promise<{ tahan: number; sudahLepas: boolean }> {
  const baris = await db.queryAll<{ jenis: string; jumlah_rp: number | string }>(
    `SELECT jenis, jumlah_rp FROM aleta_ai_satker_mutasi WHERE rujukan_id = ? AND jenis IN ('tahan', 'lepas')`,
    [rujukanId]
  );
  let tahan = 0;
  let sudahLepas = false;
  for (const b of baris) {
    if (b.jenis === "tahan") tahan += -Number(b.jumlah_rp);
    if (b.jenis === "lepas") sudahLepas = true;
  }
  return { tahan, sudahLepas };
}

/** Tahan dana satker sebelum giliran. false = saldo satker tidak cukup (tidak ada yang berubah). Dipanggil lagi = menambah tahanan. */
export async function tahanSatker(db: AletaDatabase, pemakai: Pemakai, jumlahRp: number, rujukanId: string): Promise<boolean> {
  if (jumlahRp <= 0) return true;
  const hasil = await antreSaldo(KUNCI_ANTRE, () =>
    terapkanMutasiSatker(db, { jenis: "tahan", jumlahRp: -Math.trunc(jumlahRp), rujukanId, penggunaId: pemakai.id, peranId: pemakai.peranId, catatan: "Dana ditahan untuk giliran" })
  );
  return hasil !== null;
}

/** Menutup satu giliran: tahanan dilepas lalu biaya aktual dipotong (tidak melebihi saldo). Idempoten per rujukan. */
export async function selesaikanSatker(
  db: AletaDatabase,
  pemakai: Pemakai,
  rujukanId: string,
  tagihRp: number
): Promise<{ dipotongRp: number; tidakTertagihRp: number; saldoSetelah: number; sudahDiproses: boolean }> {
  return antreSaldo(KUNCI_ANTRE, () =>
    dalamTransaksi(db, async (tx) => {
      await pastikanBaris(tx);
      const { tahan, sudahLepas } = await totalTahanan(tx, rujukanId);
      if (sudahLepas) return { dipotongRp: 0, tidakTertagihRp: 0, saldoSetelah: await saldoSatker(tx), sudahDiproses: true };
      let saldo = await saldoSatker(tx);
      const dasar = { rujukanId, penggunaId: pemakai.id, peranId: pemakai.peranId };
      if (tahan > 0) {
        const lepas = await terapkanMutasiSatker(tx, { ...dasar, jenis: "lepas", jumlahRp: tahan, catatan: "Tahanan dilepas" });
        saldo = lepas?.saldoSetelah ?? saldo;
      } else {
        await tx.run(
          `INSERT INTO aleta_ai_satker_mutasi (id, jenis, jumlah_rp, saldo_setelah, rujukan_id, pengguna_id, peran_id, oleh_id, catatan, dibuat_at) VALUES (?, 'lepas', 0, ?, ?, ?, ?, '', 'Tanpa tahanan', ?)`,
          [`ais-${randomUUID()}`, saldo, rujukanId, pemakai.id, pemakai.peranId, sekarangIso()]
        );
      }
      const diminta = Math.max(0, Math.trunc(tagihRp));
      const dipotong = Math.min(diminta, Math.max(0, saldo));
      if (dipotong > 0) {
        const potong = await terapkanMutasiSatker(tx, { ...dasar, jenis: "potong", jumlahRp: -dipotong, catatan: "Biaya giliran" });
        saldo = potong?.saldoSetelah ?? saldo;
      }
      return { dipotongRp: dipotong, tidakTertagihRp: diminta - dipotong, saldoSetelah: saldo, sudahDiproses: false };
    })
  );
}

// ─── Riwayat dan pemeriksaan ────────────────────────────────────────────────

type BarisMutasi = {
  id: string;
  jenis: string;
  jumlah_rp: number | string;
  saldo_setelah: number | string;
  rujukan_id: string;
  pengguna_id: string;
  peran_id: string;
  oleh_id: string;
  catatan: string;
  dibuat_at: string;
};

/** Riwayat isi dan pemakaian (siapa/kapan/berapa), terbaru dulu. Mutasi tahan/lepas nol tidak ditampilkan. */
export async function riwayatSatker(db: AletaDatabase, batas = 100): Promise<MutasiSatker[]> {
  const baris = await db.queryAll<BarisMutasi>(
    `SELECT id, jenis, jumlah_rp, saldo_setelah, rujukan_id, pengguna_id, peran_id, oleh_id, catatan, dibuat_at
     FROM aleta_ai_satker_mutasi WHERE jumlah_rp <> 0 AND jenis IN ('isi', 'potong', 'koreksi') ORDER BY dibuat_at DESC, id DESC LIMIT ?`,
    [Math.min(500, Math.max(1, Math.trunc(batas)))]
  );
  return baris.map((b) => ({
    id: b.id,
    jenis: b.jenis as JenisMutasiSatker,
    jumlahRp: Number(b.jumlah_rp),
    saldoSetelah: Number(b.saldo_setelah),
    rujukanId: b.rujukan_id,
    penggunaId: b.pengguna_id,
    peranId: b.peran_id,
    olehId: b.oleh_id,
    catatan: b.catatan,
    waktu: b.dibuat_at,
  }));
}

/** Saldo harus = jumlah mutasi. */
export async function verifikasiSatker(db: AletaDatabase): Promise<{ saldo: number; jumlahMutasi: number; seimbang: boolean }> {
  const saldo = await saldoSatker(db);
  const b = await db.queryOne<{ total: number | string | null }>(`SELECT COALESCE(SUM(jumlah_rp), 0) AS total FROM aleta_ai_satker_mutasi`);
  const jumlahMutasi = Number(b?.total ?? 0);
  return { saldo, jumlahMutasi, seimbang: saldo === jumlahMutasi };
}

/** Pemakaian satker bulan ini (WITA) oleh satu pengguna. */
export async function pemakaianSatkerPengguna(db: AletaDatabase, penggunaId: string, sekarang: Date = new Date()): Promise<number> {
  const b = await db.queryOne<{ total: number | string | null }>(
    `SELECT COALESCE(SUM(-jumlah_rp), 0) AS total FROM aleta_ai_satker_mutasi WHERE jenis = 'potong' AND pengguna_id = ? AND dibuat_at >= ?`,
    [penggunaId, awalBulanIso(sekarang)]
  );
  return Number(b?.total ?? 0);
}

/** Pemakaian bulan ini per pengguna (untuk layar Super Admin). */
export async function pemakaianSatkerBulanIni(db: AletaDatabase, sekarang: Date = new Date()): Promise<Array<{ penggunaId: string; peranId: string; terpakaiRp: number }>> {
  const baris = await db.queryAll<{ pengguna_id: string; peran_id: string; total: number | string }>(
    `SELECT pengguna_id, MAX(peran_id) AS peran_id, SUM(-jumlah_rp) AS total FROM aleta_ai_satker_mutasi WHERE jenis = 'potong' AND dibuat_at >= ? GROUP BY pengguna_id ORDER BY total DESC`,
    [awalBulanIso(sekarang)]
  );
  return baris.map((b) => ({ penggunaId: b.pengguna_id, peranId: b.peran_id, terpakaiRp: Number(b.total) }));
}

// ─── Aturan ─────────────────────────────────────────────────────────────────

export const BATAS_BATAS_BULANAN_RP = 1_000_000_000;

export async function bacaAturanSatker(db: AletaDatabase): Promise<AturanSatker[]> {
  const baris = await db.queryAll<{ sasaran: string; sasaran_id: string; boleh: number | string; batas_bulanan_rp: number | string }>(
    `SELECT sasaran, sasaran_id, boleh, batas_bulanan_rp FROM aleta_ai_satker_aturan ORDER BY sasaran, sasaran_id`
  );
  return baris.map((b) => ({ sasaran: b.sasaran as SasaranAturan, sasaranId: b.sasaran_id, boleh: Number(b.boleh) === 1, batasBulananRp: Number(b.batas_bulanan_rp) }));
}

/** Menyimpan (membuat atau mengganti) satu aturan. Hanya Super Admin (rute). */
export async function simpanAturanSatker(db: AletaDatabase, olehId: string, a: { sasaran?: unknown; sasaranId?: unknown; boleh?: unknown; batasBulananRp?: unknown }): Promise<AturanSatker[]> {
  const sasaran = teks(a.sasaran);
  const sasaranId = teks(a.sasaranId);
  if (sasaran !== "peran" && sasaran !== "pengguna") throw new ApiError(400, "Aturan berlaku untuk peran atau untuk satu pengguna.");
  if (!sasaranId || sasaranId.length > 80) throw new ApiError(400, sasaran === "peran" ? "Pilih peran untuk aturan ini." : "Pilih pengguna untuk aturan ini.");
  const batas = Math.trunc(Number(a.batasBulananRp ?? 0));
  if (!Number.isFinite(batas) || batas < 0 || batas > BATAS_BATAS_BULANAN_RP) {
    throw new ApiError(400, `Batas bulanan harus antara Rp0 (tanpa batas) dan Rp${BATAS_BATAS_BULANAN_RP.toLocaleString("id-ID")}.`);
  }
  const boleh = a.boleh === true || a.boleh === 1 || a.boleh === "1" ? 1 : 0;
  const sekarang = sekarangIso();
  const ada = await db.queryOne<{ id: string }>(`SELECT id FROM aleta_ai_satker_aturan WHERE sasaran = ? AND sasaran_id = ?`, [sasaran, sasaranId]);
  if (ada) {
    await db.run(`UPDATE aleta_ai_satker_aturan SET boleh = ?, batas_bulanan_rp = ?, diubah_oleh = ?, diubah_at = ? WHERE id = ?`, [boleh, batas, olehId, sekarang, ada.id]);
  } else {
    await db.run(`INSERT INTO aleta_ai_satker_aturan (id, sasaran, sasaran_id, boleh, batas_bulanan_rp, diubah_oleh, diubah_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [`aia-${randomUUID()}`, sasaran, sasaranId, boleh, batas, olehId, sekarang]);
  }
  await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "satker.aturan", hasil: "ok", ringkas: `Aturan satker ${sasaran} ${sasaranId}: ${boleh ? "boleh" : "tidak boleh"}, batas bulanan Rp${batas}` });
  return bacaAturanSatker(db);
}

export async function hapusAturanSatker(db: AletaDatabase, olehId: string, sasaran: unknown, sasaranId: unknown): Promise<AturanSatker[]> {
  const s = teks(sasaran);
  const id = teks(sasaranId);
  await db.run(`DELETE FROM aleta_ai_satker_aturan WHERE sasaran = ? AND sasaran_id = ?`, [s, id]);
  await catatJejak(db, { penggunaId: olehId, peranId: "super-admin", aksi: "satker.aturan", hasil: "hapus", ringkas: `Aturan satker ${s} ${id} dihapus` });
  return bacaAturanSatker(db);
}

// ─── Hak pakai satu pengguna ────────────────────────────────────────────────

export type KeadaanSatker = {
  /** Aturan mengizinkan pengguna ini memakai dompet satker. */
  boleh: boolean;
  saldoRp: number;
  batasBulananRp: number;
  terpakaiBulanIniRp: number;
  /** null = tanpa batas bulanan. */
  sisaBatasRp: number | null;
  alasan?: string;
};

export async function keadaanSatkerPengguna(db: AletaDatabase, pelaku: PelakuAi, sekarang: Date = new Date()): Promise<KeadaanSatker> {
  const hak = hakSatker(await bacaAturanSatker(db), { id: pelaku.id, peranId: pelaku.peranId, peranTambahan: pelaku.peranTambahan });
  const saldoRp = await saldoSatker(db);
  const terpakai = await pemakaianSatkerPengguna(db, pelaku.id, sekarang);
  return {
    boleh: hak.boleh,
    saldoRp,
    batasBulananRp: hak.batasBulananRp,
    terpakaiBulanIniRp: terpakai,
    sisaBatasRp: hak.boleh ? sisaBatas(hak.batasBulananRp, terpakai) : null,
    ...(hak.alasan ? { alasan: hak.alasan } : {}),
  };
}

// ─── Penilaian satu giliran terhadap dompet satker ──────────────────────────

export type PenilaianSatker = { ok: true; saldoRp: number; sisaBatasRp: number | null } | { ok: false; alasan: string; saldoRp: number };

/**
 * Boleh atau tidak giliran berbiaya `perkiraanRp` dibebankan ke dompet satker oleh `pelaku`: hak menurut aturan, saldo satker
 * (habis = kalimat "saldo satker habis"), dan batas bulanan pengguna. Pengguna selalu dapat kembali ke saldonya sendiri.
 */
export async function nilaiDompetSatker(db: AletaDatabase, pelaku: PelakuAi, perkiraanRp: number, minimumRp: number, sekarang: Date = new Date()): Promise<PenilaianSatker> {
  const k = await keadaanSatkerPengguna(db, pelaku, sekarang);
  if (!k.boleh) return { ok: false, alasan: k.alasan ?? PESAN_TANPA_HAK_SATKER, saldoRp: k.saldoRp };
  if (k.saldoRp < Math.max(1, minimumRp)) return { ok: false, alasan: PESAN_SATKER_HABIS, saldoRp: k.saldoRp };
  if (k.saldoRp < perkiraanRp) {
    return { ok: false, alasan: `Saldo satker (Rp${k.saldoRp.toLocaleString("id-ID")}) tidak cukup untuk giliran ini (perkiraan Rp${perkiraanRp.toLocaleString("id-ID")}). Pakai saldo Anda sendiri atau hubungi Super Admin.`, saldoRp: k.saldoRp };
  }
  if (k.sisaBatasRp !== null && (k.sisaBatasRp < Math.max(1, minimumRp) || k.sisaBatasRp < perkiraanRp)) return { ok: false, alasan: PESAN_BATAS_SATKER_PENGGUNA, saldoRp: k.saldoRp };
  return { ok: true, saldoRp: k.saldoRp, sisaBatasRp: k.sisaBatasRp };
}
