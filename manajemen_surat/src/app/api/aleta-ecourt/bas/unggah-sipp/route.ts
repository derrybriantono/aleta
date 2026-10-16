import { NextResponse, type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { gatewayUnggahBasSipp } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { hakUnggahMassal, periksaBerkasBas } from "@/server/modules/aleta-ecourt/unggah-massal";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** BAS khas puluhan KB; batas ini longgar. */
const BATAS_BERKAS = 10 * 1024 * 1024;

/**
 * ============================================================================
 * UNGGAH e-DOC BAS SATU SIDANG KE SIPP (F4.1, 17 OKT 2026) - MENULIS KE SIPP
 * ============================================================================
 *
 *   POST multipart: perkaraId, sidangId, nomorPerkara, bas (berkas), olehUsername?, ganti?
 *     -> { jalur, nama, urutan, bentuk, diganti, peringatan[] }
 *     -> 409 { alasan, sebab } bila isinya bukan BAS perkara ini, atau e-Doc sudah ada
 *
 * Sama dengan tingkap e-Doc baris Jadwal Sidang SIPP (fileupload_c.php,
 * from=bas): berkas ke resources/file/doc/<tahun>/<bulan daftar>, kolom
 * perkara_jadwal_sidang.edoc_bas. Ditulis bot (basUnggahService) - portal
 * tidak menyentuh SIPP sendiri.
 *
 * HAK: golongan BAS massal (PP, Panitera, Panmud, Analis) + Admin/Super Admin
 * (keputusan 9 & 16 Okt 2026: BAS milik panitera sidang; hakim TIDAK). Bot
 * menolak sekali lagi lewat peranPenekan.
 *
 * DOBEL: e-Doc yang sudah ada TIDAK diganti kecuali ganti=1 dikirim (petugas
 * memilihnya dengan sadar, seperti konfirmasi L1 di tingkap SIPP).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const hak = hakUnggahMassal(actor);
    if (!hak.bas || !hak.peranBas) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message:
              "Unggah BAS ke SIPP hanya untuk Panitera Pengganti, Panitera, Panitera Muda, Admin, dan Super Admin. Peran Anda tidak diberi hak ini.",
          },
        },
        { status: 403 }
      );
    }

    const formulir = await request.formData();
    const perkaraId = String(formulir.get("perkaraId") ?? "").trim();
    const sidangId = String(formulir.get("sidangId") ?? "").trim();
    const nomorPerkara = String(formulir.get("nomorPerkara") ?? "").trim();
    const olehUsername = String(formulir.get("olehUsername") ?? "").trim().slice(0, 120);
    const ganti = String(formulir.get("ganti") ?? "") === "1";
    if (!/^\d{1,12}$/.test(perkaraId) || !/^\d{1,12}$/.test(sidangId) || !nomorPerkara) {
      return ok({ ok: false, sebab: "Perkara, sidang, atau nomor perkara belum disebut." });
    }
    const berkas = formulir.get("bas");
    if (!(berkas instanceof File) || berkas.size === 0) return ok({ ok: false, sebab: "Berkas BAS belum dipilih." });
    if (berkas.size > BATAS_BERKAS) return ok({ ok: false, sebab: "Berkas BAS melampaui 10 MB." });
    const bita = new Uint8Array(await berkas.arrayBuffer());

    const periksa = periksaBerkasBas(bita, nomorPerkara);
    if (periksa.tolak) {
      return NextResponse.json(
        { ok: false, error: { message: periksa.tolak }, data: { ok: false, alasan: "isi_ditolak", sebab: periksa.tolak, peringatan: periksa.peringatan } },
        { status: 409 }
      );
    }

    const hasil = await gatewayUnggahBasSipp({
      perkaraId,
      sidangId,
      nomorPerkara,
      basBase64: Buffer.from(bita).toString("base64"),
      olehUsername,
      operator: String(actor?.name || actor?.email || actorUserId || "").trim(),
      ip: alamatIpPeramban(request),
      peranPenekan: hak.peranBas,
      ganti,
    });
    if (!hasil.ok) {
      if (hasil.kode === "sudah_ada") {
        return NextResponse.json(
          { ok: false, error: { message: hasil.error }, data: { ok: false, alasan: "sudah_ada", sebab: hasil.error, peringatan: periksa.peringatan } },
          { status: 409 }
        );
      }
      return ok({ ok: false, alasan: hasil.kode || "", sebab: hasil.error || "ALETA Bot belum dapat dihubungi.", peringatan: periksa.peringatan });
    }
    return ok({ ...hasil.data, peringatan: periksa.peringatan });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_UNGGAH_SIPP_GAGAL",
      feature: "aleta_ecourt",
      entityId: "bas-unggah-sipp",
    });
  }
}
