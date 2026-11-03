import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bacaRegisterKuasa, pilihanUntuk, simpanRegisterKuasa } from "@/server/modules/aleta-ecourt/register-kuasa";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * REGISTER KUASA HUKUM PER PERKARA (3 Nov 2026) - dipakai ekstensi-sipp/kuasa-register.js
 * ============================================================================
 *
 *   GET  ?nomor=&nama=[&tanggal=dd/mm/yyyy]  -> { daftar[], pilihan }   register kuasa itu di perkara itu
 *   POST { nomorPerkara, namaKuasa, pihakKe, pihakNama, tanggalSuratKuasa, nomorRegister, tanggalRegister }
 *
 * Hanya menulis ke tabel ALETA aleta_register_kuasa (migrasi 0132); tidak menyentuh SIPP/ABT. POST dikirim ekstensi
 * hanya SESUDAH SIPP menjawab berhasil menyimpan data kuasa. Aturan satu nama kuasa = satu register: src/lib/register-kuasa.ts.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak");
    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").slice(0, 80);
    const nama = String(request.nextUrl.searchParams.get("nama") || "").slice(0, 200);
    const tanggal = String(request.nextUrl.searchParams.get("tanggal") || "").slice(0, 20);
    const daftar = await bacaRegisterKuasa(db, nomor, nama || undefined);
    return ok({ daftar, pilihan: nama ? pilihanUntuk(daftar, tanggal) : null });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "REGISTER_KUASA_BACA_FAILED", feature: "aleta_ecourt", entityId: "register-kuasa" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "status.data-pihak");
    const mentah = await request.text();
    if (mentah.length > 4_000) throw new ApiError(413, "Permintaan terlalu besar.");
    let badan: Record<string, unknown>;
    try {
      badan = JSON.parse(mentah || "{}") as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Isi permintaan bukan JSON.");
    }
    const hasil = await simpanRegisterKuasa(db, String(actorUserId || ""), {
      nomorPerkara: String(badan.nomorPerkara ?? ""),
      namaKuasa: String(badan.namaKuasa ?? ""),
      pihakKe: Number(badan.pihakKe),
      pihakNama: String(badan.pihakNama ?? ""),
      tanggalSuratKuasa: String(badan.tanggalSuratKuasa ?? ""),
      nomorRegister: String(badan.nomorRegister ?? ""),
      tanggalRegister: String(badan.tanggalRegister ?? ""),
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "REGISTER_KUASA_SIMPAN_FAILED", feature: "aleta_ecourt", entityId: "register-kuasa" });
  }
}
