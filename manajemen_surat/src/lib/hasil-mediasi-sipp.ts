/**
 * ============================================================================
 * HASIL MEDIASI KE SIPP - ATURAN MURNI (28 Okt 2026)
 * ============================================================================
 *
 * Bahan form "Isi hasil mediasi (SIPP)" di Jadwal Mediasi. Yang ditulis ke SIPP
 * dikerjakan bot (aleta_bot/services/hasilMediasiTulisService.js) persis seperti
 * borang Edit Hasil Mediasi SIPP; berkas ini hanya memegang aturan layar DAN
 * rute: siapa yang boleh, bawaan dari laporan hasil mediasi (.rtf) yang sudah
 * disusun mediator, dan perubahan teks kesepakatan ke bentuk isian SIPP.
 */
import type { DrafHasilMediasi, KunciHasil, Pasal } from "@/lib/hasil-mediasi";
import { golonganPengguna, type PenggunaGolongan } from "@/lib/matriks-peran";
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { namaTiapMediator } from "@/lib/sebutan-mediator";

export type KodeHasilSipp = "Y1" | "Y2" | "S" | "T" | "D";

/** Pilihan Hasil Mediasi borang SIPP - urutan dan bunyi sama dengan SIPP. */
export const PILIHAN_HASIL_SIPP: ReadonlyArray<{ nilai: KodeHasilSipp; label: string; kesepakatan: boolean }> = [
  { nilai: "Y1", label: "Berhasil Dengan Akta Perdamaian", kesepakatan: true },
  { nilai: "Y2", label: "Berhasil Dengan Pencabutan", kesepakatan: true },
  { nilai: "S", label: "Berhasil Sebagian", kesepakatan: true },
  { nilai: "T", label: "Tidak Berhasil", kesepakatan: false },
  { nilai: "D", label: "Tidak Dapat Dilaksanakan", kesepakatan: false },
];

export function hasilBerkesepakatan(kode: string): boolean {
  return kode === "Y1" || kode === "Y2" || kode === "S";
}

export function labelHasilSipp(kode: string): string {
  return PILIHAN_HASIL_SIPP.find((p) => p.nilai === kode)?.label ?? "";
}

/** Kunci hasil laporan .rtf -> kode SIPP. Berhasil seluruhnya dibedakan oleh penutupnya. */
export function kodeSippDariHasil(hasil: KunciHasil | string | null | undefined, penutup?: string): KodeHasilSipp | "" {
  switch (hasil) {
    case "berhasil-seluruhnya":
      return penutup === "akta" ? "Y1" : "Y2";
    case "berhasil-sebagian":
      return "S";
    case "tidak-berhasil":
      return "T";
    case "tidak-dapat-dilaksanakan":
      return "D";
    default:
      return "";
  }
}

const iso = (x: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x ?? "").slice(0, 10)) ? String(x).slice(0, 10) : "");

/** Pasal kesepakatan laporan .rtf -> teks polos untuk kotak isian (Pasal N lalu isinya). */
export function teksDariPasal(pasal: readonly Pasal[]): string {
  return pasal
    .map((p, i) => [`Pasal ${i + 1}`, ...p.isi.map((x) => String(x ?? "").trim()).filter(Boolean)].join("\n"))
    .join("\n\n");
}

export type BawaanHasilSipp = {
  hasil: KodeHasilSipp | "";
  tanggalLaporan: string;
  tanggalKesepakatan: string;
  isiKesepakatan: string;
  sumber: "sipp" | "laporan-rtf" | "";
};

/**
 * Bawaan isian: yang SUDAH tercatat di SIPP diutamakan (menyunting), lalu draf
 * laporan .rtf mediator, lalu tanggal pertemuan terakhir (di satker tanggal
 * laporan = tanggal pertemuan terakhir pada 97 dari 110 mediasi, 2025-2026).
 */
