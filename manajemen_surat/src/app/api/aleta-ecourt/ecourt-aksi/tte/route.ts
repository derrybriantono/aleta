import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  BATAS_PERAMBAN_MS,
  bersihkanNomor,
  catatJejakAksi,
  kalimatAlasan,
  panggilBot,
} from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TTE salinan putusan oleh panitera, memakai sesi e-Court PANITERA YANG
 * SEDANG LOGIN (E10).
 *
 * ============================================================================
 * PASSPHRASE TIDAK PERNAH DISIMPAN
 * ============================================================================
 *
 * Passphrase diketik panitera tiap kali, diteruskan ke bot dalam satu
 * permintaan, diketikkan bot ke kolom e-Court, lalu dibuang. Rute ini tidak
 * menyimpannya, tidak mencatatnya ke jejak/audit/log, dan tidak meneruskan
 * pesan galat mentah (yang dapat memantulkan isi badan permintaan). Setiap
 * teks yang keluar dari sini disapu terhadap passphrase itu.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  let passphrase = "";
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const body = (await request.json().catch(() => ({}))) as {
      nomorPerkara?: string;
      passphrase?: unknown;
      konfirmasi?: boolean;
    };
    passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
    body.passphrase = "";
    const nomorPerkara = bersihkanNomor(body.nomorPerkara);
    const sapu = (teks: unknown) => (passphrase ? String(teks ?? "").split(passphrase).join("***") : String(teks ?? ""));

    if (body.konfirmasi !== true) {
      return ok({ ok: false, alasan: "konfirmasi_belum_diberikan", pesan: kalimatAlasan("konfirmasi_belum_diberikan") });
    }
    if (!passphrase) return ok({ ok: false, alasan: "passphrase_kosong", pesan: kalimatAlasan("passphrase_kosong") });

    const hasil = await panggilBot<{ ok: boolean; alasan?: string; pesan?: string; akun?: { nama: string; peran: string } | null }>(
      "/ecourt-aksi/tte",
      {
        method: "POST",
        body: { penggunaId: actor.id, nama: actor.name, nomorPerkara, passphrase, konfirmasi: true },
        batasMs: BATAS_PERAMBAN_MS,
      }
    );
    const data = hasil.ok ? hasil.data : { ok: false, alasan: hasil.alasan, pesan: "", akun: null };
    const alasan = sapu(data.alasan);
    await catatJejakAksi(
      db,
      {
        penggunaId: actor.id,
        penggunaNama: actor.name,
        aksi: "tte",
        peranEcourt: "panitera",
        akunEcourt: data.akun ? `${data.akun.nama} (${data.akun.peran})` : "",
        nomorPerkara,
        sasaran: "salinan putusan",
        hasil: data.ok ? "berhasil" : "gagal",
        alasan,
        alamatIp: alamatIpPeramban(request),
      },
      [passphrase]
    ).catch(() => undefined);
    const jawaban = {
      ok: Boolean(data.ok),
      alasan,
      pesan: sapu(data.pesan) || kalimatAlasan(alasan),
      akun: data.akun ?? null,
    };
    passphrase = "";
    return ok(jawaban);
  } catch (error) {
    passphrase = "";
    // Galat asli sengaja tidak diteruskan: badan permintaan memuat passphrase.
    return handleAdminRouteError(error instanceof ApiError ? error : new Error("Permintaan TTE salinan putusan gagal diproses."), request, {
      db,
      actorUserId,
      action: "ECOURT_AKSI_TTE_FAILED",
      feature: "ecourt_aksi",
      entityId: "tte",
    });
  }
}
