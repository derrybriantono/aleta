/**
 * ============================================================================
 * PENANDA SITA DI KOLOM AGENDA + KETERANGAN EKSEPSI/REKONVENSI/SITA/EKSEKUSI
 * (antrian sidang butir 22-24, 12 Okt 2026)
 * ============================================================================
 *
 * Sita dibaca bot dari petitum (bagian primer) dan dari SIPP (sita jaminan
 * putusan sela, sita eksekusi register eksekusi) - lihat aleta_bot
 * sitaEksekusiPerkaraService (angka ukur di kepala berkasnya). Bot mengirim
 * per perkara:
 *
 *   sita: { daftar: [{ kode, nama, sumber, kutipan?, catatanSipp? }] } | null
 *   eksekusi: [{ nomorRegister, tanggalPermohonan, jenis, statusTerakhir, tahap, ... }]
 *   sitaTerbaca: false     kuerinya gagal - DIAM, bukan "tidak ada sita"
 *
 * Istilah: pengguna menulis "Sita Revindikator"; yang dipakai istilah baku
 * "Sita Revindikasi" (revindicatoir beslag).
 *
 * Eksepsi/rekonvensi di rincian & Status Perkara memakai data yang SAMA
 * dengan kolom Agenda (lib/penanda-jawaban.ts) - tidak ada aturan kedua.
 */

import type { PenandaJawabanPerkara, TemuanJawaban } from "@/lib/penanda-jawaban";
import { tanggalIndonesia } from "@/lib/rangkaian-sidang";

export const KUNCI_SAKLAR_SITA = "penanda-sita";
export const KUNCI_SAKLAR_JAWABAN = "penanda-jawaban";

export type KodeSita = "jaminan" | "revindikasi" | "marital" | "eksekusi" | "lain";

export type SitaButir = {
  kode: KodeSita;
  /** "Sita Jaminan", "Sita Marital", ..., atau "Sita" + kata aslinya. */
  nama: string;
  sumber: "petitum" | "sipp" | "keduanya";
  /** Butir petitum yang memuatnya (sumber petitum/keduanya). */
  kutipan?: string;
  /** Catatan SIPP (penetapan sita putusan sela / sita eksekusi). */
  catatanSipp?: string;
};

export type SitaPerkara = { daftar: SitaButir[] };

export type TahapEksekusi = { nama: string; tanggal: string };

export type EksekusiPerkara = {
  nomorRegister: string;
  nomorPutusanDieksekusi: string;
  tingkatPutusan: string;
  tanggalPermohonan: string;
  /** "riil", "pembayaran sejumlah uang (lelang)", keduanya, atau "" (belum sampai). */
  jenis: string;
  /** status_eksekusi_text SIPP. */
  statusTerakhir: string;
  tahapTerakhir: TahapEksekusi | null;
  tahap: TahapEksekusi[];
  dicabut: string;
  nomorPenetapanSita: string;
  penetapanSita: string;
  pelaksanaanSita: string;
};

export type BarisPenandaSita = {
  nomorPerkara: string;
  sita?: SitaPerkara | null;
  eksekusi?: EksekusiPerkara[];
  sitaTerbaca?: boolean;
};

export type PenandaSita = { kunci: string; label: string; kelas: string; keterangan: string };

/**
 * Satu warna untuk semua jenis sita (kuning pekat berbingkai) - tidak dipakai
 * penanda lain di kolom Agenda (biru muda Mediasi, fuchsia mediator,
 * hijau/merah/abu hasil mediasi, jingga Eksepsi, biru tua Rekonvensi).
 * Jenisnya terbaca dari tulisannya.
 */
export const KELAS_PENANDA_SITA =
  "bg-yellow-300 text-yellow-950 ring-1 ring-yellow-800 dark:bg-yellow-400 dark:text-yellow-950 dark:ring-yellow-200";

const SEBUT_SUMBER: Record<SitaButir["sumber"], string> = {
  petitum: "dari petitum",
  sipp: "dari catatan SIPP",
  keduanya: "dari petitum dan catatan SIPP",
};

export function butirSita(sita: SitaPerkara | null | undefined): SitaButir[] {
  return Array.isArray(sita?.daftar) ? sita.daftar.filter((x) => x && x.nama) : [];
}

/** Title lencana: jenis, asal, kutipan butir petitum, catatan SIPP. */
export function keteranganSita(b: SitaButir, bisaDibuka = true): string {
  const baris = [`${b.nama} - ${SEBUT_SUMBER[b.sumber] ?? "dari petitum"}.`];
  if (b.kutipan) baris.push(`Butir petitum: "${b.kutipan}"`);
  if (b.catatanSipp) baris.push(`SIPP: ${b.catatanSipp}`);
  if (bisaDibuka) baris.push("Ditekan = membuka Status Perkara.");
  return baris.join("\n");
}

