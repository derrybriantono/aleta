import type { AletaDatabase } from "@/server/db/client";
import { tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { getUsersFromDb } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";
import { createXlsxWorkbook } from "@/server/shared/xlsx";

/**
 * Laporan bulanan untuk Super Admin: HANYA metadata biaya dan pemakaian.
 * Tidak ada isi pesan, judul percakapan, atau teks apa pun dari pengguna -
 * rahasia musyawarah tetap milik pemilik percakapan.
 *
 *   pendapatan   = jumlah biaya_rp yang ditagih (Super Admin gratis = 0)
 *   biaya API Rp = jumlah biaya_api_rp (biaya USD x kurs tengah hari itu),
 *                  SEMUA giliran termasuk Super Admin dan pengklasifikasi
 *   biaya MDR Rp = jumlah biaya_mdr_rp (bagian MDR QRIS dalam harga giliran
 *                  yang terpotong; tahap 4)
 *   laba         = pendapatan - biaya API Rp - biaya MDR Rp
 *
 * Tahap 4: rentang beberapa bulan (perBulan), ekspor CSV/XLSX.
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
  biaya_mdr_rp: number | string | null;
  gratis: number | string;
  dibuat_at: string;
};

export type Kumpulan = { giliran: number; gratis: number; token: number; biayaUsd: number; biayaApiRp: number; biayaMdrRp: number; pendapatanRp: number; labaRp: number };
const kosong = (): Kumpulan => ({ giliran: 0, gratis: 0, token: 0, biayaUsd: 0, biayaApiRp: 0, biayaMdrRp: 0, pendapatanRp: 0, labaRp: 0 });

function tambah(k: Kumpulan, b: BarisPesan) {
  k.giliran += 1;
  if (Number(b.gratis) === 1) k.gratis += 1;
  k.token += Number(b.token_masuk) + Number(b.token_keluar) + Number(b.token_cache_tulis) + Number(b.token_cache_baca);
  k.biayaUsd += Number(b.biaya_usd);
  k.biayaApiRp += Number(b.biaya_api_rp);
  k.biayaMdrRp += Number(b.biaya_mdr_rp ?? 0);
  k.pendapatanRp += Number(b.biaya_rp);
  k.labaRp = k.pendapatanRp - k.biayaApiRp - k.biayaMdrRp;
}

export function rentangBulan(bulan: string): { awal: string; akhir: string; bulan: string } {
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
  const bulan = bulanMasukan || tanggalLokal().slice(0, 7);
  return laporanRentang(db, bulan, bulan);
}

const BATAS_RENTANG_BULAN = 24;

/** Laporan dari bulan `dari` sampai `sampai` (YYYY-MM, termasuk keduanya), dengan rincian per bulan. */
export async function laporanRentang(db: AletaDatabase, dariMasukan?: string, sampaiMasukan?: string) {
  const dari = rentangBulan(dariMasukan || tanggalLokal().slice(0, 7));
  const sampai = rentangBulan(sampaiMasukan || dari.bulan);
  if (sampai.bulan < dari.bulan) throw new ApiError(400, "Bulan akhir tidak boleh sebelum bulan awal.");
  const [ta, ba] = dari.bulan.split("-").map(Number) as [number, number];
  const [tb, bb] = sampai.bulan.split("-").map(Number) as [number, number];
  if ((tb - ta) * 12 + (bb - ba) + 1 > BATAS_RENTANG_BULAN) throw new ApiError(400, `Rentang laporan paling panjang ${BATAS_RENTANG_BULAN} bulan.`);

  const baris = await db.queryAll<BarisPesan>(
    `SELECT pemilik_id, kelompok, model, status, token_masuk, token_keluar, token_cache_tulis, token_cache_baca, biaya_usd, biaya_api_rp, biaya_mdr_rp, biaya_rp, gratis, dibuat_at
     FROM aleta_ai_obrolan_pesan WHERE peran = 'ai' AND status <> 'berjalan' AND dibuat_at >= ? AND dibuat_at < ? LIMIT 500000`,
    [dari.awal, sampai.akhir]
  );
  const pengguna = new Map((await getUsersFromDb(db)).map((u) => [String(u.id), { nama: String(u.name ?? ""), peran: String(u.roleId ?? "") }]));

  const total = kosong();
  const perPengguna = new Map<string, Kumpulan>();
  const perPeran = new Map<string, Kumpulan>();
  const perKelompok = new Map<string, Kumpulan>();
  const perModel = new Map<string, Kumpulan>();
  const perBulan = new Map<string, Kumpulan>();
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
    tambah(ambil(perBulan, tanggalLokal(new Date(b.dibuat_at)).slice(0, 7)), b);
  }

  // Mutasi saldo di luar giliran (isi, kuota, kuota hangus, koreksi admin) pada rentang yang sama.
  const mutasi = await db.queryAll<{ jenis: string; jumlah_rp: number | string }>(
    `SELECT jenis, jumlah_rp FROM aleta_ai_mutasi WHERE jenis IN ('isi', 'kuota', 'kuota-hangus', 'koreksi') AND jumlah_rp <> 0 AND dibuat_at >= ? AND dibuat_at < ?`,
    [dari.awal, sampai.akhir]
  );
  const mutasiSaldo = { isiRp: 0, kuotaRp: 0, kuotaHangusRp: 0, koreksiTambahRp: 0, koreksiKurangRp: 0, koreksiJumlah: 0 };
  for (const m of mutasi) {
    const n = Number(m.jumlah_rp);
    if (m.jenis === "isi") mutasiSaldo.isiRp += n;
    else if (m.jenis === "kuota") mutasiSaldo.kuotaRp += n;
    else if (m.jenis === "kuota-hangus") mutasiSaldo.kuotaHangusRp += -n;
    else if (m.jenis === "koreksi") {
      mutasiSaldo.koreksiJumlah += 1;
      if (n > 0) mutasiSaldo.koreksiTambahRp += n;
      else mutasiSaldo.koreksiKurangRp += -n;
    }
  }

  // Bentuk datar sesuai kesepakatan dengan layar: total di tingkat atas, dan tiap kelompok
  // memuat `nama` (pengguna: nama akun; peran/kelompok/model: nilainya) di samping angkanya.
  return {
    bulan: dari.bulan,
    dari: dari.bulan,
    sampai: sampai.bulan,
    pendapatanRp: total.pendapatanRp,
    biayaApiRp: total.biayaApiRp,
    biayaMdrRp: total.biayaMdrRp,
    labaRp: total.labaRp,
    ringkasan: total,
    perPengguna: urutkan(perPengguna).map(([id, k]) => ({ nama: pengguna.get(id)?.nama || id, penggunaId: id, peran: pengguna.get(id)?.peran ?? "", ...k })),
    perPeran: urutkan(perPeran).map(([peran, k]) => ({ nama: peran, peran, ...k })),
    perKelompok: urutkan(perKelompok).map(([kelompok, k]) => ({ nama: kelompok, kelompok, ...k })),
    perModel: urutkan(perModel).map(([model, k]) => ({ nama: model, model, ...k })),
    mutasiSaldo,
    perBulan: [...perBulan.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([bln, k]) => ({ nama: bln, bulan: bln, ...k })),
  };
}

