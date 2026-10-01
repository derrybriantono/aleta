import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  BATAS_PERAMBAN_MS,
  bacaJejakPengguna,
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

type SesiBaris = {
  peran: string;
  sebutanPeran: string;
  namaAkunEcourt: string;
  tersambungPada: string;
  terakhirDipakai: string;
  diperiksaPada: string;
  keadaan: "tersambung" | "kedaluwarsa" | "terputus";
  kedaluwarsaPada: string;
};

/**
 * Sesi e-Court PRIBADI pengguna yang sedang login (perbaikan 1 Okt 2026, E10).
 * Daftar sesinya per peran, tanpa cookie - cookie tidak pernah keluar dari bot.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const hasil = await panggilBot<{ sesi: SesiBaris[]; peranTersedia: Array<{ kode: string; sebutan: string }> }>(
      `/ecourt-pengguna/sesi?penggunaId=${encodeURIComponent(actor.id)}`
    );
    const jejak = await bacaJejakPengguna(db, actor.id, 20).catch(() => []);
    if (!hasil.ok) {
      return ok({ tersedia: false, pesan: kalimatAlasan(hasil.alasan), sesi: [], peranTersedia: [], jejak });
    }
    return ok({
      tersedia: true,
      pesan: "",
      pengguna: { id: actor.id, nama: actor.name },
      sesi: hasil.data.sesi ?? [],
      peranTersedia: hasil.data.peranTersedia ?? [],
      jejak,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_SESI_PRIBADI_READ_FAILED",
      feature: "ecourt_sesi_pribadi",
      entityId: "sesi",
    });
  }
}

/**
 * aksi: "mulai" | "kirim" | "periksa" | "keluar".
 *
 * BADAN PERMINTAAN "kirim" MEMUAT SANDI e-COURT. Tidak satu bagiannya pun
 * dicatat; galat yang keluar dari rute ini diganti kalimat umum.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const body = (await request.json().catch(() => ({}))) as {
      aksi?: string;
      peran?: string;
      email?: string;
      sandi?: string;
      captcha?: string;
    };
    const peran = String(body.peran || "");
    const ip = alamatIpPeramban(request);

    if (body.aksi === "mulai") {
      const hasil = await panggilBot<{ ok: boolean; alasan?: string; captcha?: string; adaCaptcha?: boolean }>(
        "/ecourt-pengguna/login/mulai",
        { method: "POST", body: { penggunaId: actor.id, peran }, batasMs: BATAS_PERAMBAN_MS }
      );
      if (!hasil.ok) return ok({ ok: false, alasan: hasil.alasan, pesan: kalimatAlasan(hasil.alasan) });
      return ok({ ...hasil.data, pesan: kalimatAlasan(hasil.data.alasan) });
    }

    if (body.aksi === "kirim") {
      const sandi = String(body.sandi || "");
      const hasil = await panggilBot<{ ok: boolean; alasan?: string; namaAkunEcourt?: string }>(
        "/ecourt-pengguna/login/kirim",
        {
          method: "POST",
          body: {
            penggunaId: actor.id,
            peran,
            namaPengguna: actor.name,
            email: String(body.email || ""),
            sandi,
            captcha: String(body.captcha || ""),
          },
          batasMs: BATAS_PERAMBAN_MS,
        }
      );
      body.sandi = "";
      const berhasil = hasil.ok && hasil.data.ok;
      // Alasan dari bot/e-Court disapu: pesan penolakan dapat memantulkan isian.
      const sapuSandi = (teks: unknown) => (sandi ? String(teks ?? "").split(sandi).join("***") : String(teks ?? ""));
      const alasan = sapuSandi(hasil.ok ? String(hasil.data.alasan || "") : hasil.alasan);
      await catatJejakAksi(
        db,
        {
          penggunaId: actor.id,
          penggunaNama: actor.name,
          aksi: "sambung",
          peranEcourt: peran,
          akunEcourt: hasil.ok ? String(hasil.data.namaAkunEcourt || "") : "",
          hasil: berhasil ? "berhasil" : "gagal",
          alasan,
          alamatIp: ip,
        },
        [sandi]
      ).catch(() => undefined);
      return ok({
        ok: berhasil,
        alasan,
        pesan: kalimatAlasan(alasan),
        namaAkunEcourt: hasil.ok ? sapuSandi(hasil.data.namaAkunEcourt || "") : "",
      });
    }

    if (body.aksi === "periksa" || body.aksi === "keluar") {
      const jalur = body.aksi === "periksa" ? "/ecourt-pengguna/periksa" : "/ecourt-pengguna/keluar";
      const hasil = await panggilBot<{ ok: boolean; alasan?: string; berlaku?: boolean | null; namaAkunEcourt?: string }>(
        jalur,
        { method: "POST", body: { penggunaId: actor.id, peran }, batasMs: BATAS_PERAMBAN_MS }
      );
      const alasan = hasil.ok ? String(hasil.data.alasan || "") : hasil.alasan;
      await catatJejakAksi(db, {
        penggunaId: actor.id,
        penggunaNama: actor.name,
        aksi: body.aksi === "periksa" ? "periksa" : "putus",
        peranEcourt: peran,
        hasil: hasil.ok && hasil.data.ok ? "berhasil" : "gagal",
        alasan,
        alamatIp: ip,
      }).catch(() => undefined);
      if (!hasil.ok) return ok({ ok: false, alasan, pesan: kalimatAlasan(alasan) });
      return ok({ ...hasil.data, pesan: kalimatAlasan(alasan) });
    }

    return ok({ ok: false, alasan: "aksi_tidak_dikenali", pesan: "Aksi tidak dikenali." });
  } catch (error) {
    // Pesan galat asli sengaja tidak diteruskan: badan permintaan memuat sandi.
    return handleAdminRouteError(error instanceof ApiError ? error : new Error("Permintaan sesi e-Court pribadi gagal diproses."), request, {
      db,
      actorUserId,
      action: "ECOURT_SESI_PRIBADI_FAILED",
      feature: "ecourt_sesi_pribadi",
      entityId: "sesi",
    });
  }
}
