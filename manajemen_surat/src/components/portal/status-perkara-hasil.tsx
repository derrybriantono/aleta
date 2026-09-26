"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Layers,
  LayoutGrid,
  List,
  Printer,
  Table2,
  X,
} from "lucide-react";

import { LembarCetakHasil } from "@/components/portal/status-perkara-cetak";
import {
  pengukurKanvas,
  susunTataLetakCetak,
  ukuranHurufCetak,
  type PengukurTeks,
  type TataLetakCetak,
} from "@/components/portal/status-perkara-cetak-lebar";
import type { BarisCariPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tanggalDMY, tanggalHariPendek } from "@/lib/tanggal-indonesia";
import { cn } from "@/lib/utils";

/**
 * Hasil pencarian Status Perkara - empat tampilan, satu urutan, satu cetak.
 *
 * ============================================================================
 * DIPINDAHKAN DARI aleta-ecourt-status-perkara.tsx
 * ============================================================================
 *
 * Kisi kartu hasil pencarian dulu hidup di dalam berkas layar yang sudah 5.900
 * baris. Diminta pengguna 25 September 2026 (butir 7, 8, 9): hasil harus dapat
 * dilihat sebagai tabel lengkap, daftar ringkas, kotak (seperti sebelumnya),
 * dan kelompok - dapat diurutkan, dapat dicetak. Semua itu di sini, supaya
 * berkas layar tidak membengkak dan tampilan hasil dapat DIGAMBAR dalam uji
 * tanpa menyalakan seluruh layar Status Perkara.
 *
 * ============================================================================
 * RUAS BARU BOLEH BELUM ADA
 * ============================================================================
 *
 * Pihak, kuasa, petugas, tahapan, sidang, umur, e-Court, dan akta cerai datang
 * dari kueri kedua di bot yang dikerjakan BERSAMAAN dengan layar ini. Bot yang
 * lebih lama tidak mengirimkannya - layar tetap utuh, selnya bertanda "—", dan
 * kolom yang seluruhnya belum dikirim DISEBUTKAN di atas tabel. Diam tentang
 * itu akan membuat "—" dibaca sebagai "SIPP-nya kosong".
 */

/**
 * Satu baris hasil pencarian: bentuk yang SAMA dengan kiriman bot, yaitu
 * BarisCariPerkara - definisi kontrak bot <-> layar 25 September 2026 yang
 * juga dipakai rute portal - ditambah satu ruas milik layar.
 *
 * Bentuknya TIDAK ditulis ulang di sini. Dua definisi yang harus dijaga
 * selaras menyimpang diam-diam; dengan satu definisi, ruas yang diganti nama
 * atau jenisnya di kontrak membuat tsc menolak layar ini.
 *
 * Seluruh ruas rinci di kontrak OPSIONAL: bot versi lama tidak mengirimnya,
 * dan layar tetap menggambar hasilnya (lihat kepala berkas).
 */
export type BarisHasil = BarisCariPerkara & {
  /**
   * Diisi LAYAR, bukan bot: bagian yang gagal dibaca bot (`ruasTakTerbaca`)
   * pada HALAMAN asal baris ini - lihat tandaiTakTerbaca().
   *
   * Per baris, bukan per daftar: halaman kedua yang gagal membaca kuasa tidak
   * boleh menandai kuasa di halaman pertama yang terbaca utuh.
   */
  takTerbaca?: string[];
};

// ===========================================================================
// BAGIAN YANG GAGAL DIBACA BOT
// ===========================================================================

/**
 * Nama bagian yang dikirim bot lewat `ruasTakTerbaca` -> kolom yang terkena
 * dan sebutannya untuk dibaca orang.
 *
 * Kuncinya nama yang dicatat catatTakTerbaca() di sippStatusPerkaraService.js
 * (lengkapiRuas; lampirkanCocok memakai awalan "cocok:"). Tanpa peta ini layar
 * menulis "Keterangan hakimKetua, cocok:Kuasa gagal dibaca" - dan, lebih buruk,
 * bot mengisi ruas yang gagal dengan nilai "tidak ada": kueri sidang yang
 * gagal membuat SETIAP baris terbaca "0 sidang".
 */
const RUAS_BOT: Record<string, { label: string; kolom: KunciKolom[] }> = {
  perkara: { label: "tahapan dan proses", kolom: ["tahapan"] },
  pihak: { label: "nama pihak", kolom: ["pihak1", "pihak2"] },
  kuasa: { label: "kuasa hukum", kolom: ["kuasa"] },
  hakimKetua: { label: "hakim ketua", kolom: ["hakim"] },
  paniteraPengganti: { label: "panitera pengganti", kolom: ["panitera"] },
  jurusita: { label: "juru sita", kolom: ["jurusita"] },
  sidang: { label: "jadwal sidang", kolom: ["sidangTerakhir", "sidangBerikut", "jumlahSidang"] },
  ecourt: { label: "e-Court", kolom: ["ecourt"] },
  aktaCerai: { label: "akta cerai", kolom: ["aktaCerai"] },
};

const AWALAN_COCOK = "cocok:";

/** Teks sel yang bagiannya gagal dibaca - di layar maupun di lembar cetak. */
export const TEKS_TAK_TERBACA = "tak terbaca";

/**
 * Hasil yang dijawab LAPIS DALAM kata bebas (bot mengirim lapis = "dalam"):
 * kata itu tidak cocok pada satu pun nomor, jenis, pihak, atau kuasa, lalu
 * dicari sampai isi pertimbangan. Urutan lapisnya milik cariPerkaraHalaman()
 * di sippStatusPerkaraService.js - SYARAT_CEPAT lalu SYARAT_DALAM.
 */
export const KALIMAT_LAPIS_DALAM =
  "Kata cari tidak cocok pada nomor perkara, jenis perkara, nama pihak, maupun kuasa hukum, sehingga pencarian diperdalam ke alamat pihak, KUA, hakim/panitera/juru sita, agenda sidang, serta isi pertimbangan dan amar. Lihat “cocok karena” pada tiap perkara.";

/**
 * Menandai tiap baris satu HALAMAN dengan bagian yang gagal dibaca pada
 * halaman itu. Yang tidak gagal dibiarkan apa adanya.
 */
export function tandaiTakTerbaca(baris: BarisHasil[], ruasTakTerbaca: unknown): BarisHasil[] {
  const daftar = Array.isArray(ruasTakTerbaca)
    ? [...new Set(ruasTakTerbaca.map((x) => String(x ?? "").trim()).filter(Boolean))]
    : [];
  if (daftar.length === 0) return baris;
  return baris.map((b) => ({ ...b, takTerbaca: daftar }));
}

/** Apakah sel kolom ini pada baris ini berasal dari bagian yang gagal dibaca. */
function selTakTerbaca(kunci: KunciKolom, b: BarisHasil): boolean {
  if (!b.takTerbaca || b.takTerbaca.length === 0) return false;
  return b.takTerbaca.some((ruas) => RUAS_BOT[ruas]?.kolom.includes(kunci) ?? false);
}

