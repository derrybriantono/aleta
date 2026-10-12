import { type NextRequest } from "next/server";

import {
  pengaturanDenganAktif,
  ringkasTarikEcourt,
  type JadwalTarikEcourt,
} from "@/lib/tarik-ecourt-status";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { getGatewayEcourtJadwal, saveGatewayEcourtJadwal } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saklar "Tarik data e-Court" untuk widget (popup) ekstensi.
 *
 *   GET  -> { tersedia, pesan, ringkas }        keadaan berwarna penjadwal
 *   POST { aktif:boolean } -> { berhasil, pesan, ringkas }
 *
 * Super Admin dan Admin saja - dijaga DI SINI (aksi "ecourt.tarik-data" pada
 * matriks peran), bukan hanya dengan menyembunyikan barisnya di popup: ekstensi
 * berjalan di peramban pengguna. Yang diubah hanya `aktif`; jarak, jam kerja,
 * dan jatah perkara tetap milik Integrasi e-Court. Penyimpanannya di runtime
 * config ALETA Bot (bukan peramban) dan berlaku pada putaran berikutnya tanpa
 * menyalakan ulang bot.
 *
 * Ini hanya penarikan (membaca) dari e-Court yang sudah ada - tidak ada
 * pengiriman ke e-Court. Tiap perubahan dicatat di jejak ALETA: siapa, kapan,
 * dari apa ke apa.
 */
async function bacaRingkas() {
  const hasil = await getGatewayEcourtJadwal();
  const jadwal = hasil.ok ? ((hasil.data?.jadwal ?? null) as JadwalTarikEcourt | null) : null;
  return { jadwal, ringkas: ringkasTarikEcourt(jadwal), galat: hasil.ok ? "" : String(hasil.error || "") };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAksi(db, actorUserId, "ecourt.tarik-data");

    const { ringkas, galat } = await bacaRingkas();
    return ok({
      tersedia: ringkas.keadaan !== "tidak-terjangkau",
      pesan: ringkas.keadaan === "tidak-terjangkau" ? galat || ringkas.keterangan : "",
      ringkas,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_TARIK_DATA_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "tarik-ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanAksi(db, actorUserId, "ecourt.tarik-data");

    const badan = (await request.json().catch(() => null)) as { aktif?: unknown } | null;
    if (!badan || typeof badan.aktif !== "boolean") {
      throw new ApiError(400, "Badan permintaan harus JSON {aktif: true|false}.");
    }
    const aktifBaru = badan.aktif;

    const sebelum = await bacaRingkas();
    if (sebelum.ringkas.keadaan === "tidak-terjangkau" || !sebelum.jadwal) {
      return ok({
        berhasil: false,
        pesan: "ALETA Bot tidak menjawab - saklar tidak diubah.",
        ringkas: sebelum.ringkas,
      });
    }

    // Sudah sesuai: tidak ada yang ditulis dan tidak ada jejak palsu.
    if (sebelum.jadwal.pengaturan.aktif === aktifBaru) {
      return ok({ berhasil: true, pesan: "Sudah demikian; tidak ada yang diubah.", ringkas: sebelum.ringkas });
    }

    const pengaturan = pengaturanDenganAktif(sebelum.jadwal, aktifBaru);
    if (!pengaturan) {
      return ok({ berhasil: false, pesan: "Pengaturan penjadwal tidak terbaca - saklar tidak diubah.", ringkas: sebelum.ringkas });
    }

    const simpan = await saveGatewayEcourtJadwal({ ...pengaturan, olehSiapa: actor.name });
    if (!simpan.ok || simpan.data?.ok === false) {
      const alasan = String(simpan.ok ? simpan.data?.alasan || "ditolak_bot" : simpan.error || "bot_tidak_terjangkau");
      return ok({ berhasil: false, pesan: `Saklar tidak tersimpan (${alasan}).`, ringkas: sebelum.ringkas });
    }

    // Jejak ALETA. Gagal mencatat tidak membatalkan saklar yang sudah
    // tersimpan (bot juga mencatat peristiwa keamanannya sendiri), tetapi
    // dikeluhkan di log server.
    try {
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId: actor.id,
        action: aktifBaru ? "AKTIFKAN_ECOURT_TARIK_DATA" : "MATIKAN_ECOURT_TARIK_DATA",
        entityType: "ecourt_penjadwal",
        entityId: "tarik-data",
        payload: { aktif: aktifBaru, sebelumnya: !aktifBaru, oleh: actor.name, lewat: "widget-ekstensi" },
      });
    } catch (galatJejak) {
      console.warn("[ALETA AUDIT] Gagal mencatat perubahan saklar tarik data e-Court:", galatJejak);
    }

    // Keadaan yang DIBACA ULANG dari bot - bukan yang kita kira sudah tersimpan.
    const sesudah = await bacaRingkas();
    return ok({
      berhasil: true,
      pesan: aktifBaru ? "Penarikan e-Court diaktifkan." : "Penarikan e-Court dimatikan.",
      ringkas: sesudah.ringkas,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_TARIK_DATA_WRITE_FAILED",
      feature: "aleta_ecourt",
      entityId: "tarik-ecourt",
    });
  }
}
