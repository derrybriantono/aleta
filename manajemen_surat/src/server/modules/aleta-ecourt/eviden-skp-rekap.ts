import { type NextRequest } from "next/server";

import { peranRekapEvidenCadangan, susunPaketEvidenRekap, type PeranRekapEviden } from "@/lib/eviden-skp-rekap";
import type { KetuaEvidenSkp, PaketEvidenSkp } from "@/lib/eviden-skp-tipe";
import {
  PESAN_PERIODE_BELUM_DIMULAI,
  SEMUA_DOKUMEN_EVIDEN_SKP,
  bacaTanggalIso,
  dispositionLampiran,
  formatEvidenSkpSah,
  mulaiPeriodeSkpJabatan,
  periodeSkpJabatanSah,
  susunPeriodeSkpJabatan,
} from "@/lib/eviden-skp-unduh";
import { SEBUTAN_PERAN, bacaIdSipp, type BarisRekap, type RekapPetugas } from "@/lib/rekap-petugas";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase, type AletaDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaLogoKop, susunUnduhanEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-unduhan";
import { getGatewayRekapPetugas } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
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
 * EVIDEN SKP DARI REKAP PETUGAS - RUTE DAFTAR DAN UNDUH (27 Okt 2026)
 * ============================================================================
 *
 *   GET .../rekap-petugas/eviden?aksi=daftar|unduh&peran=panitera|jurusita|mediator&id=
 *       &tahun=&periode=(b01..b12|tw1..tw4|tahun)&dokumen=&format=[&tanggal=]
 *
 * Hak SAMA dengan tombol hakim dan halaman rekapnya: kemampuan "panel" (siapa
 * yang boleh membaca Status Perkara boleh membaca siapa menanganinya). Isinya
 * dibaca dari rekap petugas di bot, lalu disusun menjadi satu dokumen
 * (lib/eviden-skp-rekap) dan digambar dengan penggambar eviden yang sama.
 */

/** Halaman daftar perkara dibaca bertahap (200 baris/halaman); sekian halaman paling banyak. */
export const HALAMAN_MAKS_EVIDEN_REKAP = 15;
const BATAS_HALAMAN = 200;

export type BacaanRekapEviden = {
  nama: string;
  baris: BarisRekap[];
  ambangHari: number;
  dihitungPada: string;
  galat: string[];
};

type JawabanRekap = { ok: true; data: RekapPetugas } | { ok: false; error: string };

/** Seluruh daftar perkara orang itu (semua tahun), halaman demi halaman; `ambil` disuntikkan supaya dapat diuji tanpa bot. */
export async function bacaRekapUntukEviden(
  peran: PeranRekapEviden,
  id: number,
  ambil: (lewati: number) => Promise<JawabanRekap> = (lewati) =>
    getGatewayRekapPetugas({ peran, id, tahun: "", keadaan: "", kedudukan: "", lewati, batas: BATAS_HALAMAN })
): Promise<BacaanRekapEviden> {
  const baris: BarisRekap[] = [];
  let pertama: RekapPetugas | null = null;
  const galat: string[] = [];
  for (let halaman = 0; halaman < HALAMAN_MAKS_EVIDEN_REKAP; halaman += 1) {
    const jawaban = await ambil(halaman * BATAS_HALAMAN);
    if (!jawaban.ok) {
      if (!pertama) {
        throw new ApiError(/^Tidak ada .+ dengan ID SIPP/i.test(jawaban.error) ? 404 : 502, jawaban.error || "ALETA Bot belum dapat dihubungi.");
      }
      galat.push("sebagian halaman daftar perkara tidak dapat dibaca dari ALETA Bot");
      break;
    }
    const rekap = jawaban.data;
    pertama ??= rekap;
    baris.push(...(rekap.daftar?.baris ?? []));
    if (!rekap.daftar?.adaLagi) break;
    if (halaman === HALAMAN_MAKS_EVIDEN_REKAP - 1) galat.push(`daftar perkara dipotong pada ${baris.length} baris`);
  }
  if (!pertama) throw new ApiError(502, "Rekap petugas tidak dapat dibaca.");
  if (!pertama.perkaraTerbaca) galat.push("perkara orang ini tidak dapat dibaca dari SIPP");
  for (const t of pertama.takTerbaca ?? []) galat.push(String(t.bagian));
  return {
    nama: pertama.identitas?.nama || `${SEBUTAN_PERAN[peran]} ${id}`,
    baris,
    ambangHari: peran === "mediator" ? (pertama.ambang?.mediasiHari ?? 30) : (pertama.ambang?.lamaPerkaraHari ?? 150),
    dihitungPada: pertama.dihitungPada || new Date().toISOString(),
    galat,
  };
}

