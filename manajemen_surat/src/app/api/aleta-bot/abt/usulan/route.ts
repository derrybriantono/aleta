import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayAbtUsulan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Usulan isian untuk blangko ABT.
 *
 * ============================================================================
 * MENGUSULKAN, TIDAK MENULIS
 * ============================================================================
 *
 * Rute ini tidak menyentuh satu pun berkas di folder APS Badilag - folder itu
 * hanya dibaca, dan aturan itu tidak berubah - dan tidak menulis ke basis data
 * aps_badilag. Ia menjawab dengan usulan; yang menuliskannya ke ABT adalah
 * ekstensi di peramban petugas, lewat rute simpan milik ABT sendiri
 * (abt/edit_data), dengan sesi petugas itu sendiri.
 *
 * Akibatnya penting dan disengaja: apa pun yang masuk ke ABT tetap tercatat
 * atas nama orang yang menekan tombolnya, lewat jalur yang sama dengan
 * pengisian tangan, dan tetap melewati pemeriksaan ABT sendiri.
 *
 * ============================================================================
 * ISI KETERANGAN SAKSI DIKIRIM DARI HALAMAN, BUKAN DIBACA DARI BASIS DATA
 * ============================================================================
 *
 * Keterangan saksi (variabel 2021 dan 2022) hidup di basis data aps_badilag,
 * yang tidak dibaca ALETA. Yang membacanya adalah ekstensi - dari halaman yang
 * sedang dibuka petugas - lalu mengirimkannya ke sini untuk diurai.
 *
 * Karena itu isinya diperlakukan sebagai MASUKAN, bukan sebagai kebenaran:
 * panjangnya dibatasi, dan tidak satu pun bagiannya dipakai menyusun kueri.
 */
const BATAS_TEKS = 20000;

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const body = await readJsonBody<{
      nomorPerkara?: unknown;
      sumber?: unknown;
      saksi1?: unknown;
      saksi2?: unknown;
      tanggalSidang?: unknown;
    }>(request).catch(() => ({}) as Record<string, unknown>);

    const nomorPerkara = String(body.nomorPerkara || "").trim();
    if (!nomorPerkara) {
      return ok({ available: false, message: "Nomor perkara tidak terbaca dari halaman ABT." });
    }

    const sumberMinta = String(body.sumber || "semua");
    const sumber =
      sumberMinta === "sipp" || sumberMinta === "saksi" ? (sumberMinta as "sipp" | "saksi") : "semua";

    const hasil = await getGatewayAbtUsulan({
      nomorPerkara,
      sumber,
      saksi1: String(body.saksi1 || "").slice(0, BATAS_TEKS),
      saksi2: String(body.saksi2 || "").slice(0, BATAS_TEKS),
      // Tanggal sidang dibaca ekstensi dari halaman ABT itu sendiri
      // (variabel 0033). Dipakai menghitung ulang lama pisah: kalimat saksi
      // benar pada hari ia diperiksa, dan mulai keliru pada sidang berikutnya.
      tanggalSidang: String(body.tanggalSidang || "").slice(0, 40),
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({
      available: true,
      message: "",
      // Diteruskan utuh, bukan disusun ulang medan demi medan. Rute massal
      // pernah menyusun ulang jawabannya begitu, dan medan yang lupa
      // didaftarkan hilang tanpa bunyi - empat kali dalam satu hari.
      sipp: hasil.data?.sipp ?? null,
      saksi: hasil.data?.saksi ?? null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_USULAN_FAILED",
      feature: "abt_usulan",
    });
  }
}
