import { randomUUID } from "node:crypto";

import {
  bagianDariParagraf,
  bagianDariTeksBebas,
  bagianTerlarang,
  bangunRtf,
  bawaKeputusan,
  bolehBuatBlangkoSendiri,
  daftarIsianPaket,
  deteksiIsian,
  gabungBarisPdf,
  jenisBlangkoSah,
  namaBerkasAman,
  ringkasPemetaan,
  superAdminKah,
  susunDaftarIsianTxt,
  terapkanPemetaan,
  terapkanKeputusan,
  terimaUsulanYakin,
  usulkanPemetaan,
  type BagianSendiri,
  type ButirDaftarPaket,
  type ButirPemetaan,
  type JenisBlangkoSendiri,
  type KatalogVariabel,
  type KeputusanButir,
  type RingkasPemetaan,
} from "@/lib/blangko-sendiri";
import { ambilDariZip, bacaDocxXml, bacaRtfParagraf } from "@/lib/deteksi-sisa-blangko";
import { buatDocx, type AlineaDocx } from "@/lib/docx";
import { penandaDalam } from "@/lib/penyelesai-variabel";
import type { BagianBlangko } from "@/lib/pustaka-blangko";
import type { AletaDatabase } from "@/server/db/client";
import { bacaPdfDariBita } from "@/server/modules/aleta-ecourt/baca-pdf";
import { kenaliBentukNaskah } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { isianPerkara } from "@/server/modules/aleta-ecourt/isian-perkara";
import { isiNaskah, lengkapiDariAbt, selesaikanPenanda } from "@/server/modules/aleta-ecourt/penyelesai";
import { cariPerkaraContoh } from "@/server/modules/pengaturan-abt/service";
import { ApiError } from "@/server/shared/errors";

/**
 * ============================================================================
 * BUAT BLANGKO SENDIRI (18 Okt 2026)
 * ============================================================================
 *
 * Blangko pribadi milik akun hakim, panitera, atau konseptor: disunting di
 * portal atau diunggah (RTF/DOCX/PDF), dibaca menjadi paragraf, isiannya
 * dikenali dan dipetakan ke isian ABT yang SUDAH ADA, lalu diekspor ke
 * blangko Putusan Mandiri atau diajukan sebagai paket untuk folder blangko ABT.
 *
 * MEMAKAI ULANG, BUKAN MENULIS ULANG
 *   pembaca RTF/DOCX      deteksi-sisa-blangko (bacaRtfParagraf, bacaDocxXml)
 *   pembaca PDF           baca-pdf (pdfjs) - teks saja
 *   penyelesai isian      penyelesai (kamus ALETA lalu mesin ABT) - pratinjau
 *   katalog isian ABT     aleta_kamus_variabel (salinan abt_variabel)
 *   pembuat DOCX          docx
 *
 * JALUR KE ABT
 *   Folder blangko ABT hanya DIBACA oleh ALETA (aturan lama) dan tidak ada
 *   mekanisme tulis berkas blangko yang aman. Maka ekspor ke ABT berbentuk
 *   PAKET (RTF + daftar isian) yang diajukan pemilik dan dipasang manual oleh
 *   Super Admin sesudah menyetujui. Isian baru yang belum ada di ABT tidak
 *   dibuat otomatis: hanya diusulkan, dan tercetak "..." pada RTF.
 *
 * HAK
 *   Pemilik mengubah segalanya. Super Admin boleh membuka, melihat pratinjau,
 *   mengunduh, memutus paket, dan menghapus - tetapi TIDAK mengubah isi atau
 *   pemetaan blangko orang lain. Orang lain tidak melihatnya sama sekali.
 */

const teks = (nilai: unknown): string => String(nilai ?? "").trim();
const angka = (nilai: unknown): number => Number(nilai ?? 0) || 0;

export const BATAS_BERKAS_BLANGKO = 8 * 1024 * 1024;
const BATAS_ISIAN = 1500;
const BATAS_JSON = 4 * 1024 * 1024;

export type AktorBlangko = { id: string; name?: string | null; roleId?: string | null };

export type PaketBlangko = {
  status: "tidak" | "menunggu" | "disetujui" | "ditolak";
  diajukanAt: string;
  diputuskanOleh: string;
  diputuskanAt: string;
  catatan: string;
};

export type RingkasBlangkoPribadi = {
  id: string;
  nama: string;
  jenis: string;
  asal: string;
  berkasAsal: string;
  keadaan: string;
  untukPutusanMandiri: boolean;
  paketStatus: PaketBlangko["status"];
  versi: number;
  jumlahBagian: number;
  jumlahIsian: number;
  belumDiputus: number;
  pemilikId: string;
  pemilikNama: string;
  milikSaya: boolean;
  dibuatAt: string;
  diubahAt: string;
};

