import { type NextRequest } from "next/server";

import { susunPaketEvidenSkp } from "@/lib/eviden-skp-katalog";
import type { PaketEvidenSkp } from "@/lib/eviden-skp-tipe";
import {
  SEBUTAN_PERAN_EVIDEN_SKP,
  bacaPermintaanUnduhSkp,
  dispositionLampiran,
  type PermintaanUnduhSkp,
} from "@/lib/eviden-skp-unduh";
import { sebutanOrangSkp, susunPaketSkpJabatan, susunPaketSkpPimpinan } from "@/lib/skp-jabatan-lembar";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { ambilDataEvidenSkpPeriode } from "@/server/modules/aleta-ecourt/eviden-skp-data";
import { bacaLogoKop, susunUnduhanEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-unduhan";
import { bacaAktorSkp } from "@/server/modules/skp/pegawai";
import { siapkanSkp, type HasilSiapSkp } from "@/server/modules/skp/lembar";
import { getInstitutionIdentityFromDb } from "@/server/modules/settings/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";

/**
 * ============================================================================
 * PENANGAN RUTE UNDUH DAN DAFTAR DOKUMEN SKP (satu tempat, dipakai bersama)
 * ============================================================================
 *
 * /api/skp/unduh dan /api/skp/daftar memakai ini. Rute eviden SKP hakim LAMA
 * (/api/aleta-ecourt/eviden-skp dan /unduh) tetap menjalankan kodenya sendiri
 * dan hanya menyerahkan permintaan ber-?jenis= selain hakim (SKP Pimpinan
 * Ketua/Wakil) ke sini; tanpa ?jenis= atau jenis=hakim perilaku dan haknya
 * (kemampuan panel) tidak berubah sedikit pun.
 *
 * URUTAN PEMERIKSAAN (yang tidak berwenang tidak diberi tahu bentuk alamat
 * yang benar, dan data SIPP tidak dibaca untuknya):
 *   1. sesi (401)
 *   2. hakim / pimpinan: kemampuan "panel" (403) - isinya eviden hakim
 *   3. bentuk alamat (400)
 *   4. hak lihat pegawai (403, bolehLihatSkp) - jabatan perkara dan pimpinan
 *   5. data SIPP (kalimat bot diteruskan dengan kodenya)
 */

export function jenisDiAlamat(request: NextRequest): string {
  return (request.nextUrl.searchParams.get("jenis") ?? "").trim().toLowerCase() || "hakim";
}

/** Permintaan ber-?jenis= selain hakim diserahkan rute lama ke penangan SKP baru. */
export function bukanJenisHakim(request: NextRequest): boolean {
  return jenisDiAlamat(request) !== "hakim";
}

function bacaPermintaan(request: NextRequest, hariIni: string, sebagaiDaftar: boolean) {
  const params = new URLSearchParams(request.nextUrl.searchParams);
  if (sebagaiDaftar) {
    if (!params.get("dokumen")) params.set("dokumen", "semua");
    if (!params.get("format")) params.set("format", "pdf");
  }
  const permintaan = bacaPermintaanUnduhSkp(params, hariIni);
  if (!permintaan.ok) throw new ApiError(400, permintaan.pesan);
  return { permintaan: permintaan.nilai, params };
}

async function siapkanDariPermintaan(
  db: NonNullable<Awaited<ReturnType<typeof getDatabase>>>,
  aktor: Awaited<ReturnType<typeof bacaAktorSkp>>["aktor"],
  p: PermintaanUnduhSkp,
  params: URLSearchParams
): Promise<HasilSiapSkp> {
  if (p.jenis === "hakim") throw new ApiError(400, "Jenis hakim tidak melalui penyiapan Lembar SKP.");
  const pegawaiUserId = p.pegawai ?? (p.jenis === "pimpinan" ? aktor.userId : "");
  if (!pegawaiUserId) throw new ApiError(400, "Pegawai harus diisi dengan ID pengguna.");
  return siapkanSkp(db, aktor, {
    jenis: p.jenis,
    pegawaiUserId,
    idSipp: p.id,
    tahun: p.tahun,
    periode: p.periode,
    sertakanTambahan: p.sertakanTambahan,
    langsung: ["1", "ya", "true"].includes(String(params.get("langsung") ?? "").toLowerCase()),
    ketat: true,
    denganDataHakim: p.jenis === "pimpinan",
  });
}

function susunPaket(siap: HasilSiapSkp, p: PermintaanUnduhSkp): PaketEvidenSkp {
  try {
    if (p.jenis === "pimpinan") {
      if (!siap.dataHakim) {
        throw new ApiError(409, "Penetapan SKP Pimpinan ini tidak memuat data eviden hakim; hitung ulang secara langsung (?langsung=1).");
      }
      return susunPaketSkpPimpinan(siap.hasil, siap.dataHakim);
    }
    return susunPaketSkpJabatan(siap.hasil);
  } catch (galat) {
    if (galat instanceof ApiError) throw galat;
    throw new ApiError(
      500,
      `Dokumen SKP tidak dapat disusun dari data SIPP${galat instanceof Error && galat.message ? `: ${galat.message}` : "."}`
    );
  }
}

/** GET ...unduh?jenis=&id=&pegawai=&tahun=&periode=&dokumen=&format=[&tanggal=][&tambahan=0][&langsung=1] */
export async function tanganiUnduhSkp(request: NextRequest): Promise<Response> {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const { aktor, pengguna } = await bacaAktorSkp(db, actorUserId);
    const jenisAlamat = jenisDiAlamat(request);
    if (jenisAlamat === "hakim" || jenisAlamat === "pimpinan") await pastikanKapabilitas(db, actorUserId, "panel");

    const hariIni = waktuPengadilan().tanggal;
    const { permintaan: p, params } = bacaPermintaan(request, hariIni, false);
    const tanggal = p.tanggal ?? hariIni;

    let paket: PaketEvidenSkp;
    let kunciPemilik: string;
    let nama: string;
    let aksiAudit = "SKP_UNDUH";
    let tambahanAudit: Record<string, unknown> = {};

    if (p.jenis === "hakim") {
      const data = await ambilDataEvidenSkpPeriode({ peran: "hakim", id: String(p.id), tahun: p.tahun, periode: p.periode });
      if (!data.ok) {
        const status = data.status >= 400 && data.status <= 599 ? data.status : 502;
        throw new ApiError(status, data.alasan || "Data eviden SKP tidak dapat dibaca dari SIPP. Coba lagi beberapa saat lagi.");
      }
      try {
        paket = susunPaketEvidenSkp(data.data);
      } catch (galat) {
        throw new ApiError(
          500,
          `Dokumen eviden SKP tidak dapat disusun dari data SIPP${galat instanceof Error && galat.message ? `: ${galat.message}` : "."}`
        );
      }
      kunciPemilik = `hakim:${p.id}`;
      nama = paket.orang.nama;
      aksiAudit = "EVIDEN_SKP_UNDUH";
      tambahanAudit = { peran: "hakim", id: p.id };
    } else {
      const siap = await siapkanDariPermintaan(db, aktor, p, params);
      paket = susunPaket(siap, p);
      kunciPemilik = `${p.jenis}:${siap.pegawai.userId}`;
      nama = siap.pegawai.nama;
      tambahanAudit = {
        pemilik: siap.pegawai.userId,
        alasanHak: siap.hak.alasan,
        dariPenetapan: siap.dariPenetapan,
        ...(p.id !== null ? { id: p.id } : {}),
      };
    }

    const instansi = await getInstitutionIdentityFromDb(db).catch(() => null);
    const logo = await bacaLogoKop();
    const hasil = await susunUnduhanEvidenSkp({
      paket,
      dokumen: p.dokumen,
      format: p.format,
      opsi: {
        instansi,
        tanggalTandaTangan: tanggal,
        sebutanOrang: p.jenis === "hakim" ? SEBUTAN_PERAN_EVIDEN_SKP.hakim : sebutanOrangSkp(p.jenis),
        logo,
      },
    });
    if (!hasil.ok) throw new ApiError(hasil.status, hasil.pesan);

    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: aksiAudit,
      entityType: p.jenis === "hakim" ? "petugas" : "skp",
      entityId: kunciPemilik,
      payload: {
        jenis: p.jenis,
        nama,
        tahun: p.tahun,
        periode: p.periode,
        dokumen: p.dokumen,
        format: p.format,
        tanggalTandaTangan: tanggal,
        namaBerkas: hasil.nama,
        dokumenIkut: hasil.dokumen,
        byte: hasil.isi.length,
        oleh: pengguna.name || "",
        ...tambahanAudit,
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
      action: "SKP_UNDUH_FAILED",
      feature: "skp",
    });
  }
}

