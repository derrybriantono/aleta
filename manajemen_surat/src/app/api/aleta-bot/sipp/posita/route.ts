import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewaySippPositaRapikan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Merapikan posita satu perkara di SIPP.
 *
 * ============================================================================
 * INI JALUR TULIS - DAN ITU DISEBUT DI SINI, BUKAN DISAMARKAN
 * ============================================================================
 *
 * Hampir seluruh jalur ALETA ke SIPP hanya membaca. Yang ini menulis, dan ke
 * kolom yang berisi dalil gugatan penggugat. Karena itu ia melewati
 * pemeriksaan sesi dan kewenangan yang sama dengan jalur tulis lain, dan
 * kegagalannya dicatat sebagai kejadian tersendiri.
 *
 * Pagar isinya ada di sisi bot - sippPositaService - dan pagar itu mutlak:
 * teks tanpa ruang kosong harus persis sama sebelum dan sesudah. Perapian
 * hanya menyisipkan pemisah antar butir; ia tidak dapat menambah, mengurangi,
 * maupun mengubah satu huruf pun. Rute ini TIDAK mengendurkannya, dan tidak
 * pula mengulangnya - satu aturan di satu tempat.
 *
 * ============================================================================
 * YANG TIDAK DISIMPAN DI SINI
 * ============================================================================
 *
 * Isi positanya memuat nama, alamat, dan riwayat rumah tangga para pihak.
 * Rute ini tidak menyimpannya - tidak ke basis data portal, tidak ke disk.
 * Ia meneruskan, menerima keterangan berhasil beserta teks lamanya, lalu
 * melupakannya. Yang menyimpan teks lama hanya peramban petugas, sebagai
 * riwayat perubahan yang memang dimintanya.
 */
const BATAS_HURUF = 200_000;

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const body = await readJsonBody<{ perkaraId?: unknown; posita?: unknown }>(request).catch(
      () => ({}) as { perkaraId?: unknown; posita?: unknown }
    );
    const perkaraId = String(body.perkaraId || "").trim();
    const posita = String(body.posita || "");

    if (!perkaraId) {
      return ok({ available: false, message: "Nomor perkara tidak terkirim." });
    }
    if (!posita.trim()) {
      return ok({ available: false, message: "Posita yang dirapikan kosong." });
    }
    if (posita.length > BATAS_HURUF) {
      return ok({ available: false, message: "Posita terlalu panjang untuk dirapikan." });
    }

    const hasil = await getGatewaySippPositaRapikan(perkaraId, posita);
    if (!hasil.ok) {
      return ok({
        // Sebabnya diteruskan apa adanya. Yang paling penting di antaranya -
        // penolakan karena isinya berbeda, bukan sekadar penataannya - hanya
        // berguna bila disebutkan lengkap.
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({
      available: true,
      message: "",
      tersentuh: hasil.data?.tersentuh ?? 0,
      sebelum: hasil.data?.sebelum ?? "",
      alasan: hasil.data?.alasan ?? "",
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_POSITA_RAPIKAN_FAILED",
      feature: "abt_posita",
    });
  }
}
