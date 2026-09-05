import { type NextRequest } from "next/server";

import { roles as daftarPeran } from "@/lib/mock-data";
import { type RoleId } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import { getGatewayPenunjukanUsulan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { kapabilitasPeran, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaPengaturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { normalisasiUsulan, rencanaUntukPerkara } from "@/server/modules/aleta-ecourt/rencana-penetapan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Usulan penunjukan PMH, PPP, PJS, dan PHS untuk perkara yang sedang dibuka.
 *
 * ============================================================================
 * MENGUSULKAN, TIDAK MENETAPKAN
 * ============================================================================
 *
 * Rute ini hanya menjawab siapa yang seharusnya ditunjuk dan kapan sidangnya.
 * Tidak ada satu pun tulisan ke SIPP dari sini - pengisian borangnya dikerjakan
 * ekstensi di peramban petugas, dan tombol Simpan tetap ditekan orang.
 *
 * ============================================================================
 * DUA KEMAMPUAN, DIPERIKSA TERPISAH
 * ============================================================================
 *
 * "penunjukan" membuka papannya. "penunjukan-otomatis" menyalakan penyusunan
 * lengkap tanpa diminta satu per satu.
 *
 * Yang diperiksa di sini yang PERTAMA, sebab yang dijawab memang isi papannya.
 * Kemampuan kedua ikut dikembalikan sebagai keterangan, supaya ekstensi tahu
 * apakah tombol otomatisnya perlu digambar - dan ketika nanti tombol itu
 * benar-benar mengisi borang, rutenya sendiri yang memeriksanya lagi. Ekstensi
 * berjalan di peramban pengguna; jawabannya kenyamanan, bukan penjagaan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) {
      return ok({ available: true, usulan: null, alasan: "nomor_perkara_kosong" });
    }

    const pengaturan = await bacaPengaturanPenunjukan(db);

    const hasil = await getGatewayPenunjukanUsulan({
      nomorPerkara: nomor,
      pengaturan: {
        aturan: pengaturan.aturan as unknown as Record<string, unknown>,
        hariSidang: pengaturan.hariSidang,
        paniteraMajelis: pengaturan.paniteraMajelis,
      },
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        usulan: null,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    // Kemampuan tombol otomatis dibaca dari matriks peran, bukan disimpulkan
    // dari kemampuan pertama - keduanya memang dapat dinyalakan sendiri-sendiri.
    const kemampuan = await kapabilitasPeran(db, actor.roleId as RoleId);
    const peran = daftarPeran.find((x) => x.id === actor.roleId);
    const bolehOtomatis = kemampuan["penunjukan-otomatis"] === true;

    // Rencana kerja berurutan dirakit hanya bila otomatis dinyalakan bagi peran
    // ini. Tetap BACA-SAJA: merakit rencana tidak menulis apa pun ke SIPP -
    // yang menulis nanti adalah ekstensi, dengan penjagaannya sendiri.
    let rencana = null;
    if (bolehOtomatis) {
      const usulanNormal = normalisasiUsulan(hasil.data as Record<string, unknown>);
      if (usulanNormal) {
        rencana = await rencanaUntukPerkara(db, { nomorPerkara: nomor, usulan: usulanNormal });
      }
    }

    return ok({
      available: true,
      usulan: hasil.data ?? null,
      rencana,
      pengaturan: {
        aturan: pengaturan.aturan,
        hariSidang: pengaturan.hariSidangRinci,
      },
      bolehOtomatis,
      pengguna: {
        nama: actor.name,
        peran: peran ? peran.name : String(actor.roleId || ""),
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_USULAN_READ_FAILED",
      feature: "penunjukan",
      entityId: "usulan",
    });
  }
}
