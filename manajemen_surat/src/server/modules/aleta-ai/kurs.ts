import type { AletaDatabase } from "@/server/db/client";
import { bacaPengaturan } from "@/server/modules/aleta-ai/pengaturan";
import { describeNetworkError, outboundFetch } from "@/server/shared/outbound-http";

/**
 * ============================================================================
 * ALETA Ai - KURS USD-IDR HARIAN
 * ============================================================================
 *
 * Harga dalam rupiah mengikuti kurs harian. Kurs diambil otomatis SEKALI per
 * hari (malas: saat ada giliran pertama hari itu, atau saat Super Admin
 * membuka halaman kurs) dari sumber publik yang dapat dijangkau server, lalu
 * disimpan beserta tanggal dan sumbernya. Bila pengambilan gagal, kurs
 * tersimpan terakhir dipakai (ditandai "basi"); bila belum pernah ada, kurs
 * awal dari pengaturan.
 *
 * Penyangga kurs (bawaan +3%) ditambahkan di rumus harga (biaya.ts), bukan di
 * sini: yang disimpan di sini adalah kurs tengah apa adanya.
 */

export type KursBerlaku = {
  kurs: number;
  tanggal: string;
  sumber: string;
  /** true bila bukan kurs hari ini (pengambilan hari ini gagal atau belum pernah). */
  basi: boolean;
};

export type PengambilKurs = () => Promise<{ kurs: number; sumber: string }>;

const KURS_MIN = 5_000;
const KURS_MAKS = 100_000;

/** Tanggal "YYYY-MM-DD" di zona waktu pengadilan (WITA). */
export function tanggalLokal(waktu: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).format(waktu);
}

export function kursWajar(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= KURS_MIN && n <= KURS_MAKS;
}

const SUMBER_PUBLIK: ReadonlyArray<{ nama: string; url: string; baca: (j: unknown) => number | undefined }> = [
  {
    nama: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    baca: (j) => {
      const o = j as { result?: string; rates?: { IDR?: number } };
      return o?.result === "success" ? o.rates?.IDR : undefined;
    },
  },
  {
    nama: "frankfurter.app",
    url: "https://api.frankfurter.app/latest?from=USD&to=IDR",
    baca: (j) => (j as { rates?: { IDR?: number } })?.rates?.IDR,
  },
];

/** Pengambil bawaan: mencoba sumber publik berurutan, memakai yang pertama berhasil dan wajar. */
export const ambilKursPublik: PengambilKurs = async () => {
  const gagal: string[] = [];
  for (const sumber of SUMBER_PUBLIK) {
    try {
      const respons = await outboundFetch(sumber.url, { headers: { Accept: "application/json" } }, 6000);
      if (!respons.ok) {
        gagal.push(`${sumber.nama}: HTTP ${respons.status}`);
        continue;
      }
      const kurs = sumber.baca(await respons.json());
      if (kursWajar(kurs)) return { kurs, sumber: sumber.nama };
      gagal.push(`${sumber.nama}: nilai tidak wajar`);
    } catch (error) {
      gagal.push(`${sumber.nama}: ${describeNetworkError(error)}`);
    }
  }
  throw new Error(`Kurs tidak dapat diambil (${gagal.join("; ")})`);
};

type BarisKurs = { tanggal: string; kurs: number | string; sumber: string; diambil_at: string };

export async function kursTersimpanTerakhir(db: AletaDatabase): Promise<{ tanggal: string; kurs: number; sumber: string; diambilAt: string } | null> {
  const baris = await db.queryOne<BarisKurs>(`SELECT tanggal, kurs, sumber, diambil_at FROM aleta_ai_kurs ORDER BY tanggal DESC, diambil_at DESC LIMIT 1`);
  if (!baris) return null;
  const kurs = Number(baris.kurs);
  return kursWajar(kurs) ? { tanggal: baris.tanggal, kurs, sumber: baris.sumber, diambilAt: baris.diambil_at } : null;
}

export async function simpanKurs(db: AletaDatabase, input: { tanggal: string; kurs: number; sumber: string }): Promise<void> {
  if (!kursWajar(input.kurs)) throw new Error("Kurs tidak wajar.");
  const id = `kurs-${input.tanggal}`;
  const sekarang = new Date().toISOString();
  const hasil = await db.run(`UPDATE aleta_ai_kurs SET kurs = ?, sumber = ?, diambil_at = ? WHERE id = ?`, [input.kurs, input.sumber, sekarang, id]);
  if (!hasil.changes) {
    await db.run(`INSERT INTO aleta_ai_kurs (id, tanggal, kurs, sumber, diambil_at) VALUES (?, ?, ?, ?, ?)`, [id, input.tanggal, input.kurs, input.sumber, sekarang]);
  }
}

/** Kurs yang berlaku sekarang: tersimpan terakhir, atau kurs awal pengaturan. Tidak memanggil jaringan. */
export async function kursBerlaku(db: AletaDatabase, sekarang: Date = new Date()): Promise<KursBerlaku> {
  const hariIni = tanggalLokal(sekarang);
  const terakhir = await kursTersimpanTerakhir(db);
  if (terakhir) return { kurs: terakhir.kurs, tanggal: terakhir.tanggal, sumber: terakhir.sumber, basi: terakhir.tanggal !== hariIni };
  const p = await bacaPengaturan(db);
  return { kurs: p.kursAwal, tanggal: hariIni, sumber: "bawaan (belum ada kurs terambil)", basi: true };
}

let sedangMengambil: Promise<"sudah-ada" | "diambil" | "gagal"> | null = null;

/**
 * Ambil kurs hari ini bila belum ada. Aman dipanggil di setiap giliran: satu
 * pengambilan berjalan sekali pada satu waktu dan hasil hari ini langsung
 * dikenali. Tidak pernah melempar.
 */
export function segarkanKursBilaPerlu(
  db: AletaDatabase,
  opsi: { pengambil?: PengambilKurs; sekarang?: Date } = {}
): Promise<"sudah-ada" | "diambil" | "gagal"> {
  if (sedangMengambil) return sedangMengambil;
  sedangMengambil = (async () => {
    try {
      const hariIni = tanggalLokal(opsi.sekarang);
      const terakhir = await kursTersimpanTerakhir(db);
      if (terakhir?.tanggal === hariIni) return "sudah-ada" as const;
      const ambil = opsi.pengambil ?? ambilKursPublik;
      const hasil = await ambil();
      await simpanKurs(db, { tanggal: hariIni, kurs: hasil.kurs, sumber: hasil.sumber });
      return "diambil" as const;
    } catch {
      return "gagal" as const;
    } finally {
      sedangMengambil = null;
    }
  })();
  return sedangMengambil;
}