/** Keterangan "cocok karena" yang gagal dicari untuk baris ini: ["kuasa", ...]. */
function cocokTakTerbaca(b: BarisHasil): string[] {
  return (b.takTerbaca ?? [])
    .filter((ruas) => ruas.startsWith(AWALAN_COCOK))
    .map((ruas) => ruas.slice(AWALAN_COCOK.length).trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Sebutan bagian-bagian yang gagal dibaca, untuk dibaca orang. Keterangan
 * "cocok karena" yang gagal DIGABUNG menjadi satu sebutan. Nama yang belum
 * dikenal layar tetap disebut apa adanya - terbaca janggal lebih baik daripada
 * hilang.
 */
export function sebutanTakTerbaca(ruas: string[]): string[] {
  const hasil: string[] = [];
  const cocok: string[] = [];
  for (const satu of ruas) {
    if (satu.startsWith(AWALAN_COCOK)) {
      const nama = satu.slice(AWALAN_COCOK.length).trim().toLowerCase();
      if (nama && !cocok.includes(nama)) cocok.push(nama);
      continue;
    }
    const label = RUAS_BOT[satu]?.label ?? satu;
    if (!hasil.includes(label)) hasil.push(label);
  }
  if (cocok.length > 0) hasil.push(`keterangan “cocok karena” (${cocok.join(", ")})`);
  return hasil;
}

// ===========================================================================
// PILIHAN TAMPILAN - DIINGAT PER PERAMBAN
// ===========================================================================

export type TampilanHasil = "detail" | "daftar" | "kotak" | "kelompok";

export const PILIHAN_TAMPILAN: Array<{ kunci: TampilanHasil; label: string }> = [
  { kunci: "detail", label: "Detail" },
  { kunci: "daftar", label: "Daftar" },
  { kunci: "kotak", label: "Kotak" },
  { kunci: "kelompok", label: "Kelompok" },
];

/**
 * Bawaan TETAP kotak: itulah yang dilihat orang sebelum pilihan ini ada, dan
 * mengubah bawaan diam-diam membuat kebiasaan orang tersandung tanpa sebab
 * yang tampak.
 */
export const TAMPILAN_BAWAAN: TampilanHasil = "kotak";

const KUNCI_TAMPILAN = "aleta.status-perkara.tampilan-hasil";
const KUNCI_KOLOM_CETAK = "aleta.status-perkara.kolom-cetak";

/**
 * Pilihan tampilan yang tersimpan. Penyimpanan situs boleh diblokir peramban
 * (mode privat, kebijakan kantor) - layar tetap harus dapat dipakai, hanya
 * pilihannya yang tidak diingat. Karena itu kegagalannya dijawab dengan
 * bawaan, bukan dilempar ke atas dan menjatuhkan layar.
 */
export function bacaTampilanTersimpan(): TampilanHasil {
  try {
    const tersimpan = window.localStorage.getItem(KUNCI_TAMPILAN);
    if (tersimpan && PILIHAN_TAMPILAN.some((x) => x.kunci === tersimpan)) {
      return tersimpan as TampilanHasil;
    }
  } catch {
    // Lihat catatan di atas: yang hilang hanya ingatan, bukan fungsinya.
  }
  return TAMPILAN_BAWAAN;
}

export function simpanTampilan(tampilan: TampilanHasil) {
  try {
    window.localStorage.setItem(KUNCI_TAMPILAN, tampilan);
  } catch {
    // Lihat bacaTampilanTersimpan.
  }
}

// ===========================================================================
// KOLOM - SATU DEFINISI UNTUK TABEL, URUTAN, SARINGAN DI LAYAR, DAN CETAK
// ===========================================================================

export type KunciKolom =
  | "nomor"
  | "jenis"
  | "pihak1"
  | "pihak2"
  | "kuasa"
  | "daftar"
  | "tahapan"
  | "sidangTerakhir"
  | "sidangBerikut"
  | "jumlahSidang"
  | "hakim"
  | "panitera"
  | "jurusita"
  | "putus"
  | "statusPutusan"
  | "minutasi"
  | "bht"
  | "aktaCerai"
  | "umur"
  | "ecourt"
  | "cocok";

type JenisKolom = "nomor" | "teks" | "tanggal" | "angka" | "ya-tidak";

type NilaiMentah = string | number | boolean | null | undefined;

export type KolomHasil = {
  kunci: KunciKolom;
  label: string;
  jenis: JenisKolom;
  /** Nilai MENTAH untuk mengurutkan - tanggal tetap ISO, angka tetap angka. */
  nilai: (b: BarisHasil) => NilaiMentah;
  /** Ruas kiriman bot yang menjadi sumbernya - untuk menyebut yang belum dikirim. */
  ruas?: keyof BarisHasil;
  bisaUrut?: boolean;
  /** Kelas lebar sel pada tabel Detail. */
  kelas?: string;
  /**
   * Bobot lebar kolom di LEMBAR CETAK, relatif terhadap kolom lain yang ikut
   * dicetak. Tanpa bobot semua kolom dibagi rata: terukur pada 22 kolom di
   * bidang A4 mendatar, tiap kolom ±49 px - nomor perkara pecah empat baris
   * sementara kolom "e-Court" yang isinya "Ya" mendapat lebar yang sama.
   */
  bobotCetak: number;
  /**
   * Kata di kolom ini TIDAK boleh dipatahkan di lembar cetak - nomor, tanggal,
   * angka, ya/tidak, status, akta cerai. Bila kolom yang dipilih tidak muat
   * utuh selebar kertas, kolom inilah yang lebih dahulu mendapat lebar
   * minimumnya; kata panjang hanya dipatahkan di kolom teks (nama, tahapan,
   * keterangan). Lihat status-perkara-cetak-lebar.ts.
   */
  utuhCetak?: boolean;
};

export const KOLOM_HASIL: KolomHasil[] = [
  { kunci: "nomor", bobotCetak: 3.4, label: "Nomor perkara", jenis: "nomor", nilai: (b) => b.nomorPerkara },
  { kunci: "jenis", bobotCetak: 2.2, label: "Jenis perkara", jenis: "teks", nilai: (b) => b.jenisPerkara, kelas: "min-w-[9rem]" },
  {
    kunci: "pihak1",
    bobotCetak: 2.7,
    label: "Pihak pertama",
    jenis: "teks",
    nilai: (b) => b.pihak1,
    ruas: "pihak1",
    kelas: "min-w-[12rem] max-w-[18rem]",
  },
  {
    kunci: "pihak2",
    bobotCetak: 2.7,
    label: "Pihak kedua",
    jenis: "teks",
    nilai: (b) => b.pihak2,
    ruas: "pihak2",
    kelas: "min-w-[12rem] max-w-[18rem]",
  },
  { kunci: "kuasa", bobotCetak: 2.2, label: "Kuasa hukum", jenis: "teks", nilai: (b) => b.kuasa, ruas: "kuasa", kelas: "min-w-[10rem]" },
  { kunci: "daftar", bobotCetak: 2.5, label: "Didaftarkan", jenis: "tanggal", nilai: (b) => b.tanggalDaftar },
  {
    kunci: "tahapan",
    bobotCetak: 2.2,
    label: "Tahapan / proses",
    jenis: "teks",
    nilai: (b) => b.tahapan,
    ruas: "tahapan",
    kelas: "min-w-[10rem] max-w-[16rem]",
  },
  { kunci: "sidangTerakhir", bobotCetak: 2.5, label: "Sidang terakhir", jenis: "tanggal", nilai: (b) => b.sidangTerakhir, ruas: "sidangTerakhir" },
  { kunci: "sidangBerikut", bobotCetak: 2.5, label: "Sidang berikut", jenis: "tanggal", nilai: (b) => b.sidangBerikut, ruas: "sidangBerikut" },
  { kunci: "jumlahSidang", bobotCetak: 1.3, label: "Jumlah sidang", jenis: "angka", nilai: (b) => b.jumlahSidang, ruas: "jumlahSidang" },
  { kunci: "hakim", bobotCetak: 2.2, label: "Hakim ketua", jenis: "teks", nilai: (b) => b.hakimKetua, ruas: "hakimKetua", kelas: "min-w-[10rem]" },
  {
    kunci: "panitera",
    bobotCetak: 2.2,
    label: "Panitera pengganti",
    jenis: "teks",
    nilai: (b) => b.paniteraPengganti,
    ruas: "paniteraPengganti",
    kelas: "min-w-[10rem]",
  },
  { kunci: "jurusita", bobotCetak: 2, label: "Juru sita", jenis: "teks", nilai: (b) => b.jurusita, ruas: "jurusita", kelas: "min-w-[10rem]" },
  { kunci: "putus", bobotCetak: 2.5, label: "Diputus", jenis: "tanggal", nilai: (b) => (b.sudahPutus ? b.tanggalPutusan : "") },
  {
    kunci: "statusPutusan",
    bobotCetak: 1.9,
    label: "Status putusan",
    jenis: "teks",
    nilai: (b) => b.statusPutusan,
    kelas: "min-w-[8rem]",
    // Teks, tetapi satu-dua kata baku ("Dikabulkan", "Dicoret dari
    // Register") - "Dikabulka|n" di lembar cetak terukur pada 89 dari 100
    // baris cerai talak 2024.
    utuhCetak: true,
  },
  { kunci: "minutasi", bobotCetak: 2.5, label: "Minutasi", jenis: "tanggal", nilai: (b) => b.tanggalMinutasi },
  { kunci: "bht", bobotCetak: 2.5, label: "BHT", jenis: "tanggal", nilai: (b) => b.tanggalBht },
  // Diurutkan menurut TANGGAL aktanya - nomor akta berurut per tahun, jadi
  // mengurutkan nomornya sebagai teks mencampur tahun.
  {
    kunci: "aktaCerai",
    bobotCetak: 2.6,
    label: "Akta cerai",
    jenis: "tanggal",
    nilai: (b) => b.tanggalAktaCerai,
    ruas: "nomorAktaCerai",
    kelas: "min-w-[10rem]",
  },
  { kunci: "umur", bobotCetak: 1.3, label: "Umur (hari)", jenis: "angka", nilai: (b) => b.umurHari, ruas: "umurHari" },
  { kunci: "ecourt", bobotCetak: 1.2, label: "e-Court", jenis: "ya-tidak", nilai: (b) => b.ecourt, ruas: "ecourt" },
  {
    kunci: "cocok",
    bobotCetak: 3,
    label: "Cocok karena",
    jenis: "teks",
    nilai: (b) => (b.cocok ?? []).map((x) => `${x.medan}: ${x.nilai}`).join("; "),
    bisaUrut: false,
    kelas: "min-w-[14rem] max-w-[22rem]",
  },
];

/** Kolom yang ikut dicetak bila penggunanya belum pernah memilih. */
export const KOLOM_CETAK_BAWAAN: KunciKolom[] = [
  "nomor",
  "jenis",
  "pihak1",
  "pihak2",
  "daftar",
  "tahapan",
  "hakim",
  "putus",
  "statusPutusan",
  "umur",
];

function kolomMenurutKunci(kunci: KunciKolom): KolomHasil | undefined {
  return KOLOM_HASIL.find((x) => x.kunci === kunci);
}

/**
 * Apakah kata di kolom ini tidak boleh dipatahkan di lembar cetak: nomor,
 * tanggal, angka, dan ya/tidak selalu; kolom teks hanya bila ditandai
 * utuhCetak.
 */
export function kolomUtuhCetak(kolom: KolomHasil): boolean {
  return kolom.utuhCetak ?? kolom.jenis !== "teks";
}

/**
 * Teks satu sel - untuk layar maupun lembar cetak.
 *
 * Tanggal HANYA lewat lib/tanggal-indonesia: layar memakai bentuk berhari
 * ("Rab, 07-10-2026"), lembar cetak bentuk angka saja karena kolomnya sempit.
 */
export function teksSel(kolom: KolomHasil, b: BarisHasil, bentuk: "layar" | "cetak" = "layar"): string {
  // Bagian yang gagal dibaca TIDAK ditulis sebagai nilainya: bot mengisinya
  // dengan "tidak ada" ("", 0), dan "0 sidang" dari kueri yang gagal adalah
  // angka karangan.
  if (selTakTerbaca(kolom.kunci, b)) return TEKS_TAK_TERBACA;
  switch (kolom.kunci) {
    case "cocok": {
      const ada = (b.cocok ?? []).map((x) => `${x.medan}: ${x.nilai}`);
      const gagal = cocokTakTerbaca(b);
      if (gagal.length > 0) ada.push(`${TEKS_TAK_TERBACA}: ${gagal.join(", ")}`);
      return ada.join("; ") || "—";
    }
    case "pihak1":
    case "pihak2": {
      const nama = String((kolom.kunci === "pihak1" ? b.pihak1 : b.pihak2) ?? "").trim();
      const sebutan = String((kolom.kunci === "pihak1" ? b.sebutanPihak1 : b.sebutanPihak2) ?? "").trim();
      if (!nama) return "—";
      return sebutan ? `${sebutan}: ${nama}` : nama;
    }
    case "tahapan": {
      const tahap = String(b.tahapan ?? "").trim();
      const proses = String(b.proses ?? "").trim();
      if (!tahap && !proses) return "—";
      return proses && proses !== tahap ? `${tahap || "—"} — ${proses}` : tahap || proses;
    }
    case "aktaCerai": {
      const nomor = String(b.nomorAktaCerai ?? "").trim();
      const tanggal = tanggalDMY(b.tanggalAktaCerai, "");
      if (!nomor && !tanggal) return "—";
      return [nomor, tanggal].filter(Boolean).join(", ");
    }
    case "statusPutusan": {
      const nama = String(b.statusPutusan ?? "").trim();
      if (nama) return nama;
      return b.sudahPutus ? "—" : "Belum putus";
    }
    default:
      break;
  }

  const v = kolom.nilai(b);
  if (kolom.jenis === "tanggal") {
    return bentuk === "cetak" ? tanggalDMY(v, "—") : tanggalHariPendek(v, "—");
  }
  if (kolom.jenis === "angka") {
    return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("id-ID") : "—";
  }
  if (kolom.jenis === "ya-tidak") {
    return v === true ? "Ya" : v === false ? "Tidak" : "—";
  }
  const teks = String(v ?? "").trim();
  return teks || "—";
}

// ===========================================================================
// URUTAN
// ===========================================================================

export type Urutan = { kunci: KunciKolom; arah: "naik" | "turun" } | null;

type KunciUrut = number | string | [number, number, string];

/** "2026-10-07" -> angka hari. Tanpa zona: Date.UTC, sama di mesin mana pun. */
function angkaTanggal(v: NilaiMentah): number | null {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? "").trim());
  if (!cocok) return null;
  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);
  if (!tahun || bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null;
  return Date.UTC(tahun, bulan - 1, hari);
}

