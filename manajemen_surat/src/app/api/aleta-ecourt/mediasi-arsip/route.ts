import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { daftarBerkas, hapusBerkasArsip, unggahBerkas, BATAS } from "@/server/modules/mediasi-arsip/layanan";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Arsip hasil mediasi per perkara (tombol "Unggah hasil mediasi" di tab Mediasi SIPP).
 *
 *   GET    ?nomorPerkara=                       -> { berkas[], hak: { lihat, unggah } }
 *   POST   multipart: berkas, nomorPerkara, urutanMediasi?, gantiId?, konfirmasiGanti?, akunSipp?
 *                                               -> { ok, berkas, peringatan[] }
 *   DELETE ?id=&konfirmasi=1&alasan=            -> { ok }
 *
 * Hak menurut matriks peran (mediasi.arsip-lihat / -unggah / -hapus). Menulis HANYA ke arsip
 * ALETA (folder yang di-mount + tabel aleta_mediasi_berkas); tidak ada tulisan ke SIPP dari sini.
 * Lihat server/modules/mediasi-arsip/layanan.ts.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanAksi(db, actorUserId, "mediasi.arsip-lihat");
    return ok(await daftarBerkas(db, aktor, { nomorPerkara: request.nextUrl.searchParams.get("nomorPerkara") }));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "MEDIASI_ARSIP_DAFTAR_GAGAL", feature: "aleta_ecourt", entityId: "mediasi-arsip" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanAksi(db, actorUserId, "mediasi.arsip-unggah");
    const formulir = await request.formData();
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) return ok({ ok: false, sebab: "Berkasnya belum dipilih." });
    // Ukuran diperiksa SEBELUM dibaca ke memori.
    if (berkas.size > BATAS.ukuranBerkas) return ok({ ok: false, sebab: `Ukuran berkas melampaui ${Math.round(BATAS.ukuranBerkas / 1024 / 1024)} MB.` });
    const hasil = await unggahBerkas(db, aktor, {
      nomorPerkara: formulir.get("nomorPerkara"),
      urutanMediasi: formulir.get("urutanMediasi"),
      gantiId: formulir.get("gantiId"),
      konfirmasiGanti: formulir.get("konfirmasiGanti") === "1",
      akunSipp: formulir.get("akunSipp"),
      nama: berkas.name,
      bita: new Uint8Array(await berkas.arrayBuffer()),
      ip: getRequestAuditMetadata(request).ipAddress,
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "MEDIASI_ARSIP_UNGGAH_GAGAL", feature: "aleta_ecourt", entityId: "mediasi-arsip" });
  }
}

export async function DELETE(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanAksi(db, actorUserId, "mediasi.arsip-hapus");
    const p = request.nextUrl.searchParams;
    return ok(
      await hapusBerkasArsip(db, aktor, {
        id: p.get("id"),
        konfirmasi: p.get("konfirmasi") === "1",
        alasan: p.get("alasan"),
        ip: getRequestAuditMetadata(request).ipAddress,
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "MEDIASI_ARSIP_HAPUS_GAGAL", feature: "aleta_ecourt", entityId: "mediasi-arsip" });
  }
}