export type RincianBlangkoPribadi = RingkasBlangkoPribadi & {
  bagian: BagianSendiri[];
  pemetaan: ButirPemetaan[];
  ringkasPemetaan: RingkasPemetaan;
  peringatan: string[];
  paket: PaketBlangko;
  hak: { ubah: boolean; putuskanPaket: boolean };
};

// ============================================================================
// Hak
// ============================================================================

function peranAktor(aktor: AktorBlangko): string {
  return teks(aktor.roleId);
}

/** Hanya peran yang diizinkan membuat/memakai blangko sendiri (dan Super Admin). */
export function pastikanBolehBlangkoSendiri(aktor: AktorBlangko) {
  if (!aktor?.id) throw new ApiError(401, "Masuk dulu untuk membuat blangko sendiri.");
  if (!bolehBuatBlangkoSendiri(peranAktor(aktor))) {
    throw new ApiError(403, "Buat blangko sendiri hanya untuk Hakim, Panitera, dan Konseptor (Panitera Pengganti).");
  }
}

function pastikanSuperAdmin(aktor: AktorBlangko, pekerjaan: string) {
  if (!superAdminKah(peranAktor(aktor))) throw new ApiError(403, `Hanya Super Admin yang dapat ${pekerjaan}.`);
}

type BarisBlangko = Record<string, unknown>;

async function muatBaris(db: AletaDatabase, id: string): Promise<BarisBlangko> {
  const baris = await db.queryOne<BarisBlangko>(`SELECT * FROM aleta_blangko_pribadi WHERE id = ?`, [teks(id)]);
  if (!baris) throw new ApiError(404, "Blangko itu tidak ditemukan.");
  return baris;
}

/** Membuka (membaca/mengunduh/pratinjau): pemilik atau Super Admin. Orang lain: seolah tidak ada. */
async function muatUntukBaca(db: AletaDatabase, aktor: AktorBlangko, id: string): Promise<BarisBlangko> {
  pastikanBolehBlangkoSendiri(aktor);
  const baris = await muatBaris(db, id);
  if (teks(baris.pemilik_id) !== teks(aktor.id) && !superAdminKah(peranAktor(aktor))) {
    throw new ApiError(404, "Blangko itu tidak ditemukan.");
  }
  return baris;
}

/** Mengubah: hanya pemilik. Super Admin tidak mengubah blangko orang lain. */
async function muatUntukUbah(db: AletaDatabase, aktor: AktorBlangko, id: string): Promise<BarisBlangko> {
  const baris = await muatUntukBaca(db, aktor, id);
  if (teks(baris.pemilik_id) !== teks(aktor.id)) {
    throw new ApiError(403, "Blangko milik orang lain tidak dapat diubah.");
  }
  return baris;
}

// ============================================================================
// Membaca berkas
// ============================================================================

export type HasilBacaBerkas = {
  bagian: BagianSendiri[];
  asal: "rtf" | "docx" | "pdf";
  peringatan: string[];
};

/**
 * Berkas -> paragraf. RTF diutamakan (batas paragrafnya asli); DOCX juga
 * berparagraf; PDF hanya teks sehingga baris cetak disambung menurut tebakan
 * dan selalu disertai peringatan. Bentuk dikenali dari kepala berkas.
 */
