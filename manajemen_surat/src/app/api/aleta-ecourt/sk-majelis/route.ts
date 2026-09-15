import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { gatewayPegawaiPenunjukan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import {
  bacaHariSidang,
  NAMA_HARI,
  SK_BERLAKU,
  simpanHariSidang,
} from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * SK SUSUNAN MAJELIS HAKIM DAN PANITERA SIDANG
 * ============================================================================
 *
 * Sampai sekarang susunan majelis yang ditawarkan panel diturunkan dari
 * PEMAKAIAN di SIPP - susunan yang paling sering muncul pada perkara tahun
 * berjalan. Itu bekerja, tetapi tidak dapat membedakan susunan yang ditetapkan
 * SK dari susunan darurat yang kebetulan pernah dipakai sekali karena seorang
 * hakim berhalangan.
 *
 * Layar ini menyimpan SK-nya sendiri, dan karena itu satu-satunya tempat
 * susunan majelis dapat DIUBAH tanpa menyentuh kode.
 *
 * ============================================================================
 * PANITERA DIIKAT KE ORANGNYA, BUKAN KE KODENYA
 * ============================================================================
 *
 * Daftar hakim dan panitera aktif ikut dikirim sebab pengikatan itu tidak
 * dapat dikerjakan mesin: kode panitera pada SIPP tabrakan - empat orang
 * berbagi kode "D" sementara SK membedakannya D, D1, D3, D4 - dan namanya pun
 * berbeda ejaan ("Munifah" pada SK, "Munifa" pada SIPP). Yang dapat
 * memutuskan siapa yang dimaksud SK hanya manusia.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const majelis = await bacaHariSidang(db);
    const pegawai = await gatewayPegawaiPenunjukan();

    return ok({
      majelis,
      namaHari: NAMA_HARI,
      skBerlaku: SK_BERLAKU,
      // Gagalnya bot TIDAK menggagalkan layar: susunan yang sudah tersimpan
      // tetap terbaca dan tetap dapat disunting hari/kodenya. Yang hilang
      // hanya kemampuan mengikat ke orang, dan itu disebutkan apa adanya.
      pegawaiTerbaca: pegawai.ok === true,
      pegawaiAlasan: pegawai.ok ? "" : String(pegawai.error || "aleta_bot tidak dapat dihubungi"),
      hakim: (pegawai.ok ? (pegawai.data?.hakim ?? []) : []) as unknown[],
      panitera: (pegawai.ok ? (pegawai.data?.panitera ?? []) : []) as unknown[],
    });
  } catch (galat) {
    return handleAdminRouteError(galat, request, {
      db,
      actorUserId,
      action: "SK_MAJELIS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/**
 * Menyimpan satu majelis.
 *
 * Kewenangannya diperiksa di dalam simpanHariSidang - hanya Super Admin dan
 * Admin. Diperiksa di sana, bukan di sini, supaya satu-satunya jalan menulis
 * tabel ini melewati pemeriksaan yang sama.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const badan = (await request.json()) as Record<string, unknown>;

    const hasil = await simpanHariSidang(db, {
      actorUserId: String(actorUserId ?? ""),
      majelisKode: String(badan.majelisKode ?? ""),
      hari: Number(badan.hari),
      paniteraKode: String(badan.paniteraKode ?? ""),
      hakimKode: String(badan.hakimKode ?? ""),
      paniteraId: String(badan.paniteraId ?? ""),
      skNomor: String(badan.skNomor ?? ""),
      skTanggal: String(badan.skTanggal ?? ""),
      keterangan: String(badan.keterangan ?? ""),
    });

    return ok({ majelis: hasil });
  } catch (galat) {
    return handleAdminRouteError(galat, request, {
      db,
      actorUserId,
      action: "SK_MAJELIS_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