async function bacaKetua(db: AletaDatabase): Promise<KetuaEvidenSkp | null> {
  const baris = await db
    .queryOne<{ name: string; nip: string | null; jabatan: string | null }>(
      `SELECT u.name, u.nip, p.name AS jabatan
         FROM users u LEFT JOIN positions p ON p.id = u.position_id
        WHERE u.role_id = 'ketua' AND u.is_active = 1 AND u.deleted_at IS NULL
        ORDER BY u.name ASC LIMIT 1`
    )
    .catch(() => null);
  if (!baris) return null;
  return { nama: baris.name, nip: baris.nip, jabatan: baris.jabatan?.trim() || "Ketua", sumber: "Pengguna ALETA berperan Ketua" };
}

export function bacaParameterEvidenRekap(p: URLSearchParams, hariIni: string = waktuPengadilan().tanggal) {
  const peran = String(p.get("peran") ?? "").trim().toLowerCase();
  if (!peranRekapEvidenCadangan(peran)) throw new ApiError(400, "Peran harus panitera, jurusita, atau mediator.");
  const id = bacaIdSipp(p.get("id"));
  if (id === null) throw new ApiError(400, "ID SIPP harus bilangan bulat positif.");
  const tahunTeks = String(p.get("tahun") ?? "").trim();
  const tahun = Number(tahunTeks);
  if (!/^\d{4}$/.test(tahunTeks) || tahun < 2000 || tahun > 2100) throw new ApiError(400, "Tahun harus empat angka antara 2000 dan 2100.");
  const periode = String(p.get("periode") ?? "").trim().toLowerCase();
  if (!periodeSkpJabatanSah(periode)) throw new ApiError(400, "Periode harus b01 sampai b12, tw1, tw2, tw3, tw4, atau tahun.");
  if (mulaiPeriodeSkpJabatan(periode, tahun) > hariIni) throw new ApiError(400, PESAN_PERIODE_BELUM_DIMULAI);
  const dokumen = String(p.get("dokumen") ?? SEMUA_DOKUMEN_EVIDEN_SKP).trim() || SEMUA_DOKUMEN_EVIDEN_SKP;
  const formatTeks = String(p.get("format") ?? "pdf").trim().toLowerCase();
  if (!formatEvidenSkpSah(formatTeks)) throw new ApiError(400, "Format harus pdf, xlsx, atau docx.");
  const tanggalTeks = String(p.get("tanggal") ?? "").trim();
  const tanggal = tanggalTeks ? bacaTanggalIso(tanggalTeks) : hariIni;
  if (!tanggal) throw new ApiError(400, "Tanggal tanda tangan harus tanggal kalender yang sah (TTTT-BB-HH).");
  return { peran, id, tahun, periode, dokumen, format: formatTeks, tanggal, aksi: String(p.get("aksi") ?? "daftar") };
}

async function susunPaket(db: AletaDatabase, b: ReturnType<typeof bacaParameterEvidenRekap>): Promise<PaketEvidenSkp> {
  const rekap = await bacaRekapUntukEviden(b.peran, b.id);
  return susunPaketEvidenRekap({
    peran: b.peran,
    orang: { id: String(b.id), nama: rekap.nama },
    periode: susunPeriodeSkpJabatan(b.periode, b.tahun),
    baris: rekap.baris,
    ambangHari: rekap.ambangHari,
    ketua: await bacaKetua(db),
    dihitungPada: rekap.dihitungPada,
    galat: rekap.galat,
  });
}

export async function tanganiEvidenRekap(request: NextRequest): Promise<Response> {
  let db: AletaDatabase | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    // Kewenangan lebih dahulu (sama dengan tombol hakim), baru bentuk alamat.
    await pastikanKapabilitas(db, actorUserId, "panel");
    const b = bacaParameterEvidenRekap(request.nextUrl.searchParams);
    const paket = await susunPaket(db, b);

    if (b.aksi !== "unduh") {
      return ok({
        jenis: b.peran,
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
        catatanOperator: ["Disusun dari rekap petugas karena akun SIPP orang ini belum ditautkan ke pegawai di Pemetaan SKP."],
        penetapan: null,
        dariPenetapan: false,
      });
    }

    const instansi = await getInstitutionIdentityFromDb(db).catch(() => null);
    const hasil = await susunUnduhanEvidenSkp({
      paket,
      dokumen: b.dokumen,
      format: b.format,
      opsi: { instansi, tanggalTandaTangan: b.tanggal, sebutanOrang: SEBUTAN_PERAN[b.peran], logo: await bacaLogoKop() },
    });
    if (!hasil.ok) throw new ApiError(hasil.status, hasil.pesan);

    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: "EVIDEN_SKP_REKAP_UNDUH",
      entityType: "petugas",
      entityId: `${b.peran}:${b.id}`,
      payload: {
        peran: b.peran,
        id: b.id,
        nama: paket.orang.nama,
        tahun: b.tahun,
        periode: b.periode,
        dokumen: b.dokumen,
        format: b.format,
        namaBerkas: hasil.nama,
        byte: hasil.isi.length,
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
      action: "EVIDEN_SKP_REKAP_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
