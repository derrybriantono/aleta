import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  aktifkanVersi,
  bacaPenyunting,
  daftarKatalog,
  indeksEfektif,
  isiEfektif,
  isiVersi,
  katalogDbAktif,
  kembaliKeBawaan,
  pastikanPenyunting,
  periksaIsi,
  pratinjauKatalog,
  riwayatKatalog,
  simpanPenyunting,
  simpanVersi,
  sidikKatalog,
} from "@/server/modules/aleta-ecourt/saksi-katalog-db";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * KATALOG SAKSI DI BASIS DATA DENGAN VERSI (25 Okt 2026, rantai C butir C4 = U8)
 * ============================================================================
 *
 * Untuk ekstensi (kemampuan "blangko-abt"; hanya baca):
 *   GET ?bagian=indeks        -> {aktif, indeks}: indeks efektif (bawaan ditimpa penimpa aktif). aktif:false bila
 *                                saklar Fitur Satker "katalog-saksi-basis-data" mati (bawaan) -> ekstensi memakai JSON tertanam.
 *   GET ?kunci=x              -> {aktif, kunci, sumber, versiDb, sidik, isi}: isi katalog efektif.
 *
 * Untuk layar penyunting (Super Admin + akun terdaftar):
 *   GET ?bagian=daftar        -> daftar katalog, saklar, penyunting terdaftar
 *   GET ?bagian=riwayat&kunci=
 *   GET ?bagian=isi&kunci=&versi=    versi kosong/0 = bawaan tertanam
 *   POST {aksi: "periksa"|"pratinjau", isi, kunci?}      memeriksa tanpa menyimpan
 *        {aksi: "simpan", kunci, isi, catatan?, dasarVersi?, aktifkan?}
 *        {aksi: "aktifkan", kunci, versi}   {aksi: "bawaan", kunci}
 *        {aksi: "penyunting", akun: [id...]}    (Super Admin saja)
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const bagian = String(getSearchParam(request, "bagian") ?? "").trim();
    const kunci = String(getSearchParam(request, "kunci") ?? "").trim();

    if (bagian === "daftar" || bagian === "riwayat" || bagian === "isi") {
      const aktor = await requireActorUser(db, actorUserId);
      await pastikanPenyunting(db, aktor);
      if (bagian === "daftar") {
        return ok({ aktif: await katalogDbAktif(db), daftar: await daftarKatalog(db), penyunting: await bacaPenyunting(db) });
      }
      if (!kunci) throw new ApiError(400, "Kunci katalog harus disebut.");
      if (bagian === "riwayat") return ok({ kunci, riwayat: await riwayatKatalog(db, kunci) });
      const versi = Number(getSearchParam(request, "versi")) || 0;
      const isi = await isiVersi(db, kunci, versi);
      if (!isi) throw new ApiError(404, "Versi katalog itu tidak ada.");
      return ok({ kunci, versi, sidik: sidikKatalog(isi), isi });
    }

    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const aktif = await katalogDbAktif(db);
    if (bagian === "indeks") return ok({ aktif, indeks: aktif ? await indeksEfektif(db) : [] });
    if (!kunci) throw new ApiError(400, "Kunci katalog harus disebut.");
    if (!aktif) return ok({ aktif: false, kunci });
    const efektif = await isiEfektif(db, kunci);
    if (!efektif) throw new ApiError(404, "Katalog itu tidak ada.");
    return ok({ aktif: true, ...efektif });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SAKSI_KATALOG_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "saksi-katalog",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await requireActorUser(db, actorUserId);
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const aksi = String(badan.aksi ?? "");
    const pelaku = { id: aktor.id, name: aktor.name, roleId: aktor.roleId, additionalRoleIds: aktor.additionalRoleIds };

    if (aksi === "penyunting") return ok({ akun: await simpanPenyunting(db, pelaku, badan.akun) });

    await pastikanPenyunting(db, pelaku);
    if (aksi === "periksa" || aksi === "pratinjau") {
      const hasil = periksaIsi(badan.isi, String(badan.kunci ?? ""));
      const dasar = { ok: hasil.ok, galat: hasil.galat, peringatan: hasil.peringatan, sidik: hasil.sidik, ukuran: hasil.ukuran };
      if (aksi === "pratinjau" && hasil.ok && hasil.katalog) return ok({ ...dasar, pratinjau: pratinjauKatalog(hasil.katalog) });
      return ok(dasar);
    }
    if (aksi === "simpan") {
      return ok(
        await simpanVersi(db, pelaku, {
          kunci: String(badan.kunci ?? ""),
          isi: badan.isi,
          catatan: String(badan.catatan ?? ""),
          dasarVersi: Number(badan.dasarVersi) || 0,
          aktifkan: badan.aktifkan !== false,
        })
      );
    }
    if (aksi === "aktifkan") return ok(await aktifkanVersi(db, pelaku, String(badan.kunci ?? ""), Number(badan.versi)));
    if (aksi === "bawaan") return ok(await kembaliKeBawaan(db, pelaku, String(badan.kunci ?? "")));
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SAKSI_KATALOG_TULIS_FAILED",
      feature: "aleta_ecourt",
      entityId: "saksi-katalog",
    });
  }
}
