import { readFile } from "node:fs/promises";
import path from "node:path";

import { susunNaskahEvidenSkp, type InstansiCetak } from "@/lib/eviden-skp-cetak";
import type { DokumenEvidenSkp, PaketEvidenSkp } from "@/lib/eviden-skp-tipe";
import {
  JENIS_BERKAS_EVIDEN_SKP,
  SEBUTAN_FORMAT_EVIDEN_SKP,
  SEMUA_DOKUMEN_EVIDEN_SKP,
  namaBerkasEvidenSkp,
  namaZipEvidenSkp,
  type FormatEvidenSkp,
} from "@/lib/eviden-skp-unduh";
import { gambarDocxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-docx";
import { gambarPdfEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-pdf";
import { gambarXlsxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-xlsx";
import { susunZip, type BerkasZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * UNDUHAN EVIDEN SKP - SATU DOKUMEN ATAU SEMUANYA DALAM ZIP (2.40.0)
 * ============================================================================
 *
 * Dari PaketEvidenSkp (disusun katalog) ke berkas yang diunduh: memilih
 * dokumen, menyusun naskahnya, menggambarnya dalam format yang diminta, dan
 * memberinya nama. "semua" membungkus SELURUH dokumen yang tersedia dalam
 * satu ZIP; dokumen yang tidak tersedia disebut di KETERANGAN.txt beserta
 * sebabnya - bukan dilewati diam-diam, sebab yang membuka ZIP-nya akan
 * mengira dokumen itu lupa diunduh.
 */

export type OpsiUnduhanEvidenSkp = {
  instansi: InstansiCetak | null;
  /** Tanggal tanda tangan ISO. */
  tanggalTandaTangan: string;
  /** "Hakim" - untuk "Hakim yang bersangkutan,". */
  sebutanOrang: string;
  logo: Uint8Array | null;
};

export type BerkasEvidenSkp = { nama: string; isi: Buffer; jenis: string };

export type HasilUnduhanEvidenSkp =
  | (BerkasEvidenSkp & { ok: true; dokumen: string[] })
  | { ok: false; status: number; pesan: string };

const JALUR_LOGO = path.join(process.cwd(), "public", "mahkamah-agung-logo.png");
let logoTersimpan: Promise<Buffer | null> | null = null;

/**
 * Logo Mahkamah Agung untuk kop - berkas yang sama dengan logo bawaan portal
 * (public/mahkamah-agung-logo.png, ikut tersalin ke citra Docker).
 *
 * Logo yang tidak terbaca TIDAK menggagalkan unduhan: kop tanpa logo tetap
 * kop yang benar isinya, sedangkan unduhan yang gagal karena satu gambar
 * membuat hakim tidak punya bukti dukung sama sekali.
 */
export function bacaLogoKop(): Promise<Buffer | null> {
  if (!logoTersimpan) {
    logoTersimpan = readFile(JALUR_LOGO).catch(() => {
      logoTersimpan = null;
      return null;
    });
  }
  return logoTersimpan;
}

export async function gambarDokumenEvidenSkp(
  paket: PaketEvidenSkp,
  dokumen: DokumenEvidenSkp,
  format: FormatEvidenSkp,
  opsi: OpsiUnduhanEvidenSkp
): Promise<BerkasEvidenSkp> {
  const naskah = susunNaskahEvidenSkp(paket, dokumen, {
    instansi: opsi.instansi,
    tanggalTandaTangan: opsi.tanggalTandaTangan,
    sebutanOrang: opsi.sebutanOrang,
    logo: opsi.logo,
  });
  const isi =
    format === "pdf"
      ? (await gambarPdfEvidenSkp(naskah)).berkas
      : format === "xlsx"
        ? await gambarXlsxEvidenSkp(naskah)
        : await gambarDocxEvidenSkp(naskah);
  return {
    nama: namaBerkasEvidenSkp({ periode: paket.periode, judulLengkap: dokumen.judulLengkap, nama: paket.orang.nama, format }),
    isi,
    jenis: JENIS_BERKAS_EVIDEN_SKP[format],
  };
}

/** Nama yang sama tidak boleh dua kali di satu ZIP - yang kedua ditimpa pembukanya. */
function namaUnik(nama: string, terpakai: Set<string>): string {
  if (!terpakai.has(nama.toLowerCase())) {
    terpakai.add(nama.toLowerCase());
    return nama;
  }
  const titik = nama.lastIndexOf(".");
  const dasar = titik > 0 ? nama.slice(0, titik) : nama;
  const ekstensi = titik > 0 ? nama.slice(titik) : "";
  for (let i = 2; ; i += 1) {
    const calon = `${dasar} (${i})${ekstensi}`;
    if (!terpakai.has(calon.toLowerCase())) {
      terpakai.add(calon.toLowerCase());
      return calon;
    }
  }
}

export async function susunUnduhanEvidenSkp(p: {
  paket: PaketEvidenSkp;
  dokumen: string;
  format: FormatEvidenSkp;
  opsi: OpsiUnduhanEvidenSkp;
}): Promise<HasilUnduhanEvidenSkp> {
  const { paket, format, opsi } = p;

  if (p.dokumen === SEMUA_DOKUMEN_EVIDEN_SKP) {
    const tersedia = paket.dokumen.filter((d) => d.tersedia);
    if (tersedia.length === 0) {
      return {
        ok: false,
        status: 409,
        pesan: `Tidak ada dokumen eviden SKP yang dapat disusun untuk ${paket.periode.labelPanjang}.`,
      };
    }
    const terpakai = new Set<string>();
    const isiZip: BerkasZip[] = [];
    for (const d of tersedia) {
      const berkas = await gambarDokumenEvidenSkp(paket, d, format, opsi);
      isiZip.push({ nama: namaUnik(berkas.nama, terpakai), isi: berkas.isi });
    }
    const tidak = paket.dokumen.filter((d) => !d.tersedia);
    if (tidak.length > 0) {
      const keterangan = [
        `Eviden SKP ${paket.periode.labelPanjang} - ${paket.orang.nama}`,
        "",
        `Dokumen dalam arsip ini (${SEBUTAN_FORMAT_EVIDEN_SKP[format]}): ${tersedia.length}.`,
        "",
        "Dokumen yang TIDAK ikut, karena tidak dapat disusun dari data SIPP:",
        ...tidak.map((d) => `- ${d.judulLengkap}: ${d.sebabTidakTersedia || "tidak tersedia"}`),
        "",
      ].join("\r\n");
      isiZip.push({ nama: namaUnik("KETERANGAN.txt", terpakai), isi: Buffer.from(keterangan, "utf8") });
    }
    return {
      ok: true,
      nama: namaZipEvidenSkp({ periode: paket.periode, nama: paket.orang.nama, format }),
      isi: susunZip(isiZip),
      jenis: "application/zip",
      dokumen: tersedia.map((d) => d.kunci),
    };
  }

  const dokumen = paket.dokumen.find((d) => d.kunci === p.dokumen);
  if (!dokumen) {
    return {
      ok: false,
      status: 404,
      pesan: `Dokumen "${p.dokumen}" tidak ada dalam daftar eviden SKP. Pilih dokumen dari menu Unduh eviden SKP.`,
    };
  }
  if (!dokumen.tersedia) {
    return {
      ok: false,
      status: 409,
      pesan: dokumen.sebabTidakTersedia || `${dokumen.judulLengkap} tidak dapat disusun dari data SIPP.`,
    };
  }
  const berkas = await gambarDokumenEvidenSkp(paket, dokumen, format, opsi);
  return { ok: true, ...berkas, dokumen: [dokumen.kunci] };
}
