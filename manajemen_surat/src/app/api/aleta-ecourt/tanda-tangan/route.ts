import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayTandaTangan,
  kirimTandaTanganHapus,
  kirimTandaTanganNama,
  kirimTandaTanganSahkan,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getUserByIdFromDb } from "@/server/modules/organization/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * TANDA TANGAN PEJABAT - DAFTAR, PENAMAAN, DAN PENGESAHAN
 * ============================================================================
 *
 * Dipakai membubuhkan tanda tangan pada penetapan yang diterbitkan ALETA.
 * Gambarnya diimpor dari berkas .doc satuan kerja, dan pengukirannya kasar -
 * ia menyapu bita mencari tanda berkas PNG dan JPEG, tanpa tahu gambar mana
 * milik siapa.
 *
 * Karena itu tiap gambar harus DINAMAI dan DISAHKAN seorang manusia sebelum
 * dapat dipakai. Tanda tangan yang terpasang pada nama yang keliru adalah
 * tanda tangan palsu pada penetapan pengadilan, dan tidak ada satu galat pun
 * yang akan berbunyi.
 *
 * ============================================================================
 * KEWENANGANNYA "blangko-abt", BUKAN "penunjukan"
 * ============================================================================
 *
 * Yang boleh menuliskan penetapan belum tentu yang boleh menyatakan gambar ini
 * tanda tangan seorang hakim. Yang kedua menyangkut seluruh satuan kerja dan
 * berlaku untuk semua perkara sesudahnya - kewenangan yang sama dengan yang
 * menyunting blangko ABT.
 *
 * Nama pengesah diambil dari SESI, tidak pernah dari badan permintaan.
 */
async function pengesah(request: NextRequest) {
  const db = await getDatabase();
  const actorUserId = await resolveActorUserId(request);
  await pastikanKapabilitas(db, actorUserId, "blangko-abt");
  const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
  const nama = String(aktor?.name || aktor?.email || actorUserId || "").trim();
  return { db, actorUserId, nama };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const sesi = await pengesah(request);
    db = sesi.db;
    actorUserId = sesi.actorUserId;

    const hanyaSah = request.nextUrl.searchParams.get("hanyaSah") === "1";
    const respons = await getGatewayTandaTangan(hanyaSah);
    return Response.json(respons, { status: respons?.ok === false ? 502 : 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TANDA_TANGAN_BACA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    const sesi = await pengesah(request);
    db = sesi.db;
    actorUserId = sesi.actorUserId;
    if (!sesi.nama) {
      return Response.json({ ok: false, alasan: "pengesah_tidak_dikenali" }, { status: 403 });
    }

    const badan = (await request.json()) as Record<string, unknown>;
    const id = Number(badan.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ ok: false, alasan: "id_tidak_sah" }, { status: 400 });
    }

    const tindakan = String(badan.tindakan ?? "");

    if (tindakan === "nama") {
      const respons = await kirimTandaTanganNama(id, {
        namaPejabat: String(badan.namaPejabat ?? "").slice(0, 150),
        jabatan: String(badan.jabatan ?? "").slice(0, 120),
        oleh: sesi.nama,
      });
      return Response.json(respons, { status: respons?.ok === false ? 400 : 200 });
    }

    if (tindakan === "sahkan") {
      const respons = await kirimTandaTanganSahkan(id, sesi.nama);
      return Response.json(respons, { status: respons?.ok === false ? 400 : 200 });
    }

    if (tindakan === "hapus") {
      const respons = await kirimTandaTanganHapus(id);
      return Response.json(respons, { status: respons?.ok === false ? 400 : 200 });
    }

    return Response.json({ ok: false, alasan: "tindakan_tidak_dikenali" }, { status: 400 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "TANDA_TANGAN_UBAH_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
