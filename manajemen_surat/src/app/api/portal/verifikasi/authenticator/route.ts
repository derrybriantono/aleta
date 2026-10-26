import { type NextRequest } from "next/server";
import QRCode from "qrcode";

import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { hapusAuthenticatorSendiri, konfirmasiAuthenticator, mulaiPendaftaranAuthenticator } from "@/server/modules/verifikasi/layanan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticator MILIK SENDIRI (halaman Akun). Boleh didaftarkan kapan pun,
 * walau saklar verifikasi masih mati: kodenya baru ditagih setelah Super Admin
 * menyalakan. Rahasia dan QR hanya dikirim sekali, saat mulai.
 *   aksi "mulai"      -> {rahasia, uri, qr}; QR boleh dipindai di beberapa HP
 *   aksi "konfirmasi" -> {kode}
 *   aksi "hapus"      -> {kode} (kode authenticator/cadangan yang berlaku)
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const aksi = String(badan.aksi ?? "");

    if (aksi === "mulai") {
      const hasil = await mulaiPendaftaranAuthenticator(db, { id: actor.id, username: actor.username, name: actor.name });
      const qr = await QRCode.toDataURL(hasil.uri, { margin: 1, width: 220, errorCorrectionLevel: "M" });
      return ok({ ...hasil, qr });
    }
    if (aksi === "konfirmasi") {
      await konfirmasiAuthenticator(db, actor.id, String(badan.kode ?? ""));
      return ok({ aktif: true });
    }
    if (aksi === "hapus") {
      await hapusAuthenticatorSendiri(db, actor.id, String(badan.kode ?? ""));
      return ok({ dihapus: true });
    }
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleRouteError(error);
  }
}
