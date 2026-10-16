import { type NextRequest } from "next/server";

import { hakPengaturanAbt } from "@/lib/pengaturan-abt";
import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaMenu,
  bacaTemplat,
  bacaVariabel,
  cariPerkaraContoh,
  daftarTemplat,
  daftarVariabel,
  kembalikanSuntingan,
  riwayatSuntingan,
  simpanMenu,
  simpanTemplat,
  simpanVariabel,
  ujiVariabel,
  type AktorPengaturan,
} from "@/server/modules/pengaturan-abt/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getRequestAuditMetadata, getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pengaturan SIPP & ABT - halaman admin (16 Okt 2026, Tahap H).
 *
 *   GET ?bagian=menu                       hak menu folder Blangko Derry + saklar kebijakan
 *   GET ?bagian=variabel                   variabel yang dipakai blangko Derry
 *   GET ?bagian=variabel&noVar=NNNN        satu variabel (kueri hanya untuk Super Admin)
 *   GET ?bagian=templat[&kode=X]           kumpulan / isi template tanya jawab
 *   GET ?bagian=riwayat[&jenis=&kunci=]    riwayat suntingan (cadangan nilai lama)
 *   GET ?bagian=perkara[&nomor=]           perkara contoh untuk uji variabel
 *
 *   POST {tindakan: "simpan-menu", ubah:[{id,lama,baru}], config:[{name,lama,baru}]}
 *   POST {tindakan: "uji-variabel", noVar, perkaraId, sidangKe, sql_query?}   tidak menulis
 *   POST {tindakan: "simpan-variabel", noVar, lama, baru, perkaraId, sidangKe}
 *   POST {tindakan: "simpan-templat", kode, lama:[{tanya,jawab}], baru:[...]}
 *   POST {tindakan: "kembalikan", id}
 *
 * Membuka: Super Admin dan Admin. Mengubah hak menu/saklar dan kueri variabel:
 * Super Admin saja; isian bawaan dan template: Super Admin dan Admin
 * (lib/pengaturan-abt.ts hakPengaturanAbt).
 */
async function aktorDari(request: NextRequest, pekerjaan: string) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  const actor = await pastikanAdminIstimewa(db, actorUserId, pekerjaan);
  const roleId = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "");
  const aktor: AktorPengaturan = { id: actor.id, name: actor.name, roleId };
  return { db, actorUserId, aktor, hak: hakPengaturanAbt(roleId) };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorDari(request, "membuka Pengaturan SIPP & ABT");
    db = a.db;
    actorUserId = a.actorUserId;
    const bagian = getSearchParam(request, "bagian") ?? "menu";

    if (bagian === "menu") return ok({ ...(await bacaMenu()), hak: a.hak });
    if (bagian === "variabel") {
      const noVar = getSearchParam(request, "noVar");
      return ok(noVar ? { ...(await bacaVariabel(db, noVar, a.hak)), hak: a.hak } : { ...(await daftarVariabel(db)), hak: a.hak });
    }
    if (bagian === "templat") {
      const kode = getSearchParam(request, "kode");
      return ok(kode ? await bacaTemplat(kode) : await daftarTemplat());
    }
    if (bagian === "riwayat") {
      return ok({
        riwayat: await riwayatSuntingan(db, {
          jenis: getSearchParam(request, "jenis") ?? "",
          kunci: getSearchParam(request, "kunci") ?? "",
          batas: Number(getSearchParam(request, "batas") ?? 50),
        }),
      });
    }
    if (bagian === "perkara") return ok(await cariPerkaraContoh(getSearchParam(request, "nomor") ?? ""));
    throw new ApiError(400, "Bagian tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENGATURAN_SIPP_ABT_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "pengaturan-sipp-abt",
    });
  }
}

async function bacaBadan(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorDari(request, "mengubah Pengaturan SIPP & ABT");
    db = a.db;
    actorUserId = a.actorUserId;
    const badan = await bacaBadan(request);
    const ip = getRequestAuditMetadata(request).ipAddress;
    switch (String(badan.tindakan ?? "")) {
      case "simpan-menu":
        return ok(await simpanMenu(db, a.aktor, ip, badan));
      case "uji-variabel":
        return ok(await ujiVariabel(a.hak, badan));
      case "simpan-variabel":
        return ok(await simpanVariabel(db, a.aktor, ip, badan));
      case "simpan-templat":
        return ok(await simpanTemplat(db, a.aktor, ip, badan));
      case "kembalikan":
        return ok(await kembalikanSuntingan(db, a.aktor, ip, String(badan.id ?? "")));
      default:
        throw new ApiError(400, "Tindakan tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENGATURAN_SIPP_ABT_WRITE_FAILED",
      feature: "aleta_ecourt",
      entityId: "pengaturan-sipp-abt",
    });
  }
}
