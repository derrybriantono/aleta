import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaPotonganLog, daftarLogPenarikan } from "@/server/modules/aleta-ecourt/log-penarikan";
import {
  detakGatewayPantauSesi,
  getGatewayEcourtJadwal,
  getGatewayPantauSesi,
  jalankanGatewayAuditArsip,
  saveGatewayPantauSesi,
  hentikanGatewayPenarikan,
  mulaiGatewayPenarikanMenyeluruh,
  mulaiGatewayPenarikanPerkara,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penarikan berkas e-Court dari portal, beserta pemantauannya.
 *
 * ============================================================================
 * MENGGANTIKAN PuTTY, BUKAN MENGGANTIKAN SKRIPNYA
 * ============================================================================
 *
 * Skrip aleta-ecourt-unduh-latar.sh tetap ada dan tetap dapat dipakai. Yang
 * ditambahkan di sini adalah pintu masuk dari portal untuk pekerjaan yang sama,
 * memakai jembatan yang sama, menulis ke folder log yang sama.
 *
 * Karena folder lognya sama, layar pemantauan menampilkan penarikan dari kedua
 * jalur. Petugas yang sudah memulai penarikan dari SSH akan melihatnya di
 * portal - dan tidak memulai penarikan kedua di atasnya.
 *
 * ============================================================================
 * SIAPA YANG BOLEH APA
 * ============================================================================
 *
 * Menarik SELURUH arsip dan menghentikan penarikan adalah tindakan pengelolaan:
 * berjam-jam beban ke server Mahkamah Agung, dan menghentikan pekerjaan yang
 * mungkin sedang ditunggu orang lain. Keduanya hanya untuk Super Admin dan
 * Admin.
 *
 * Menarik SATU perkara adalah pekerjaan sehari-hari petugas perkara, dan
 * memakai kemampuan permintaan yang sudah ada.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);

    const namaLog = String(request.nextUrl.searchParams.get("log") || "").trim();

    // Membaca lanjutan satu log: yang berpindah hanya baris baru.
    if (namaLog) {
      const mulai = Number(request.nextUrl.searchParams.get("mulai"));
      const potongan = await bacaPotonganLog(namaLog, Number.isFinite(mulai) ? mulai : -1);

      if (!potongan) {
        return ok({ available: true, potongan: null, alasan: "log_tidak_ditemukan" });
      }
      return ok({ available: true, potongan });
    }

    const daftar = await daftarLogPenarikan(20);
    // Keduanya diminta bersamaan: satu layar, satu kali menunggu.
    const [jadwal, pantau] = await Promise.all([getGatewayEcourtJadwal(), getGatewayPantauSesi()]);

    return ok({
      available: true,
      bolehMenarikSemua: isPrivilegedAdmin(actor),
      log: daftar,
      // Keadaan bot boleh gagal dibaca tanpa menghilangkan daftar log: log
      // dibaca dari disk sendiri, dan tetap berguna walau bot sedang tidak
      // dapat dihubungi.
      keadaan: jadwal.ok ? (jadwal.data?.jadwal ?? null) : null,
      pesanKeadaan: jadwal.ok ? "" : jadwal.error || "ALETA Bot belum dapat dihubungi.",
      pantau: pantau.ok ? (pantau.data?.pantau ?? null) : null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PENARIKAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

/** Memulai atau menghentikan penarikan. */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    const body = await readJsonBody<{
      tindakan?: string;
      nomorPerkara?: string;
      aktif?: boolean;
      jedaMenit?: number;
      jedaPeringatanJam?: number;
      batas?: number;
      perbaiki?: boolean;
    }>(request).catch(
      () => ({}) as Record<string, never>
    );
    const tindakan = String(body.tindakan || "").trim();

    if (tindakan === "perkara") {
      // Satu perkara: kemampuan permintaan, sama seperti titipan lewat ekstensi.
      const actor = await pastikanKapabilitas(db, actorUserId, "permintaan");
      const nomor = String(body.nomorPerkara || "").trim();
      if (!nomor) {
        return ok({ available: true, ok: false, alasan: "nomor_perkara_kosong" });
      }

      const hasil = await mulaiGatewayPenarikanPerkara(nomor, actor.name);
      if (!hasil.ok) {
        return ok({
          available: false,
          ok: false,
          message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        });
      }
      return ok({ available: true, ...(hasil.data ?? { ok: false }) });
    }

    // Sisanya menuntut Super Admin atau Admin.
    const actor = await requireActorUser(db, actorUserId);
    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(
        403,
        "Hanya Super Admin dan Admin yang dapat menarik seluruh arsip atau menghentikan penarikan."
      );
    }

    if (tindakan === "hentikan") {
      const hasil = await hentikanGatewayPenarikan(actor.name);
      if (!hasil.ok) {
        return ok({
          available: false,
          ok: false,
          message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        });
      }
      return ok({ available: true, ...(hasil.data ?? { ok: false }) });
    }

    if (tindakan === "pantau-simpan") {
      const hasil = await saveGatewayPantauSesi({
        aktif: Boolean(body.aktif),
        jedaMenit: Number(body.jedaMenit) || 10,
        jedaPeringatanJam: Number(body.jedaPeringatanJam) || 4,
        olehSiapa: actor.name,
      });
      if (!hasil.ok) {
        return ok({ available: false, ok: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(hasil.data ?? { ok: false }) });
    }

    if (tindakan === "pantau-detak") {
      const hasil = await detakGatewayPantauSesi();
      if (!hasil.ok) {
        return ok({ available: false, ok: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(hasil.data ?? { ok: false }) });
    }

    if (tindakan === "audit-arsip") {
      const hasil = await jalankanGatewayAuditArsip({
        batas: Number(body.batas) || undefined,
        // Membuang berkas rusak HARUS diminta terpisah. Pemeriksaan yang
        // sekaligus menghapus membuat tombol Periksa menjadi tombol yang
        // menghapus - dan tidak ada yang menduga itu.
        perbaiki: body.perbaiki === true,
        olehSiapa: actor.name,
      });
      if (!hasil.ok) {
        return ok({ available: false, ok: false, message: hasil.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(hasil.data ?? { ok: false }) });
    }

    if (tindakan === "menyeluruh") {
      const hasil = await mulaiGatewayPenarikanMenyeluruh(actor.name);
      if (!hasil.ok) {
        return ok({
          available: false,
          ok: false,
          message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        });
      }
      return ok({ available: true, ...(hasil.data ?? { ok: false }) });
    }

    return ok({ available: true, ok: false, alasan: "tindakan_tidak_dikenali" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_PENARIKAN_MULAI_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