export type LaporanAi = Awaited<ReturnType<typeof laporanRentang>>;

const KOLOM_ANGKA: Array<{ key: keyof Kumpulan; header: string }> = [
  { key: "giliran", header: "Giliran" },
  { key: "gratis", header: "Giliran gratis" },
  { key: "token", header: "Token" },
  { key: "biayaUsd", header: "Biaya API (USD)" },
  { key: "biayaApiRp", header: "Biaya API (Rp)" },
  { key: "biayaMdrRp", header: "Biaya MDR (Rp)" },
  { key: "pendapatanRp", header: "Pendapatan (Rp)" },
  { key: "labaRp", header: "Laba (Rp)" },
];

const BAGIAN: Array<{ kunci: "perBulan" | "perPengguna" | "perPeran" | "perKelompok" | "perModel"; judul: string }> = [
  { kunci: "perBulan", judul: "Per bulan" },
  { kunci: "perPengguna", judul: "Per pengguna" },
  { kunci: "perPeran", judul: "Per peran" },
  { kunci: "perKelompok", judul: "Per kelompok" },
  { kunci: "perModel", judul: "Per model" },
];

const bulat = (k: keyof Kumpulan, n: number) => (k === "biayaUsd" ? Math.round(n * 1e6) / 1e6 : Math.round(n));

