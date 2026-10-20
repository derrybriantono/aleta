import type { AletaDatabase } from "@/server/db/client";
import { tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { getUsersFromDb } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

/**
 * Laporan bulanan untuk Super Admin: HANYA metadata biaya dan pemakaian.
 * Tidak ada isi pesan, judul percakapan, atau teks apa pun dari pengguna -
 * rahasia musyawarah tetap milik pemilik percakapan.
 *
 *   pendapatan   = jumlah biaya_rp yang ditagih (Super Admin gratis = 0)
 *   biaya API Rp = jumlah biaya_api_rp (biaya USD x kurs tengah hari itu),
 *                  SEMUA giliran termasuk Super Admin dan pengklasifikasi
 *   laba         = pendapatan - biaya API Rp (biaya MDR QRIS menyusul tahap 5)
 */

type BarisPesan = {
  pemilik_id: string;
  kelompok: string;
  model: string;
  status: string;
  token_masuk: number | string;
  token_keluar: number | string;
  token_cache_tulis: number | string;
  token_cache_baca: number | string;
  biaya_usd: number | string;
  biaya_api_rp: number | string;
  biaya_rp: number | string;
  gratis: number | string;
};

type Kumpulan = { giliran: number; gratis: number; token: number; biayaUsd: number; biayaApiRp: number; pendapatanRp: number; labaRp: number };
const kosong = (): Kumpulan => ({ giliran: 0, gratis: 0, token: 0, biayaUsd: 0, biayaApiRp: 0, pendapatanRp: 0, labaRp: 0 });

function tambah(k: Kumpulan, b: BarisPesan) {
  k.giliran += 1;
  if (Number(b.gratis) === 1) k.gratis += 1;
  k.token += Number(b.token_masuk) + Number(b.token_keluar) + Number(b.token_cache_tulis) + Number(b.token_cache_baca);
  k.biayaUsd += Number(b.biaya_usd);
  k.biayaApiRp += Number(b.biaya_api_rp);
  k.pendapatanRp += Number(b.biaya_rp);
  k.labaRp = k.pendapatanRp - k.biayaApiRp;
}

function rentangBulan(bulan: string): { awal: string; akhir: string; bulan: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(bulan);
  if (!m) throw new ApiError(400, "Format bulan harus YYYY-MM, misalnya 2026-10.");
  const tahun = Number(m[1]);
  const bln = Number(m[2]);
  if (bln < 1 || bln > 12) throw new ApiError(400, "Bulan tidak sah.");
  const awal = new Date(`${m[1]}-${m[2]}-01T00:00:00+08:00`);
  const berikut = bln === 12 ? `${tahun + 1}-01` : `${tahun}-${String(bln + 1).padStart(2, "0")}`;
  const akhir = new Date(`${berikut}-01T00:00:00+08:00`);
  return { awal: awal.toISOString(), akhir: akhir.toISOString(), bulan };
}

function urutkan(peta: Map<string, Kumpulan>) {
  return [...peta.entries()].sort((a, b) => b[1].pendapatanRp - a[1].pendapatanRp || b[1].biayaApiRp - a[1].biayaApiRp);
}

export async function laporanBulanan(db: AletaDatabase, bulanMasukan?: string) {
  const { awal, akhir, bulan } = rentangBulan(bulanMasukan || tanggalLokal().slice(0, 7));
  const baris = await db.queryAll<BarisPesan>(
    `SELECT pemilik_id, kelompok, model, status, token_masuk, token_keluar, token_cache_tulis, token_cache_baca, biaya_usd, biaya_api_rp, biaya_rp, gratis
     FROM aleta_ai_obrolan_pesan WHERE peran = 'ai' AND status <> 'berjalan' AND dibuat_at >= ? AND dibuat_at < ? LIMIT 200000`,
    [awal, akhir]
  );
  const pengguna = new Map((await getUsersFromDb(db)).map((u) => [String(u.id), { nama: String(u.name ?? ""), peran: String(u.roleId ?? "") }]));

  const total = kosong();
  const perPengguna = new Map<string, Kumpulan>();
  const perPeran = new Map<string, Kumpulan>();
  const perKelompok = new Map<string, Kumpulan>();
  const perModel = new Map<string, Kumpulan>();
  const ambil = (peta: Map<string, Kumpulan>, kunci: string) => {
    let k = peta.get(kunci);
    if (!k) {
      k = kosong();
      peta.set(kunci, k);
    }
    return k;
  };

  for (const b of baris) {
    tambah(total, b);
    tambah(ambil(perPengguna, b.pemilik_id), b);
    tambah(ambil(perPeran, pengguna.get(b.pemilik_id)?.peran || "(tidak dikenal)"), b);
    tambah(ambil(perKelompok, b.kelompok || "(tanpa kelompok)"), b);
    tambah(ambil(perModel, b.model || "(tanpa model)"), b);
  }

  // Bentuk datar sesuai kesepakatan dengan layar: total di tingkat atas, dan tiap kelompok
  // memuat `nama` (pengguna: nama akun; peran/kelompok/model: nilainya) di samping angkanya.
  return {
    bulan,
    pendapatanRp: total.pendapatanRp,
    biayaApiRp: total.biayaApiRp,
    biayaMdrRp: 0, // biaya MDR QRIS menyusul di tahap 5
    labaRp: total.labaRp,
    ringkasan: total,
    perPengguna: urutkan(perPengguna).map(([id, k]) => ({ nama: pengguna.get(id)?.nama || id, penggunaId: id, peran: pengguna.get(id)?.peran ?? "", ...k })),
    perPeran: urutkan(perPeran).map(([peran, k]) => ({ nama: peran, peran, ...k })),
    perKelompok: urutkan(perKelompok).map(([kelompok, k]) => ({ nama: kelompok, kelompok, ...k })),
    perModel: urutkan(perModel).map(([model, k]) => ({ nama: model, model, ...k })),
  };
}