export async function bacaBerkasBlangko(bita: Uint8Array, namaBerkas: string): Promise<HasilBacaBerkas> {
  if (!bita || bita.length === 0) throw new ApiError(400, "Berkasnya kosong.");
  if (bita.length > BATAS_BERKAS_BLANGKO) {
    throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_BERKAS_BLANGKO / 1024 / 1024} MB.`);
  }
  const bentuk = kenaliBentukNaskah(bita);
  const peringatan: string[] = [];
  let paragraf: string[] = [];
  let asal: HasilBacaBerkas["asal"];

  if (bentuk === "rtf") {
    asal = "rtf";
    paragraf = bacaRtfParagraf(new TextDecoder("windows-1252").decode(bita)).map((p) => p.teks);
  } else if (bentuk === "docx") {
    asal = "docx";
    const xml = await ambilDariZip(bita, "word/document.xml").catch(() => null);
    if (!xml) throw new ApiError(422, "Berkas DOCX ini tidak dapat dibaca (isinya rusak atau bukan dokumen Word).");
    paragraf = bacaDocxXml(new TextDecoder("utf-8").decode(xml)).map((p) => p.teks);
  } else if (bentuk === "pdf") {
    asal = "pdf";
    const isi = await bacaPdfDariBita(bita, teks(namaBerkas) || "blangko.pdf");
    if (!isi.ada) throw new ApiError(422, `PDF tidak dapat dibaca: ${isi.sebab}`);
    const baris = isi.halaman.flatMap((h) => h.teks.split(/\r\n|\r|\n/));
    if (baris.every((b) => !b.trim())) {
      throw new ApiError(422, "PDF ini tidak memuat teks (kemungkinan hasil pindaian), jadi tidak ada yang dapat dibaca.");
    }
    paragraf = gabungBarisPdf(baris);
    peringatan.push("PDF hanya dibaca teksnya: batas paragraf, rata, huruf tebal, dan tabel tidak terbawa. Periksa dan rapikan hasilnya.");
    if (isi.halamanKosong.length > 0) peringatan.push(`Halaman tanpa teks (kemungkinan pindaian): ${isi.halamanKosong.join(", ")}.`);
    if (isi.jumlahHalaman > isi.halaman.length) peringatan.push(`Hanya ${isi.halaman.length} dari ${isi.jumlahHalaman} halaman yang dibaca.`);
  } else if (bentuk === "doc") {
    throw new ApiError(422, "Berkas Word lama (.doc) belum dapat dibaca. Simpan ulang sebagai .docx atau .rtf lalu unggah lagi.");
  } else {
    throw new ApiError(400, "Isinya bukan RTF, DOCX, maupun PDF - dikenali dari isi berkas, bukan dari namanya.");
  }

  const { bagian, terpotong } = bagianDariParagraf(paragraf);
  if (bagian.length === 0) throw new ApiError(422, "Tidak ada teks yang dapat dibaca dari berkas ini.");
  if (terpotong) peringatan.push("Berkas terlalu panjang: hanya 4.000 paragraf pertama yang dibaca.");
  return { bagian, asal, peringatan };
}

// ============================================================================
// Katalog isian ABT
// ============================================================================

/** Katalog isian ABT (salinan di kamus). Kosong bila kamus belum disalin - usulan tetap jalan. */
export async function muatKatalogIsian(db: AletaDatabase): Promise<KatalogVariabel[]> {
  type Baris = { no_var: string; nama?: string; arti?: string };
  let baris: Baris[] = [];
  try {
    baris = await db.queryAll<Baris>(`SELECT no_var, nama, arti FROM aleta_kamus_variabel ORDER BY no_var LIMIT 8000`);
  } catch {
    try {
      baris = await db.queryAll<Baris>(`SELECT no_var, nama FROM aleta_kamus_variabel ORDER BY no_var LIMIT 8000`);
    } catch {
      return [];
    }
  }
  return baris
    .map((b) => ({ noVar: teks(b.no_var), judul: teks(b.arti) || teks(b.nama) }))
    .filter((b) => /^\d{3,5}$/.test(b.noVar) && b.judul);
}

// ============================================================================
// Penyimpanan
// ============================================================================

function uraiJson<T>(nilai: unknown, cadangan: T): T {
  try {
    const hasil = JSON.parse(teks(nilai) || "null");
    return (hasil ?? cadangan) as T;
  } catch {
    return cadangan;
  }
}

function keRingkas(baris: BarisBlangko, aktor: AktorBlangko): RingkasBlangkoPribadi {
  const bagian = uraiJson<BagianSendiri[]>(baris.isi_json, []);
  const pemetaan = uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []);
  return {
    id: teks(baris.id),
    nama: teks(baris.nama),
    jenis: teks(baris.jenis),
    asal: teks(baris.asal),
    berkasAsal: teks(baris.berkas_asal),
    keadaan: teks(baris.keadaan),
    untukPutusanMandiri: angka(baris.untuk_putusan_mandiri) === 1,
    paketStatus: (teks(baris.paket_status) || "tidak") as PaketBlangko["status"],
    versi: angka(baris.versi),
    jumlahBagian: bagian.length,
    jumlahIsian: pemetaan.length,
    belumDiputus: pemetaan.filter((b) => b.status === "usulan").length,
    pemilikId: teks(baris.pemilik_id),
    pemilikNama: teks(baris.pemilik_nama),
    milikSaya: teks(baris.pemilik_id) === teks(aktor.id),
    dibuatAt: teks(baris.dibuat_at),
    diubahAt: teks(baris.diubah_at),
  };
}

function keRincian(baris: BarisBlangko, aktor: AktorBlangko): RincianBlangkoPribadi {
  const pemetaan = uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []);
  const milik = teks(baris.pemilik_id) === teks(aktor.id);
  return {
    ...keRingkas(baris, aktor),
    bagian: uraiJson<BagianSendiri[]>(baris.isi_json, []),
    pemetaan,
    ringkasPemetaan: ringkasPemetaan(pemetaan),
    peringatan: uraiJson<string[]>(baris.peringatan_json, []),
    paket: {
      status: (teks(baris.paket_status) || "tidak") as PaketBlangko["status"],
      diajukanAt: teks(baris.paket_diajukan_at),
      diputuskanOleh: teks(baris.paket_diputuskan_oleh),
      diputuskanAt: teks(baris.paket_diputuskan_at),
      catatan: teks(baris.paket_catatan),
    },
    hak: { ubah: milik, putuskanPaket: superAdminKah(peranAktor(aktor)) },
  };
}

async function catat(db: AletaDatabase, blangkoId: string, aktor: AktorBlangko, tindakan: string, ringkas: string) {
  await db.run(
    `INSERT INTO aleta_blangko_pribadi_riwayat (id, blangko_id, tindakan, ringkas, oleh_id, oleh_nama, pada)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), blangkoId, tindakan, ringkas.slice(0, 300), teks(aktor.id), teks(aktor.name), new Date().toISOString()]
  );
}

