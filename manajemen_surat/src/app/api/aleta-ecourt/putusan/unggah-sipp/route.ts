import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { gatewayUnggahPutusanSipp } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Putusan yang khas di bawah 1 MB; batas ini longgar sepuluh kali lipat. */
const BATAS_SATU_BERKAS = 10 * 1024 * 1024;

/**
 * Mengunggah putusan akhir dan anonimisasinya ke SIPP sekaligus.
 *
 *   POST multipart: perkaraId, nomorPerkara, putusan?, anonimisasi?
 *
 * ============================================================================
 * INI MENULIS KE SIPP - DAN ITU DIBATASI KEWENANGANNYA
 * ============================================================================
 *
 * Berbeda dengan rute putusan yang lain di folder ini, yang ini benar-benar
 * MENULIS: berkas ke cakram SIPP, kolom dokumen pada perkara_putusan, baris
 * dirput_dokumen, dan antrean Direktori Putusan. Karena itu kewenangannya
 * "penunjukan" - kewenangan yang sama dengan menuliskan penetapan, bukan
 * kewenangan membaca panel.
 *
 * Portal tidak menyentuh SIPP sendiri; seluruhnya lewat gerbang bot, tempat
 * satu-satunya sambungan ke basis data SIPP berada.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const formulir = await request.formData();
    const perkaraId = String(formulir.get("perkaraId") ?? "").trim();
    const nomorPerkara = String(formulir.get("nomorPerkara") ?? "").trim();
    const olehUsername = String(formulir.get("olehUsername") ?? "").trim();

    if (!perkaraId) return ok({ ok: false, sebab: "perkara_id belum disebut." });
    if (!nomorPerkara) return ok({ ok: false, sebab: "Nomor perkara belum disebut." });

    const bacaBerkas = async (nama: string): Promise<string> => {
      const berkas = formulir.get(nama);
      if (!(berkas instanceof File) || berkas.size === 0) return "";
      if (berkas.size > BATAS_SATU_BERKAS) {
        throw new Error(
          `Ukuran ${nama} melampaui ${Math.round(BATAS_SATU_BERKAS / 1024 / 1024)} MB. Putusan yang sebesar itu hampir pasti hasil pindaian, bukan PDF teks.`
        );
      }
      return Buffer.from(await berkas.arrayBuffer()).toString("base64");
    };

    let putusanBase64 = "";
    let anonimisasiBase64 = "";
    try {
      putusanBase64 = await bacaBerkas("putusan");
      anonimisasiBase64 = await bacaBerkas("anonimisasi");
    } catch (galat) {
      return ok({ ok: false, sebab: String((galat as Error).message) });
    }

    if (!putusanBase64 && !anonimisasiBase64) {
      return ok({ ok: false, sebab: "Belum ada berkas yang dipilih." });
    }

    const hasil = await gatewayUnggahPutusanSipp({
      perkaraId,
      nomorPerkara,
      putusanBase64,
      anonimisasiBase64,
      // Akun SIPP yang sedang membuka halamannya - yang tercatat di audit trail
      // SIPP adalah dia, bukan akun ALETA. Yang menekan tombolnya orang yang
      // sedang masuk SIPP di layar itu.
      olehUsername,
    });

    if (!hasil.ok) {
      return ok({ ok: false, sebab: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok(hasil.data);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_UNGGAH_SIPP_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-unggah-sipp",
    });
  }
}