function selCsv(nilai: string | number): string {
  const t = String(nilai);
  // Cegah formula injection (=, +, -, @) pada teks; angka dibiarkan.
  const aman = typeof nilai === "string" && /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
  return /[",;\n\r]/.test(aman) ? `"${aman.replace(/"/g, '""')}"` : aman;
}

function barisMutasiSaldo(lap: LaporanAi): Array<[string, number]> {
  const m = lap.mutasiSaldo;
  return [
    ["Isi saldo", m.isiRp],
    ["Kuota hibah", m.kuotaRp],
    ["Kuota hangus", m.kuotaHangusRp],
    ["Koreksi admin (tambah)", m.koreksiTambahRp],
    ["Koreksi admin (kurang)", m.koreksiKurangRp],
  ];
}

/** CSV satu tabel: Bagian, Nama, angka... (baris "Total" lebih dulu). Pemisah koma, UTF-8 dengan BOM untuk Excel. */
export function laporanKeCsv(lap: LaporanAi): string {
  const kepala = ["Bagian", "Nama", ...KOLOM_ANGKA.map((k) => k.header)];
  const baris: Array<Array<string | number>> = [kepala];
  baris.push(["Total", `${lap.dari} s.d. ${lap.sampai}`, ...KOLOM_ANGKA.map((k) => bulat(k.key, lap.ringkasan[k.key]))]);
  for (const bag of BAGIAN) {
    for (const r of lap[bag.kunci]) baris.push([bag.judul, r.nama, ...KOLOM_ANGKA.map((k) => bulat(k.key, r[k.key]))]);
  }
  baris.push([], ["Mutasi saldo", "Jenis", "Jumlah (Rp)"]);
  for (const [nama, rp] of barisMutasiSaldo(lap)) baris.push(["Mutasi saldo", nama, rp]);
  return `\uFEFF${baris.map((r) => r.map(selCsv).join(",")).join("\r\n")}\r\n`;
}

/** XLSX: lembar Ringkasan + satu lembar per bagian. */
export function laporanKeXlsx(lap: LaporanAi): Buffer {
  const kolom = [{ key: "nama", header: "Nama", width: 32 }, ...KOLOM_ANGKA.map((k) => ({ key: k.key, header: k.header, width: 16 }))];
  const keBaris = (nama: string, k: Kumpulan) => ({ nama, ...Object.fromEntries(KOLOM_ANGKA.map((c) => [c.key, bulat(c.key, k[c.key])])) });
  const lembar = [
    { name: "Ringkasan", columns: kolom, rows: [keBaris(`Total ${lap.dari} s.d. ${lap.sampai}`, lap.ringkasan)], freezeHeader: true },
    ...BAGIAN.map((bag) => ({ name: bag.judul, columns: kolom, rows: lap[bag.kunci].map((r) => keBaris(r.nama, r)), autoFilter: true, freezeHeader: true })),
    {
      name: "Mutasi saldo",
      columns: [
        { key: "jenis", header: "Jenis", width: 28 },
        { key: "jumlah", header: "Jumlah (Rp)", width: 16 },
      ],
      rows: barisMutasiSaldo(lap).map(([jenis, jumlah]) => ({ jenis, jumlah })),
      freezeHeader: true,
    },
  ];
  return createXlsxWorkbook(lembar, { creator: "", aplikasi: "" });
}