function periksaNama(nilai: unknown): string {
  const nama = teks(nilai).replace(/\s+/g, " ").slice(0, 120);
  if (!nama) throw new ApiError(400, "Beri nama blangko.");
  return nama;
}

function periksaJenis(nilai: unknown): JenisBlangkoSendiri {
  const jenis = teks(nilai) || "lain";
  if (!jenisBlangkoSah(jenis)) throw new ApiError(400, "Jenis blangko tidak dikenal.");
  return jenis;
}

function siapkanPemetaan(bagian: BagianSendiri[], katalog: KatalogVariabel[], lama: ButirPemetaan[] = []) {
  const isian = deteksiIsian(bagian);
  const peringatan: string[] = [];
  const dipakai = isian.length > BATAS_ISIAN ? isian.slice(0, BATAS_ISIAN) : isian;
  if (isian.length > BATAS_ISIAN) {
    peringatan.push(`Terlalu banyak isian terdeteksi (${isian.length}); hanya ${BATAS_ISIAN} pertama yang dipetakan.`);
  }
  const usulan = usulkanPemetaan(bagian, dipakai, katalog);
  return { pemetaan: lama.length ? bawaKeputusan(usulan, lama) : usulan, peringatan };
}

function peringatanIsi(bagian: BagianSendiri[], bawaan: string[] = []): string[] {
  const daftar = [...bawaan];
  const terlarang = bagianTerlarang(bagian);
  if (terlarang.length > 0) {
    daftar.push(`Paragraf ${terlarang.slice(0, 8).join(", ")} memuat kata nama aplikasi ini. Hapus dulu sebelum blangko dipakai untuk ABT.`);
  }
  return daftar;
}

function pastikanUkuran(bagian: BagianSendiri[], pemetaan: ButirPemetaan[]) {
  if (JSON.stringify(bagian).length + JSON.stringify(pemetaan).length > BATAS_JSON) {
    throw new ApiError(413, "Blangko ini terlalu besar untuk disimpan.");
  }
}

async function simpanBaru(
  db: AletaDatabase,
  aktor: AktorBlangko,
  masukan: { nama: string; jenis: JenisBlangkoSendiri; asal: string; berkasAsal: string; bagian: BagianSendiri[]; peringatan: string[] }
): Promise<RincianBlangkoPribadi> {
  const katalog = await muatKatalogIsian(db);
  const { pemetaan, peringatan: pp } = siapkanPemetaan(masukan.bagian, katalog);
  pastikanUkuran(masukan.bagian, pemetaan);
  const id = `bp_${randomUUID()}`;
  const sekarang = new Date().toISOString();
  await db.run(
    `INSERT INTO aleta_blangko_pribadi
       (id, pemilik_id, pemilik_nama, nama, jenis, asal, berkas_asal, keadaan, untuk_putusan_mandiri,
        isi_json, pemetaan_json, peringatan_json, paket_status, versi, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draf', 0, ?, ?, ?, 'tidak', 1, ?, ?)`,
    [
      id,
      teks(aktor.id),
      teks(aktor.name),
      masukan.nama,
      masukan.jenis,
      masukan.asal,
      masukan.berkasAsal,
      JSON.stringify(masukan.bagian),
      JSON.stringify(pemetaan),
      JSON.stringify(peringatanIsi(masukan.bagian, [...masukan.peringatan, ...pp])),
      sekarang,
      sekarang,
    ]
  );
  await catat(db, id, aktor, "buat", `${masukan.asal}: ${masukan.bagian.length} paragraf, ${pemetaan.length} isian`);
  return keRincian(await muatBaris(db, id), aktor);
}

export async function buatDariBerkas(
  db: AletaDatabase,
  aktor: AktorBlangko,
  masukan: { bita: Uint8Array; namaBerkas: string; nama?: string; jenis?: unknown }
): Promise<RincianBlangkoPribadi> {
  pastikanBolehBlangkoSendiri(aktor);
  const jenis = periksaJenis(masukan.jenis);
  const dasarNama = teks(masukan.namaBerkas).replace(/\.(rtf|docx?|pdf)$/i, "");
  const nama = periksaNama(masukan.nama || dasarNama || "Blangko saya");
  const baca = await bacaBerkasBlangko(masukan.bita, masukan.namaBerkas);
  return simpanBaru(db, aktor, {
    nama,
    jenis,
    asal: baca.asal,
    berkasAsal: teks(masukan.namaBerkas).slice(0, 200),
    bagian: baca.bagian,
    peringatan: baca.peringatan,
  });
}

