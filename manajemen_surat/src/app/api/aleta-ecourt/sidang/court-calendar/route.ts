import { type NextRequest } from "next/server";

import { bolehIsiCourtCalendar } from "@/lib/court-calendar-hak";
import { getDatabase } from "@/server/db/client";
import { getGatewayStatusPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Court Calendar satu perkara dari Jadwal Sidang (6 Okt 2026, butir 3).
 *
 *   GET  ?perkaraId   Court Calendar SIPP perkara itu BESERTA id barisnya
 *                     (untuk disunting), keadaan perkara yang dibaca penyusun
 *                     rekomendasi (@/lib/court-calendar-susun - aturan butir 29),
 *                     dan akun SIPP yang akan tercatat. Hanya membaca.
 *   POST              tambah / sunting baris ke SIPP - MENULIS lewat bot
 *                     (courtCalendarTulisService), bentuk blangko SIPP.
 *                     Kering kecuali `kering: false` disebut tegas.
 *
 * Hak: kemampuan "data-umum" (sama dengan Court Calendar otomatis panel SIPP)
 * DAN golongan panitera/admin (bolehIsiCourtCalendar).
 *
 * Akun SIPP: diturunkan dari kredensial SIPP milik pengguna yang login
 * (court-calendar-akun.ts) - tidak pernah diketik bebas, tidak pernah akun
 * orang lain. Operator (nama ALETA) dan IP peramban hanya ke jejak ALETA.
 */
async function pastikanHak(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string | null) {
  const aktor = await pastikanKapabilitas(db, actorUserId, "data-umum");
  if (!bolehIsiCourtCalendar(aktor)) {
    throw new ApiError(403, "Court Calendar hanya dapat diisi panitera, panitera pengganti, dan admin.");
  }
  return aktor;
}

function rek(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

/** Hanya ruas yang dibaca ccMasukan - status perkara utuh tidak dikirim ke layar. */
function bahanPenyusun(status: Record<string, unknown> | null | undefined) {
  if (!status) return null;
  const tahapan = rek(status.tahapan);
  const identitas = rek(status.identitasPihak);
  const mediasi = rek(status.mediasi);
  return {
    tahapan: tahapan ? { tahap: Array.isArray(tahapan.tahap) ? tahapan.tahap : [], sidangPertama: tahapan.sidangPertama ?? null } : null,
    identitasPihak: identitas
      ? { jenisPerkara: String(identitas.jenisPerkara ?? ""), jenisPerkaraLengkap: String(identitas.jenisPerkaraLengkap ?? "") }
      : null,
    jadwal: Array.isArray(status.jadwal)
      ? status.jadwal.map((x) => {
          const j = rek(x) ?? {};
          return {
            tanggalSidang: String(j.tanggalSidang ?? j.tanggal ?? ""),
            jamSidang: String(j.jamSidang ?? j.jam ?? ""),
            agenda: String(j.agenda ?? ""),
            dihadiriOleh: j.dihadiriOleh ?? null,
          };
        })
      : [],
    mediasi: mediasi && Array.isArray(mediasi.baris) ? { baris: mediasi.baris.map((m) => ({ berhasil: rek(m)?.berhasil })) } : null,
    lewatEcourt: status.lewatEcourt === true,
    putusan: { sudahPutus: Boolean(rek(status.putusan)?.sudahPutus) },
    ikrarTalak: { ada: Boolean(rek(status.ikrarTalak)?.ada) },
  };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanHak(db, actorUserId);

    // ?jumlah=1,2,3 - angka kecil di samping tautan tiap baris Jadwal Sidang,
    // satu panggilan untuk seluruh baris yang tampil.
    const jumlah = request.nextUrl.searchParams.get("jumlah");
    if (jumlah !== null) {
      const id = [...new Set(jumlah.split(",").map((x) => x.trim()).filter((x) => /^\d{1,20}$/.test(x)))].slice(0, 500);
      if (!id.length) return ok({ available: true, ok: true, jumlah: {} });
      const hasil = await panggilBotJadwalSidang<{ ok?: boolean; jumlah?: Record<string, number>; alasan?: string }>(
        `/court-calendar/jumlah?${new URLSearchParams({ perkaraId: id.join(",") }).toString()}`
      );
      if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error, jumlah: {} });
      return ok({ available: true, ok: hasil.data.ok !== false, jumlah: hasil.data.jumlah ?? {}, alasan: hasil.data.alasan ?? "" });
    }

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (!/^\d{1,20}$/.test(perkaraId)) {
      return ok({ available: true, ok: false, alasan: "Nomor perkara SIPP tidak dikenali." });
    }
    const kalender = await panggilBotJadwalSidang<{ ok?: boolean; alasan?: string; perkara?: { nomorPerkara?: string }; baris?: unknown[] }>(
      `/court-calendar?${new URLSearchParams({ perkaraId }).toString()}`
    );
    if (!kalender.ok) return ok({ available: false, ok: false, alasan: kalender.error });
    if (!kalender.data.ok) return ok({ available: true, ok: false, alasan: String(kalender.data.alasan || "Court Calendar tidak terbaca.") });

    const nomor = String(kalender.data.perkara?.nomorPerkara || "");
    const [status, akun] = await Promise.all([
      nomor ? getGatewayStatusPerkara(nomor) : Promise.resolve(null),
      akunSippPengguna(db, aktor.id),
    ]);
    const statusData = status && status.ok && status.data?.ok ? (status.data as Record<string, unknown>) : null;

    return ok({
      available: true,
      ok: true,
      perkara: kalender.data.perkara,
      baris: kalender.data.baris ?? [],
      status: bahanPenyusun(statusData),
      statusAlasan: statusData ? "" : status && !status.ok ? status.error : "Keadaan perkara tidak terbaca - rekomendasi disusun dari Court Calendar saja.",
      akun,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_COURT_CALENDAR_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanHak(db, actorUserId);
    const badan = (await request.json()) as Record<string, unknown>;

    const akun = await akunSippPengguna(db, aktor.id, badan.akunSipp);
    if (!akun.ok) {
      return ok({ available: true, ok: false, alasan: akun.alasan, pesan: akun.pesan, milik: akun.milik });
    }

    const tambah = Array.isArray(badan.tambah) ? badan.tambah.slice(0, 30) : [];
    const ubah = Array.isArray(badan.ubah) ? badan.ubah.slice(0, 30) : [];
    const kering = badan.kering !== false;
    const hasil = await panggilBotJadwalSidang("/court-calendar", {
      method: "POST",
      body: {
        perkaraId: String(badan.perkaraId ?? ""),
        tambah,
        ubah,
        akunSipp: akun.username,
        operator: String(aktor.name || aktor.email || aktor.id),
        ip: alamatIpPeramban(request),
        kering,
      },
      // Tiap baris didahului jeda manusia (sampai 2,2 detik) di bot.
      timeoutMs: kering ? 20_000 : Math.min(120_000, 20_000 + (tambah.length + ubah.length) * 3_000),
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_COURT_CALENDAR_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
