import { type NextRequest } from "next/server";

import { bacaIsianUntukLayar, jalankanAksiIsian, simpanIsianDariIsi } from "@/server/modules/skp/layanan";
import { bacaIsiJson, jalankanRuteSkp } from "@/server/modules/skp/rute-umum";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Isian manual SKP (indikator yang tidak terbaca dari SIPP, dengan bukti).
 *
 *   GET  ?pegawai=<id pengguna>&tahun=2026[&periode=b09]  isian pegawai itu (hak lihat SKP-nya)
 *   PUT  {pegawai?, periode, tahun, kunciRhk, kunciIndikator, nilai, nilaiTeks?, catatan?, bukti:[{judul,rujukan?,tanggal?}]}
 *        menyimpan DRAF - hanya pemilik (tanpa `pegawai` = dirinya)
 *   POST {aksi: "ajukan"|"setujui"|"kembalikan", id, catatan?}
 *        ajukan: pemilik (wajib bernilai dan berbukti); setujui/kembalikan:
 *        atasan langsung, Ketua, Panitera, Super Admin, Admin (kembalikan
 *        wajib berisi catatan)
 */
export async function GET(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_ISIAN_FAILED", async ({ db, aktor }) =>
    ok(await bacaIsianUntukLayar(db, aktor, request.nextUrl.searchParams))
  );
}

export async function PUT(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_ISIAN_SIMPAN_FAILED", async ({ db, aktor }) =>
    ok({ isian: await simpanIsianDariIsi(db, aktor, await bacaIsiJson(request)) })
  );
}

export async function POST(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_ISIAN_AKSI_FAILED", async ({ db, aktor }) =>
    ok({ isian: await jalankanAksiIsian(db, aktor, await bacaIsiJson(request)) })
  );
}
