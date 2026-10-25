import { type NextRequest } from "next/server";

import { petakanBuktiSaksi, type ButirBukti, type KeteranganSaksi } from "@/lib/bukti-saksi";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaSetelanBerkas } from "@/server/modules/aleta-ecourt/berkas-otomatis";
import { sebutanAman } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { bacaGugatanSinggah } from "@/server/modules/aleta-ecourt/isi-gugatan-singgah";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PEMETAAN BUKTI <-> KETERANGAN SAKSI (G2, 25 Okt 2026) - USULAN
 * ============================================================================
 *
 *   POST { nomor, lawan?, pelaku?, saksi: [{ label, jawaban: [teks] }] }
 *     -> { aktif, usulan: [{ kodeBukti, uraianBukti, tautan: [{ saksi, kutipan, dasar }], keyakinan: "ragu", catatan }] }
 *
 * Butir bukti dibaca dari daftar bukti e-Court (pembaca yang sama dengan isi-gugatan, singgahan 30 menit); keterangan saksi dikirim
 * pemanggil (ekstensi membacanya dari ABT). Saklar "pemetaan bukti dan saksi" (Super Admin, bawaan MATI): mati -> { aktif: false,
 * usulan: [] } tanpa membaca apa pun. Tidak menulis ke ABT, SIPP, atau e-Court. Hak sama dengan isi-gugatan (data pihak).
 */
const BATAS_SAKSI = 8;
const BATAS_JAWABAN = 60;
const BATAS_TEKS = 1200;

function bersihkanSaksi(mentah: unknown): KeteranganSaksi[] {
  if (!Array.isArray(mentah)) return [];
  return mentah.slice(0, BATAS_SAKSI).map((s, i) => {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const jawaban = Array.isArray(o.jawaban) ? o.jawaban.slice(0, BATAS_JAWABAN).map((j) => String(j ?? "").slice(0, BATAS_TEKS)) : [];
    return { label: String(o.label ?? `Saksi ${i + 1}`).slice(0, 80), jawaban };
  });
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak");

    const badan = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!badan) throw new ApiError(400, "Permintaan tidak terbaca.");
    const nomor = String(badan.nomor ?? "").trim().slice(0, 80);
    if (!nomor) throw new ApiError(400, "Nomor perkara kosong.");

    const setelan = await bacaSetelanBerkas(db);
    if (!setelan.buktiSaksi) return ok({ aktif: false, usulan: [], catatan: ["Pemetaan bukti dan saksi belum dinyalakan Super Admin."] });

    const saksi = bersihkanSaksi(badan.saksi);
    if (saksi.length === 0) return ok({ aktif: true, usulan: [], catatan: ["Belum ada keterangan saksi yang dikirim."] });

    const sebutan = { lawan: sebutanAman(String(badan.lawan ?? ""), "Penggugat"), pelaku: sebutanAman(String(badan.pelaku ?? ""), "Tergugat") };
    const { hasil } = await bacaGugatanSinggah(nomor, sebutan, undefined, { denganBukti: true, otomatis: { bukti: setelan.bukti, kesimpulan: setelan.kesimpulan } });
    const bukti = (Array.isArray(hasil.bukti) ? hasil.bukti : []) as ButirBukti[];
    if (bukti.length === 0) return ok({ aktif: true, usulan: [], catatan: ["Daftar bukti e-Court perkara ini belum terbaca."] });
    return ok({ aktif: true, usulan: petakanBuktiSaksi(bukti, saksi), catatan: [] });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "BUKTI_SAKSI_PETA_FAILED", feature: "aleta_ecourt", entityId: "bukti-saksi" });
  }
}
