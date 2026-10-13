import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { kirimPenetapanHapusSemuaGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pejabatSahUntukTanggal, saringPejabatPembatalan } from "@/server/modules/aleta-ecourt/rencana-penetapan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { alamatIpPeramban } from "@/server/shared/request";
import { getUserByIdFromDb } from "@/server/modules/organization/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * MEMBATALKAN SELURUH PENETAPAN SATU PERKARA
 * ============================================================================
 *
 * Membatalkan satu per satu menuntut empat kali dua tekanan, berurutan dari
 * PHS mundur ke PMH, dan urutan itu tidak boleh keliru - membongkar majelis
 * selagi hari sidangnya masih berdiri meninggalkan sidang bagi majelis yang
 * sudah tidak ada. Delapan tekanan yang urutannya harus diingat adalah delapan
 * kesempatan berhenti di tengah.
 *
 * ============================================================================
 * KERING SEBAGAI BAWAAN, DAN KEWENANGAN YANG SAMA DENGAN MENULIS
 * ============================================================================
 *
 * Permintaan yang lupa menyebut { kering: false } memulangkan RENCANA, bukan
 * pembongkarannya. Dan yang boleh menuliskan penetapan, dialah yang boleh
 * membongkarnya kembali - memisahkan keduanya hanya akan menghasilkan perkara
 * separuh tertulis yang tidak seorang pun berwenang membereskan.
 *
 * Operatornya dari SESI, tidak pernah dari badan permintaan: menerimanya dari
 * peramban berarti siapa pun yang dapat memanggil rute ini dapat menuliskan
 * nama orang lain pada catatan.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const aktor = actorUserId ? await getUserByIdFromDb(db, actorUserId) : null;
    const operator = String(aktor?.name || aktor?.email || actorUserId || "").trim();
    if (!operator) {
      return Response.json({ ok: false, alasan: "operator_tidak_dikenali" }, { status: 403 });
    }

    const badan = (await request.json()) as Record<string, unknown>;

    const perkaraId = Number(badan.perkaraId);
    if (!Number.isFinite(perkaraId) || perkaraId <= 0) {
      return Response.json({ ok: false, alasan: "perkara_tidak_sah" }, { status: 400 });
    }

    // Hanya keempat jenis yang dikenal, dan hanya nama akun yang berupa untai.
    // Menerima objek apa adanya berarti meneruskan apa pun yang dikirim
    // peramban ke dalam kueri bot.
    const masuk = (badan.akunPerJenis || {}) as Record<string, unknown>;
    const akunPerJenis: Record<string, string> = {};
    for (const jenis of ["pmh", "ppp", "pjs", "phs"]) {
      const nama = String(masuk[jenis] ?? "").trim();
      if (nama) akunPerJenis[jenis] = nama.slice(0, 60);
    }
    // Butir 17 (13 Okt 2026): cadangan pejabat yang tidak sah dibuang - lihat
    // saringPejabatPembatalan. akunSippMasuk = penekan sebenarnya (jejak ALETA).
    if (["pmh", "ppp", "pjs"].some((j) => akunPerJenis[j])) {
      const baca = await pejabatSahUntukTanggal(db, new Date().toISOString().slice(0, 10));
      for (const j of ["pmh", "ppp", "pjs"]) {
        if (!akunPerJenis[j]) continue;
        const nama = baca.ok ? saringPejabatPembatalan(baca.sah, j, akunPerJenis[j]) : "";
        if (nama) akunPerJenis[j] = nama;
        else delete akunPerJenis[j];
      }
    }
    const akunSippMasuk = String(badan.akunSippMasuk || "").trim().slice(0, 150);
    if (Object.keys(akunPerJenis).length === 0 && !akunSippMasuk) {
      return Response.json({ ok: false, alasan: "akun_sipp_belum_terbaca" }, { status: 400 });
    }

    const kering = badan.kering !== false;

    const respons = await kirimPenetapanHapusSemuaGateway({
      perkaraId,
      akunPerJenis,
      akunSippMasuk,
      operator,
      kering,
      ip: alamatIpPeramban(request),
    });

    return Response.json(respons, { status: respons?.ok === false ? 409 : 200 });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PENETAPAN_HAPUS_SEMUA_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
