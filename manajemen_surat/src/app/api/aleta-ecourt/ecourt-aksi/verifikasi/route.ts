import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { BATAS_PERAMBAN_MS, catatJejakAksi, kalimatAlasan, panggilBot } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HasilVerifikasi = {
  ok: boolean;
  alasan?: string;
  kering?: boolean;
  keputusan?: string;
  judulDokumen?: string;
  nomorPerkara?: string;
  statusSesudah?: string;
  akun?: { nama: string; peran: string } | null;
};

/**
 * Verifikasi dokumen e-litigasi oleh majelis LANGSUNG ke e-Court, memakai
 * sesi e-Court hakim yang sedang login (E9). Menulis ke e-Court - hanya atas
 * klik + konfirmasi (konfirmasi:true), dan bot menolak tanpa itu.
 *
 * kering:true membuka dialog verifikasi di e-Court dan membaca isinya tanpa
 * menekan Simpan - untuk memastikan dokumennya cocok lebih dulu.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const body = (await request.json().catch(() => ({}))) as {
      documentKey?: string;
      keputusan?: string;
      keterangan?: string;
      konfirmasi?: boolean;
      kering?: boolean;
    };
    const keputusan = body.keputusan === "valid" || body.keputusan === "tidak_valid" ? body.keputusan : "";
    if (!keputusan) return ok({ ok: false, alasan: "keputusan_tidak_dikenali", pesan: "Pilih Valid atau Tidak Valid." });

    const hasil = await panggilBot<HasilVerifikasi>("/ecourt-aksi/verifikasi", {
      method: "POST",
      body: {
        penggunaId: actor.id,
        nama: actor.name,
        documentKey: String(body.documentKey || "").slice(0, 191),
        keputusan,
        keterangan: String(body.keterangan || "").slice(0, 500),
        konfirmasi: body.konfirmasi === true,
        kering: body.kering === true,
      },
      batasMs: BATAS_PERAMBAN_MS,
    });
    const data: HasilVerifikasi = hasil.ok ? hasil.data : { ok: false, alasan: hasil.alasan };
    const kering = body.kering === true;
    await catatJejakAksi(db, {
      penggunaId: actor.id,
      penggunaNama: actor.name,
      aksi: kering ? "verifikasi_kering" : "verifikasi",
      peranEcourt: "hakim",
      akunEcourt: data.akun ? `${data.akun.nama} (${data.akun.peran})` : "",
      nomorPerkara: String(data.nomorPerkara || ""),
      sasaran: `${String(body.documentKey || "").slice(0, 120)} ${keputusan}`,
      hasil: data.ok ? "berhasil" : /bukan_|konfirmasi/.test(String(data.alasan)) ? "ditolak" : "gagal",
      alasan: String(data.alasan || ""),
      alamatIp: alamatIpPeramban(request),
    }).catch(() => undefined);
    return ok({ ...data, pesan: kalimatAlasan(data.alasan) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_AKSI_VERIFIKASI_FAILED",
      feature: "ecourt_aksi",
      entityId: "verifikasi",
    });
  }
}
