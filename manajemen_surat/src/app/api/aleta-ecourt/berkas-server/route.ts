import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  ambilHasil,
  buatPekerjaan,
  daftarPekerjaan,
  hapusPekerjaan,
  mulaiPekerjaan,
  saklarBerkasNyala,
  statusPekerjaan,
  tambahButir,
} from "@/server/modules/aleta-ecourt/berkas-pekerjaan";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Naskah dikirim satu per satu (paling besar 6 MB); jangan dipotong oleh batas badan bawaan.
export const maxDuration = 120;

/**
 * Pekerjaan berkas di server untuk cetak massal Blangko Derry (K14, rantai B, 25 Okt 2026).
 *
 *   GET                       -> { aktif, pekerjaan: [ringkas...] }   milik pemanggil saja
 *   GET ?id=                  -> ringkas satu pekerjaan (status, temuan sisa blangko, hasil)
 *   GET ?id=&unduh=1          -> berkas hasil (ZIP atau PDF) bila selesai
 *   POST {aksi:"buat", format:"rtf"|"pdf", nama}        -> { tersedia, id, batas }
 *   POST {aksi:"butir", id, nama, rtfBase64}            -> { jumlahButir }
 *   POST {aksi:"mulai", id}                             -> ringkas (pekerjaan berjalan di server)
 *   DELETE ?id=               -> { dihapus }
 *
 * Saklar kinerja.berkasDiServer mati (bawaan) -> { tersedia: false } dan tidak ada yang disimpan. Kewenangan
 * sama dengan abt/pdf dan pdf-gabung (kapabilitas "blangko-abt"). Hanya di memori server; lihat berkas-pekerjaan.ts.
 */
async function pemanggil(request: NextRequest, tulis: boolean) {
  const db = await getDatabase();
  const id = await resolveActorUserId(request);
  if (tulis) await pastikanKapabilitas(db, id, "blangko-abt");
  const actor = await requireActorUser(db, id);
  return { db, id: actor.id };
}

export async function GET(request: NextRequest) {
  try {
    const { db, id } = await pemanggil(request, false);
    const q = new URL(request.url).searchParams;
    const idPekerjaan = q.get("id");
    if (!idPekerjaan) {
      if (!(await saklarBerkasNyala(db))) return ok({ aktif: false, pekerjaan: [] });
      return ok({ aktif: true, pekerjaan: daftarPekerjaan(id) });
    }
    if (q.get("unduh") === "1") {
      const h = ambilHasil(id, idPekerjaan);
      return new Response(new Uint8Array(h.bita), {
        status: 200,
        headers: {
          "content-type": h.tipe,
          "content-length": String(h.bita.length),
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(h.nama)}`,
          "cache-control": "no-store",
        },
      });
    }
    return ok(statusPekerjaan(id, idPekerjaan));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, id } = await pemanggil(request, true);
    let b: Record<string, unknown>;
    try {
      b = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    if (!b || typeof b !== "object") throw new ApiError(400, "Badan permintaan harus obyek.");
    if (b.aksi === "buat") return ok(await buatPekerjaan(db, id, { format: b.format, nama: b.nama }));
    if (!(await saklarBerkasNyala(db))) return ok({ tersedia: false, alasan: "saklar-mati" });
    if (b.aksi === "butir") return ok(tambahButir(id, b.id, { nama: b.nama, rtfBase64: b.rtfBase64 }));
    if (b.aksi === "mulai") {
      const { selesai: _selesai, ...ringkas } = mulaiPekerjaan(id, b.id);
      void _selesai;
      return ok(ringkas);
    }
    throw new ApiError(400, 'Aksi harus "buat", "butir", atau "mulai".');
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await pemanggil(request, false);
    return ok(hapusPekerjaan(id, new URL(request.url).searchParams.get("id")));
  } catch (error) {
    return handleRouteError(error);
  }
}
