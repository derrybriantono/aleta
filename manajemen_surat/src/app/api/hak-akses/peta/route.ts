import { type NextRequest } from "next/server";

import {
  HAK_MENU_ABT,
  KEPUTUSAN_MENUNGGU,
  KEWENANGAN_KHUSUS,
  NAMA_GRUP_SIPP,
  LABEL_KELOMPOK,
  LABEL_TINGKAT,
  PERUBAHAN_18OKT,
  URUTAN_KELOMPOK,
  petaUntukPembaca,
} from "@/lib/hak-akses-peta";
import { GOLONGAN_PERAN, LABEL_GOLONGAN } from "@/lib/matriks-peran";
import { getEffectiveRoleId, isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Peta hak akses per peran (18 Okt 2026) untuk halaman Pengaturan > Hak akses per peran.
 *
 *   GET -> { teknis, golongan[], kelompok[], tingkat, butir[], kewenangan[], perubahan[] }
 *
 * Data SAMA dengan dokumen docs/hak-akses/MATRIKS-HAK-AKSES-18okt.md (lib/hak-akses-peta.ts).
 * Admin membaca tabelnya saja; Super Admin juga mendapat kunci, rute, daftar perubahan, dan keputusan yang menunggu.
 * Peran lain 403 - peta ini memuat seluruh susunan hak satker.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hak akses per peran hanya dapat dibuka Super Admin dan Admin.");
    }
    const teknis = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "") === "super-admin";
    return ok({
      teknis,
      golongan: GOLONGAN_PERAN.map((kode) => ({ kode, label: LABEL_GOLONGAN[kode] })),
      kelompok: URUTAN_KELOMPOK.map((kode) => ({ kode, label: LABEL_KELOMPOK[kode] })),
      tingkat: LABEL_TINGKAT,
      butir: petaUntukPembaca(teknis),
      kewenangan: KEWENANGAN_KHUSUS,
      perubahan: teknis ? PERUBAHAN_18OKT : [],
      menunggu: teknis ? KEPUTUSAN_MENUNGGU : [],
      hakMenuAbt: HAK_MENU_ABT.map((h) => ({
        folder: h.folder,
        tahap: h.tahap,
        grup: h.grup.map((g) => NAMA_GRUP_SIPP[g] ?? String(g)),
        validator: (h.validator ?? []).map((g) => NAMA_GRUP_SIPP[g] ?? String(g)),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
