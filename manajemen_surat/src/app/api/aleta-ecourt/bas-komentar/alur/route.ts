import { type NextRequest } from "next/server";

import { normalkanNomorPerkara } from "@/lib/bas-komentar";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaAlurBas } from "@/server/modules/aleta-ecourt/bas-komentar";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cocok = { perkaraId?: string; perkara_id?: string; nomorPerkara?: string; jenisPerkara?: string; tanggalDaftar?: string };

/**
 * Alur BAS satu perkara untuk dibaca hakim sebelum berkomentar.
 *
 *   GET ?perkaraId=<id>             -> alur
 *   GET ?nomor=<nomor perkara>      -> alur, atau { perluDipilih, pilihan } bila
 *                                      nomor itu cocok dengan banyak perkara
 *
 * HANYA MEMBACA - lembar BAS ALETA dari basis data portal dan keterangan
 * saksi ABT lewat jembatan bot (SELECT). Kemampuannya "panel", sama dengan
 * berkas perkara, karena isinya keterangan perkara yang sama.
 *
 * Pencarian nomor meniru rute berkas-perkara: separuh kata, dan bila lebih
 * dari satu yang cocok DAFTARNYA dikembalikan - kecuali satu di antaranya
 * sama persis dengan yang diketik. Membuka perkara pertama yang cocok
 * pernah membuat petugas membaca perkara tahun lain tanpa tanda apa pun.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    let perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const nomorDiketik = String(getSearchParam(request, "nomor") ?? "").trim();
    let nomorPerkara = normalkanNomorPerkara(nomorDiketik);

    if (!perkaraId && nomorPerkara) {
      const cari = await callAletaBotSippBridge<Cocok[]>("case.searchByNumber", {
        nomorPerkara,
        query: nomorPerkara,
        limit: 20,
      });
      if (!cari.ok) {
        return ok({ ada: false, pilihan: [], halangan: [`SIPP tidak terbaca: ${cari.error ?? "jembatan bot tidak menjawab"}`] });
      }
      const cocok = (Array.isArray(cari.data) ? cari.data : []).map((item) => ({
        perkaraId: String(item.perkaraId ?? item.perkara_id ?? "").trim(),
        nomorPerkara: String(item.nomorPerkara ?? "").trim(),
        jenisPerkara: String(item.jenisPerkara ?? "").trim(),
        tanggalDaftar: String(item.tanggalDaftar ?? "").trim(),
      }));
      const persis = cocok.filter((item) => normalkanNomorPerkara(item.nomorPerkara) === nomorPerkara);

      if (cocok.length === 0) {
        return ok({ ada: false, pilihan: [], halangan: [`Tidak ada perkara yang nomornya memuat "${nomorDiketik}".`] });
      }
      if (persis.length !== 1 && cocok.length > 1) {
        return ok({
          ada: false,
          perluDipilih: true,
          pilihan: cocok,
          halangan: [`${cocok.length} perkara cocok dengan "${nomorDiketik}". Pilih yang dimaksud.`],
        });
      }
      const terpilih = persis[0] ?? cocok[0];
      perkaraId = terpilih.perkaraId;
      nomorPerkara = normalkanNomorPerkara(terpilih.nomorPerkara) || nomorPerkara;
    }

    if (!perkaraId) return ok({ ada: false, pilihan: [], halangan: ["Sebutkan nomor perkara."] });

    const alur = await bacaAlurBas(db, { perkaraId, nomorPerkara });
    return ok({ ada: true, alur });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_KOMENTAR_ALUR_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-komentar",
    });
  }
}