/**
 * Kunci urut satu sel. null berarti KOSONG - dan yang kosong selalu di bawah,
 * naik maupun turun: pada urutan "Diputus, terbaru dulu" perkara yang belum
 * putus tidak boleh menutupi yang sudah.
 */
function kunciUrut(kolom: KolomHasil, b: BarisHasil): KunciUrut | null {
  // Yang gagal dibaca diperlakukan KOSONG, bukan sebagai nilai pengisinya -
  // kalau tidak, "0 sidang" karangan ikut bersaing di puncak urutan menaik.
  if (selTakTerbaca(kolom.kunci, b)) return null;
  const v = kolom.nilai(b);
  switch (kolom.jenis) {
    case "tanggal":
      return angkaTanggal(v);
    case "angka":
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    case "ya-tidak":
      return v === true ? 1 : v === false ? 0 : null;
    case "nomor": {
      const teks = String(v ?? "").trim();
      if (!teks) return null;
      // "419/Pdt.G/2026/PA.Dgl": tahun dulu, lalu nomor urutnya SEBAGAI ANGKA.
      // Sebagai teks, 1000/Pdt.G/2026 jatuh sebelum 999/Pdt.G/2026.
      const bagian = /^(\d+)\/(.+?)\/(\d{4})(?:\/|$)/.exec(teks);
      if (!bagian) return [Number.MAX_SAFE_INTEGER, 0, teks];
      return [Number(bagian[3]), Number(bagian[1]), bagian[2]];
    }
    default: {
      const teks = String(v ?? "").trim();
      return teks ? teks : null;
    }
  }
}

function banding(x: KunciUrut, y: KunciUrut): number {
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (Array.isArray(x) && Array.isArray(y)) {
    return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2], "id", { numeric: true, sensitivity: "base" });
  }
  return String(x).localeCompare(String(y), "id", { numeric: true, sensitivity: "base" });
}