export async function buatDariTeks(
  db: AletaDatabase,
  aktor: AktorBlangko,
  masukan: { nama: unknown; jenis?: unknown; teks: unknown }
): Promise<RincianBlangkoPribadi> {
  pastikanBolehBlangkoSendiri(aktor);
  const { bagian } = bagianDariTeksBebas(teks(masukan.teks));
  if (bagian.length === 0) throw new ApiError(400, "Isi blangko masih kosong.");
  return simpanBaru(db, aktor, {
    nama: periksaNama(masukan.nama),
    jenis: periksaJenis(masukan.jenis),
    asal: "sunting",
    berkasAsal: "",
    bagian,
    peringatan: [],
  });
}

export async function daftarBlangko(
  db: AletaDatabase,
  aktor: AktorBlangko,
  opsi: { semua?: boolean } = {}
): Promise<RingkasBlangkoPribadi[]> {
  pastikanBolehBlangkoSendiri(aktor);
  const semua = Boolean(opsi.semua) && superAdminKah(peranAktor(aktor));
  const baris = semua
    ? await db.queryAll<BarisBlangko>(`SELECT * FROM aleta_blangko_pribadi ORDER BY diubah_at DESC LIMIT 500`)
    : await db.queryAll<BarisBlangko>(`SELECT * FROM aleta_blangko_pribadi WHERE pemilik_id = ? ORDER BY diubah_at DESC LIMIT 500`, [
        teks(aktor.id),
      ]);
  return baris.map((b) => keRingkas(b, aktor));
}

export async function ambilBlangko(db: AletaDatabase, aktor: AktorBlangko, id: string): Promise<RincianBlangkoPribadi> {
  return keRincian(await muatUntukBaca(db, aktor, id), aktor);
}

async function tulisPerubahan(
  db: AletaDatabase,
  baris: BarisBlangko,
  ubah: { nama?: string; jenis?: string; bagian?: BagianSendiri[]; pemetaan?: ButirPemetaan[]; peringatan?: string[]; keadaan?: string; mandiri?: boolean }
) {
  const bagian = ubah.bagian ?? uraiJson<BagianSendiri[]>(baris.isi_json, []);
  const pemetaan = ubah.pemetaan ?? uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []);
  pastikanUkuran(bagian, pemetaan);
  // Setiap ubahan membatalkan paket yang sudah diajukan/diputus: yang disetujui harus sama dengan yang tersimpan.
  const isiBerubah = ubah.bagian !== undefined || ubah.pemetaan !== undefined;
  const reset = isiBerubah ? ", paket_status = 'tidak', paket_diajukan_at = '', paket_rtf = '', paket_daftar = '', paket_diputuskan_oleh = '', paket_diputuskan_at = '', paket_catatan = '', keadaan = 'draf', untuk_putusan_mandiri = 0" : "";
  await db.run(
    `UPDATE aleta_blangko_pribadi
        SET nama = ?, jenis = ?, isi_json = ?, pemetaan_json = ?, peringatan_json = ?, versi = ?, diubah_at = ?${reset}
      WHERE id = ?`,
    [
      ubah.nama ?? teks(baris.nama),
      ubah.jenis ?? teks(baris.jenis),
      JSON.stringify(bagian),
      JSON.stringify(pemetaan),
      JSON.stringify(ubah.peringatan ?? uraiJson<string[]>(baris.peringatan_json, [])),
      angka(baris.versi) + (isiBerubah ? 1 : 0),
      new Date().toISOString(),
      teks(baris.id),
    ]
  );
}

/** Menyunting nama, jenis, atau isi (teks bebas). Mengubah isi memetakan ulang dan membawa keputusan lama. */
export async function simpanIsi(
  db: AletaDatabase,
  aktor: AktorBlangko,
  id: string,
  masukan: { nama?: unknown; jenis?: unknown; teks?: unknown }
): Promise<RincianBlangkoPribadi> {
  const baris = await muatUntukUbah(db, aktor, id);
  const nama = masukan.nama === undefined ? undefined : periksaNama(masukan.nama);
  const jenis = masukan.jenis === undefined ? undefined : periksaJenis(masukan.jenis);
  if (masukan.teks === undefined) {
    await tulisPerubahan(db, baris, { nama, jenis });
  } else {
    const { bagian } = bagianDariTeksBebas(teks(masukan.teks));
    if (bagian.length === 0) throw new ApiError(400, "Isi blangko tidak boleh kosong.");
    const katalog = await muatKatalogIsian(db);
    const lama = uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []);
    const { pemetaan, peringatan } = siapkanPemetaan(bagian, katalog, lama);
    const asal = uraiJson<string[]>(baris.peringatan_json, []).filter((p) => p.startsWith("PDF "));
    await tulisPerubahan(db, baris, { nama, jenis, bagian, pemetaan, peringatan: peringatanIsi(bagian, [...asal, ...peringatan]) });
  }
  await catat(db, teks(baris.id), aktor, "sunting", masukan.teks === undefined ? "nama/jenis" : "isi");
  return keRincian(await muatBaris(db, teks(baris.id)), aktor);
}