/** GET ...daftar?jenis=&id=&pegawai=&tahun=&periode= : dokumen yang dapat diunduh (menu unduhan). */
export async function tanganiDaftarSkp(request: NextRequest): Promise<Response> {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const { aktor } = await bacaAktorSkp(db, actorUserId);
    const jenisAlamat = jenisDiAlamat(request);
    if (jenisAlamat === "hakim" || jenisAlamat === "pimpinan") await pastikanKapabilitas(db, actorUserId, "panel");

    const { permintaan: p, params } = bacaPermintaan(request, waktuPengadilan().tanggal, true);

    let paket: PaketEvidenSkp;
    let catatanOperator: string[] = [];
    let penetapan: { status: string; dikunciPada: string | null } | null = null;
    let dariPenetapan = false;

    if (p.jenis === "hakim") {
      const data = await ambilDataEvidenSkpPeriode({ peran: "hakim", id: String(p.id), tahun: p.tahun, periode: p.periode });
      if (!data.ok) throw new ApiError(data.status, data.alasan);
      paket = susunPaketEvidenSkp(data.data);
      catatanOperator = data.data.catatanOperator ?? [];
    } else {
      const siap = await siapkanDariPermintaan(db, aktor, p, params);
      paket = susunPaket(siap, p);
      catatanOperator = siap.catatanOperator;
      dariPenetapan = siap.dariPenetapan;
      penetapan = siap.penetapan ? { status: siap.penetapan.status, dikunciPada: siap.penetapan.dikunciPada } : null;
    }

    return ok({
      jenis: p.jenis,
      periode: paket.periode,
      orang: paket.orang,
      ketua: paket.ketua,
      dokumen: paket.dokumen.map((d) => ({
        kunci: d.kunci,
        judul: d.judul,
        judulLengkap: d.judulLengkap,
        tersedia: d.tersedia,
        sebabTidakTersedia: d.sebabTidakTersedia ?? null,
        jumlahBaris: d.tabel.baris.length,
      })),
      galat: paket.galat,
      // Untuk PETUGAS di menu - tidak tercetak di dokumen yang ditandatangani.
      catatanOperator,
      penetapan,
      dariPenetapan,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SKP_DAFTAR_FAILED",
      feature: "skp",
    });
  }
}