/**
 * Mengurutkan baris. null = urutan asal dari bot, TIDAK disentuh.
 *
 * Urutannya stabil: dua baris yang sama nilainya tetap pada urutan asalnya,
 * supaya mengklik kepala kolom dua kali tidak mengacak baris yang seri.
 */
export function urutkanBaris(baris: BarisHasil[], urut: Urutan): BarisHasil[] {
  if (!urut) return baris;
  const kolom = kolomMenurutKunci(urut.kunci);
  if (!kolom || kolom.bisaUrut === false) return baris;
  const arah = urut.arah === "naik" ? 1 : -1;
  return baris
    .map((b, i) => ({ b, i, k: kunciUrut(kolom, b) }))
    .sort((x, y) => {
      if (x.k === null && y.k === null) return x.i - y.i;
      if (x.k === null) return 1;
      if (y.k === null) return -1;
      const hasil = banding(x.k, y.k);
      return hasil !== 0 ? hasil * arah : x.i - y.i;
    })
    .map((x) => x.b);
}

/** Klik kepala kolom: naik -> turun -> kembali ke urutan asal. */
export function urutBerikut(urut: Urutan, kunci: KunciKolom): Urutan {
  if (!urut || urut.kunci !== kunci) return { kunci, arah: "naik" };
  if (urut.arah === "naik") return { kunci, arah: "turun" };
  return null;
}

/**
 * Menyaring baris yang SUDAH termuat. Dicocokkan ke teks yang tampak di tiap
 * kolom beserta "cocok karena" - jadi kuasa, akta cerai, juru sita ikut
 * terjangkau walau tidak ada kotak saringan tersendiri untuknya.
 */
export function saringBarisLokal(baris: BarisHasil[], kata: string): BarisHasil[] {
  const dicari = kata.trim().toLowerCase();
  if (!dicari) return baris;
  return baris.filter((b) =>
    KOLOM_HASIL.some((k) => teksSel(k, b).toLowerCase().includes(dicari) || teksSel(k, b, "cetak").toLowerCase().includes(dicari))
  );
}

// ===========================================================================
// KELOMPOK
// ===========================================================================

type KelompokMenurut = "tahapan" | "jenis" | "keadaan";

const PILIHAN_KELOMPOK: Array<{ kunci: KelompokMenurut; label: string }> = [
  { kunci: "tahapan", label: "Tahapan" },
  { kunci: "jenis", label: "Jenis perkara" },
  { kunci: "keadaan", label: "Keadaan putusan" },
];

function namaKelompok(b: BarisHasil, menurut: KelompokMenurut): string {
  if (menurut === "tahapan") {
    // Belum dikirim dibedakan dari tidak tercatat: yang pertama urusan bot
    // versi lama, yang kedua keadaan SIPP-nya. Yang GAGAL dibaca dibedakan
    // dari keduanya - bot mengisinya kosong, dan tanpa ini perkaranya
    // dikelompokkan sebagai "tidak tercatat di SIPP".
    if (selTakTerbaca("tahapan", b)) return "Tahapan gagal dibaca dari SIPP";
    if (b.tahapan === undefined) return "Tahapan belum dikirim ALETA Bot";
    return String(b.tahapan).trim() || "Tahapan tidak tercatat di SIPP";
  }
  if (menurut === "jenis") return String(b.jenisPerkara ?? "").trim() || "Jenis perkara tidak tercatat";
  if (!b.sudahPutus) return "Belum putus";
  const nama = String(b.statusPutusan ?? "").trim();
  return nama ? `Sudah putus — ${nama}` : "Sudah putus";
}

export function kelompokkanBaris(
  baris: BarisHasil[],
  menurut: KelompokMenurut
): Array<{ nama: string; baris: BarisHasil[] }> {
  const peta = new Map<string, BarisHasil[]>();
  for (const b of baris) {
    const nama = namaKelompok(b, menurut);
    const isi = peta.get(nama);
    if (isi) isi.push(b);
    else peta.set(nama, [b]);
  }
  // Yang terbanyak di atas: pertanyaan pertama orang yang mengelompokkan
  // hampir selalu "yang mana paling banyak".
  return [...peta.entries()]
    .map(([nama, isi]) => ({ nama, baris: isi }))
    .sort((a, b) => b.baris.length - a.baris.length || a.nama.localeCompare(b.nama, "id"));
}

// ===========================================================================
// KOMPONEN
// ===========================================================================

function kunciBaris(b: BarisHasil) {
  return b.perkaraId || b.nomorPerkara;
}

const IKON_TAMPILAN: Record<TampilanHasil, typeof Table2> = {
  detail: Table2,
  daftar: List,
  kotak: LayoutGrid,
  kelompok: Layers,
};

