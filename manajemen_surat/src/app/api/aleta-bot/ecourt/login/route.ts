import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  getGatewayEcourtSesi,
  keluarGatewayEcourt,
  kirimGatewayEcourtLogin,
  mulaiGatewayEcourtLogin,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { tampilanStatus } from "@/lib/ecourt-status-akun";

export const runtime = "nodejs";

/** Penanda pelaku untuk jejak keamanan bot - tanpa isi badan permintaan. */
function actorLabel(actor: unknown): string {
  const a = (actor ?? {}) as { email?: string; id?: string; name?: string };
  return String(a.email || a.id || a.name || "");
}
export const dynamic = "force-dynamic";

/** Keadaan sesi e-Court. */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const penuh = request.nextUrl.searchParams.get("periksa") === "penuh";
    const slot = String(request.nextUrl.searchParams.get("slot") || "").trim();
    const hasil = await getGatewayEcourtSesi(penuh, slot);

    if (!hasil.ok) {
      return ok({ available: false, message: hasil.error || "ALETA Bot belum dapat dihubungi.", sesi: null });
    }
    return ok({
      available: true,
      message: "",
      sesi: hasil.data?.sesi ?? null,
      // Bentuk baru: keadaan bernilai tiga - berlaku, kedaluwarsa, atau belum
      // dipastikan - beserta nama pengguna dan kapan terakhir diperiksa.
      keadaan: (hasil.data as { keadaan?: unknown })?.keadaan ?? null,
      menunggu: hasil.data?.menunggu === true,
      // Status akun satu sumber (30 Okt 2026) - judul/kalimat/warna yang sama
      // dengan semua penanda lain.
      status: tampilanStatus(hasil.data?.statusAkun ?? null),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SESSION_READ_FAILED",
      feature: "ecourt",
      entityId: "sesi",
    });
  }
}

/**
 * Membuka, mengirim, atau menutup login e-Court.
 *
 * ============================================================================
 * BADAN PERMINTAAN INI DAPAT MEMUAT SANDI
 * ============================================================================
 *
 * Aksi "kirim" membawa sandi e-Court petugas. Tidak ada satu pun bagian
 * badan permintaan yang boleh dicatat: bukan ke log, bukan ke jejak audit,
 * bukan ke pesan galat. Yang dicatat hanya AKSI dan hasilnya.
 *
 * Sandi diteruskan langsung ke bot dan tidak pernah disimpan di portal.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Masuk/keluar akun e-Court PENGADILAN: Super Admin dan Admin saja (U5, 9 Okt
    // 2026). Sesi e-Court pribadi tiap pegawai memakai rute ecourt-sesi.
    const actor = await pastikanAdminIstimewa(db, actorUserId, "masuk atau keluar akun e-Court pengadilan");

    const body = (await request.json()) as {
      aksi?: string;
      slot?: string;
      email?: string;
      sandi?: string;
      captcha?: string;
      simpan?: boolean;
      isiOtomatis?: boolean;
    };
    // Slot akun penarik yang dimasuki (30 Okt 2026). Kosong = akun bawaan.
    const slot = String(body.slot || "").trim().toLowerCase();
    if (slot && !/^[a-z0-9-]{1,32}$/.test(slot)) return ok({ ok: false, alasan: "slot_tidak_sah" });

    if (body.aksi === "mulai") {
      const hasil = await mulaiGatewayEcourtLogin(slot, body.isiOtomatis !== false);
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
      return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
    }

    if (body.aksi === "kirim") {
      const hasil = await kirimGatewayEcourtLogin({
        email: String(body.email || ""),
        sandi: String(body.sandi || ""),
        captcha: String(body.captcha || ""),
        // Disimpan tersandi di bot HANYA bila e-Court menerima login ini.
        simpan: body.simpan === true,
        olehSiapa: `portal:${actorLabel(actor)}`,
      });
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
      return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
    }

    if (body.aksi === "keluar") {
      const hasil = await keluarGatewayEcourt(slot);
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.error || "bot_tidak_terjangkau" });
      return ok(hasil.data ?? { ok: false, alasan: "tanpa_jawaban" });
    }

    return ok({ ok: false, alasan: "aksi_tidak_dikenali" });
  } catch (error) {
    // Galat sengaja tidak diteruskan apa adanya: pesannya dapat memuat
    // potongan badan permintaan, dan badan permintaan ini memuat sandi.
    // Kecuali penolakan kewenangan (401/403): pesannya buatan portal sendiri,
    // tanpa isi badan, dan harus sampai ke layar sebagai 403 - bukan 500.
    const tolak = error instanceof ApiError && (error.status === 401 || error.status === 403);
    return handleAdminRouteError(tolak ? error : new Error("Permintaan login e-Court gagal diproses."), request, {
      db,
      actorUserId,
      action: "ECOURT_LOGIN_FAILED",
      feature: "ecourt",
      entityId: "login",
    });
  }
}
