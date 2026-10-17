import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { auditSinkron, pastikanAdminSinkron } from "@/server/modules/sinkron/akses";
import { modeKembaran, panggilBotKembaran, susunPanggilanAksi, type AksiKembaran } from "@/server/modules/sinkron/kembaran";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

/**
 * Tindakan layar "Sinkron kembaran" - SEMUANYA hanya Super Admin dan hanya
 * di portal yang berjalan di mode kembaran (laptop).
 *
 *   uji       sambungan ke MySQL server dan ssh (tanpa menulis apa pun)
 *   periksa   { ids? }               bandingkan dengan nilai TERKINI di server
 *   setujui   { ids? | kelompok? }   hanya baris yang aman; kelompok = semua atau tidak sama sekali
 *   tolak     { ids? | kelompok?, alasan? }  singkirkan - tidak akan dikirim
 *   kirim     {}                     kirim semua yang disetujui, diperiksa ULANG saat itu juga
 *
 * Tidak ada aksi "paksa". Pemeriksaan, persetujuan, dan pengiriman dijalankan
 * bot lewat jalur tulis yang sama dengan biasa; portal hanya meneruskan dan
 * mencatat siapa yang memutuskan di jejak audit.
 */

const AKSI: AksiKembaran[] = ["uji", "periksa", "setujui", "tolak", "kirim"];

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const { actor } = await pastikanAdminSinkron(db, actorUserId, true);
    if (!modeKembaran()) {
      throw new ApiError(409, "Portal ini tidak berjalan di mode kembaran (laptop). Sinkron kembaran hanya ada di laptop.");
    }
    const isi = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const aksi = String(isi.aksi || "") as AksiKembaran;
    if (!AKSI.includes(aksi)) throw new ApiError(400, "Tindakan tidak dikenal.");
    const oleh = actor.name || actor.id;

    const panggilan = susunPanggilanAksi(aksi, isi, oleh);
    const jumlahDipilih = Array.isArray(isi.ids) ? isi.ids.length : 0;
    // Dicatat SEBELUM dijalankan: keputusan Super Admin tidak hilang walau bot tiba-tiba mati.
    if (aksi !== "uji") {
      await auditSinkron(db, `SINKRON_KEMBARAN_${aksi.toUpperCase()}`, actor.id, {
        entityId: typeof isi.kelompok === "string" && isi.kelompok ? isi.kelompok : aksi,
        kelompok: typeof isi.kelompok === "string" ? isi.kelompok : null,
        jumlahDipilih,
        alasan: aksi === "tolak" && typeof isi.alasan === "string" ? isi.alasan.slice(0, 300) : undefined,
      });
    }
    const hasil = await panggilBotKembaran<Record<string, unknown>>(panggilan.jalur, {
      method: panggilan.method,
      body: panggilan.body,
      timeoutMs: panggilan.timeoutMs,
    });
    if (!hasil.ok) throw new ApiError(hasil.status && hasil.status >= 400 && hasil.status < 500 ? hasil.status : 502, hasil.error);
    if (aksi === "kirim") {
      await auditSinkron(db, "SINKRON_KEMBARAN_KIRIM_SELESAI", actor.id, {
        entityId: "kirim",
        terkirim: hasil.data.terkirim,
        kelompok: hasil.data.kelompok,
        dibatalkan: hasil.data.dibatalkan,
      });
    }
    return ok(hasil.data);
  } catch (error) {
    return handleRouteError(error);
  }
}
