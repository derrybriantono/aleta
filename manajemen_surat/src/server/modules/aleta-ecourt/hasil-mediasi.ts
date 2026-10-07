/**
 * ============================================================================
 * HASIL MEDIASI OTOMATIS (.rtf) - BAHAN SIPP DAN DRAF MEDIATOR (7 Okt 2026)
 * ============================================================================
 *
 * Rute /api/aleta-ecourt/hasil-mediasi memakai berkas ini untuk dua hal:
 *
 *   bacaBahan   data SIPP perkara itu - pertemuan dan mediator dari jadwal
 *               mediasi, identitas para pihak, anak, majelis. HANYA DIBACA.
 *   simpanDraf  pilihan mediator di pop-up, supaya dapat dibuka lagi.
 *
 * Tidak ada yang ditulis ke SIPP atau e-Court. Naskahnya disusun di peramban
 * (lib/hasil-mediasi.ts) - peladen hanya menyediakan bahan dan menyimpan
 * pilihan.
 *
 * ============================================================================
 * TANPA TABEL BARU
 * ============================================================================
 *
 * Draf disimpan di aleta_ekstensi_setelan (migrasi 0052, kunci per pengguna)
 * dengan kunci "portal:hasil-mediasi:<perkaraId>" - pola yang sama dengan
 * bawaan Tampilan Jadwal Sidang (tampilan-jadwal-bawaan.ts). Kuncinya di luar
 * daftar putih setelan ekstensi, sehingga tidak pernah terkirim ke ekstensi
 * (bacaSetelanPengguna menyaring kunci yang tidak diizinkan). Drafnya milik
 * MEDIATOR yang menyusunnya: dua mediator satu perkara masing-masing punya
 * drafnya sendiri.
 *
 * ============================================================================
 * HANYA MEDIATOR PERKARA ITU - DIPERIKSA DI SINI JUGA, BUKAN HANYA DI LAYAR
 * ============================================================================
 *
 * Tombolnya disembunyikan dari selain mediator, tetapi rute yang hanya
 * bersandar pada layar terbuka bagi siapa pun yang mengetik alamatnya. Nama
 * mediator dibaca ULANG dari SIPP (jadwal mediasi perkara itu) dan dicocokkan
 * dengan nama akun - aturan yang sama dengan layar, bolehBuatHasilMediasi.
 */