/** Lencana Sita untuk satu baris jadwal; [] bila tidak ada atau tidak terbaca. */
export function penandaSitaBaris(baris: BarisPenandaSita): PenandaSita[] {
  if (baris.sitaTerbaca === false) return [];
  return butirSita(baris.sita).map((b) => ({
    kunci: b.kode === "lain" ? `lain:${b.nama}` : b.kode,
    label: b.nama,
    kelas: KELAS_PENANDA_SITA,
    keterangan: keteranganSita(b),
  }));
}

// ---------------------------------------------------------------------------
// Keterangan rincian: eksepsi / rekonvensi
// ---------------------------------------------------------------------------

export type KeadaanJawaban = { judul: string; isi: string; kalimat: string; ada: boolean };

function asalTemuan(t: TemuanJawaban): string {
  return `${t.jenisDokumen ? `${t.jenisDokumen} Tergugat` : "dokumen Tergugat"} "${t.dokumen}"${
    t.diunggah ? ` (diunggah ${t.diunggah})` : ""
  }${t.sumber === "ocr" ? ", dibaca dari pindaian (OCR)" : ""}`;
}

/**
 * Keadaan eksepsi & rekonvensi untuk rincian. Tidak terbaca TIDAK pernah
 * ditulis sebagai "tidak ada".
 */
export function keadaanJawaban(
  p: PenandaJawabanPerkara | null | undefined,
  terbaca: boolean | undefined
): KeadaanJawaban[] {
  const hasil: KeadaanJawaban[] = [];
  for (const jenis of ["eksepsi", "rekonvensi"] as const) {
    const judul = jenis === "eksepsi" ? "Eksepsi" : "Rekonvensi";
    if (terbaca === false) {
      hasil.push({ judul, isi: "tidak dapat dibaca saat ini", kalimat: "", ada: false });
      continue;
    }
    if (!p) {
      hasil.push({ judul, isi: "belum ada jawaban/duplik Tergugat di arsip e-Court", kalimat: "", ada: false });
      continue;
    }
    const t = p[jenis];
    if (!t) {
      const sisa = p.belumDibaca > 0 ? `${p.belumDibaca} berkas belum dibaca` : p.tidakTerbaca > 0 ? `${p.tidakTerbaca} berkas tidak terbaca` : "berkas belum terbaca";
      hasil.push({ judul, isi: `belum dapat ditentukan - ${sisa}`, kalimat: "", ada: false });
      continue;
    }
    if (t.keadaan === "ada") {
      hasil.push({ judul, isi: `diajukan - terbaca dari ${asalTemuan(t)}`, kalimat: t.kalimat, ada: true });
    } else if (t.keadaan === "tidak") {
      hasil.push({ judul, isi: `tidak diajukan (dinyatakan tegas di ${asalTemuan(t)})`, kalimat: t.kalimat, ada: false });
    } else {
      hasil.push({ judul, isi: `tidak disebut di jawaban/duplik Tergugat (${p.dibaca} berkas dibaca)`, kalimat: "", ada: false });
    }
  }
  return hasil;
}

// ---------------------------------------------------------------------------
// Keterangan rincian: eksekusi
// ---------------------------------------------------------------------------

export function tanggalTampil(iso: string | null | undefined): string {
  if (!iso) return "";
  return tanggalIndonesia(`${iso.slice(0, 10)}T00:00:00Z`) || iso;
}

/** Satu kalimat ringkas untuk satu register eksekusi. */
export function ringkasanEksekusi(e: EksekusiPerkara): string {
  const bagian = [`Eksekusi ${e.nomorRegister || "(tanpa nomor register)"}`];
  if (e.tanggalPermohonan) bagian.push(`dimohonkan ${tanggalTampil(e.tanggalPermohonan)}`);
  if (e.jenis) bagian.push(`jenis ${e.jenis}`);
  if (e.statusTerakhir) bagian.push(`status ${e.statusTerakhir}`);
  else if (e.tahapTerakhir) bagian.push(`tahap terakhir ${e.tahapTerakhir.nama.toLowerCase()} ${tanggalTampil(e.tahapTerakhir.tanggal)}`);
  if (e.dicabut) bagian.push(`dicabut ${tanggalTampil(e.dicabut)}`);
  return bagian.join(" - ");
}
