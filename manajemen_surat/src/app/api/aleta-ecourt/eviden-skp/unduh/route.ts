import { type NextRequest } from "next/server";

import { susunPaketEvidenSkp } from "@/lib/eviden-skp-katalog";
import type { PaketEvidenSkp } from "@/lib/eviden-skp-tipe";
import {
  SEBUTAN_PERAN_EVIDEN_SKP,
  bacaPermintaanUnduhEvidenSkp,
  dispositionLampiran,
} from "@/lib/eviden-skp-unduh";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { ambilDataEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-data";
import { bacaLogoKop, susunUnduhanEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-unduhan";
import { getInstitutionIdentityFromDb } from "@/server/modules/settings/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unduhan eviden SKP (2.40.0).
 *
 *   ?peran=hakim&id=26&tahun=2026&periode=tw2&dokumen=rekap-perkara|semua
 *    &format=pdf|xlsx|docx[&tanggal=2026-06-30]
 *
 * ============================================================================
 * KEWENANGANNYA SAMA DENGAN REKAP PETUGAS
 * ============================================================================
 *
 * Menu unduhan ada di halaman Rekap Hakim, dan isinya keterangan perkara
 * yang sama dengan halaman itu - hanya dicetak. Karena itu kemampuannya
 * kemampuan panel, persis seperti rute rekap-petugas, dan diperiksa LEBIH
 * DAHULU dari apa pun: yang tidak berwenang tidak perlu diberi tahu bentuk
 * alamat yang benar, dan data SIPP tidak dibaca untuknya.
 *
 * ============================================================================
 * YANG BERHASIL DICATAT DI JEJAK AUDIT
 * ============================================================================
 *
 * Dokumen eviden memuat nama para pihak dari SIPP. Seperti ZIP berkas
 * perkara, unduhan yang BERHASIL ikut dicatat - siapa, dokumen apa, periode
 * mana - bukan hanya yang gagal.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");

    // Hari ini menurut WITA, bukan menurut jam peladen (UTC) - pukul 07.00 WITA
    // masih "kemarin" di peladen. Dipakai untuk menolak periode yang belum
    // dimulai dan sebagai tanggal tanda tangan bawaan.
    const hariIni = waktuPengadilan().tanggal;
    const permintaan = bacaPermintaanUnduhEvidenSkp(request.nextUrl.searchParams, hariIni);
    if (!permintaan.ok) throw new ApiError(400, permintaan.pesan);
    const { peran, id, tahun, periode, dokumen, format } = permintaan.nilai;
    const tanggal = permintaan.nilai.tanggal ?? hariIni;

    const data = await ambilDataEvidenSkp({ peran, id: String(id), tahun, periode });
    if (!data.ok) {
      const status = data.status >= 400 && data.status <= 599 ? data.status : 502;
      throw new ApiError(status, data.alasan || "Data eviden SKP tidak dapat dibaca dari SIPP. Coba lagi beberapa saat lagi.");
    }

    let paket: PaketEvidenSkp;
    try {
      paket = susunPaketEvidenSkp(data.data);
    } catch (galat) {
      throw new ApiError(
        500,
        `Dokumen eviden SKP tidak dapat disusun dari data SIPP${galat instanceof Error && galat.message ? `: ${galat.message}` : "."}`
      );
    }

    // Kop dari Identitas Instansi. Yang gagal dibaca membuat kop tanpa baris
    // instansi - bukan membatalkan unduhan, dan bukan diisi karangan.
    const instansi = await getInstitutionIdentityFromDb(db).catch(() => null);
    const logo = await bacaLogoKop();

    const hasil = await susunUnduhanEvidenSkp({
      paket,
      dokumen,
      format,
      opsi: { instansi, tanggalTandaTangan: tanggal, sebutanOrang: SEBUTAN_PERAN_EVIDEN_SKP[peran], logo },
    });
    if (!hasil.ok) throw new ApiError(hasil.status, hasil.pesan);

    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: "EVIDEN_SKP_UNDUH",
      entityType: "petugas",
      entityId: `${peran}:${id}`,
      payload: {
        peran,
        id,
        nama: paket.orang.nama,
        tahun,
        periode,
        dokumen,
        format,
        tanggalTandaTangan: tanggal,
        namaBerkas: hasil.nama,
        dokumenIkut: hasil.dokumen,
        byte: hasil.isi.length,
        oleh: aktor?.name || "",
      },
    }).catch(() => {
      // Jejak yang gagal dicatat tidak membatalkan unduhan yang sudah tersusun.
    });

    return new Response(new Uint8Array(hasil.isi), {
      status: 200,
      headers: {
        ...getAttachmentSecurityHeaders(),
        "content-type": hasil.jenis,
        "content-disposition": dispositionLampiran(hasil.nama),
        "content-length": String(hasil.isi.length),
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "EVIDEN_SKP_UNDUH_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
