import { type NextRequest } from "next/server";

import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import {
  bedaAntarVersi,
  bukaBlangko,
  cobaBlangko,
  daftarBlangko,
  daftarIsian,
  pulihkanVersi,
  riwayatVersi,
  simpanSuntingan,
  terbitkanVersi,
} from "@/server/modules/aleta-abt-penyunting/service";
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
 * Penyunting blangko dan versi ALETA ABT (5 Nov 2026, Tahap 3). SEMUA permintaan hanya untuk Super Admin, diputuskan di server
 * (bukan saklar ALETA ABT di HP: itu hanya izin membuka dari HP; keputusan pemilik: penyunting hanya Super Admin sampai stabil).
 *
 *   GET                                  daftar folder dan blangko dari pustaka
 *   GET ?bagian=isian                    daftar isian (nama) untuk "Sisipkan isian"
 *   GET ?bagian=blangko&id=[&versi=]     buka satu blangko (versi terkini bila tanpa versi)         [audit]
 *   GET ?bagian=riwayat&id=              riwayat versi
 *   GET ?bagian=beda&id=&a=&b=           beda antara dua versi
 *   GET ?bagian=coba&id=[&versi=][&berkas=1]   coba pada perkara rekaan (berkas=1: sertakan RTF contoh)   [audit]
 *   POST {tindakan:"simpan", id, dasarNomor, suntingan:[{i,teks}], hapus?:[i], catatan?}   versi baru (draf)   [audit]
 *   POST {tindakan:"pulihkan", id, nomor}                       salinan persis per bita menjadi versi baru   [audit]
 *   POST {tindakan:"terbitkan", id, nomor}                      isi pustaka diganti versi itu               [audit]
 *
 * Tidak ada yang ditulis ke SIPP/ABT. Audit tidak memuat isi blangko, hanya berkas, nomor versi, dan sidik.
 */
async function aktorSuperAdmin(request: NextRequest) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  const actor = await requireActorUser(db, actorUserId);
  const roleId = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "");
  if (roleId !== "super-admin") throw new ApiError(403, "Penyunting blangko ALETA ABT hanya untuk Super Admin.");
  return { db, actorUserId, aktor: { id: String(actor.id), name: String(actor.name || actor.id) } };
}

async function catat(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string, action: string, entityId: string, payload: Record<string, unknown>) {
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId,
    action,
    entityType: "aleta_abt_berkas",
    entityId,
    payload,
  });
}

const angka = (x: string | undefined) => {
  if (x === undefined) return undefined;
  const n = Number(x);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdmin(request);
    db = a.db;
    actorUserId = a.actorUserId;
    const bagian = getSearchParam(request, "bagian") ?? "daftar";
    const id = getSearchParam(request, "id") ?? "";
    const perluId = () => {
      if (!id) throw new ApiError(400, "Blangko belum dipilih.");
      return id;
    };
    switch (bagian) {
      case "daftar":
        return ok(await daftarBlangko(a.db));
      case "isian":
        return ok({ isian: await daftarIsian(a.db) });
      case "blangko": {
        const hasil = await bukaBlangko(a.db, perluId(), angka(getSearchParam(request, "versi")));
        await catat(a.db, a.actorUserId, "ALETA_ABT_BLANGKO_BUKA", id, { versi: hasil.versi.nomor, md5: hasil.versi.md5 });
        return ok(hasil);
      }
      case "riwayat":
        return ok(await riwayatVersi(a.db, perluId()));
      case "beda": {
        const x = angka(getSearchParam(request, "a"));
        const y = angka(getSearchParam(request, "b"));
        if (!x || !y) throw new ApiError(400, "Pilih dua versi untuk dibandingkan.");
        return ok(await bedaAntarVersi(a.db, perluId(), x, y));
      }
      case "coba": {
        const sertakan = getSearchParam(request, "berkas") === "1";
        const hasil = await cobaBlangko(a.db, perluId(), angka(getSearchParam(request, "versi")), sertakan);
        await catat(a.db, a.actorUserId, "ALETA_ABT_BLANGKO_COBA", id, { versi: hasil.versi, berkas: sertakan });
        return ok(hasil);
      }
      default:
        throw new ApiError(400, "Bagian tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ALETA_ABT_PENYUNTING_READ_FAILED",
      feature: "aleta_abt",
      entityId: "aleta-abt-penyunting",
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
    const id = String(badan.id ?? "").trim();
    if (!id) throw new ApiError(400, "Blangko belum dipilih.");
    switch (String(badan.tindakan ?? "")) {
      case "simpan": {
        const suntingan = Array.isArray(badan.suntingan) ? (badan.suntingan as Array<{ i: number; teks: string }>) : [];
        const hapus = Array.isArray(badan.hapus) ? (badan.hapus as number[]).map(Number) : [];
        if (!suntingan.length && !hapus.length) throw new ApiError(400, "Tidak ada perubahan untuk disimpan.");
        const hasil = await simpanSuntingan(a.db, a.aktor, { id, dasarNomor: Number(badan.dasarNomor), suntingan, hapus, catatan: String(badan.catatan ?? "") });
        await catat(a.db, a.actorUserId, "ALETA_ABT_BLANGKO_SIMPAN", id, { nomor: hasil.nomor, md5: hasil.md5, ukuran: hasil.ukuran, ringkas: hasil.ringkas });
        return ok(hasil);
      }
      case "pulihkan": {
        const hasil = await pulihkanVersi(a.db, a.aktor, { id, nomor: Number(badan.nomor) });
        await catat(a.db, a.actorUserId, "ALETA_ABT_BLANGKO_PULIH", id, { nomor: hasil.nomor, dariNomor: hasil.dariNomor, md5: hasil.md5 });
        return ok(hasil);
      }
      case "terbitkan": {
        const hasil = await terbitkanVersi(a.db, a.aktor, { id, nomor: Number(badan.nomor) });
        await catat(a.db, a.actorUserId, "ALETA_ABT_BLANGKO_TERBIT", id, { nomor: hasil.nomor, md5: hasil.md5 });
        return ok(hasil);
      }
      default:
        throw new ApiError(400, "Tindakan tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ALETA_ABT_PENYUNTING_WRITE_FAILED",
      feature: "aleta_abt",
      entityId: "aleta-abt-penyunting",
    });
  }
}
