import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { gatewayPegawaiPenunjukan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar hakim aktif - untuk mengenali nama pada tunjukan konseptor sementara.
 *
 * ============================================================================
 * MENGAPA RUTE TERSENDIRI, BUKAN MENUMPANG /sk-majelis
 * ============================================================================
 *
 * /sk-majelis sudah mengirim daftar yang sama, tetapi ia mengirimnya bersama
 * susunan majelis tetap, seluruh akun portal, dan jabatan tiap akun - tiga
 * pembacaan basis data tambahan yang tidak satu pun dipakai kotak isian
 * konseptor.
 *
 * Layar Antrian Sidang memanggilnya sekali tiap kali tanggalnya diganti, dan
 * tanggal adalah yang paling sering diganti di layar itu. Menumpang rute yang
 * gemuk berarti membayar ketiga pembacaan itu berulang-ulang untuk satu daftar
 * lima nama.
 *
 * ============================================================================
 * GAGALNYA TIDAK MEMATIKAN APA PUN
 * ============================================================================
 *
 * Daftar ini hanya MENOLONG mengetik: kotak isiannya tetap menerima nama apa
 * pun yang diketik, sebab konseptor tidak selalu hakim - panitera pengganti
 * pun menyusun naskah. Karena itu gagalnya bot dijawab daftar kosong beserta
 * alasannya, bukan galat: kotak isiannya harus tetap dapat dipakai ketika SIPP
 * sedang tidak terbaca.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Kapabilitas yang sama dengan layar antrian sidang: yang boleh melihat
    // jadwalnya boleh menunjuk siapa yang menyusun putusannya.
    await pastikanKapabilitas(db, actorUserId, "panel");

    try {
      const pegawai = await gatewayPegawaiPenunjukan();
      const mentah = (pegawai as { hakim?: unknown })?.hakim;
      const hakim = (Array.isArray(mentah) ? mentah : [])
        .map((x) => {
          const baris = x as { id?: unknown; kode?: unknown; nama?: unknown };
          return {
            id: Number(baris.id) || 0,
            kode: String(baris.kode ?? "").trim(),
            nama: String(baris.nama ?? "").trim(),
          };
        })
        // Yang tanpa nama dibuang: barisnya tidak dapat dipilih maupun
        // dicocokkan, dan hanya menambah baris kosong di dalam daftar.
        .filter((x) => x.nama.length > 0);

      return ok({ ada: true, hakim, alasan: "" });
    } catch (galat) {
      return ok({
        ada: false,
        hakim: [],
        alasan: galat instanceof Error ? galat.message : "Daftar hakim tidak terbaca.",
      });
    }
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "HAKIM_AKTIF_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "hakim",
    });
  }
}
