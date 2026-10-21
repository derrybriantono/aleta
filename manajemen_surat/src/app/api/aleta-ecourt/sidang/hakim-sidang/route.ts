import { type NextRequest } from "next/server";

import { bolehAksi } from "@/lib/matriks-peran";
import { kunciOrang } from "@/lib/orang-unik";
import { getDatabase } from "@/server/db/client";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaKeadaanKonseptor } from "@/server/modules/aleta-ecourt/konseptor-langkah";
import { bacaTidakAktif } from "@/server/modules/aleta-ecourt/orang-tidak-aktif";
import {
  bacaHakimSidang,
  batalHakimSidang,
  simpanHakimSidang,
  type IsianHakimSidang,
} from "@/server/modules/aleta-ecourt/sidang-keliling-hakim";
import { gatewayPegawaiPenunjukan } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hakim yang menyidangkan per perkara pada satu tanggal (22 Okt 2026, migrasi
 * 0083) - SATU hakim walau bermajelis; hanya di ALETA, tidak ditulis ke SIPP.
 * Konseptor sementara (ALETA) ikut diisi hakim itu - lihat modulnya.
 *
 *   GET ?tanggal=            -> { pilihan, calon, alasanCalon, bolehUbah }
 *                               calon = semua hakim aktif SIPP, tanpa yang
 *                               tidak aktif/mutasi (akun ALETA nonaktif ikut).
 *   PUT { tanggal, pilihan[], timpaKonseptor? } -> { hasil[] }
 *   DELETE { tanggal, perkaraIds[] }            -> { hasil[] }  (kembali ke majelis)
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const pilihan = await bacaHakimSidang(db, String(request.nextUrl.searchParams.get("tanggal") || ""));
    let calon: Array<{ id: number; kode: string; nama: string }> = [];
    let alasanCalon = "";
    try {
      const pegawai = await gatewayPegawaiPenunjukan();
      if (pegawai.ok) {
        const tidakAktif = await bacaTidakAktif(db);
        calon = (pegawai.data?.hakim ?? [])
          .map((b) => ({ id: Number(b.id) || 0, kode: String(b.kode ?? "").trim(), nama: String(b.nama ?? "").trim() }))
          .filter((h) => h.nama && !tidakAktif.hakim.has(kunciOrang(h.nama)) && !tidakAktif.semua.has(kunciOrang(h.nama)));
      } else {
        alasanCalon = pegawai.error || "Daftar hakim belum dapat dibaca dari SIPP.";
      }
    } catch (galat) {
      alasanCalon = galat instanceof Error ? galat.message : "Daftar hakim belum dapat dibaca dari SIPP.";
    }
    return ok({ pilihan, calon, alasanCalon, bolehUbah: bolehAksi(aktor, "sidang.pilih-hakim") });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "HAKIM_SIDANG_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "hakim-sidang",
    });
  }
}

async function badanJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const aktor = await pastikanAksi(db, actorUserId, "sidang.pilih-hakim");
    const badan = await badanJson(request);
    const pilihan = (Array.isArray(badan.pilihan) ? badan.pilihan : []) as IsianHakimSidang[];
    // Konseptor yang tercatat di SIPP (tetap) - dibaca, tidak pernah ditulis.
    // Tidak terbaca = undefined: konseptor sementara ALETA tetap boleh diisi.
    const keadaan = await bacaKeadaanKonseptor(pilihan.map((p) => String(p?.perkaraId ?? "")));
    const konseptorSipp = keadaan.terbaca
      ? Object.fromEntries(
          Object.entries(keadaan.peta).map(([pid, k]) => [pid, (k?.konseptor ?? []).map((x) => x.nama).filter(Boolean)])
        )
      : undefined;
    const hasil = await simpanHakimSidang(db, {
      tanggal: badan.tanggal,
      pilihan,
      olehId: String(actorUserId ?? ""),
      olehNama: String(aktor.name || aktor.email || ""),
      timpaKonseptor: badan.timpaKonseptor === true,
      konseptorSipp,
    });
    return ok({ hasil, konseptorSippTerbaca: keadaan.terbaca });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "HAKIM_SIDANG_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "hakim-sidang",
    });
  }
}

export async function DELETE(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "sidang.pilih-hakim");
    const badan = await badanJson(request);
    return ok({ hasil: await batalHakimSidang(db, { tanggal: badan.tanggal, perkaraIds: badan.perkaraIds }) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "HAKIM_SIDANG_BATAL_FAILED",
      feature: "aleta_ecourt",
      entityId: "hakim-sidang",
    });
  }
}
