/**
 * ============================================================================
 * PUTUSAN YANG MASIH BERBENTUK BLANGKO - UNTUK PERINTAH AI (18 Okt 2026)
 * ============================================================================
 *
 * Saklar "Sertakan putusan yang masih berbentuk blangko" pada penyusun
 * perintah AI memasukkan draf putusan perkara ini ke perintah, dengan setiap
 * bagian yang masih kosong DITANDAI, supaya AI melengkapi atau memperbaikinya.
 *
 * SUMBER UTAMA: berkas .rtf putusan yang sudah dibuat petugas/hakim di ABT
 * (hasil cetak blangko ABT) tetapi masih banyak yang belum masuk - "...",
 * titik-titik, isian kosong, sisa penanda. Dibaca DI PERAMBAN (RTF, DOCX, PDF,
 * TXT) dengan pembaca yang sama dengan deteksi sisa blangko; grup tersembunyi
 * RTF ({\*\isianasal ...} dan sejenisnya) dibuang pembacanya. Berkasnya tidak
 * dikirim ke mana pun selain sebagai teks perintah yang disalin petugas.
 *
 * KEKOSONGAN dideteksi dengan aturan yang sama dengan peringatan unggah
 * (lib/deteksi-sisa-blangko.ts): kurung siku, tanda isian #nnnn#, placeholder,
 * titik-titik, garis isian, tulisan merah, catatan perbaikan, kalimat blangko.
 * "..." di dalam kutipan yang dipotong (ayat, hadis, pasal) BUKAN kekosongan.
 *
 * SUMBER TAMBAHAN bila ada: draf perakit putusan (aleta_putusan_draf) dan draf
 * agen H-7 (aleta_agen_h7_draf) - lihat bahanDrafPerakit/bahanDrafH7. Draf
 * Putusan Advance tidak disimpan per perkara dan naskah ABT hanya ada di ABT,
 * jadi lewat unggah berkas.
 *
 * Berkas ini MURNI (tanpa basis data, tanpa DOM).
 */

import type { DrafH7 } from "@/lib/agen-h7-putusan";
import { LABEL, rentangParagraf, type JenisTemuan, type Paragraf } from "@/lib/deteksi-sisa-blangko";
import type { DrafBlangkoBahan } from "@/lib/prompt-ai";

export const BATAS_TEKS_DRAF = 60000;
/** Paling banyak butir rekap yang dicantumkan; selebihnya cukup dihitung. */
export const BATAS_REKAP = 150;

const SINGKAT: Record<JenisTemuan, string> = {
  merah: "tulisan merah",
  kurung: "kurung siku",
  tanda: "tanda isian",
  perbaikan: "catatan perbaikan",
  titik: "titik-titik",
  garis: "garis isian",
  kalimat: "kalimat blangko",
};

export type Kekosongan = {
  nomor: number;
  jenis: JenisTemuan;
  label: string;
  /** Tulisan aslinya (untuk yang bukan titik/garis), dipotong. */
  asli: string;
  /** Beberapa kata sebelum dan sesudahnya - petunjuk letak bagi AI dan pembaca. */
  konteks: string;
};

export type HasilTandai = {
  teks: string;
  kekosongan: Kekosongan[];
  jumlah: number;
  jumlahPerJenis: Array<{ jenis: JenisTemuan; label: string; jumlah: number }>;
};

function ringkasSpasi(t: string, maks: number): string {
  const x = String(t).replace(/\s+/g, " ").trim();
  return x.length > maks ? `${x.slice(0, maks - 1).trimEnd()}…` : x;
}

/**
 * Naskah dengan setiap kekosongan diganti penanda `[KOSONG-n: jenis]` (untuk
 * kurung, tanda, merah, perbaikan, dan kalimat: `[KOSONG-n: jenis «tulisan
 * aslinya»]` supaya isi yang sudah ada tidak hilang).
 */
export function tandaiKekosongan(paragraf: Paragraf[]): HasilTandai {
  const kekosongan: Kekosongan[] = [];
  const keluar: string[] = [];
  let nomor = 0;
  for (const par of paragraf) {
    const { p, pemenang } = rentangParagraf(par);
    if (pemenang.length === 0) {
      keluar.push(p);
      continue;
    }
    let hasil = "";
    let kursor = 0;
    for (const r of pemenang) {
      if (r.dari < kursor) continue;
      nomor += 1;
      const asli = p.slice(r.dari, r.sampai);
      const bawaIsi = r.jenis !== "titik" && r.jenis !== "garis";
      const sebelum = ringkasSpasi(p.slice(Math.max(0, r.dari - 40), r.dari), 40);
      const sesudah = ringkasSpasi(p.slice(r.sampai, r.sampai + 40), 40);
      kekosongan.push({
        nomor,
        jenis: r.jenis,
        label: LABEL[r.jenis],
        asli: bawaIsi ? ringkasSpasi(asli, 80) : "",
        konteks: `${sebelum ? `…${sebelum} ` : ""}[ISI]${sesudah ? ` ${sesudah}…` : ""}`,
      });
      hasil += p.slice(kursor, r.dari);
      hasil += `[KOSONG-${nomor}: ${SINGKAT[r.jenis]}${bawaIsi ? ` «${ringkasSpasi(asli, 80)}»` : ""}]`;
      kursor = r.sampai;
    }
    hasil += p.slice(kursor);
    keluar.push(hasil);
  }
  const hitung = new Map<JenisTemuan, number>();
  for (const k of kekosongan) hitung.set(k.jenis, (hitung.get(k.jenis) ?? 0) + 1);
  const jumlahPerJenis = [...hitung.entries()].map(([jenis, jumlah]) => ({ jenis, label: SINGKAT[jenis], jumlah }));
  return { teks: keluar.join("\n"), kekosongan, jumlah: kekosongan.length, jumlahPerJenis };
}

