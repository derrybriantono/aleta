import { type NextRequest } from "next/server";

import { BATAS_BAWAAN, saringKeluar, type AturanBatas } from "@/lib/batas-data";
import { buatPenyamar } from "@/lib/penyamaran";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { susunJejak } from "@/server/modules/aleta-ecourt/penjagaan-putusan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jejak satu draf putusan (J4), dan penyaringan sebelum keluar (J5, J6).
 *
 *   GET ?drafId=...            jejak lengkap: butir, nilai, dan dasar hukumnya
 *   POST {tindakan:"saring"}   menyaring isi sebelum dikirim ke luar gedung
 *
 * ============================================================================
 * JEJAK DIBACA DI DALAM, PENYARINGAN UNTUK YANG KELUAR
 * ============================================================================
 *
 * Keduanya berada di satu rute karena keduanya menjawab pertanyaan yang sama
 * dari dua arah: apa yang menyusun putusan ini, dan berapa banyak darinya yang
 * boleh meninggalkan gedung.
 *
 * Petugas di dalam berhak melihat jejak selengkapnya - itu gunanya jejak.
 * Penyaringan hanya berlaku pada kiriman keluar, dan penjagaan yang juga
 * menyembunyikan data dari petugas yang berhak akan dimatikan pada minggu
 * pertama.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const drafId = String(getSearchParam(request, "drafId") ?? "").trim();
    if (!drafId) return ok({ ada: false, sebab: "Sebutkan drafId." });

    const jejak = await susunJejak(db, drafId);
    return ok({
      ada: Boolean(jejak.draf),
      ...jejak,
      // Rujukan yang tidak terbukti disebut tersendiri: inilah yang menahan
      // draf, dan mencampurnya ke daftar dasar membuatnya tidak terlihat.
      dasarTakTerbukti: jejak.dasar.filter((item) => !item.terbukti),
      dasarDicabut: jejak.dasar.filter((item) => item.sudahDicabut),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_JEJAK_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "putusan-jejak",
    });
  }
}

type Masukan = {
  tindakan?: string;
  isi?: Record<string, unknown>;
  /** Garam penyamaran - beda tiap kiriman supaya dua kiriman tak dapat disatukan. */
  garam?: string;
  aturanTambahan?: AturanBatas[];
};

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const masukan = (await request.json()) as Masukan;
    if (String(masukan.tindakan ?? "") !== "saring") {
      return ok({ ok: false, sebab: "Tindakan tidak dikenali." });
    }

    // Aturan tersimpan MENAMBAH aturan bawaan, tidak menggantikannya - kecuali
    // pada ruas yang disebutnya sendiri. Mengganti seluruhnya berarti satu
    // baris yang salah dapat membuka semua ruas sekaligus.
    const baris = await db.queryAll<Record<string, unknown>>(
      `SELECT ruas, batas, sebab FROM aleta_batas_data ORDER BY ruas ASC`
    );
    const tersimpan: AturanBatas[] = baris.map((item) => ({
      ruas: String(item.ruas ?? "").trim(),
      batas: (String(item.batas ?? "terlarang") || "terlarang") as AturanBatas["batas"],
      sebab: String(item.sebab ?? "").trim(),
    }));

    const garam = String(masukan.garam ?? "").trim();
    if (!garam) {
      return ok({ ok: false, sebab: "Sebutkan garam penyamaran; tanpanya penyamaran dapat dibalik." });
    }

    const penyamar = buatPenyamar(garam);
    const hasil = saringKeluar(masukan.isi ?? {}, penyamar.samarkanNilai, [
      ...tersimpan,
      ...(masukan.aturanTambahan ?? []),
      ...BATAS_BAWAAN,
    ]);

    return ok({
      ok: hasil.belumBeraturan.length === 0,
      ...hasil,
      // Ruas tanpa aturan menahan kiriman: bawaan ketat hanya berguna bila
      // ketiadaan aturan terlihat, bukan diam-diam menghapus ruasnya.
      sebab: hasil.belumBeraturan.length
        ? `Ruas berikut belum punya aturan batas dan ditahan: ${hasil.belumBeraturan.join(", ")}.`
        : "",
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BATAS_DATA_SARING_FAILED",
      feature: "aleta_ecourt",
      entityId: "batas-data",
    });
  }
}