export function bawaanHasilSipp(masukan: {
  sipp?: { hasil?: string; laporan?: string; kesepakatan?: string; isiKesepakatan?: string } | null;
  draf?: Partial<DrafHasilMediasi> | null;
  pasal?: readonly Pasal[] | null;
  tanggalHasil?: string;
}): BawaanHasilSipp {
  const s = masukan.sipp ?? {};
  const tgl = iso(masukan.tanggalHasil);
  if (s.hasil && labelHasilSipp(s.hasil)) {
    return {
      hasil: s.hasil as KodeHasilSipp,
      tanggalLaporan: iso(s.laporan) || tgl,
      tanggalKesepakatan: iso(s.kesepakatan) || iso(s.laporan) || tgl,
      isiKesepakatan: teksDariHtmlSipp(s.isiKesepakatan ?? ""),
      sumber: "sipp",
    };
  }
  const d = masukan.draf;
  const kode = d ? kodeSippDariHasil(d.hasil, d.penutup) : "";
  if (d && kode) {
    const laporan = iso(d.dokumen?.tanggalLaporan) || tgl;
    return {
      hasil: kode,
      tanggalLaporan: laporan,
      tanggalKesepakatan: iso(d.dokumen?.tanggalKesepakatan) || laporan,
      isiKesepakatan: hasilBerkesepakatan(kode) && masukan.pasal?.length ? teksDariPasal(masukan.pasal) : "",
      sumber: "laporan-rtf",
    };
  }
  return { hasil: "", tanggalLaporan: tgl, tanggalKesepakatan: tgl, isiKesepakatan: "", sumber: "" };
}

function luputHtml(teks: string): string {
  return teks.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Teks polos kotak isian -> HTML ala CKEditor SIPP (bentuk yang terukur pada
 * isi_kesepakatan_perdamaian satker): tiap paragraf <p>, "Pasal N" tebal,
 * butir "1. ..." berurutan menjadi <ol><li>, dipisah dua ganti baris.
 */
export function htmlKesepakatanSipp(teks: string): string {
  const baris = String(teks ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((x) => x.trim());
  const keluaran: string[] = [];
  let daftar: string[] = [];
  const tutupDaftar = () => {
    if (daftar.length) keluaran.push(`<ol>\n${daftar.map((x) => ` <li>${x}</li>`).join("\n")}\n</ol>`);
    daftar = [];
  };
  for (const satu of baris) {
    if (!satu) {
      tutupDaftar();
      continue;
    }
    const butir = /^\d{1,3}[.)]\s+(.+)$/.exec(satu);
    if (butir) {
      daftar.push(luputHtml(butir[1]));
      continue;
    }
    tutupDaftar();
    keluaran.push(/^Pasal\s+\d{1,3}$/i.test(satu) ? `<p><strong>${luputHtml(satu)}</strong></p>` : `<p>${luputHtml(satu)}</p>`);
  }
  tutupDaftar();
  return keluaran.join("\n\n");
}

/** HTML SIPP -> teks polos untuk disunting (kebalikan kasar htmlKesepakatanSipp). */
export function teksDariHtmlSipp(html: string): string {
  let nomor = 0;
  return String(html ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/<ol[^>]*>/gi, () => {
      nomor = 0;
      return "\n";
    })
    .replace(/<li[^>]*>/gi, () => `\n${++nomor}. `)
    .replace(/<\/(p|div|h\d|ol|ul)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((x) => x.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type PetugasHasilMediasi = {
  mediator?: string;
  majelis?: readonly string[];
  panitera?: readonly string[];
};

/**
 * Siapa yang boleh mengisi hasil mediasi ke SIPP (permintaan pengguna 28 Okt:
 * PP perkara, hakim/mediator, Super Admin):
 *   - Super Admin: selalu;
 *   - mediator, hakim, panitera pengganti: HANYA bila namanya tercatat di
 *     perkara itu (mediator mediasinya, anggota majelis, atau PP) - sama dengan
 *     SIPP (HasRuleHakimPanitera: majelis/PP perkara).
 * Admin dan pimpinan/panitera tanpa nama di perkara itu TIDAK - yang tercatat
 * di SIPP adalah akun petugas perkara, jadi pengisinya pun petugas perkara.
 */
export function bolehIsiHasilMediasiSipp(
  pengguna: (PenggunaGolongan & { name?: string; nama?: string }) | null | undefined,
  petugas: PetugasHasilMediasi
): boolean {
  if (!pengguna) return false;
  const golongan = golonganPengguna(pengguna);
  if (golongan.includes("super-admin")) return true;
  if (!golongan.some((g) => g === "mediator" || g === "hakim" || g === "pp" || g === "pimpinan")) return false;
  const nama = String(pengguna.name ?? pengguna.nama ?? "").trim();
  if (!nama) return false;
  if (namaTiapMediator(petugas.mediator ?? "").some((m) => namaAdaDi(nama, m))) return true;
  if ((petugas.majelis ?? []).some((m) => namaAdaDi(nama, m))) return true;
  if ((petugas.panitera ?? []).some((m) => namaAdaDi(nama, m))) return true;
  return false;
}

export const SEBAB_TOLAK_HASIL_SIPP =
  "Hasil mediasi ke SIPP hanya diisi mediator, majelis, atau panitera pengganti perkara ini (nama akun Anda tidak cocok dengan yang tercatat di SIPP), dan Super Admin.";