/** Rekap yang dicantumkan di perintah: jumlah per jenis lalu butir-butirnya. */
export function rekapKekosongan(h: HasilTandai): string {
  if (h.jumlah === 0) return "Tidak ditemukan bagian kosong yang terdeteksi otomatis; periksa sendiri bila ada yang masih kurang.";
  const perJenis = h.jumlahPerJenis.map((x) => `${x.label} ${x.jumlah}`).join(", ");
  const butir = h.kekosongan.slice(0, BATAS_REKAP).map((k) => `- KOSONG-${k.nomor} (${SINGKAT[k.jenis]}): ${k.konteks}`);
  return [
    `Ditemukan ${h.jumlah} bagian kosong (${perJenis}).`,
    ...butir,
    h.jumlah > BATAS_REKAP ? `(${h.jumlah - BATAS_REKAP} butir lain ditandai di naskah, tidak dirinci di sini.)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Berkas putusan hasil ABT yang sudah dibaca -> bahan perintah. */
export function bahanDrafDariBerkas(nama: string, paragraf: Paragraf[]): DrafBlangkoBahan & { jumlahKosong: number } {
  const h = tandaiKekosongan(paragraf);
  return {
    sumber: "Berkas putusan hasil ABT",
    judul: nama,
    teks: h.teks.slice(0, BATAS_TEKS_DRAF),
    rekap: rekapKekosongan(h),
    jumlahKosong: h.jumlah,
  };
}

/** Kalimat di layar: "Ditemukan 37 bagian kosong". */
export function kalimatJumlahKosong(jumlah: number): string {
  return jumlah === 0 ? "Tidak ada bagian kosong yang terdeteksi" : `Ditemukan ${jumlah} bagian kosong`;
}

/* ========================================================================== */
/* Sumber tambahan di ALETA                                                   */
/* ========================================================================== */

export type DrafPerakitMasuk = {
  versi: number;
  jenisNaskah: string;
  keadaan: string;
  naskah: string;
  belumTerisi: string[];
  dibuatAt: string;
};

function tanggalDari(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** Draf perakit putusan -> bahan perintah. Bagian yang belum terisi ditambahkan sebagai daftar. */
export function bahanDrafPerakit(d: DrafPerakitMasuk): DrafBlangkoBahan | null {
  const naskah = String(d.naskah ?? "").trim();
  if (!naskah) return null;
  const kosong = (d.belumTerisi ?? []).map((x) => String(x).trim()).filter(Boolean);
  return {
    sumber: "Draf perakit putusan",
    judul: `${d.jenisNaskah || "PUTUSAN"} versi ${d.versi} (${d.keadaan})`,
    teks: naskah.slice(0, BATAS_TEKS_DRAF),
    rekap: kosong.length ? `Bagian yang belum terisi menurut perakit: ${kosong.join("; ")}` : "",
    dibuatPada: tanggalDari(d.dibuatAt),
  };
}

/** Draf agen H-7 -> bahan perintah: blangko, isian dengan penanda kosong, lalu ringkasan bahan. */
export function bahanDrafH7(d: DrafH7): DrafBlangkoBahan | null {
  const isian = Array.isArray(d.isian) ? d.isian : [];
  if (isian.length === 0 && !(d.ringkasan ?? []).some((r) => r.ada)) return null;
  const utama = d.blangko?.utama;
  const baris: string[] = [];
  if (utama) baris.push(`Blangko yang dipakai: ${utama.berkas}${utama.label ? ` (${utama.label})` : ""}`);
  if (isian.length) {
    baris.push("Isian blangko:");
    for (const x of isian) {
      const nilai = String(x.nilai ?? "").trim();
      const tanda = !nilai
        ? `[placeholder: ${x.nama}]`
        : x.golongan === "usulan"
          ? `${nilai} (usulan agen, perlu diperiksa)`
          : nilai;
      baris.push(`- ${x.nama}: ${tanda}`);
    }
  }
  const ringkasan = (d.ringkasan ?? []).filter((r) => r.ada && r.isi?.length);
  if (ringkasan.length) {
    baris.push("Ringkasan bahan perkara:");
    for (const r of ringkasan) baris.push(`${r.judul}:`, ...r.isi.map((b) => `- ${b}`));
  }
  return {
    sumber: "Draf agen H-7",
    judul: `sidang ${d.tanggalSidang || "-"}`,
    teks: baris.join("\n").slice(0, BATAS_TEKS_DRAF),
    dibuatPada: tanggalDari(d.dibuatPada),
  };
}

/** Kalimat keadaan draf ALETA untuk layar. */
export function keteranganDrafBlangko(jumlah: number, sumber: string[]): string {
  if (jumlah === 0) return "belum ada draf blangko untuk perkara ini";
  return `ada ${jumlah} draf: ${sumber.join(", ")}`;
}
