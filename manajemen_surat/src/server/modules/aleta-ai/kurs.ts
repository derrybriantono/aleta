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
 * membuka halaman kurs) dari kurs tengah JISDOR Bank Indonesia (cadangan:
 * sumber kurs terbuka) yang dapat dijangkau server, lalu
 * disimpan beserta tanggal dan sumbernya. Bila pengambilan gagal, kurs
 * tersimpan terakhir dipakai (ditandai "basi"); bila belum pernah ada, kurs
 * awal dari pengaturan.
 *
 * Penyangga kurs (bawaan +3%) ditambahkan di rumus harga (lib/aleta-ai/biaya.ts), bukan di
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

type SumberKurs = {
  nama: string;
  url: string;
  /** Membaca badan jawaban (teks mentah); undefined = tidak ditemukan. */
  baca: (badan: string) => number | undefined;
};

const BULAN_ID: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12, may: 5,
};

/** "16.234,00" / "16,234.00" / "16234.5" -> angka; undefined bila tidak terbaca. */
export function angkaKurs(teksAngka: string): number | undefined {
  const t = teksAngka.replace(/[^\d.,]/g, "");
  if (!t) return undefined;
  let n: number;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) n = Number(t.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) n = Number(t.replace(/,/g, ""));
  else n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Kurs JISDOR dari halaman Bank Indonesia (HTML). Halaman memuat tabel
 * "Tanggal | Kurs" terbaru di atas; yang diambil = baris bertanggal paling
 * akhir yang nilainya wajar. Pengurai sengaja longgar (tag dibuang, tanggal
 * Indonesia "23 Oktober 2026" atau "23 Okt 2026", angka "16.234,00") karena
 * susunan halaman BI dapat berubah; bila tidak terbaca, sumber berikutnya dipakai.
 */
export function bacaJisdorBi(html: string): number | undefined {
  const teksPolos = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
  const pola = /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)/g;
  let terbaik: { kunci: number; kurs: number } | null = null;
  for (const m of teksPolos.matchAll(pola)) {
    const bulan = BULAN_ID[(m[2] ?? "").toLowerCase()];
    const kurs = angkaKurs(m[4] ?? "");
    if (!bulan || !kursWajar(kurs)) continue;
    const kunci = Number(m[3]) * 10_000 + bulan * 100 + Number(m[1]);
    if (!terbaik || kunci > terbaik.kunci) terbaik = { kunci, kurs };
  }
  return terbaik?.kurs;
}

const bacaJson = (ambilIdr: (j: unknown) => unknown) => (badan: string) => {
  try {
    const n = ambilIdr(JSON.parse(badan) as unknown);
    return typeof n === "number" ? n : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Urutan sumber: kurs tengah JISDOR Bank Indonesia lebih dulu (keputusan
 * pengguna 19 Okt 2026), lalu sumber kurs terbuka sebagai cadangan. Alamat
 * JISDOR dapat diganti lewat env ALETA_AI_KURS_JISDOR_URL bila BI memindahkan
 * halamannya (tanpa rilis).
 */
export function sumberKursBawaan(): SumberKurs[] {
  return [
    {
      nama: "JISDOR Bank Indonesia",
      url: process.env.ALETA_AI_KURS_JISDOR_URL?.trim() || "https://www.bi.go.id/id/statistik/informasi-kurs/jisdor/default.aspx",
      baca: bacaJisdorBi,
    },
    {
      nama: "open.er-api.com",
      url: "https://open.er-api.com/v6/latest/USD",
      baca: bacaJson((j) => {
        const o = j as { result?: string; rates?: { IDR?: number } };
        return o?.result === "success" ? o.rates?.IDR : undefined;
      }),
    },
    {
      nama: "frankfurter.app",
      url: "https://api.frankfurter.app/latest?from=USD&to=IDR",
      baca: bacaJson((j) => (j as { rates?: { IDR?: number } })?.rates?.IDR),
    },
  ];
}

export type PengambilHttp = (url: string, init: RequestInit, batasMs: number) => Promise<Response>;

/**
 * Pengambil kurs yang mencoba sumber berurutan dan memakai yang pertama
 * berhasil dan wajar. `http` dapat disuntik (uji memakai HTTP tiruan; cloud
 * dan uji tidak pernah bergantung pada situs luar).
 */
export function buatPengambilKurs(opsi: { http?: PengambilHttp; sumber?: SumberKurs[] } = {}): PengambilKurs {
  const http = opsi.http ?? outboundFetch;
  return async () => {
    const gagal: string[] = [];
    for (const sumber of opsi.sumber ?? sumberKursBawaan()) {
      try {
        const respons = await http(sumber.url, { headers: { Accept: "application/json, text/html;q=0.9" } }, 8000);
        if (!respons.ok) {
          gagal.push(`${sumber.nama}: HTTP ${respons.status}`);
          continue;
        }
        const kurs = sumber.baca(await respons.text());
        if (kursWajar(kurs)) return { kurs, sumber: sumber.nama };
        gagal.push(`${sumber.nama}: nilai tidak terbaca atau tidak wajar`);
      } catch (error) {
        gagal.push(`${sumber.nama}: ${describeNetworkError(error)}`);
      }
    }
    throw new Error(`Kurs tidak dapat diambil (${gagal.join("; ")})`);
  };
}

/** Pengambil bawaan: JISDOR BI, lalu sumber terbuka. */
export const ambilKursPublik: PengambilKurs = () => buatPengambilKurs()();

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
