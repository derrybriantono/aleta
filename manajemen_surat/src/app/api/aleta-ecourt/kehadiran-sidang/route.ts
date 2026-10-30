import { type NextRequest } from "next/server";

import { penekanAdalahPp, SEBAB_BUKAN_PP, type AtasNamaPp } from "@/lib/kehadiran-sidang";
import { golonganPengguna } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { akunSippMilik } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { bacaKredensialSipp } from "@/server/modules/aleta-ecourt/checklist-milestone";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pembetulan pilihan kehadiran sidang di SIPP (G4 4.4, 30 Okt 2026) - dari catatan temuan panel cetak
 * Blangko Derry: BAS mencatat kehadiran lain dari SIPP, atau putusan verstek padahal SIPP mencatat
 * Tergugat hadir (aturan identik paket relaas-penetapan-30okt). Bot: kehadiranSidangTulisService.
 *
 *   GET  ?perkaraId[&basJadwalId&basNama]  usulan + bolehAnda (hanya membaca)
 *   POST { jadwalId, dihadiriOleh, sebelum, sebab, perkaraId }  MENULIS KE SIPP
 *
 * Penjaga: aksi "sidang.kehadiran-sipp" + penekan = PP perkara (akun SIPP tertaut = akun PP yang
 * tercatat, atau nama bila belum tertaut) dibaca ULANG dari rencana bot sebelum menulis. Tercatat
 * di SIPP atas akun PP perkara (Edit Jadwal Sidang), penekan sebenarnya di jejak ALETA.
 */
async function penekan(db: Awaited<ReturnType<typeof getDatabase>>, aktor: { id: string; name: string } & NonNullable<Parameters<typeof golonganPengguna>[0]>) {
  const milik = akunSippMilik(await bacaKredensialSipp(db).catch(() => []), aktor.id);
  // Super Admin boleh menekan (30 Okt malam); baris SIPP tetap atas akun PP perkara (bot), penekan di jejak ALETA.
  return { nama: aktor.name, akunSippMilik: milik, superAdmin: golonganPengguna(aktor).includes("super-admin") };
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;
    const perkaraId = String(q.get("perkaraId") || "").trim();
    if (!/^\d{1,12}$/.test(perkaraId)) return ok({ available: true, ok: false, alasan: "Perkara tidak dikenali.", usul: [] });
    const basJadwalId = String(q.get("basJadwalId") || "").trim();
    const basNama = String(q.get("basNama") || "").slice(0, 300);
    const p = new URLSearchParams({ perkaraId });
    if (/^\d{1,12}$/.test(basJadwalId) && basNama) {
      p.set("basJadwalId", basJadwalId);
      p.set("basNama", basNama);
    }
    const h = await panggilBotJadwalSidang<Record<string, unknown> & { pp?: AtasNamaPp | null; usul?: unknown[] }>(`/kehadiran-sidang?${p.toString()}`);
    if (!h.ok) return ok({ available: false, ok: false, alasan: h.error, usul: [] });
    const nilai = penekanAdalahPp(await penekan(db, aktor), h.data.pp ?? null);
    const golonganBoleh = golonganPengguna(aktor).includes("pp") || golonganPengguna(aktor).includes("admin") || golonganPengguna(aktor).includes("super-admin");
    return ok({
      available: true,
      ...h.data,
      bolehAnda: golonganBoleh && nilai.boleh,
      sebabAnda: nilai.boleh ? "" : nilai.sebab,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "SIPP_KEHADIRAN_SIDANG_READ_FAILED", feature: "aleta_ecourt" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.kehadiran-sipp");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const jadwalId = String(badan.jadwalId ?? "").trim();
    if (!/^\d{1,12}$/.test(jadwalId)) throw new ApiError(400, "Sidang tidak dikenali.");
    const dihadiriOleh = Number(badan.dihadiriOleh);
    const muatan = {
      jadwalId,
      dihadiriOleh,
      sebelum: badan.sebelum === null || badan.sebelum === undefined ? undefined : Number(badan.sebelum) || 0,
      sebab: badan.sebab === "bas" || badan.sebab === "verstek" ? badan.sebab : "usulan",
      operator: actorUserId || "portal",
      ip: alamatIpPeramban(request),
    };
    // 1) Rencana kering: atas nama siapa baris SIPP akan tercatat (PP perkara menurut SIPP sendiri).
    const kering = await panggilBotJadwalSidang<Record<string, unknown> & { ok?: boolean; atasNama?: AtasNamaPp; pesan?: string; alasan?: string }>(
      "/kehadiran-sidang",
      { method: "POST", body: { ...muatan, kering: true }, timeoutMs: 20_000 }
    );
    if (!kering.ok) return ok({ available: Boolean(kering.status), ok: false, alasan: kering.error || "ALETA Bot belum dapat dihubungi." });
    if (kering.data.ok === false) return ok({ available: true, ...kering.data, alasan: String(kering.data.pesan ?? kering.data.alasan ?? "") });
    // 2) Penekan harus PP perkara itu - dibaca ULANG dari rencana bot, bukan dari kiriman layar.
    const nilai = penekanAdalahPp(await penekan(db, aktor), kering.data.atasNama ?? null);
    if (!nilai.boleh) throw new ApiError(403, nilai.sebab || SEBAB_BUKAN_PP);
    const p = await penekan(db, aktor);
    // 3) Tulis.
    const tulis = await panggilBotJadwalSidang<Record<string, unknown> & { ok?: boolean; pesan?: string; alasan?: string }>("/kehadiran-sidang", {
      method: "POST",
      body: { ...muatan, kering: false, operatorAkunSipp: p.akunSippMilik.join(", "), jamKerja: "sekarang" },
      timeoutMs: 20_000,
    });
    if (!tulis.ok) return ok({ available: Boolean(tulis.status), ok: false, alasan: tulis.error || "ALETA Bot belum dapat dihubungi." });
    const data = tulis.data;
    return ok({ available: true, ...data, alasan: data.ok === false ? String(data.pesan ?? data.alasan ?? "") : data.alasan });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "SIPP_KEHADIRAN_SIDANG_WRITE_FAILED", feature: "aleta_ecourt" });
  }
}