import {
  bolehBuatHasilMediasi,
  type BahanHasilMediasi,
  type PertemuanSipp,
  type PihakSipp,
} from "@/lib/hasil-mediasi";
import { getEffectiveRoleId } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import {
  getGatewayIdentitasPihak,
  getGatewayJadwalMediasi,
  getGatewayPraperiksaFakta,
  type GatewayJadwalMediasi,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { ApiError } from "@/server/shared/errors";

export const AWALAN_KUNCI_DRAF = "portal:hasil-mediasi:";
/** Draf terbesar yang diterima - pilihan pop-up jauh di bawahnya. */
export const BATAS_BITA_DRAF = 200_000;

type Aktor = UserPersona;

const teks = (x: unknown) => String(x ?? "").trim();

function isoHari(geser: number): string {
  const t = new Date();
  t.setDate(t.getDate() + geser);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/**
 * Seluruh pertemuan mediasi perkara itu dari SIPP.
 *
 * Bot menyaring menurut RENTANG tanggal pertemuan, jadi rentangnya dibuat
 * lebar (setahun ke belakang, empat bulan ke depan) dan disaring dengan nomor
 * perkara. Tenggang mediasi 30 hari - setahun jauh melampauinya.
 */
async function pertemuanPerkara(nomorPerkara: string, mediasiId: string): Promise<GatewayJadwalMediasi[]> {
  const hasil = await getGatewayJadwalMediasi({ dari: isoHari(-400), sampai: isoHari(120), cari: nomorPerkara, batas: 100 });
  if (!hasil.ok) {
    throw new ApiError(503, hasil.error || "ALETA Bot belum dapat dihubungi - jadwal mediasi tidak terbaca.");
  }
  const semua = (hasil.data?.mediasi ?? []).filter((x) => teks(x.nomorPerkara) === nomorPerkara);
  const sama = mediasiId ? semua.filter((x) => teks(x.mediasiId) === mediasiId) : [];
  return sama.length ? sama : semua;
}

/** 403 bila akun ini bukan mediator perkara itu (dan bukan Super Admin). */
export function pastikanMediator(aktor: Aktor, mediatorTeks: string) {
  const boleh = bolehBuatHasilMediasi({ nama: aktor.name, peran: String(getEffectiveRoleId(aktor) || "") }, mediatorTeks);
  if (!boleh) {
    throw new ApiError(
      403,
      "Hasil mediasi hanya dapat disusun oleh mediator perkara ini" +
        (mediatorTeks ? ` (${mediatorTeks.replace(/<br\s*\/?>/gi, "; ")})` : "") +
        ". Nama akun Anda tidak cocok dengan nama mediator di SIPP."
    );
  }
}

function kunciDraf(perkaraId: string, nomorPerkara: string) {
  return `${AWALAN_KUNCI_DRAF}${perkaraId || nomorPerkara}`;
}

async function bacaDraf(db: AletaDatabase, penggunaId: string, kunci: string): Promise<{ isi: unknown; diubahPada: string } | null> {
  const baris = await db
    .prepare("SELECT nilai, diubah_pada FROM aleta_ekstensi_setelan WHERE pengguna_id = ? AND kunci = ?")
    .all<{ nilai: string; diubah_pada: string }>(penggunaId, kunci);
  if (!baris[0]) return null;
  try {
    return { isi: JSON.parse(baris[0].nilai), diubahPada: String(baris[0].diubah_pada ?? "") };
  } catch {
    return null;
  }
}

/** Bahan SIPP + draf tersimpan untuk satu perkara. */
export async function bacaBahanHasilMediasi(
  db: AletaDatabase,
  aktor: Aktor,
  masukan: { nomorPerkara: string; mediasiId: string; namaPengadilan: string }
) {
  const nomorPerkara = teks(masukan.nomorPerkara);
  if (!nomorPerkara) throw new ApiError(400, "Nomor perkara wajib diisi.");

  const pertemuan = await pertemuanPerkara(nomorPerkara, teks(masukan.mediasiId));
  if (pertemuan.length === 0) {
    throw new ApiError(404, `Jadwal mediasi perkara ${nomorPerkara} tidak ditemukan di SIPP.`);
  }
  const acuan = pertemuan[pertemuan.length - 1];
  pastikanMediator(aktor, acuan.mediator);

  // Identitas dan fakta perkara: kegagalannya TIDAK menggagalkan pop-up -
  // mediator tetap dapat mengetik sendiri, dan yang tidak terbaca disebut.
  const [identitas, fakta] = await Promise.all([
    getGatewayIdentitasPihak(nomorPerkara).catch(() => null),
    getGatewayPraperiksaFakta(nomorPerkara).catch(() => null),
  ]);
  const tidakTerbaca: string[] = [];
  let pihak: PihakSipp[] = [];
  if (identitas && identitas.ok && Array.isArray((identitas.data as { pihak?: unknown }).pihak)) {
    pihak = ((identitas.data as { pihak: PihakSipp[] }).pihak ?? []).filter((p) => p.pihakKe === 1 || p.pihakKe === 2);
  } else {
    tidakTerbaca.push("identitas para pihak");
  }
  let anak: string[] = [];
  let majelis: Array<{ nama: string; jabatan: string }> = [];
  if (fakta && fakta.ok) {
    anak = (fakta.data.anak ?? []).map(teks).filter(Boolean);
    majelis = (fakta.data.majelis ?? []).map((m) => ({ nama: teks(m.nama), jabatan: teks(m.jabatan) }));
  } else {
    tidakTerbaca.push("anak dan majelis");
  }

  const bahan: BahanHasilMediasi = {
    nomorPerkara,
    perkaraId: teks(acuan.perkaraId),
    mediasiId: teks(acuan.mediasiId),
    jenisPerkara: teks(acuan.jenisPerkara),
    alurPerkaraId: acuan.alurPerkaraId ?? null,
    jenisPerkaraId: acuan.jenisPerkaraId ?? null,
    mediator: teks(acuan.mediator),
    penetapanMediator: teks(acuan.penetapanMediator),
    pertemuan: pertemuan.map(
      (x): PertemuanSipp => ({
        tanggal: teks(x.tanggal),
        jam: teks(x.jam),
        sampaiJam: teks(x.sampaiJam),
        tempat: teks(x.tempat),
        ditunda: x.ditunda === true,
        dihadiri: teks(x.dihadiri),
      })
    ),
    pihak,
    namaPenggugat: acuan.pihak?.penggugat ?? [],
    namaTergugat: acuan.pihak?.tergugat ?? [],
    anak,
    majelis,
    namaPengadilan: teks(masukan.namaPengadilan),
  };

  const draf = await bacaDraf(db, aktor.id, kunciDraf(bahan.perkaraId, nomorPerkara));
  return { bahan, draf: draf?.isi ?? null, drafDiubahPada: draf?.diubahPada ?? "", tidakTerbaca };
}

/** Menyimpan pilihan pop-up. Mediator diperiksa ulang dari SIPP. */
export async function simpanDrafHasilMediasi(
  db: AletaDatabase,
  aktor: Aktor,
  masukan: { nomorPerkara: string; mediasiId: string; draf: unknown }
) {
  const nomorPerkara = teks(masukan.nomorPerkara);
  if (!nomorPerkara) throw new ApiError(400, "Nomor perkara wajib diisi.");
  if (!masukan.draf || typeof masukan.draf !== "object" || Array.isArray(masukan.draf)) {
    throw new ApiError(400, "Draf hasil mediasi tidak terbaca.");
  }
  const json = JSON.stringify(masukan.draf);
  if (json.length > BATAS_BITA_DRAF) throw new ApiError(413, "Draf hasil mediasi terlalu besar untuk disimpan.");

  const pertemuan = await pertemuanPerkara(nomorPerkara, teks(masukan.mediasiId));
  if (pertemuan.length === 0) throw new ApiError(404, `Jadwal mediasi perkara ${nomorPerkara} tidak ditemukan di SIPP.`);
  const acuan = pertemuan[pertemuan.length - 1];
  pastikanMediator(aktor, acuan.mediator);

  const pada = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (pengguna_id, kunci) DO UPDATE SET nilai = excluded.nilai, diubah_pada = excluded.diubah_pada"
    )
    .run(aktor.id, kunciDraf(teks(acuan.perkaraId), nomorPerkara), json, pada);
  return { tersimpan: true, diubahPada: pada };
}
