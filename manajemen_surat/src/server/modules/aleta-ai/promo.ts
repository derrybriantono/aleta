import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import type { PelakuAi } from "@/server/modules/aleta-ai/akses";
import { tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { catatJejak } from "@/server/modules/aleta-ai/pengaturan";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ALETA Ai - PROGRAM PROMOSI "GRATIS PAKAI ALETA Ai" (27 Okt 2026)
 * ============================================================================
 *
 * Diatur Super Admin. Selama program menyala, dalam periode (tanggal WITA, awal
 * dan akhir TERMASUK), untuk pengguna sasaran (semua peran atau peran tertentu):
 *
 *   - giliran dan jalan tugas ditagih Rp0: tidak memotong saldo atau kuota dan
 *     tidak butuh saldo, selama jatah masih ada;
 *   - jatah per pengguna = giliran per hari (0 = tanpa batas giliran) DAN/ATAU
 *     nilai rupiah-setara selama periode (0 = tanpa batas rupiah); salah satu
 *     yang habis = jatah habis;
 *   - pengaman tagihan API: total biaya API promosi satker selama periode tidak
 *     boleh melampaui batas; bila habis, promosi berhenti untuk SEMUA orang;
 *   - sesudah jatah habis, alur biasa berlaku (kuota, lalu saldo) dengan pesan
 *     jelas. Batas harian, batas satker bulanan, dan batas laju TETAP berlaku.
 *
 * Pengaturan disimpan di aleta_ai_pengaturan (kunci promo_konfig, JSON); pemakaian
 * di aleta_ai_promo_pakai (0113). Giliran gagal atau ditolak tanpa keluaran tidak
 * memakai jatah (dihitung = 0), tetapi biaya APInya tetap dicatat.
 */

export const KUNCI_PROMO = "promo_konfig";

export type KonfigPromo = {
  aktif: boolean;
  /** Tanggal WITA (YYYY-MM-DD), termasuk. Kosong = belum diatur. */
  mulai: string;
  akhir: string;
  judul: string;
  teks: string;
  /** true = semua pengguna; false = hanya peran di `peran`. */
  semuaPeran: boolean;
  peran: string[];
  /** Giliran gratis per pengguna per hari; 0 = tanpa batas giliran. */
  giliranPerHari: number;
  /** Nilai rupiah-setara gratis per pengguna selama periode; 0 = tanpa batas rupiah. */
  rupiahPeriode: number;
  /** Batas total biaya API promosi satker selama periode (Rp, kurs dasar). */
  batasSatkerRp: number;
};

export const PROMO_BAWAAN: KonfigPromo = {
  aktif: false,
  mulai: "",
  akhir: "",
  judul: "Gratis mencoba ALETA Ai",
  teks: "Coba ALETA Ai tanpa biaya selama masa promosi.",
  semuaPeran: true,
  peran: [],
  giliranPerHari: 20,
  rupiahPeriode: 25_000,
  batasSatkerRp: 500_000,
};

export const BATAS_PERIODE_HARI = 366;
const BATAS_RP = 10_000_000_000;

export type AlasanPromo =
  | ""
  | "mati"
  | "belum-mulai"
  | "berakhir"
  | "bukan-sasaran"
  | "super-admin"
  | "jatah-harian-habis"
  | "jatah-rupiah-habis"
  | "batas-promo-habis";

export type StatusPromo = {
  /** Layar boleh menampilkan pita/lencana promosi untuk pengguna ini. */
  tampil: boolean;
  /** Giliran/tugas berikutnya digratiskan oleh promosi. */
  berlaku: boolean;
  alasan: AlasanPromo;
  /** Pesan ramah bila tampil tetapi tidak berlaku (jatah habis dst.). */
  pesan: string;
  judul: string;
  teks: string;
  mulai: string;
  akhir: string;
  /** "31 Okt 2026". */
  akhirTeks: string;
  giliranPerHari: number;
  terpakaiGiliranHariIni: number;
  /** null = tanpa batas giliran. */
  sisaGiliranHariIni: number | null;
  rupiahPeriode: number;
  terpakaiRupiah: number;
  /** null = tanpa batas rupiah. */
  sisaRupiah: number | null;
};

const teks = (n: unknown) => String(n ?? "").trim();
const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function tanggalSah(t: string): boolean {
  if (!TANGGAL.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t;
}

export function tanggalPanjang(t: string): string {
  if (!tanggalSah(t)) return t;
  const [y, m, d] = t.split("-").map(Number) as [number, number, number];
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** Awal tanggal WITA sebagai ISO UTC. */
const awalIso = (t: string) => new Date(`${t}T00:00:00+08:00`).toISOString();
/** Awal HARI SESUDAH tanggal itu (batas atas periode, tidak termasuk). */
const sesudahIso = (t: string) => new Date(new Date(`${t}T00:00:00+08:00`).getTime() + 86_400_000).toISOString();

function hariAntara(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

// ----------------------------------------------------------------------------
// Pengaturan
// ----------------------------------------------------------------------------

function normalisasi(mentah: unknown): KonfigPromo {
  const m = (mentah && typeof mentah === "object" ? mentah : {}) as Record<string, unknown>;
  const angka = (v: unknown, cadangan: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : cadangan);
  return {
    aktif: m.aktif === true,
    mulai: tanggalSah(teks(m.mulai)) ? teks(m.mulai) : "",
    akhir: tanggalSah(teks(m.akhir)) ? teks(m.akhir) : "",
    judul: teks(m.judul).slice(0, 80) || PROMO_BAWAAN.judul,
    teks: teks(m.teks).slice(0, 240) || PROMO_BAWAAN.teks,
    semuaPeran: m.semuaPeran !== false,
    peran: Array.isArray(m.peran) ? [...new Set(m.peran.map((p) => teks(p)).filter((p) => /^[a-z0-9][a-z0-9_-]{1,63}$/i.test(p)))] : [],
    giliranPerHari: angka(m.giliranPerHari, PROMO_BAWAAN.giliranPerHari),
    rupiahPeriode: angka(m.rupiahPeriode, PROMO_BAWAAN.rupiahPeriode),
    batasSatkerRp: angka(m.batasSatkerRp, PROMO_BAWAAN.batasSatkerRp),
  };
}

export async function bacaPromo(db: AletaDatabase): Promise<KonfigPromo> {
  const baris = await db.queryOne<{ nilai: string }>(`SELECT nilai FROM aleta_ai_pengaturan WHERE kunci = ?`, [KUNCI_PROMO]);
  if (!baris?.nilai) return { ...PROMO_BAWAAN };
  try {
    return normalisasi(JSON.parse(baris.nilai));
  } catch {
    return { ...PROMO_BAWAAN };
  }
}

/** Memeriksa konfigurasi yang akan disimpan; melempar 400 berpesan jelas. */
export function periksaKonfigPromo(k: KonfigPromo): void {
  for (const [nama, n, maks] of [
    ["Giliran per hari", k.giliranPerHari, 100_000],
    ["Nilai rupiah per pengguna", k.rupiahPeriode, BATAS_RP],
    ["Batas biaya promosi satker", k.batasSatkerRp, BATAS_RP],
  ] as const) {
    if (!Number.isInteger(n) || n < 0 || n > maks) throw new ApiError(400, `${nama} harus bilangan bulat 0 sampai ${maks.toLocaleString("id-ID")}.`);
  }
  if (!k.semuaPeran && k.peran.length === 0) throw new ApiError(400, "Pilih minimal satu peran sasaran, atau pilih semua pengguna.");
  if (!k.aktif) return;
  if (!tanggalSah(k.mulai) || !tanggalSah(k.akhir)) throw new ApiError(400, "Isi tanggal mulai dan tanggal berakhir promosi (WITA).");
  if (k.akhir < k.mulai) throw new ApiError(400, "Tanggal berakhir tidak boleh sebelum tanggal mulai.");
  if (hariAntara(k.mulai, k.akhir) + 1 > BATAS_PERIODE_HARI) throw new ApiError(400, `Periode promosi paling panjang ${BATAS_PERIODE_HARI} hari.`);
  if (k.giliranPerHari === 0 && k.rupiahPeriode === 0) throw new ApiError(400, "Isi jatah giliran per hari atau nilai rupiah per pengguna (minimal salah satu).");
  if (k.batasSatkerRp < 1) throw new ApiError(400, "Isi batas total biaya promosi satker (pengaman tagihan API) lebih dari Rp0.");
}

export type PerubahanPromo = Partial<KonfigPromo>;

/** Super Admin. Perubahan sebagian diterima; hasilnya diperiksa utuh. Tercatat di jejak. */
export async function simpanPromo(db: AletaDatabase, olehId: string, masukan: PerubahanPromo): Promise<KonfigPromo> {
  if (!masukan || typeof masukan !== "object") throw new ApiError(400, "Isi pengaturan promosi tidak terbaca.");
  const lama = await bacaPromo(db);
  const m = masukan as Record<string, unknown>;
  for (const k of ["giliranPerHari", "rupiahPeriode", "batasSatkerRp"] as const) {
    if (m[k] !== undefined && !(typeof m[k] === "number" && Number.isFinite(m[k]))) throw new ApiError(400, "Jatah dan batas promosi harus berupa angka.");
  }
  if (m.aktif !== undefined && typeof m.aktif !== "boolean") throw new ApiError(400, "Saklar promosi harus berupa ya/tidak.");
  if (m.peran !== undefined && !Array.isArray(m.peran)) throw new ApiError(400, "Daftar peran sasaran tidak sah.");
  const baru = normalisasi({ ...lama, ...masukan });
  periksaKonfigPromo(baru);
  const nilai = JSON.stringify(baru);
  const waktu = new Date().toISOString();
  const hasil = await db.run(`UPDATE aleta_ai_pengaturan SET nilai = ?, diubah_oleh = ?, diubah_at = ? WHERE kunci = ?`, [nilai, olehId, waktu, KUNCI_PROMO]);
  if (!hasil.changes) {
    await db.run(`INSERT INTO aleta_ai_pengaturan (kunci, nilai, diubah_oleh, diubah_at) VALUES (?, ?, ?, ?)`, [KUNCI_PROMO, nilai, olehId, waktu]);
  }
  const beda = (Object.keys(baru) as Array<keyof KonfigPromo>).filter((k) => JSON.stringify(baru[k]) !== JSON.stringify(lama[k]));
  if (beda.length) {
    const sasaran = baru.semuaPeran ? "semua" : baru.peran.join("/");
    await catatJejak(db, {
      penggunaId: olehId,
      peranId: "super-admin",
      aksi: "admin.promo",
      hasil: "ok",
      ringkas: `Promosi ${baru.aktif ? "MENYALA" : "mati"}: ${beda.join(", ")}; periode ${baru.mulai || "-"}..${baru.akhir || "-"}; sasaran ${sasaran}; ${baru.giliranPerHari}/hari, Rp${baru.rupiahPeriode}, batas satker Rp${baru.batasSatkerRp}`,
    });
  }
  return baru;
}

// ----------------------------------------------------------------------------
// Status dan jatah
// ----------------------------------------------------------------------------

type PelakuPromo = Pick<PelakuAi, "id" | "peranId" | "superAdmin"> & { peranTambahan?: string[] };

const NOL: Pick<StatusPromo, "giliranPerHari" | "terpakaiGiliranHariIni" | "sisaGiliranHariIni" | "rupiahPeriode" | "terpakaiRupiah" | "sisaRupiah"> = {
  giliranPerHari: 0,
  terpakaiGiliranHariIni: 0,
  sisaGiliranHariIni: null,
  rupiahPeriode: 0,
  terpakaiRupiah: 0,
  sisaRupiah: null,
};

export function pesanPromoHabis(alasan: AlasanPromo): string {
  switch (alasan) {
    case "jatah-harian-habis":
      return "Jatah gratis ALETA Ai Anda untuk hari ini sudah habis; besok tersedia lagi selama promosi berlangsung. Untuk sekarang, pemakaian dihitung dari kuota atau saldo Anda.";
    case "jatah-rupiah-habis":
      return "Jatah gratis ALETA Ai Anda selama promosi sudah terpakai seluruhnya. Pemakaian berikutnya dihitung dari kuota atau saldo Anda.";
    case "batas-promo-habis":
      return "Program gratis ALETA Ai telah mencapai batasnya dan berhenti. Pemakaian berikutnya dihitung dari kuota atau saldo Anda.";
    default:
      return "";
  }
}

/** Pesan yang ditambahkan di depan galat "saldo tidak cukup" bila jatah promosi baru saja habis. */
export function awalanPromoHabis(status: Pick<StatusPromo, "alasan">): string {
  const p = pesanPromoHabis(status.alasan);
  return p ? `${p} ` : "";
}

export async function pemakaianApiPromo(db: AletaDatabase, k: Pick<KonfigPromo, "mulai" | "akhir">): Promise<number> {
  if (!tanggalSah(k.mulai) || !tanggalSah(k.akhir)) return 0;
  const b = await db.queryOne<{ n: number | string | null }>(`SELECT COALESCE(SUM(biaya_api_rp), 0) AS n FROM aleta_ai_promo_pakai WHERE dibuat_at >= ? AND dibuat_at < ?`, [
    awalIso(k.mulai),
    sesudahIso(k.akhir),
  ]);
  return Number(b?.n ?? 0);
}

/**
 * Keadaan promosi untuk satu pelaku. `tambahanApiRp` = perkiraan biaya API giliran/tugas yang
 * akan berjalan: bila totalnya akan melampaui batas satker promosi, promosi tidak berlaku
 * untuk giliran itu (pola periksaBatas). Tidak pernah melempar karena promosi tidak boleh
 * menggagalkan giliran: galat baca dianggap "promosi mati".
 */
export async function statusPromo(db: AletaDatabase, pelaku: PelakuPromo, opsi: { sekarang?: Date; tambahanApiRp?: number; konfig?: KonfigPromo } = {}): Promise<StatusPromo> {
  const sekarang = opsi.sekarang ?? new Date();
  let k: KonfigPromo;
  try {
    k = opsi.konfig ?? (await bacaPromo(db));
  } catch {
    k = { ...PROMO_BAWAAN };
  }
  const dasar = { judul: k.judul, teks: k.teks, mulai: k.mulai, akhir: k.akhir, akhirTeks: tanggalPanjang(k.akhir), ...NOL };
  const mati = (alasan: AlasanPromo): StatusPromo => ({ tampil: false, berlaku: false, alasan, pesan: "", ...dasar });
  if (!k.aktif) return mati("mati");
  if (!tanggalSah(k.mulai) || !tanggalSah(k.akhir)) return mati("mati");
  const hariIni = tanggalLokal(sekarang);
  if (hariIni < k.mulai) return mati("belum-mulai");
  if (hariIni > k.akhir) return mati("berakhir");
  if (pelaku.superAdmin) return mati("super-admin");
  const peranPelaku = [pelaku.peranId, ...(pelaku.peranTambahan ?? [])].filter(Boolean);
  if (!k.semuaPeran && !peranPelaku.some((p) => k.peran.includes(p))) return mati("bukan-sasaran");

  try {
    const hari = await db.queryOne<{ n: number | string | null }>(`SELECT COUNT(*) AS n FROM aleta_ai_promo_pakai WHERE pengguna_id = ? AND tanggal = ? AND dihitung = 1`, [pelaku.id, hariIni]);
    const rupiah = await db.queryOne<{ n: number | string | null }>(
      `SELECT COALESCE(SUM(setara_rp), 0) AS n FROM aleta_ai_promo_pakai WHERE pengguna_id = ? AND dihitung = 1 AND dibuat_at >= ? AND dibuat_at < ?`,
      [pelaku.id, awalIso(k.mulai), sesudahIso(k.akhir)]
    );
    const terpakaiGiliran = Number(hari?.n ?? 0);
    const terpakaiRupiah = Number(rupiah?.n ?? 0);
    const sisaGiliran = k.giliranPerHari > 0 ? Math.max(0, k.giliranPerHari - terpakaiGiliran) : null;
    const sisaRupiah = k.rupiahPeriode > 0 ? Math.max(0, k.rupiahPeriode - terpakaiRupiah) : null;
    const api = await pemakaianApiPromo(db, k);
    const tambah = Math.max(0, opsi.tambahanApiRp ?? 0);
    let alasan: AlasanPromo = "";
    if (api >= k.batasSatkerRp || (tambah > 0 && api + tambah > k.batasSatkerRp)) alasan = "batas-promo-habis";
    else if (sisaRupiah !== null && sisaRupiah <= 0) alasan = "jatah-rupiah-habis";
    else if (sisaGiliran !== null && sisaGiliran <= 0) alasan = "jatah-harian-habis";
    return {
      tampil: true,
      berlaku: alasan === "",
      alasan,
      pesan: pesanPromoHabis(alasan),
      ...dasar,
      giliranPerHari: k.giliranPerHari,
      terpakaiGiliranHariIni: terpakaiGiliran,
      sisaGiliranHariIni: sisaGiliran,
      rupiahPeriode: k.rupiahPeriode,
      terpakaiRupiah,
      sisaRupiah,
    };
  } catch {
    return mati("mati");
  }
}

// ----------------------------------------------------------------------------
// Pencatatan pemakaian
// ----------------------------------------------------------------------------

export type JenisPakaiPromo = "giliran" | "tugas";

/** Memesan jatah SEBELUM giliran/tugas berjalan (giliran serentak ikut terhitung). */
export async function mulaiPakaiPromo(
  db: AletaDatabase,
  m: { pelaku: Pick<PelakuAi, "id" | "peranId">; jenis: JenisPakaiPromo; rujukanId: string; kelompok?: string; model?: string; sekarang?: Date }
): Promise<void> {
  const sekarang = m.sekarang ?? new Date();
  await db.run(
    `INSERT INTO aleta_ai_promo_pakai (id, pengguna_id, peran_id, jenis, rujukan_id, tanggal, dihitung, setara_rp, token, biaya_api_rp, kelompok, model, dibuat_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0, ?, ?, ?)`,
    [`aipr-${randomUUID()}`, m.pelaku.id, m.pelaku.peranId, m.jenis, m.rujukanId, tanggalLokal(sekarang), teks(m.kelompok), teks(m.model), sekarang.toISOString()]
  );
}

/** Menutup catatan: angka sebenarnya. `dihitung` false = tidak memakai jatah (gagal/ditolak tanpa keluaran). */
export async function tutupPakaiPromo(
  db: AletaDatabase,
  m: { rujukanId: string; dihitung: boolean; setaraRp: number; token: number; biayaApiRp: number; kelompok?: string; model?: string }
): Promise<void> {
  await db.run(`UPDATE aleta_ai_promo_pakai SET dihitung = ?, setara_rp = ?, token = ?, biaya_api_rp = ?, kelompok = ?, model = ? WHERE rujukan_id = ?`, [
    m.dihitung ? 1 : 0,
    m.dihitung ? Math.max(0, Math.round(m.setaraRp)) : 0,
    Math.max(0, Math.trunc(m.token)),
    Math.max(0, m.biayaApiRp),
    teks(m.kelompok),
    teks(m.model),
    m.rujukanId,
  ]);
}

/** Apakah rujukan (pesan/jalan tugas) adalah pemakaian promosi. */
export async function adaPakaiPromo(db: AletaDatabase, rujukanId: string): Promise<boolean> {
  const b = await db.queryOne<{ id: string }>(`SELECT id FROM aleta_ai_promo_pakai WHERE rujukan_id = ? LIMIT 1`, [rujukanId]);
  return Boolean(b);
}

export type RingkasanPromo = { giliran: number; token: number; biayaApiRp: number; setaraRp: number; pengguna: number };

/** Ringkasan semua pemakaian promosi pada rentang (ISO UTC) untuk laporan. */
export async function ringkasanPromo(db: AletaDatabase, awal: string, akhir: string): Promise<RingkasanPromo> {
  const b = await db.queryOne<{ g: number | string | null; t: number | string | null; a: number | string | null; s: number | string | null; p: number | string | null }>(
    `SELECT COALESCE(SUM(dihitung), 0) AS g, COALESCE(SUM(token), 0) AS t, COALESCE(SUM(biaya_api_rp), 0) AS a, COALESCE(SUM(setara_rp), 0) AS s, COUNT(DISTINCT pengguna_id) AS p
     FROM aleta_ai_promo_pakai WHERE dibuat_at >= ? AND dibuat_at < ?`,
    [awal, akhir]
  );
  return { giliran: Number(b?.g ?? 0), token: Number(b?.t ?? 0), biayaApiRp: Number(b?.a ?? 0), setaraRp: Number(b?.s ?? 0), pengguna: Number(b?.p ?? 0) };
}
