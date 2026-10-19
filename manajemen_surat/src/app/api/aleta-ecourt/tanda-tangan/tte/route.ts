import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayTandaTangan, getGatewayTteStatus, kirimTandaTanganTte } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { appendAuditLog } from "@/server/shared/audit";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { requireActorUser } from "@/server/modules/organization/service";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bolehAksi } from "@/lib/matriks-peran";
import { petaTteSaya, bentukBarisTte, type BarisTteMentah } from "@/lib/tte-bsre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * TTE (BSrE) PER PEJABAT - cara tanda tangan dan identitas sertifikat
 * ============================================================================
 *
 * 19 Okt 2026: tombol "Passphrase TTE" di panel ekstensi dipindah ke
 * pengaturan Tanda tangan pejabat. Yang disimpan di sini HANYA cara
 * menandatangani (gambar disahkan / TTE BSrE) dan identitas sertifikat
 * (NIK / ID pengguna BSrE).
 *
 * PASSPHRASE TIDAK PERNAH DISIMPAN. Menyimpannya membuat dokumen dapat
 * ditandatangani atas nama pejabat tanpa kehadirannya. Rute ini menolak
 * badan yang memuat `passphrase` (bukan mengabaikannya) dan tidak pernah
 * menuliskan isi badan ke log.
 *
 * Hak: GET - Admin/Super Admin melihat semua; pejabat lain hanya baris yang
 * ditautkan ke akunnya sendiri (NIK disamarkan untuk yang bukan pemilik/admin
 * tidak pernah dikirim). POST - hanya yang memegang aksi "ttd.kelola".
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await requireActorUser(db, actorUserId);
    const admin = bolehAksi(aktor, "ttd.kelola");

    const [status, daftar] = await Promise.all([getGatewayTteStatus(), getGatewayTandaTangan(false)]);
    const dataStatus = (status as { ok?: boolean; data?: { tersambung?: boolean } }).data;
    // Status tidak terbaca = "tidak diketahui", bukan "belum tersambung": bot
    // lama belum punya rutenya, dan itu bukan keadaan BSrE.
    const statusBsre: "tersambung" | "belum" | "tidak-terbaca" =
      status?.ok === false || typeof dataStatus?.tersambung !== "boolean" ? "tidak-terbaca" : dataStatus.tersambung ? "tersambung" : "belum";

    const r = daftar as { ok?: boolean; error?: string; data?: { baris?: BarisTteMentah[] }; baris?: BarisTteMentah[] };
    if (r?.ok === false) {
      return Response.json({ ok: false, error: String(r.error ?? "Daftar tanda tangan tidak terbaca.") }, { status: 502 });
    }
    const semua = r?.data?.baris ?? r?.baris ?? [];
    const baris = petaTteSaya(semua, { admin, penggunaId: String(aktor.id) }).map((b) => bentukBarisTte(b, { admin, penggunaId: String(aktor.id) }));

    return ok({ admin, statusBsre, baris });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "TTE_PEJABAT_BACA_FAILED", feature: "aleta_ecourt" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanAksi(db, actorUserId, "ttd.kelola");

    const badan = (await request.json()) as Record<string, unknown>;
    // Passphrase DITOLAK tegas, sebelum apa pun dibaca dari badan.
    if ("passphrase" in badan || "kataSandi" in badan || "sandi" in badan) {
      return Response.json({ ok: false, alasan: "passphrase_tidak_disimpan", error: "Passphrase tidak disimpan di server." }, { status: 400 });
    }
    const id = Number(badan.id);
    if (!Number.isFinite(id) || id <= 0) return Response.json({ ok: false, alasan: "id_tidak_sah" }, { status: 400 });
    const caraTtd = String(badan.caraTtd ?? "gambar");
    const nikBsre = String(badan.nikBsre ?? "").trim().slice(0, 32);

    const respons = await kirimTandaTanganTte(id, { caraTtd, nikBsre });
    if (respons?.ok !== false) {
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId,
        action: "TTD_TTE_ATUR",
        entityType: "tanda_tangan",
        entityId: String(id),
        // NIK tidak dicatat utuh; passphrase tidak pernah ada.
        payload: { oleh: String(aktor.name ?? ""), caraTtd, nikTerisi: Boolean(nikBsre) },
      });
    }
    const status = respons?.ok === false ? (Number((respons as { status?: number }).status ?? 0) >= 400 && Number((respons as { status?: number }).status ?? 0) < 500 ? 400 : 502) : 200;
    // Berhasil lewat ok() (bungkus {ok, data}); penolakan membawa kodenya di error supaya layar
    // membacanya tanpa menyentuh ruas isi (penjaga jawaban-portal-dibuka).
    if (respons?.ok === false) {
      const r = respons as { alasan?: string; error?: string };
      return Response.json({ ok: false, error: String(r.alasan || r.error || "Pengaturan TTE tidak tersimpan.") }, { status });
    }
    return ok(respons);
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "TTE_PEJABAT_UBAH_FAILED", feature: "aleta_ecourt" });
  }
}