/** Keputusan pemilik atas pemetaan; `terimaYakin` mengonfirmasi usulan yakin tinggi sekaligus. */
export async function simpanKeputusan(
  db: AletaDatabase,
  aktor: AktorBlangko,
  id: string,
  masukan: { keputusan?: KeputusanButir[]; terimaYakin?: number }
): Promise<RincianBlangkoPribadi & { diterima: number }> {
  const baris = await muatUntukUbah(db, aktor, id);
  let pemetaan = uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []);
  let diterima = 0;
  try {
    if (Array.isArray(masukan.keputusan) && masukan.keputusan.length > 0) {
      pemetaan = terapkanKeputusan(pemetaan, masukan.keputusan.slice(0, BATAS_ISIAN));
    }
  } catch (galat) {
    throw new ApiError(400, galat instanceof Error ? galat.message : "Keputusan tidak sah.");
  }
  if (masukan.terimaYakin !== undefined) {
    const batas = Math.min(1, Math.max(0.5, Number(masukan.terimaYakin) || 0.8));
    const hasil = terimaUsulanYakin(pemetaan, batas);
    pemetaan = hasil.pemetaan;
    diterima = hasil.diterima;
  }
  await tulisPerubahan(db, baris, { pemetaan });
  await catat(db, teks(baris.id), aktor, "pemetaan", `${masukan.keputusan?.length ?? 0} keputusan, ${diterima} usulan diterima`);
  return { ...keRincian(await muatBaris(db, teks(baris.id)), aktor), diterima };
}

export async function hapusBlangko(db: AletaDatabase, aktor: AktorBlangko, id: string): Promise<void> {
  const baris = await muatUntukBaca(db, aktor, id);
  await db.run(`DELETE FROM aleta_blangko_pribadi_riwayat WHERE blangko_id = ?`, [teks(baris.id)]);
  await db.run(`DELETE FROM aleta_blangko_pribadi WHERE id = ?`, [teks(baris.id)]);
}

export async function riwayatBlangko(db: AletaDatabase, aktor: AktorBlangko, id: string) {
  const baris = await muatUntukBaca(db, aktor, id);
  const daftar = await db.queryAll<BarisBlangko>(
    `SELECT tindakan, ringkas, oleh_nama, pada FROM aleta_blangko_pribadi_riwayat WHERE blangko_id = ? ORDER BY pada DESC LIMIT 100`,
    [teks(baris.id)]
  );
  return daftar.map((r) => ({ tindakan: teks(r.tindakan), ringkas: teks(r.ringkas), olehNama: teks(r.oleh_nama), pada: teks(r.pada) }));
}

// ============================================================================
// Pratinjau terisi untuk satu perkara
// ============================================================================

export type HasilPratinjau = {
  nomorPerkara: string;
  alinea: Array<{ teks: string; rata: BagianSendiri["rata"]; tebal: boolean }>;
  tersisa: string[];
  jumlahIsian: number;
  docxBase64: string;
};

/**
 * Mengisi blangko untuk satu perkara dengan penyelesai yang sama dengan
 * pustaka blangko (kamus, isian tersimpan, lalu mesin ABT). Tidak menulis
 * apa pun ke SIPP/ABT. Isian yang tak punya nilai tercetak "...".
 */
export async function pratinjauBlangko(
  db: AletaDatabase,
  aktor: AktorBlangko,
  id: string,
  masukan: { nomor?: unknown; perkaraId?: unknown; docx?: boolean }
): Promise<HasilPratinjau> {
  const baris = await muatUntukBaca(db, aktor, id);
  let perkaraId = teks(masukan.perkaraId);
  let nomorPerkara = teks(masukan.nomor);
  if (!perkaraId) {
    if (!nomorPerkara) throw new ApiError(400, "Sebutkan nomor perkara untuk pratinjau.");
    const cari = await cariPerkaraContoh(nomorPerkara);
    if (!cari.perkara) throw new ApiError(404, "Perkara dengan nomor itu tidak ditemukan.");
    perkaraId = String(cari.perkara.perkaraId);
    nomorPerkara = cari.perkara.nomor || nomorPerkara;
  }

  const bagian = uraiJson<BagianSendiri[]>(baris.isi_json, []);
  const pemetaan = uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []);
  const terapan = terapkanPemetaan(bagian, pemetaan);

  const penanda = [...new Set(terapan.flatMap((a) => penandaDalam(a.teks)))];
  const isian = await isianPerkara(db, perkaraId);
  const hasil = await selesaikanPenanda(db, { perkaraId, penanda, isian });
  const { kosong } = await lengkapiDariAbt(perkaraId, hasil, penanda);

  const tersisa = new Set<string>(kosong.map((k) => k.noVar));
  const alinea = terapan.map((a) => {
    const isi = isiNaskah(a.teks, hasil);
    for (const t of isi.tersisa) tersisa.add(t);
    return { teks: isi.naskah, rata: a.rata, tebal: a.tebal };
  });

  let docxBase64 = "";
  if (masukan.docx) {
    const susunan: AlineaDocx[] = alinea.map((a) => ({ teks: a.teks, rata: a.rata, tebal: a.tebal }));
    docxBase64 = buatDocx({ alinea: susunan }).toString("base64");
  }
  await catat(db, teks(baris.id), aktor, "pratinjau", `perkara ${nomorPerkara || perkaraId}`);
  return { nomorPerkara, alinea, tersisa: [...tersisa].sort(), jumlahIsian: penanda.length, docxBase64 };
}

