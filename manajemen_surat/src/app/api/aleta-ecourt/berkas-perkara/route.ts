import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { catatRiwayat } from "@/server/modules/aleta-ecourt/berkas-riwayat";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Berkas perkara terpadu - SIPP, e-Court, dan APS Badilag dalam satu jawaban.
 *
 * ============================================================================
 * MENJAWAB SEBAGIAN LEBIH BAIK DARIPADA MENOLAK
 * ============================================================================
 *
 * Bila satu sumber tidak terbaca - ABT sedang mati, jembatan bot putus - rute
 * ini TETAP menjawab dengan bagian yang berhasil, dan menyebutkan bagian mana
 * yang tidak. Menolak seluruhnya karena satu sumber bermasalah berarti petugas
 * kehilangan data SIPP yang sebenarnya baik-baik saja.
 *
 * Kapabilitas yang dituntut sama dengan panel perkara ("panel"): siapa pun yang
 * boleh melihat keterangan perkara boleh melihat berkasnya, karena isinya
 * memang keterangan perkara yang sama, hanya dirakit dari lebih banyak sumber.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    let perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const nomorPerkara = String(getSearchParam(request, "nomor") ?? "").trim();

    // Panitera menghafal nomor perkara, bukan id basis data. Menuntut id di
    // sini berarti menuntut mereka membuka SIPP lebih dulu hanya untuk
    // menyalin angka - persis pekerjaan yang seharusnya dihapus modul ini.
    //
    // Pencariannya SEPARUH KATA, sehingga "324" mengenai banyak perkara. Dulu
    // yang pertama langsung dibuka; itu keliru dan berbahaya - petugas mengira
    // membuka perkara 324 tahun ini, padahal yang terbuka perkara lain dari
    // tahun yang sama sekali berbeda, dan tidak ada apa pun di layar yang
    // memberitahunya. Sekarang bila lebih dari satu yang cocok, DAFTARNYA yang
    // dikembalikan, dan yang memilih adalah petugas.
    if (!perkaraId && nomorPerkara) {
      const cari = await callAletaBotSippBridge<
        Array<{ perkaraId?: string; perkara_id?: string; nomorPerkara?: string; jenisPerkara?: string; tanggalDaftar?: string }>
      >("case.searchByNumber", { nomorPerkara, query: nomorPerkara, limit: 20 });

      const cocok = Array.isArray(cari.data) ? cari.data : [];

      if (cocok.length === 0) {
        return ok({ ok: false, pilihan: [], halangan: [`Tidak ada perkara yang nomornya memuat "${nomorPerkara}".`] });
      }

      if (cocok.length > 1) {
        return ok({
          ok: false,
          perluDipilih: true,
          pilihan: cocok.map((item) => ({
            perkaraId: String(item.perkaraId ?? item.perkara_id ?? "").trim(),
            nomorPerkara: String(item.nomorPerkara ?? "").trim(),
            jenisPerkara: String(item.jenisPerkara ?? "").trim(),
            tanggalDaftar: String(item.tanggalDaftar ?? "").trim(),
          })),
          halangan: [`${cocok.length} perkara cocok dengan "${nomorPerkara}". Pilih yang dimaksud.`],
        });
      }

      perkaraId = String(cocok[0]?.perkaraId ?? cocok[0]?.perkara_id ?? "").trim();
    }

    const berkas = await rakitBerkasPerkara(perkaraId, nomorPerkara);

    // Keadaan dicatat tiap perkara dibuka, tetapi barisnya hanya ditulis bila
    // BERBEDA dari yang terakhir. Perkara yang dibuka dua puluh kali sehari
    // dengan begitu meninggalkan satu baris, bukan dua puluh - dan riwayat
    // penuh salinan yang sama tidak dapat dibaca.
    //
    // Kegagalan pencatatan tidak dilempar: riwayat catatan pendamping, dan
    // halaman perkara tidak boleh mati karena catatannya gagal ditulis.
    await catatRiwayat(db, berkas, String(actorUserId ?? ""));

    return ok(berkas);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BERKAS_PERKARA_FAILED",
      feature: "aleta_ecourt",
      entityId: "berkas-perkara",
    });
  }
}
