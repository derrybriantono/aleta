import { type NextRequest } from "next/server";

import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import {
  bacaSetelanSinkronAbt,
  bukaBeda,
  buatPaketEkspor,
  daftarEkspor,
  putuskanBeda,
  ringkasanBeda,
  simpanSetelanSinkronAbt,
} from "@/server/modules/aleta-abt-sinkron/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tetap sinkron dengan ABT (5 Nov 2026, Tahap 9). SEMUA permintaan hanya untuk Super Admin, diputuskan di server (sama dengan
 * penyunting blangko: saklar ALETA ABT di HP hanya izin membuka dari HP).
 *
 *   GET                                 ringkasan: jumlah menunggu ditinjau, daftar beda, yang hilang di ABT, setelan jadwal
 *   GET ?bagian=setelan                 setelan sinkron terjadwal
 *   GET ?bagian=beda&id=                satu blangko: isi ALETA ABT melawan isi ABT terbaru                  [audit]
 *   GET ?bagian=ekspor-daftar           ubahan yang siap dan yang belum siap dikirim sebagai paket
 *   GET ?bagian=ekspor[&id=...]         unduh paket ABT (ZIP berkas saja, TIDAK dipasang)                    [audit]
 *   POST {tindakan:"setelan", jadwal?, jam?, izinJamKerja?}       atur sinkron terjadwal (bawaan mati)       [audit]
 *   POST {tindakan:"putuskan", id, pilihan:"ambil"|"tetap", md5Abt, md5Aleta}   ambil dari ABT / tetap ALETA   [audit]
 *
 * Tidak ada yang ditulis ke SIPP/ABT. Audit tidak memuat isi blangko, hanya berkas, sidik, dan pilihan.
 */
async function aktorSuperAdmin(request: NextRequest) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  const actor = await requireActorUser(db, actorUserId);
  const roleId = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "");
  if (roleId !== "super-admin") throw new ApiError(403, "Beda dengan ABT hanya untuk Super Admin.");
  return { db, actorUserId, aktor: { id: String(actor.id), name: String(actor.name || actor.id) } };
}

async function catat(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string, action: string, entityType: string, entityId: string, payload: Record<string, unknown>) {
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId,
    action,
    entityType,
    entityId,
    payload,
  });
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdmin(request);
    db = a.db;
    actorUserId = a.actorUserId;
    const bagian = getSearchParam(request, "bagian") ?? "ringkas";
    const id = getSearchParam(request, "id") ?? "";
    switch (bagian) {
      case "ringkas":
        return ok(await ringkasanBeda(a.db));
      case "setelan":
        return ok(await bacaSetelanSinkronAbt(a.db));
      case "beda": {
        if (!id) throw new ApiError(400, "Blangko belum dipilih.");
        const hasil = await bukaBeda(a.db, id);
        await catat(a.db, a.actorUserId, "ALETA_ABT_BEDA_BUKA", "aleta_abt_berkas", id, { md5Aleta: hasil.md5Aleta, md5Abt: hasil.md5Abt });
        return ok(hasil);
      }
      case "ekspor-daftar":
        return ok(await daftarEkspor(a.db));
      case "ekspor": {
        const hasil = await buatPaketEkspor(a.db, id ? [id] : undefined);
        await catat(a.db, a.actorUserId, "ALETA_ABT_BEDA_EKSPOR", "aleta_abt_paket", hasil.nama, {
          berkas: hasil.berkas,
          potongan: hasil.potongan,
          tidakSiap: hasil.tidakSiap.length,
          sidik: hasil.sidikBerkas,
          dipasang: false,
        });
        return new Response(new Uint8Array(hasil.zip), {
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${hasil.nama}.zip"`,
            "cache-control": "private, no-store",
            "content-length": String(hasil.zip.length),
          },
        });
      }
      default:
        throw new ApiError(400, "Bagian tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ALETA_ABT_BEDA_READ_FAILED",
      feature: "aleta_abt",
      entityId: "aleta-abt-sinkron",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdmin(request);
    db = a.db;
    actorUserId = a.actorUserId;
    let badan: Record<string, unknown> = {};
    try {
      const isi = (await request.json()) as unknown;
      if (isi && typeof isi === "object" && !Array.isArray(isi)) badan = isi as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    switch (String(badan.tindakan ?? "")) {
      case "setelan": {
        const hasil = await simpanSetelanSinkronAbt(a.db, a.aktor, badan);
        await catat(a.db, a.actorUserId, "ALETA_ABT_SINKRON_SETELAN", "aleta_abt_sinkron", "jadwal", { jadwal: hasil.jadwal, jam: hasil.jam, izinJamKerja: hasil.izinJamKerja });
        return ok(hasil);
      }
      case "putuskan": {
        const id = String(badan.id ?? "").trim();
        if (!id) throw new ApiError(400, "Blangko belum dipilih.");
        const pilihan = badan.pilihan === "ambil" ? "ambil" : badan.pilihan === "tetap" ? "tetap" : "";
        if (!pilihan) throw new ApiError(400, "Pilih ambil dari ABT atau tetap memakai ALETA ABT.");
        const hasil = await putuskanBeda(a.db, a.aktor, { id, pilihan, md5Abt: String(badan.md5Abt ?? ""), md5Aleta: String(badan.md5Aleta ?? "") });
        await catat(a.db, a.actorUserId, pilihan === "ambil" ? "ALETA_ABT_BEDA_AMBIL" : "ALETA_ABT_BEDA_TETAP", "aleta_abt_berkas", id, {
          pilihan,
          nomor: hasil.nomor,
          md5Abt: String(badan.md5Abt ?? ""),
          md5Aleta: String(badan.md5Aleta ?? ""),
        });
        return ok(hasil);
      }
      default:
        throw new ApiError(400, "Tindakan tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ALETA_ABT_BEDA_WRITE_FAILED",
      feature: "aleta_abt",
      entityId: "aleta-abt-sinkron",
    });
  }
}