// ============================================================================
// Ekspor
// ============================================================================

function pastikanSiapEkspor(bagian: BagianSendiri[], pemetaan: ButirPemetaan[], untuk: "abt" | "mandiri") {
  const ringkas = ringkasPemetaan(pemetaan);
  if (ringkas.belumDiputus > 0) {
    throw new ApiError(409, `Masih ${ringkas.belumDiputus} isian yang belum Anda putuskan. Konfirmasi atau abaikan dulu semuanya.`);
  }
  if (untuk === "abt") {
    const terlarang = bagianTerlarang(bagian);
    if (terlarang.length > 0) {
      throw new ApiError(422, `Paragraf ${terlarang.slice(0, 8).join(", ")} memuat kata nama aplikasi ini; hapus dulu sebelum dipakai untuk ABT.`);
    }
  }
}

export type BerkasAbt = {
  namaBerkas: string;
  namaDaftar: string;
  rtf: string;
  daftar: ButirDaftarPaket;
  daftarTxt: string;
};

function susunBerkasAbt(baris: BarisBlangko, katalog: KatalogVariabel[]): BerkasAbt {
  const bagian = uraiJson<BagianSendiri[]>(baris.isi_json, []);
  const pemetaan = uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []);
  pastikanSiapEkspor(bagian, pemetaan, "abt");
  const nama = teks(baris.nama);
  const rtf = bangunRtf(terapkanPemetaan(bagian, pemetaan));
  const daftar = daftarIsianPaket(pemetaan, katalog);
  const namaBerkas = namaBerkasAman(nama, "rtf");
  const judulAman = namaBerkas.replace(/\.rtf$/, "").replace(/-/g, " ");
  return {
    namaBerkas,
    namaDaftar: namaBerkasAman(`${nama} daftar isian`, "txt"),
    rtf,
    daftar,
    daftarTxt: susunDaftarIsianTxt(daftar, { nama: judulAman, jenis: teks(baris.jenis) }),
  };
}

/** RTF ber-penanda + daftar isian untuk diunduh pemilik (atau Super Admin). Tidak menulis ke ABT. */
export async function eksporUntukAbt(db: AletaDatabase, aktor: AktorBlangko, id: string): Promise<BerkasAbt> {
  const baris = await muatUntukBaca(db, aktor, id);
  const berkas = susunBerkasAbt(baris, await muatKatalogIsian(db));
  await catat(db, teks(baris.id), aktor, "unduh-abt", berkas.namaBerkas);
  return berkas;
}

/** Bagian blangko untuk Putusan Mandiri, dalam bentuk yang sama dengan pustaka blangko. */
function keBagianPustaka(baris: BarisBlangko): BagianBlangko[] {
  const terapan = terapkanPemetaan(uraiJson<BagianSendiri[]>(baris.isi_json, []), uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []));
  return terapan.map((b) => ({
    id: `${teks(baris.id)}:${b.urutan}`,
    urutan: b.urutan,
    blokSidik: "",
    teks: b.teks,
    syarat: {},
    rata: b.rata,
    tebal: b.tebal,
    selalu: true,
  }));
}

/**
 * Menyatakan blangko siap dipakai Putusan Mandiri (putusan tanpa ABT).
 * Syarat: semua isian sudah diputuskan pemilik. Blangko tetap milik akunnya.
 */
