import { type AletaDatabase } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";

/**
 * ============================================================================
 * SALINAN PUTUSAN SESUDAH BHT - PENUNJUK PERKARA (migrasi 0120, 30 Okt 2026)
 * ============================================================================
 *
 * Pendeteksi berkala (tiap 30 menit di server, dan malas-sinkron saat daftar dibaca) mencatat perkara yang BARU BHT menurut SIPP
 * (bot membaca perkara_putusan.tanggal_bht) ke aleta_salinan_bht dengan status 'menunggu'. Petugas membuka daftarnya lewat Cetak massal
 * jenis "Salinan putusan BHT": salinan dicetak dengan alur PDF SALINAN yang sudah ada (naskah ABT, "ttd", tanda tangan Panitera), lalu
 * perkara ditutup ('selesai'). Hanya penunjuk perkara yang disimpan: bukan isi putusan, dan tidak ada yang ditulis ke SIPP/ABT.
 *
 * Mengapa salinan TIDAK diunggah otomatis ke e-Doc: SIPP hanya punya dua tempat unggah untuk putusan (putusan akhir dan anonimisasi);
 * salinan bukan salah satunya, dan memasukkannya ke tempat putusan akhir akan menimpa putusan resmi. Menunggu keputusan pengguna.
 */

const MASA_SINKRON_MS = 10 * 60 * 1000;
const MASA_SIMPAN_HARI = 120;
let sinkronTerakhir = 0;

export type PerkaraBht = { perkaraId: string; nomorPerkara: string; tanggalPutusan: string; tanggalBht: string; adaPutusan: boolean };
export type BarisSalinanBht = { perkaraId: string; nomorPerkara: string; tanggalPutusan: string; tanggalBht: string; status: string; terdeteksiPada: string };

type AmbilDaftar = (sejakHari: number) => Promise<PerkaraBht[] | null>;

async function ambilDariBot(sejakHari: number): Promise<PerkaraBht[] | null> {
  const r = await callAletaBotSippBridge<{ ok?: boolean; perkara?: PerkaraBht[] }>("salinan.bht", { sejakHari }, { timeoutMs: 30_000 });
  if (!r.ok || !r.data || r.data.ok === false || !Array.isArray(r.data.perkara)) return null;
  return r.data.perkara;
}

/** Mengosongkan ingatan sinkron (uji). */
export function lupakanSinkronSalinanBht() {
  sinkronTerakhir = 0;
}

/** Mencatat perkara BHT yang belum tercatat. Pulang jumlah baris baru; null bila daftar tidak terbaca (tidak ada yang berubah). */
export async function sinkronSalinanBht(db: AletaDatabase, ambil: AmbilDaftar = ambilDariBot, sejakHari = 14): Promise<number | null> {
  const daftar = await ambil(sejakHari).catch(() => null);
  if (!daftar) return null;
  const sekarang = new Date().toISOString();
  let baru = 0;
  for (const p of daftar) {
    if (!/^\d{1,12}$/.test(String(p.perkaraId)) || !p.adaPutusan) continue;
    const ada = await db.queryOne<{ perkara_id: string }>(`SELECT perkara_id FROM aleta_salinan_bht WHERE perkara_id = ?`, [String(p.perkaraId)]);
    if (ada) continue;
    await db.run(
      `INSERT INTO aleta_salinan_bht (perkara_id, nomor_perkara, tanggal_putusan, tanggal_bht, status, terdeteksi_pada) VALUES (?, ?, ?, ?, 'menunggu', ?)`,
      [String(p.perkaraId), String(p.nomorPerkara).slice(0, 80), String(p.tanggalPutusan || ""), String(p.tanggalBht || ""), sekarang]
    );
    baru += 1;
  }
  const batas = new Date(Date.now() - MASA_SIMPAN_HARI * 86400000).toISOString();
  await db.run(`DELETE FROM aleta_salinan_bht WHERE terdeteksi_pada < ?`, [batas]);
  sinkronTerakhir = Date.now();
  return baru;
}

/** Daftar perkara yang salinannya menunggu. `sinkron`: ikut menyegarkan dari SIPP bila terakhir sudah lebih dari 10 menit. */
export async function daftarSalinanBht(db: AletaDatabase, opsi: { sinkron?: boolean; ambil?: AmbilDaftar } = {}): Promise<{ perkara: BarisSalinanBht[]; disegarkan: boolean }> {
  let disegarkan = false;
  if (opsi.sinkron !== false && Date.now() - sinkronTerakhir > MASA_SINKRON_MS) disegarkan = (await sinkronSalinanBht(db, opsi.ambil)) !== null;
  const baris = await db.queryAll<{ perkara_id: string; nomor_perkara: string; tanggal_putusan: string; tanggal_bht: string; status: string; terdeteksi_pada: string }>(
    `SELECT perkara_id, nomor_perkara, tanggal_putusan, tanggal_bht, status, terdeteksi_pada FROM aleta_salinan_bht WHERE status = 'menunggu' ORDER BY tanggal_bht DESC, perkara_id DESC`
  );
  return {
    disegarkan,
    perkara: baris.map((b) => ({
      perkaraId: String(b.perkara_id),
      nomorPerkara: String(b.nomor_perkara),
      tanggalPutusan: String(b.tanggal_putusan),
      tanggalBht: String(b.tanggal_bht),
      status: String(b.status),
      terdeteksiPada: String(b.terdeteksi_pada),
    })),
  };
}

/** Menutup perkara yang salinannya sudah dicetak. Pulang banyaknya baris yang ditutup. */
export async function tutupSalinanBht(db: AletaDatabase, aktor: { id: string; name?: string | null }, perkaraIds: unknown): Promise<number> {
  const daftar = (Array.isArray(perkaraIds) ? perkaraIds : []).map((x) => String(x)).filter((x) => /^\d{1,12}$/.test(x)).slice(0, 200);
  let n = 0;
  const sekarang = new Date().toISOString();
  for (const id of daftar) {
    const ada = await db.queryOne<{ status: string }>(`SELECT status FROM aleta_salinan_bht WHERE perkara_id = ?`, [id]);
    if (!ada || ada.status === "selesai") continue;
    await db.run(`UPDATE aleta_salinan_bht SET status = 'selesai', selesai_pada = ?, selesai_oleh = ? WHERE perkara_id = ?`, [sekarang, String(aktor.name || aktor.id).slice(0, 120), id]);
    n += 1;
  }
  return n;
}

/** Detak berkala di server (instrumentation.ts): pertama 2 menit sesudah mulai, lalu tiap 30 menit. Matikan dengan ALETA_SALINAN_BHT=0. */
export function mulaiSalinanBhtBerkala(ambilDb: () => Promise<AletaDatabase>): void {
  const jalan = async () => {
    try {
      await sinkronSalinanBht(await ambilDb());
    } catch {
      /* detak berikutnya mencoba lagi */
    }
  };
  setTimeout(() => void jalan(), 2 * 60 * 1000).unref?.();
  setInterval(() => void jalan(), 30 * 60 * 1000).unref?.();
}