export function HasilPencarianPerkara({
  hasil,
  tampilan,
  onUbahTampilan,
  urut,
  onUbahUrut,
  onBuka,
  adaLagi,
  memuatLagi,
  onMuatLagi,
  onMuatSemua,
  paguMuat,
  kriteria,
  namaPengadilan,
  lapis = "",
  aksi,
  pengukurCetak,
}: {
  hasil: BarisHasil[];
  tampilan: TampilanHasil;
  onUbahTampilan: (tampilan: TampilanHasil) => void;
  urut: Urutan;
  onUbahUrut: (urut: Urutan) => void;
  onBuka: (nomorPerkara: string) => void;
  /** Bot menyebut masih ada perkara sesudah yang termuat. */
  adaLagi: boolean;
  memuatLagi: boolean;
  onMuatLagi: () => void;
  onMuatSemua: () => void;
  paguMuat: number;
  /** Kalimat kriteria pencarian yang menghasilkan daftar ini - untuk lembar cetak. */
  kriteria: string[];
  namaPengadilan: string;
  /**
   * Lapis kata bebas yang menjawab, kiriman bot: "dalam" berarti kata itu
   * tidak cocok pada nomor, jenis, pihak, maupun kuasa, dan yang tampil ketemu
   * di alamat, KUA, petugas, agenda sidang, pertimbangan, atau amar.
   */
  lapis?: string;
  /** Tombol tambahan di bilah alat; menerima baris yang SEDANG tampil. */
  aksi?: (barisTampil: BarisHasil[]) => ReactNode;
  /**
   * Pengukur teks untuk tata letak lembar cetak. Tidak diisi: kanvas
   * peramban. null: tanpa pengukuran. Uji mengisinya dengan pengukur buatan.
   */
  pengukurCetak?: PengukurTeks | null;
}) {
  const [pengukur] = useState<PengukurTeks | null>(() =>
    pengukurCetak === undefined ? pengukurKanvas() : pengukurCetak
  );
  const [saringLokal, setSaringLokal] = useState("");
  const [kelompokMenurut, setKelompokMenurut] = useState<KelompokMenurut>("tahapan");
  const [terlipat, setTerlipat] = useState<Set<string>>(() => new Set());
  const [pilihKolom, setPilihKolom] = useState(false);
  const [kolomCetak, setKolomCetak] = useState<KunciKolom[]>(bacaKolomCetak);
  const [mencetak, setMencetak] = useState(false);

  const barisTersaring = useMemo(() => saringBarisLokal(hasil, saringLokal), [hasil, saringLokal]);
  const barisTampil = useMemo(() => urutkanBaris(barisTersaring, urut), [barisTersaring, urut]);

  // Kolom yang SELURUHNYA belum dikirim bot - disebutkan, bukan didiamkan.
  const kolomBelumDikirim = useMemo(
    () =>
      KOLOM_HASIL.filter(
        (k) => k.ruas !== undefined && hasil.length > 0 && hasil.every((b) => b[k.ruas as keyof BarisHasil] === undefined)
      ),
    [hasil]
  );

  const kolomUrut = KOLOM_HASIL.filter((k) => k.bisaUrut !== false);
  const labelUrut = urut ? kolomMenurutKunci(urut.kunci)?.label ?? "" : "";

  // Bagian yang gagal dibaca, dihimpun dari BARIS-nya - tiap baris membawa
  // kegagalan halamannya sendiri (lihat tandaiTakTerbaca).
  const takTerbaca = useMemo(() => {
    const ruas: string[] = [];
    let perkara = 0;
    for (const b of hasil) {
      if (!b.takTerbaca || b.takTerbaca.length === 0) continue;
      perkara += 1;
      for (const satu of b.takTerbaca) if (!ruas.includes(satu)) ruas.push(satu);
    }
    return { sebutan: sebutanTakTerbaca(ruas), perkara };
  }, [hasil]);

  const catatanCetak = useMemo(() => {
    const kalimat: string[] = [];
    if (lapis === "dalam") kalimat.push(KALIMAT_LAPIS_DALAM);
    if (saringLokal.trim()) {
      kalimat.push(
        `Disaring di layar dengan kata “${saringLokal.trim()}”: ${barisTampil.length} dari ${hasil.length} perkara yang termuat.`
      );
    }
    if (urut && labelUrut) {
      kalimat.push(`Diurutkan menurut ${labelUrut.toLowerCase()}, ${urut.arah === "naik" ? "menaik" : "menurun"}.`);
    }
    if (adaLagi) {
      kalimat.push(
        `Yang tercetak hanya ${hasil.length} perkara yang sudah dimuat; masih ada perkara lain yang cocok tetapi belum dimuat.`
      );
    }
    if (takTerbaca.sebutan.length > 0) {
      kalimat.push(
        `Keterangan ${takTerbaca.sebutan.join(", ")} gagal dibaca dari SIPP untuk ${takTerbaca.perkara} perkara; sel bertanda “${TEKS_TAK_TERBACA}” belum tentu kosong.`
      );
    }
    return kalimat;
  }, [lapis, saringLokal, barisTampil.length, hasil.length, urut, labelUrut, adaLagi, takTerbaca]);

  const kolomTercetak = KOLOM_HASIL.filter((k) => kolomCetak.includes(k.kunci));
  // Stabil: lembar cetak memasang pewaktu cetaknya ulang tiap penutup ini
  // berganti, dan penutup yang dibuat ulang tiap gambar dapat menunda cetak
  // selama komponen ini terus digambar ulang.
  const selesaiCetak = useCallback(() => setMencetak(false), []);

  // Tata letak lembar cetak DIPRATINJAU di panel pilih kolom: huruf yang
  // diperkecil dan kolom yang katanya tetap akan dipatahkan dikatakan SEBELUM
  // mencetak, bukan ditemukan di kertas (telaah 26 September 2026: "Semua
  // kolom" mematahkan nomor perkara di seluruh baris tanpa satu peringatan).
  const pratinjauCetak = useMemo(() => {
    if (!pilihKolom) return null;
    const kolom = KOLOM_HASIL.filter((k) => kolomCetak.includes(k.kunci));
    if (kolom.length === 0) return null;
    return {
      kolom,
      tata: susunTataLetakCetak({
        kepala: kolom.map((k) => k.label),
        baris: barisTampil.map((b) => kolom.map((k) => teksSel(k, b, "cetak"))),
        bobot: kolom.map((k) => k.bobotCetak),
        utuh: kolom.map(kolomUtuhCetak),
        ukur: pengukur,
      }),
    };
  }, [pilihKolom, kolomCetak, barisTampil, pengukur]);

  return (
    <div className="min-w-0 space-y-2">
      {/* ================================================================
          BILAH ALAT: tampilan, urutan, saringan di layar, cetak
          ================================================================ */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Bila bot menyatakan masih ada, yang termuat BUKAN jumlah yang
            cocok. "100 perkara cocok" di atas, "masih ada yang cocok" di
            bawah daftar, dulu tampil bersamaan (telaah 26 September 2026). */}
        <p className="text-sm text-muted-foreground" data-bagian="kepala-hasil">
          {adaLagi
            ? `${hasil.length.toLocaleString("id-ID")} perkara pertama termuat — masih ada yang cocok; pilih salah satu:`
            : `${hasil.length.toLocaleString("id-ID")} perkara cocok — pilih salah satu:`}
        </p>

        <div
          role="group"
          aria-label="Tampilan hasil"
          className="inline-flex flex-wrap rounded-lg border bg-card p-0.5"
        >
          {PILIHAN_TAMPILAN.map((pilihan) => {
            const Ikon = IKON_TAMPILAN[pilihan.kunci];
            const aktif = tampilan === pilihan.kunci;
            return (
              <button
                key={pilihan.kunci}
                type="button"
                aria-pressed={aktif}
                onClick={() => onUbahTampilan(pilihan.kunci)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
                  aktif ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Ikon className="h-3.5 w-3.5" aria-hidden="true" />
                {pilihan.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Urutkan
            <select
              aria-label="Urutkan menurut"
              value={urut?.kunci ?? ""}
              onChange={(e) =>
                onUbahUrut(e.target.value ? { kunci: e.target.value as KunciKolom, arah: urut?.arah ?? "naik" } : null)
              }
              className="h-8 max-w-[11rem] rounded-md border bg-card px-1.5 text-xs text-foreground"
            >
              <option value="">Urutan asal</option>
              {kolomUrut.map((k) => (
                <option key={k.kunci} value={k.kunci}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {urut ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => onUbahUrut({ kunci: urut.kunci, arah: urut.arah === "naik" ? "turun" : "naik" })}
            >
              {urut.arah === "naik" ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {urut.arah === "naik" ? "Menaik" : "Menurun"}
            </Button>
          ) : null}
        </div>

        <Input
          type="search"
          aria-label="Saring hasil yang termuat"
          placeholder="Saring hasil yang termuat…"
          value={saringLokal}
          onChange={(e) => setSaringLokal(e.target.value)}
          className="h-8 w-full text-xs sm:w-56"
        />

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {aksi ? aksi(barisTampil) : null}
          <Button size="sm" variant="outline" onClick={() => setPilihKolom((x) => !x)} aria-expanded={pilihKolom}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Cetak
          </Button>
        </div>
      </div>

      {/* ================================================================
          PILIH KOLOM YANG DICETAK
          ================================================================ */}
      {pilihKolom ? (
        <div
          role="group"
          aria-label="Kolom yang dicetak"
          className="space-y-2 rounded-lg border bg-card p-3 motion-safe:animate-in motion-safe:fade-in-0"
        >
          <p className="text-sm font-medium">
            Kolom yang ikut dicetak — {barisTampil.length.toLocaleString("id-ID")} perkara, urutan dan saringan
            seperti yang tampil.
          </p>
          {pratinjauCetak ? <PeringatanCetak kolom={pratinjauCetak.kolom} tata={pratinjauCetak.tata} /> : null}
          <div className="grid gap-1 sm:grid-cols-3 lg:grid-cols-4">
            {KOLOM_HASIL.map((k) => (
              <label key={k.kunci} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={kolomCetak.includes(k.kunci)}
                  onChange={(e) => {
                    const berikut = e.target.checked
                      ? KOLOM_HASIL.filter((x) => x.kunci === k.kunci || kolomCetak.includes(x.kunci)).map((x) => x.kunci)
                      : kolomCetak.filter((x) => x !== k.kunci);
                    setKolomCetak(berikut);
                    simpanKolomCetak(berikut);
                  }}
                />
                {k.label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={kolomTercetak.length === 0 || barisTampil.length === 0}
              onClick={() => {
                setPilihKolom(false);
                setMencetak(true);
              }}
            >
              Cetak sekarang
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const semua = KOLOM_HASIL.map((x) => x.kunci);
                setKolomCetak(semua);
                simpanKolomCetak(semua);
              }}
            >
              Semua kolom
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setKolomCetak(KOLOM_CETAK_BAWAAN);
                simpanKolomCetak(KOLOM_CETAK_BAWAAN);
              }}
            >
              Kolom bawaan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPilihKolom(false)}>
              Batal
            </Button>
          </div>
        </div>
      ) : null}

      {mencetak ? (
        <LembarCetakHasil
          namaPengadilan={namaPengadilan}
          kriteria={kriteria}
          catatan={catatanCetak}
          kepala={kolomTercetak.map((k) => k.label)}
          bobot={kolomTercetak.map((k) => k.bobotCetak)}
          utuh={kolomTercetak.map(kolomUtuhCetak)}
          baris={barisTampil.map((b) => kolomTercetak.map((k) => teksSel(k, b, "cetak")))}
          ukur={pengukur}
          onSelesai={selesaiCetak}
        />
      ) : null}

      {takTerbaca.sebutan.length > 0 ? (
        <p
          role="status"
          className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-800 dark:text-rose-200"
        >
          Keterangan {takTerbaca.sebutan.join(", ")} gagal dibaca dari SIPP untuk{" "}
          {takTerbaca.perkara.toLocaleString("id-ID")} dari {hasil.length.toLocaleString("id-ID")} perkara yang
          termuat. Selnya bertanda &quot;{TEKS_TAK_TERBACA}&quot; — belum tentu kosong di SIPP; bukalah perkaranya
          untuk memastikan.
        </p>
      ) : null}

      {/* ================================================================
          YANG TIDAK UTUH DIKATAKAN
          ================================================================ */}
      {/* Hasil lapis dalam dikatakan: tanpa kalimat ini, perkara yang ketemu
          di pertimbangan hukum tampak seperti salah tangkap nama pihak. */}
      {lapis === "dalam" ? <p className="text-xs text-muted-foreground">{KALIMAT_LAPIS_DALAM}</p> : null}
      {saringLokal.trim() ? (
        <p className="text-xs text-muted-foreground">
          Menampilkan {barisTampil.length.toLocaleString("id-ID")} dari {hasil.length.toLocaleString("id-ID")} perkara
          yang termuat.
        </p>
      ) : null}
      {urut && adaLagi ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          {/* Pada pagu, tombol Muat semua sudah tidak ada - kalimat yang tetap
              menyuruh menekannya menunjuk tombol yang hilang dan menjanjikan
              urutan lengkap yang mustahil. */}
          {hasil.length < paguMuat
            ? `Diurutkan dari ${hasil.length.toLocaleString("id-ID")} perkara yang termuat — muat semua untuk urutan lengkap.`
            : `Diurutkan dari ${hasil.length.toLocaleString("id-ID")} perkara yang termuat; sisanya melewati pagu ${paguMuat.toLocaleString("id-ID")} — persempit pencarian untuk urutan yang utuh.`}
        </p>
      ) : null}
      {kolomBelumDikirim.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {kolomBelumDikirim.length} kolom belum dikirim ALETA Bot versi ini (
          {kolomBelumDikirim.map((k) => k.label.toLowerCase()).join(", ")}) — tampil sebagai &quot;—&quot; sampai bot
          diperbarui, bukan karena SIPP-nya kosong.
        </p>
      ) : null}

      {barisTampil.length === 0 ? (
        <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
          Tidak ada perkara termuat yang cocok dengan saringan &quot;{saringLokal.trim()}&quot;.
        </p>
      ) : tampilan === "detail" ? (
        <TabelDetail baris={barisTampil} urut={urut} onUbahUrut={onUbahUrut} onBuka={onBuka} />
      ) : tampilan === "daftar" ? (
        <ul className="divide-y rounded-lg border bg-card" aria-label="Daftar hasil">
          {barisTampil.map((b) => (
            <BarisDaftar key={kunciBaris(b)} b={b} onBuka={onBuka} />
          ))}
        </ul>
      ) : tampilan === "kelompok" ? (
        <TampilanKelompok
          baris={barisTampil}
          adaLagi={adaLagi}
          menurut={kelompokMenurut}
          onUbahMenurut={(x) => {
            setKelompokMenurut(x);
            setTerlipat(new Set());
          }}
          terlipat={terlipat}
          onUbahTerlipat={setTerlipat}
          onBuka={onBuka}
        />
      ) : (
        <KisiKotak baris={barisTampil} onBuka={onBuka} />
      )}

      {/* ================================================================
          MUAT LEBIH BANYAK
          ================================================================ */}
      {adaLagi ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {hasil.length.toLocaleString("id-ID")} perkara termuat; masih ada yang cocok.
          </p>
          {hasil.length < paguMuat ? (
            <>
              <Button size="sm" variant="outline" disabled={memuatLagi} onClick={onMuatLagi}>
                {memuatLagi ? "Memuat…" : "Muat lebih banyak"}
              </Button>
              <Button size="sm" variant="outline" disabled={memuatLagi} onClick={onMuatSemua}>
                Muat semua (sampai {paguMuat.toLocaleString("id-ID")})
              </Button>
            </>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Pagu {paguMuat.toLocaleString("id-ID")} perkara tercapai — persempit pencarian untuk melihat sisanya.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function bacaKolomCetak(): KunciKolom[] {
  try {
    const tersimpan = window.localStorage.getItem(KUNCI_KOLOM_CETAK);
    if (tersimpan) {
      const daftar = JSON.parse(tersimpan);
      if (Array.isArray(daftar)) {
        const sah = KOLOM_HASIL.map((x) => x.kunci).filter((k) => daftar.includes(k));
        if (sah.length > 0) return sah;
      }
    }
  } catch {
    // Penyimpanan diblokir atau isinya rusak: kembali ke kolom bawaan.
  }
  return KOLOM_CETAK_BAWAAN;
}

function simpanKolomCetak(kolom: KunciKolom[]) {
  try {
    window.localStorage.setItem(KUNCI_KOLOM_CETAK, JSON.stringify(kolom));
  } catch {
    // Lihat bacaTampilanTersimpan.
  }
}

/** "5,5 pt" - angka desimal menurut kebiasaan Indonesia. */
function teksPt(pt: number): string {
  return `${pt.toLocaleString("id-ID")} pt`;
}

/**
 * Apa yang akan terjadi pada lembar cetak dengan kolom pilihan ini - dikatakan
 * sebelum mencetak. Tiga keadaan:
 *
 *   - seluruh kata utuh pada huruf awalnya: tidak ada yang perlu dikatakan;
 *   - hurufnya diperkecil supaya seluruh kata utuh: disebut ukurannya;
 *   - pada huruf terkecil pun tidak muat: kolom yang katanya akan dipatahkan
 *     DISEBUT, dan penggunanya diminta mengurangi kolom.
 *
 * Tanpa pengukur (peramban tanpa kanvas) apa yang patah tidak dapat
 * diketahui - dan itu pun dikatakan bila kolomnya banyak.
 */
function PeringatanCetak({ kolom, tata }: { kolom: KolomHasil[]; tata: TataLetakCetak }) {
  const awal = parseFloat(ukuranHurufCetak(kolom.length + 1));
  if (!tata.terukur) {
    if (kolom.length + 1 <= 16) return null;
    return (
      <p data-bagian="peringatan-cetak" className="text-xs text-muted-foreground">
        {kolom.length} kolom dicetak dengan huruf {teksPt(awal)}. Kata yang lebih lebar dari kolomnya akan dipatahkan —
        lebarnya tidak dapat diukur di peramban ini.
      </p>
    );
  }
  if (tata.kolomPatah.length > 0) {
    const nama = tata.kolomPatah.map((j) => (j === 0 ? "No" : kolom[j - 1]?.label ?? "")).filter(Boolean);
    return (
      <p
        data-bagian="peringatan-cetak"
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-200"
      >
        {kolom.length} kolom tidak muat utuh selebar A4 mendatar walau huruf diperkecil sampai {teksPt(tata.ukuranPt)}:
        kata panjang pada kolom {nama.join(", ")} akan dipatahkan. Nomor perkara, tanggal, dan angka tetap utuh.
        Kurangi kolom supaya seluruhnya utuh.
      </p>
    );
  }
  if (tata.ukuranPt < awal) {
    return (
      <p data-bagian="peringatan-cetak" className="text-xs text-muted-foreground">
        Huruf diperkecil dari {teksPt(awal)} menjadi {teksPt(tata.ukuranPt)} supaya tidak ada kata yang dipatahkan.
      </p>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// DETAIL
// ---------------------------------------------------------------------------

/**
 * Tabel lengkap.
 *
 * ============================================================================
 * TABELNYA MENGGULUNG DI DALAM WADAHNYA, TIDAK PERNAH MENDORONG HALAMAN
 * ============================================================================
 *
 * Dua puluh satu kolom tidak muat di layar mana pun. Wadahnya menggulung ke
 * bawah DAN ke samping; halaman di sekitarnya tidak ikut melebar.
 *
 * overflow-auto saja TIDAK cukup. Lebar minimum isi sebuah wadah bergulir tetap
 * dihitung ke atas: layar e-Court memakai grid `lg:grid-cols-[216px_1fr]`, dan
 * `1fr` bermakna minmax(auto, 1fr) - kolomnya melebar sampai selebar tabel, dan
 * pada 375 px seluruh halaman bergulir mendatar. `contain: inline-size`
 * memutus hitungan itu: lebar wadah ditentukan induknya, bukan isinya.
 *
 * Tingginya dibatasi menurut tinggi LAYAR PERANGKAT (dvh - tinggi yang
 * memperhitungkan bilah alamat ponsel yang muncul-hilang), dengan vh sebagai
 * cadangan bagi peramban yang belum mengenal dvh. Kepala tabel menempel di
 * atas dan kolom nomor perkara menempel di kiri saat digulir.
 */
function TabelDetail({
  baris,
  urut,
  onUbahUrut,
  onBuka,
}: {
  baris: BarisHasil[];
  urut: Urutan;
  onUbahUrut: (urut: Urutan) => void;
  onBuka: (nomorPerkara: string) => void;
}) {
  return (
    <div
      data-testid="wadah-tabel-hasil"
      tabIndex={0}
      aria-label="Tabel hasil pencarian; gulir ke samping dan ke bawah"
      className="w-full max-w-full overflow-auto overscroll-contain rounded-lg border bg-card [contain:inline-size] max-h-[70vh] supports-[height:100dvh]:max-h-[70dvh]"
    >
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {KOLOM_HASIL.map((k, i) => {
              const aktif = urut?.kunci === k.kunci;
              const arahAria = aktif ? (urut?.arah === "naik" ? "ascending" : "descending") : "none";
              return (
                <th
                  key={k.kunci}
                  scope="col"
                  aria-sort={k.bisaUrut === false ? undefined : arahAria}
                  className={cn(
                    "sticky top-0 whitespace-nowrap border-b bg-card px-2 py-1.5 text-left text-xs font-semibold",
                    i === 0 ? "left-0 z-30 border-r" : "z-20"
                  )}
                >
                  {k.bisaUrut === false ? (
                    <span className="text-muted-foreground">{k.label}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUbahUrut(urutBerikut(urut, k.kunci))}
                      title="Klik untuk mengurutkan: menaik, menurun, lalu kembali ke urutan asal"
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-0.5 hover:text-primary",
                        aktif ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {k.label}
                      {aktif ? (
                        urut?.arah === "naik" ? (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr
              key={kunciBaris(b)}
              data-nomor={b.nomorPerkara}
              onClick={() => onBuka(b.nomorPerkara)}
              className="group cursor-pointer"
            >
              {KOLOM_HASIL.map((k, i) =>
                i === 0 ? (
                  <td
                    key={k.kunci}
                    className="sticky left-0 z-10 whitespace-nowrap border-b border-r bg-card px-2 py-1.5 align-top group-hover:bg-muted"
                  >
                    {/* Tombol di dalam sel pertama: baris tabel tidak dapat
                        dijangkau papan ketik, tombol dapat. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBuka(b.nomorPerkara);
                      }}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {b.nomorPerkara}
                    </button>
                  </td>
                ) : (
                  <td
                    key={k.kunci}
                    className={cn(
                      "border-b px-2 py-1.5 align-top group-hover:bg-muted/60",
                      k.jenis === "tanggal" || k.jenis === "angka" || k.jenis === "ya-tidak" ? "whitespace-nowrap" : "",
                      k.jenis === "angka" ? "text-right tabular-nums" : "",
                      k.kelas
                    )}
                  >
                    <IsiSel kolom={k} b={b} />
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IsiSel({ kolom, b }: { kolom: KolomHasil; b: BarisHasil }) {
  if (selTakTerbaca(kolom.kunci, b)) {
    return (
      <span
        className="italic text-rose-700 dark:text-rose-300"
        title="Gagal dibaca dari SIPP untuk pencarian ini - bukalah perkaranya untuk memastikan."
      >
        {TEKS_TAK_TERBACA}
      </span>
    );
  }
  if (kolom.kunci === "pihak1" || kolom.kunci === "pihak2") {
    const nama = String((kolom.kunci === "pihak1" ? b.pihak1 : b.pihak2) ?? "").trim();
    const sebutan = String((kolom.kunci === "pihak1" ? b.sebutanPihak1 : b.sebutanPihak2) ?? "").trim();
    if (!nama) return <span className="text-muted-foreground">—</span>;
    return (
      <>
        {sebutan ? <span className="block text-[11px] text-muted-foreground">{sebutan}</span> : null}
        {nama}
      </>
    );
  }
  if (kolom.kunci === "tahapan") {
    const tahap = String(b.tahapan ?? "").trim();
    const proses = String(b.proses ?? "").trim();
    if (!tahap && !proses) return <span className="text-muted-foreground">—</span>;
    return (
      <>
        {tahap || "—"}
        {proses && proses !== tahap ? <span className="block text-[11px] text-muted-foreground">{proses}</span> : null}
      </>
    );
  }
  if (kolom.kunci === "cocok") {
    const gagal = cocokTakTerbaca(b);
    if ((!b.cocok || b.cocok.length === 0) && gagal.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    return (
      <>
        {(b.cocok ?? []).map((satu) => (
          <span key={satu.medan} className="block text-xs leading-snug">
            <span className="font-medium text-muted-foreground">{satu.medan}: </span>
            {satu.nilai}
          </span>
        ))}
        {/* Keterangan yang gagal dicari DISEBUT: tanpa ini perkara yang
            ketemu lewat nama kuasa tampil tanpa satu alasan pun. */}
        {gagal.length > 0 ? (
          <span className="block text-xs italic leading-snug text-rose-700 dark:text-rose-300">
            {TEKS_TAK_TERBACA}: {gagal.join(", ")}
          </span>
        ) : null}
      </>
    );
  }
  const teks = teksSel(kolom, b);
  return teks === "—" ? <span className="text-muted-foreground">—</span> : <>{teks}</>;
}

// ---------------------------------------------------------------------------
// DAFTAR
// ---------------------------------------------------------------------------

function ringkasPihakBaris(b: BarisHasil): string {
  const satu = String(b.pihak1 ?? "").trim();
  const dua = String(b.pihak2 ?? "").trim();
  if (satu && dua) return `${satu} lawan ${dua}`;
  return satu || dua;
}

function BarisDaftar({ b, onBuka }: { b: BarisHasil; onBuka: (nomorPerkara: string) => void }) {
  const pihak = ringkasPihakBaris(b);
  const tahap = String(b.tahapan ?? "").trim();
  return (
    <li>
      <button
        type="button"
        onClick={() => onBuka(b.nomorPerkara)}
        className="block w-full px-3 py-2 text-left transition hover:bg-muted/50"
      >
        <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="shrink-0 font-medium sm:w-56">{b.nomorPerkara}</span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="text-muted-foreground">{b.jenisPerkara || "—"}</span>
            {pihak ? <span> · {pihak}</span> : null}
            {tahap ? <span className="text-muted-foreground"> · {tahap}</span> : null}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground sm:text-right">
            Daftar {tanggalHariPendek(b.tanggalDaftar, "—")}
            {b.sudahPutus ? ` · putus ${tanggalHariPendek(b.tanggalPutusan, "—")}` : " · belum putus"}
          </span>
        </span>
        {b.cocok && b.cocok.length > 0 ? (
          <span className="mt-0.5 block text-xs leading-snug">
            {b.cocok.map((satu, i) => (
              <span key={satu.medan}>
                {i > 0 ? " · " : ""}
                <span className="font-medium text-muted-foreground">{satu.medan}: </span>
                {satu.nilai}
              </span>
            ))}
          </span>
        ) : null}
        <CocokTakTerbaca b={b} />
      </button>
    </li>
  );
}

/**
 * Keterangan "cocok karena" yang gagal dicari untuk satu perkara - disebut di
 * Daftar, Kotak, dan Kelompok seperti di tabel Detail. Tanpa ini perkara yang
 * ketemu lewat nama kuasa tampil tanpa satu alasan pun.
 */
function CocokTakTerbaca({ b }: { b: BarisHasil }) {
  const gagal = cocokTakTerbaca(b);
  if (gagal.length === 0) return null;
  return (
    <span className="mt-0.5 block text-xs italic leading-snug text-rose-700 dark:text-rose-300">
      Keterangan cocok {TEKS_TAK_TERBACA}: {gagal.join(", ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KOTAK - kisi kartu yang dulu hidup di aleta-ecourt-status-perkara.tsx
// ---------------------------------------------------------------------------

function KisiKotak({ baris, onBuka }: { baris: BarisHasil[]; onBuka: (nomorPerkara: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Kotak hasil">
      {baris.map((item) => (
        <button
          key={kunciBaris(item)}
          type="button"
          onClick={() => onBuka(item.nomorPerkara)}
          className="rounded-lg border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/50"
        >
          <p className="font-medium">{item.nomorPerkara}</p>
          <p className="text-sm text-muted-foreground">{item.jenisPerkara}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Daftar {tanggalHariPendek(item.tanggalDaftar, "—")}
            {item.sudahPutus ? ` · putus ${tanggalHariPendek(item.tanggalPutusan, "—")}` : " · belum putus"}
          </p>

          {/* APA yang cocok, bukan sekadar bahwa ia cocok.

              Tanpa ini, mencari nama juru sita menghasilkan dua puluh kartu
              yang tidak satu pun menyebut nama itu - dan satu-satunya cara
              memastikan adalah membuka perkaranya satu per satu. */}
          {item.cocok && item.cocok.length > 0 ? (
            <div className="mt-2 space-y-1 border-t pt-2">
              {item.cocok.map((satu) => (
                <p key={satu.medan} className="text-xs leading-snug">
                  <span className="font-medium text-muted-foreground">{satu.medan}: </span>
                  <span className="text-foreground">{satu.nilai}</span>
                </p>
              ))}
            </div>
          ) : null}
          <CocokTakTerbaca b={item} />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KELOMPOK
// ---------------------------------------------------------------------------

function TampilanKelompok({
  baris,
  adaLagi = false,
  menurut,
  onUbahMenurut,
  terlipat,
  onUbahTerlipat,
  onBuka,
}: {
  baris: BarisHasil[];
  /** Bot menyebut masih ada perkara yang cocok tetapi belum dimuat. */
  adaLagi?: boolean;
  menurut: KelompokMenurut;
  onUbahMenurut: (menurut: KelompokMenurut) => void;
  terlipat: Set<string>;
  onUbahTerlipat: (terlipat: Set<string>) => void;
  onBuka: (nomorPerkara: string) => void;
}) {
  const kelompok = useMemo(() => kelompokkanBaris(baris, menurut), [baris, menurut]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Kelompokkan menurut
          <select
            aria-label="Kelompokkan menurut"
            value={menurut}
            onChange={(e) => onUbahMenurut(e.target.value as KelompokMenurut)}
            className="h-8 rounded-md border bg-card px-1.5 text-xs text-foreground"
          >
            {PILIHAN_KELOMPOK.map((x) => (
              <option key={x.kunci} value={x.kunci}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onUbahTerlipat(new Set())}>
          Buka semua
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => onUbahTerlipat(new Set(kelompok.map((x) => x.nama)))}
        >
          Lipat semua
        </Button>
        <span className="text-xs text-muted-foreground">{kelompok.length} kelompok</span>
      </div>
      {/* Lencana "N perkara" dan urutan "terbanyak di atas" dihitung dari yang
          TERMUAT. Bila masih ada yang belum dimuat, itu dikatakan di sini -
          bukan hanya di bawah daftar, jauh dari angka yang dibacanya. */}
      {adaLagi ? (
        <p data-bagian="catatan-kelompok" className="text-xs text-amber-700 dark:text-amber-300">
          Dikelompokkan dari {baris.length.toLocaleString("id-ID")} perkara yang termuat — masih ada yang cocok tetapi
          belum dimuat, jadi jumlah tiap kelompok hanya menghitung yang termuat.
        </p>
      ) : null}

      {kelompok.map((satu) => {
        const lipat = terlipat.has(satu.nama);
        return (
          <section key={satu.nama} className="rounded-lg border bg-card">
            <button
              type="button"
              aria-expanded={!lipat}
              onClick={() => {
                const berikut = new Set(terlipat);
                if (lipat) berikut.delete(satu.nama);
                else berikut.add(satu.nama);
                onUbahTerlipat(berikut);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted/50"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 motion-safe:transition-transform",
                    lipat ? "-rotate-90" : ""
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 break-words">{satu.nama}</span>
              </span>
              <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums">
                {satu.baris.length.toLocaleString("id-ID")} perkara
              </span>
            </button>
            {lipat ? null : (
              <ul className="divide-y border-t">
                {satu.baris.map((b) => (
                  <BarisDaftar key={kunciBaris(b)} b={b} onBuka={onBuka} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ===========================================================================
// PANEL YANG DIKECILKAN (butir 9)
// ===========================================================================

/**
 * Satu baris ringkas pengganti panel Tag atau Saringan yang dikecilkan.
 *
 * Isinya yang menjelaskan hasil di bawahnya - tag yang menyala, periode,
 * saringan yang aktif - sehingga panel yang mengecil tidak menyembunyikan
 * MENGAPA daftarnya seperti itu. Tombol "Buka lagi" mengembalikan panelnya
 * utuh.
 *
 * Bila panelnya mengecil ketika fokus papan ketik berada di dalamnya, fokus
 * dipindahkan ke "Buka lagi" - kalau tidak, fokusnya jatuh ke body dan
 * pengguna papan ketik kehilangan tempatnya.
 *
 * Di bawah lebar sm isinya turun ke BARIS SENDIRI selebar bilah. Terukur di
 * peramban pada 375 px: selama isinya berdiri di antara judul dan tombol, ruang
 * yang tersisa untuknya tinggal ±80 px, setiap chip pecah per kata ("Nama /
 * pihak: / “Siti / Aminah"), dan bilah "ringkas" itu setinggi 192 px - lebih
 * tinggi daripada banyak panel yang terbuka.
 */
export function BilahPanelKecil({
  judul,
  children,
  onBukaLagi,
  onTutup,
  fokusAwal = false,
}: {
  judul: string;
  children: ReactNode;
  onBukaLagi: () => void;
  onTutup: () => void;
  fokusAwal?: boolean;
}) {
  const tombol = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (fokusAwal) tombol.current?.focus();
  }, [fokusAwal]);

  return (
    <div
      role="region"
      aria-label={`${judul} (dikecilkan)`}
      data-keadaan="kecil"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/20 px-3 py-1.5 text-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-reduce:animate-none"
    >
      <span className="text-xs font-semibold text-muted-foreground">{judul}:</span>
      <div
        data-bagian="isi-ringkas"
        className="order-last flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:order-none sm:w-auto sm:flex-1"
      >
        {children}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button ref={tombol} size="sm" variant="outline" className="h-8" onClick={onBukaLagi}>
          Buka lagi
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 px-0"
          onClick={onTutup}
          aria-label={`Sembunyikan ringkasan ${judul.toLowerCase()}`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
