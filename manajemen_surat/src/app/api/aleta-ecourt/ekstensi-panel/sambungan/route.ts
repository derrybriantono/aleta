import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { APP_VERSION } from "@/lib/patch-notes";
import {
  getGatewayEcourtSesi,
  getGatewayWhatsappStatus,
  getWhatsappRuntimeMode,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Keadaan = { keadaan: string; sebab: string };

/**
 * Lampu sambungan untuk panel ekstensi di portal (Tahap 4 rencana "ekstensi
 * dulu", ide portal-7 dan portal-14).
 *
 * ============================================================================
 * HANYA KATA KEADAAN - BUKAN KETERANGAN PENGELOLAAN
 * ============================================================================
 *
 * Rute status WhatsApp dan akun e-Court yang sudah ada khusus Super Admin dan
 * Admin, dan memang harus begitu: keduanya menyebut nomor telepon, kode QR,
 * dan slot akun. Petugas biasa hanya perlu tahu SATU hal sebelum menelepon
 * admin - bagian mana yang sedang terputus. Karena itu yang dikirim di sini
 * hanya kata keadaannya (tersambung/terputus, hidup/habis) beserta kalimat
 * sebab yang pendek. Tidak ada nomor, tidak ada QR, tidak ada nama slot.
 *
 * ============================================================================
 * MURAH, DAN TIDAK PERNAH MENYALAKAN PERAMBAN
 * ============================================================================
 *
 * Sesi e-Court dibaca dalam mode "cepat" - hanya berkas sesi di disk bot.
 * Mode "penuh" meluncurkan Chrome dan membuka e-Court sungguhan; itu tidak
 * pantas dipicu oleh panel yang dibuka puluhan petugas tiap pagi.
 *
 * Bot yang mati tidak menjatuhkan rute ini: jawabannya tetap 200 dengan
 * keadaan "tidak-diketahui" dan sebabnya, supaya panel dapat menyebut bahwa
 * yang putus adalah ALETA Bot - bukan menampilkan galat.
 *
 * Tanpa sesi: 401 (requireActorUser). Hanya membaca.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const mulai = Date.now();
    const modeWa = getWhatsappRuntimeMode();
    const [wa, ecourt] = await Promise.all([
      modeWa === "aleta_bot" ? getGatewayWhatsappStatus() : Promise.resolve(null),
      getGatewayEcourtSesi(false),
    ]);
    const lamaMs = Date.now() - mulai;

    // Bot dianggap hidup bila SALAH SATU permintaannya dijawab. Jawaban
    // penolakan pun (status ada) berarti prosesnya hidup.
    const dijawab = (x: { ok: boolean; status?: number } | null) => Boolean(x && (x.ok || x.status));
    const botHidup = dijawab(wa) || dijawab(ecourt);

    let whatsapp: Keadaan;
    if (modeWa !== "aleta_bot") {
      whatsapp = { keadaan: "nonaktif", sebab: "Kiriman WhatsApp tidak dijalankan lewat ALETA Bot di server ini." };
    } else if (wa && wa.ok) {
      const tersambung = String(wa.data?.status || "") === "connected";
      whatsapp = {
        keadaan: tersambung ? "tersambung" : "terputus",
        sebab: tersambung ? "" : "Sesi WhatsApp ALETA Bot tidak tersambung - hubungi admin.",
      };
    } else {
      whatsapp = { keadaan: "tidak-diketahui", sebab: "ALETA Bot tidak menjawab." };
    }

    let ecourtKeadaan: Keadaan;
    if (ecourt.ok) {
      const sesi = ecourt.data?.sesi;
      if (!sesi || !sesi.tersimpan) {
        ecourtKeadaan = { keadaan: "belum-ada", sebab: "Belum ada sesi e-Court yang tersimpan di server." };
      } else if (sesi.berlaku === false) {
        ecourtKeadaan = { keadaan: "habis", sebab: "Sesi e-Court sudah habis - perlu login ulang oleh admin." };
      } else {
        ecourtKeadaan = { keadaan: "hidup", sebab: "" };
      }
    } else {
      ecourtKeadaan = { keadaan: "tidak-diketahui", sebab: "ALETA Bot tidak menjawab." };
    }

    return ok({
      versiPortal: APP_VERSION,
      dibaca: new Date().toISOString(),
      bot: { hidup: botHidup, ms: lamaMs },
      whatsapp,
      ecourt: ecourtKeadaan,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
