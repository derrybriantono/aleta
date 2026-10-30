import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { APP_VERSION } from "@/lib/patch-notes";
import {
  getGatewayStatusAkunEcourt,
  getGatewayWhatsappStatus,
  getWhatsappRuntimeMode,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { keadaanSambunganLama, statusBotMati, tampilanStatus, type TampilanStatusEcourt } from "@/lib/ecourt-status-akun";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Keadaan = { keadaan: string; sebab: string };
type KeadaanEcourt = Keadaan & { status: TampilanStatusEcourt };

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
      // Status akun satu sumber (30 Okt 2026) - bukan lagi "folder sesi ada
      // = hidup". Tidak menyalakan peramban; bot hanya memeriksa ulang akun
      // yang buktinya basi, di latar, jalan ringan lebih dulu.
      getGatewayStatusAkunEcourt(true),
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

    // `keadaan` lama (hidup/habis/belum-ada/terputus/tidak-diketahui) tetap
    // dikirim untuk ekstensi yang belum diperbarui; ekstensi baru membaca
    // `status` (judul, kalimat, warna) yang sama dengan semua penanda.
    // Dulu sesi yang BELUM DIPASTIKAN ditulis "hidup" (hijau palsu).
    const status = tampilanStatus(ecourt.ok && ecourt.data ? ecourt.data.ringkas : statusBotMati());
    const ecourtKeadaan: KeadaanEcourt = {
      // Bot tidak menjawab: kata lama tetap "tidak-diketahui" seperti dulu.
      keadaan: ecourt.ok ? keadaanSambunganLama(status.keadaan) : "tidak-diketahui",
      sebab: status.keadaan === "aktif" ? "" : status.teks,
      status,
    };

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