export async function eksporKePutusanMandiri(
  db: AletaDatabase,
  aktor: AktorBlangko,
  id: string
): Promise<{ id: string; jumlahBagian: number; bagian: BagianBlangko[] }> {
  const baris = await muatUntukUbah(db, aktor, id);
  pastikanSiapEkspor(uraiJson<BagianSendiri[]>(baris.isi_json, []), uraiJson<ButirPemetaan[]>(baris.pemetaan_json, []), "mandiri");
  await db.run(`UPDATE aleta_blangko_pribadi SET untuk_putusan_mandiri = 1, keadaan = 'siap', diubah_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    teks(baris.id),
  ]);
  await catat(db, teks(baris.id), aktor, "ekspor-mandiri", "siap untuk Putusan Mandiri");
  const bagian = keBagianPustaka(baris);
  return { id: teks(baris.id), jumlahBagian: bagian.length, bagian };
}

/** Bagian blangko pribadi untuk dipakai penyusun Putusan Mandiri (hanya pemilik). */
export async function bagianUntukPutusanMandiri(db: AletaDatabase, aktor: AktorBlangko, id: string): Promise<BagianBlangko[]> {
  const baris = await muatUntukUbah(db, aktor, id);
  if (angka(baris.untuk_putusan_mandiri) !== 1) throw new ApiError(409, "Blangko ini belum diekspor ke Putusan Mandiri.");
  return keBagianPustaka(baris);
}

// ============================================================================
// Paket untuk Super Admin
// ============================================================================

/** Pemilik mengajukan paket (RTF + daftar isian); yang diajukan disimpan sebagai cuplikan. */
export async function ajukanPaket(db: AletaDatabase, aktor: AktorBlangko, id: string): Promise<RincianBlangkoPribadi> {
  const baris = await muatUntukUbah(db, aktor, id);
  if (teks(baris.paket_status) === "menunggu") throw new ApiError(409, "Paket blangko ini sudah menunggu persetujuan Super Admin.");
  const berkas = susunBerkasAbt(baris, await muatKatalogIsian(db));
  const sekarang = new Date().toISOString();
  await db.run(
    `UPDATE aleta_blangko_pribadi
        SET paket_status = 'menunggu', paket_diajukan_at = ?, paket_rtf = ?, paket_daftar = ?,
            paket_diputuskan_oleh = '', paket_diputuskan_at = '', paket_catatan = '', diubah_at = ?
      WHERE id = ?`,
    [sekarang, berkas.rtf, berkas.daftarTxt, sekarang, teks(baris.id)]
  );
  await catat(db, teks(baris.id), aktor, "ajukan-paket", berkas.namaBerkas);
  return keRincian(await muatBaris(db, teks(baris.id)), aktor);
}

export async function tarikPaket(db: AletaDatabase, aktor: AktorBlangko, id: string): Promise<RincianBlangkoPribadi> {
  const baris = await muatUntukUbah(db, aktor, id);
  if (teks(baris.paket_status) !== "menunggu") throw new ApiError(409, "Tidak ada paket yang sedang menunggu.");
  await db.run(
    `UPDATE aleta_blangko_pribadi SET paket_status = 'tidak', paket_diajukan_at = '', paket_rtf = '', paket_daftar = '', diubah_at = ? WHERE id = ?`,
    [new Date().toISOString(), teks(baris.id)]
  );
  await catat(db, teks(baris.id), aktor, "tarik-paket", "");
  return keRincian(await muatBaris(db, teks(baris.id)), aktor);
}

/** Super Admin menyetujui/menolak paket. Menyetujui TIDAK memasang ke ABT: pemasangan manual. */
export async function putuskanPaket(
  db: AletaDatabase,
  aktor: AktorBlangko,
  id: string,
  masukan: { setuju: boolean; catatan?: unknown }
): Promise<RincianBlangkoPribadi> {
  pastikanBolehBlangkoSendiri(aktor);
  pastikanSuperAdmin(aktor, "memutuskan paket blangko");
  const baris = await muatBaris(db, id);
  if (teks(baris.paket_status) !== "menunggu") throw new ApiError(409, "Paket ini tidak sedang menunggu keputusan.");
  const catatan = teks(masukan.catatan).slice(0, 400);
  if (!masukan.setuju && !catatan) throw new ApiError(400, "Tuliskan alasan penolakan.");
  const sekarang = new Date().toISOString();
  await db.run(
    `UPDATE aleta_blangko_pribadi
        SET paket_status = ?, paket_diputuskan_oleh = ?, paket_diputuskan_at = ?, paket_catatan = ?, diubah_at = ?
      WHERE id = ?`,
    [masukan.setuju ? "disetujui" : "ditolak", teks(aktor.name) || teks(aktor.id), sekarang, catatan, sekarang, teks(baris.id)]
  );
  await catat(db, teks(baris.id), aktor, masukan.setuju ? "setujui-paket" : "tolak-paket", catatan);
  return keRincian(await muatBaris(db, teks(baris.id)), aktor);
}

/** Unduh cuplikan paket yang diajukan (bukan keadaan terkini). Pemilik atau Super Admin. */
export async function unduhPaket(db: AletaDatabase, aktor: AktorBlangko, id: string) {
  const baris = await muatUntukBaca(db, aktor, id);
  if (!teks(baris.paket_rtf)) throw new ApiError(404, "Blangko ini belum punya paket yang diajukan.");
  const nama = teks(baris.nama);
  await catat(db, teks(baris.id), aktor, "unduh-paket", "");
  return {
    status: teks(baris.paket_status),
    namaBerkas: namaBerkasAman(nama, "rtf"),
    namaDaftar: namaBerkasAman(`${nama} daftar isian`, "txt"),
    rtf: teks(baris.paket_rtf),
    daftarTxt: teks(baris.paket_daftar),
  };
}

