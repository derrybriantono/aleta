import { type NextRequest } from "next/server";

import {
  type FaktaBukti,
  keteranganDraf,
  susunDrafBukti,
} from "@/lib/penyusun-pertimbangan";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { gatewayFaktaBuktiPertimbangan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * AGEN PENYUSUN PERTIMBANGAN (TAHAP 4) - DRAF DAFTAR ALAT BUKTI
 * ============================================================================
 *
 *   GET ?nomor=<nomor perkara>   draf + lubang yang harus diisi orang
 *
 * GET SAJA, DAN ITU BUKAN KEBETULAN. Daftar alat bukti menyatakan bahwa
 * selembar surat SUDAH dicocokkan dengan aslinya, SUDAH bermeterai, SUDAH
 * di-nazegelen, dan SUDAH diparaf Ketua Majelis - kesaksian tentang apa yang
 * terjadi di ruang sidang, bukan fakta yang tersimpan di basis data mana pun.
 *
 * Mesin dapat menyusun kalimatnya. Mesin tidak dapat menyaksikannya. Karena
 * itu tidak ada POST di berkas ini, dan tidak akan ada: yang menempelkannya
 * ke blangko adalah petugas, lewat panel ABT, sesudah membacanya.
 *
 * Kewenangannya "panel" - sama dengan layar yang hanya membaca.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const nomor = (request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) return ok({ tersedia: false, alasan: "nomor perkara belum disebut" });

    const jawab = await gatewayFaktaBuktiPertimbangan(nomor);
    if (!jawab.ok) {
      // "Tidak terbaca" dibedakan dari "tidak ada bukti". Yang kedua kabar
      // tentang perkaranya; yang pertama kabar bahwa kita tidak tahu apa-apa.
      return ok({
        tersedia: false,
        alasan: jawab.error || "aleta_bot tidak dapat dihubungi",
      });
    }

    const fakta = jawab.data?.fakta as FaktaBukti | undefined;
    if (!fakta) return ok({ tersedia: false, alasan: "fakta perkara tidak terbaca" });

    const draf = susunDrafBukti(fakta);
    return ok({
      tersedia: true,
      nomorPerkara: draf.nomorPerkara,
      butir: draf.butir,
      teks: draf.teks,
      lubang: draf.lubang,
      lengkap: draf.lengkap,
      keterangan: keteranganDraf(draf),
      // Ikut dikirim supaya layar tidak perlu menyimpulkannya sendiri - dan
      // supaya tidak ada layar yang lupa menyebutnya.
      hanyaDraf: true,
    });
  } catch (galat) {
    return handleAdminRouteError(galat, request, {
      db,
      actorUserId,
      action: "ECOURT_PERTIMBANGAN_BUKTI_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
