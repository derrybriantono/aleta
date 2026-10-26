import { GalatAntrean, UMUR_JALAN_MAKS_HARI, UMUR_SELESAI_MAKS_HARI, bersihkanMasukanAntrean, jenisAntreanSah, statusAntreanSah, type JenisAntrean } from "@/lib/antrean-peramban";
import { withTransaction, type AletaDatabase } from "@/server/db/client";
import { bacaKinerja } from "@/server/modules/aleta-ecourt/kinerja-ekstensi";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * ANTREAN KERJA PERAMBAN DI BASIS DATA (K15, rantai B, 25 Okt 2026)
 * ============================================================================
 *
 * Salinan keadaan antrean kerja massal peramban (cetak massal, relaas massal, catatan putusan
 * terjadwal) supaya dapat ditawarkan lagi sesudah Chrome ditutup atau di PC lain.
 *
 *   - SELALU milik pemanggil (pengguna dari sesi, tidak pernah dari badan permintaan);
 *   - hanya bekerja bila Super Admin menyalakan saklar kinerja.antreanDiServer (mati bawaan):
 *     tulisan ditolak halus dengan { disimpan: false, alasan: "saklar-mati" } dan bacaan kosong;
 *   - tidak menjalankan apa pun: hanya menyimpan dan membaca keadaan. Menjalankan ulang adalah
 *     keputusan pemiliknya di peramban.
 */

type Baris = {
  pengguna_id: string;
  jenis: string;
  kunci: string;
  perangkat: string;
  ringkas: string;
  selesai: number;
  total: number;
  muatan_json: string;
  status: string;
  dibuat_pada: string;
  diubah_pada: string;
};

export type AntreanTersimpan = {
  jenis: JenisAntrean;
  kunci: string;
  perangkat: string;
  ringkas: string;
  selesai: number;
  total: number;
  muatan: unknown;
  dibuatPada: string;
  diubahPada: string;
};

const HARI_MS = 24 * 60 * 60 * 1000;

async function saklarNyala(db: AletaDatabase) {
  return (await bacaKinerja(db)).antreanDiServer === true;
}

/** Membuang antrean ditinggalkan (jalan > 14 hari) dan yang sudah selesai/dibuang > 2 hari. Dipanggil saat membaca. */
export async function sapuAntreanBasi(db: AletaDatabase, sekarang = new Date()) {
  const batasJalan = new Date(sekarang.getTime() - UMUR_JALAN_MAKS_HARI * HARI_MS).toISOString();
  const batasSelesai = new Date(sekarang.getTime() - UMUR_SELESAI_MAKS_HARI * HARI_MS).toISOString();
  await db.prepare("DELETE FROM aleta_antrean_peramban WHERE status = 'jalan' AND diubah_pada < ?").run(batasJalan);
  await db.prepare("DELETE FROM aleta_antrean_peramban WHERE status <> 'jalan' AND diubah_pada < ?").run(batasSelesai);
}

export async function simpanAntrean(db: AletaDatabase, penggunaId: string, masukan: unknown, sekarang = new Date()) {
  if (!(await saklarNyala(db))) return { disimpan: false as const, alasan: "saklar-mati" as const };
  let m;
  try {
    m = bersihkanMasukanAntrean(masukan);
  } catch (galat) {
    if (galat instanceof GalatAntrean) throw new ApiError(400, galat.message);
    throw galat;
  }
  const waktu = sekarang.toISOString();
  await withTransaction(db, async (tx) => {
    await tx
      .prepare(
        "INSERT INTO aleta_antrean_peramban (pengguna_id, jenis, kunci, perangkat, ringkas, selesai, total, muatan_json, status, dibuat_pada, diubah_pada) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT (pengguna_id, jenis, kunci) DO UPDATE SET perangkat = excluded.perangkat, ringkas = excluded.ringkas, selesai = excluded.selesai, " +
          "total = excluded.total, muatan_json = excluded.muatan_json, status = excluded.status, diubah_pada = excluded.diubah_pada"
      )
      .run(penggunaId, m.jenis, m.kunci, m.perangkat, m.ringkas, m.selesai, m.total, JSON.stringify(m.muatan), m.status, waktu, waktu);
  });
  return { disimpan: true as const, diubahPada: waktu };
}

/** Antrean aktif (status "jalan") milik pemanggil, terbaru dulu. Saklar mati = kosong. */
export async function daftarAntrean(db: AletaDatabase, penggunaId: string, jenis?: unknown, sekarang = new Date()) {
  if (!(await saklarNyala(db))) return { aktif: false as const, antrean: [] as AntreanTersimpan[] };
  if (jenis !== undefined && jenis !== null && jenis !== "" && !jenisAntreanSah(jenis)) throw new ApiError(400, "Jenis antrean tidak dikenal.");
  await sapuAntreanBasi(db, sekarang);
  const baris = await db
    .prepare(
      "SELECT pengguna_id, jenis, kunci, perangkat, ringkas, selesai, total, muatan_json, status, dibuat_pada, diubah_pada " +
        "FROM aleta_antrean_peramban WHERE pengguna_id = ? AND status = 'jalan' ORDER BY diubah_pada DESC"
    )
    .all<Baris>(penggunaId);
  const hasil: AntreanTersimpan[] = [];
  for (const b of baris) {
    if (!jenisAntreanSah(b.jenis) || (jenis && b.jenis !== jenis)) continue;
    let muatan: unknown = {};
    try {
      muatan = JSON.parse(b.muatan_json);
    } catch {
      muatan = {};
    }
    hasil.push({
      jenis: b.jenis,
      kunci: b.kunci,
      perangkat: b.perangkat,
      ringkas: b.ringkas,
      selesai: Number(b.selesai) || 0,
      total: Number(b.total) || 0,
      muatan,
      dibuatPada: b.dibuat_pada,
      diubahPada: b.diubah_pada,
    });
  }
  return { aktif: true as const, antrean: hasil };
}

/** Menandai satu antrean milik pemanggil selesai atau dibuang. Tidak ada baris = tidak ada galat (idempoten). */
export async function akhiriAntrean(db: AletaDatabase, penggunaId: string, jenis: unknown, kunci: unknown, status: unknown, sekarang = new Date()) {
  if (!jenisAntreanSah(jenis)) throw new ApiError(400, "Jenis antrean tidak dikenal.");
  const k = typeof kunci === "string" ? kunci.trim() : "";
  if (!k) throw new ApiError(400, "Kunci antrean kosong.");
  const st = status === undefined || status === null || status === "" ? "selesai" : status;
  if (!statusAntreanSah(st) || st === "jalan") throw new ApiError(400, 'Status akhir harus "selesai" atau "dibuang".');
  const sebelum = await db
    .prepare("SELECT kunci FROM aleta_antrean_peramban WHERE pengguna_id = ? AND jenis = ? AND kunci = ? AND status = 'jalan'")
    .all<{ kunci: string }>(penggunaId, jenis, k);
  if (!sebelum.length) return { diakhiri: false };
  await db
    .prepare("UPDATE aleta_antrean_peramban SET status = ?, diubah_pada = ? WHERE pengguna_id = ? AND jenis = ? AND kunci = ? AND status = 'jalan'")
    .run(st, sekarang.toISOString(), penggunaId, jenis, k);
  return { diakhiri: true };
}
