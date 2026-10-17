/**
 * ============================================================================
 * TUTORIAL HIDUP - TIPE, ATURAN HAK, DAN PENCARIAN
 * ============================================================================
 *
 * Pengganti tutorial PDF yang harus diperbarui dengan tangan. Tutorialnya
 * tinggal di SATU daftar bertipe (tutorial-isi.ts); berkas ini hanya memuat
 * bentuk datanya dan aturan siapa-melihat-apa.
 *
 * KENAPA "HIDUP"
 * Setiap entri ditautkan ke sesuatu yang NYATA di portal: aplikasi
 * (ATURAN_APLIKASI / portalApps), menu samping (modules), tab ALETA e-Court
 * (TAB_ECOURT), atau hak aksi (AKSI) di matriks peran. Dua akibatnya:
 *   1. Yang melihat sebuah tutorial adalah yang MEMANG berhak atas fiturnya -
 *      diturunkan dari matriks peran, bukan daftar peran yang ditulis ulang.
 *   2. src/test/tutorial-hidup.test.ts GAGAL bila ada aplikasi/menu/tab/aksi
 *      yang belum punya tutorial, atau tutorial menunjuk yang sudah tidak ada.
 *      Jadi tiap rilis yang menambah menu atau hak wajib menambah tutorialnya.
 *
 * Berkas ini murni (tanpa React) supaya dapat diuji dan dipakai di mana saja.
 */

import { CATATAN_EKSTENSI } from "@/lib/catatan-ekstensi";
import {
  AKSI,
  ATURAN_APLIKASI,
  GOLONGAN_PERAN,
  MODUL_MILIK_APLIKASI,
  TAB_ECOURT,
  aplikasiTampil,
  bawaanAplikasiGolongan,
  golonganDariPeran,
  golonganPengguna,
  type AksesMenuPeran,
  type GolonganPeran,
  type KunciAksi,
  type PenggunaGolongan,
  type TabEcourt,
} from "@/lib/matriks-peran";
import { modules, portalApps } from "@/lib/mock-data";
import { PATCH_NOTES } from "@/lib/patch-notes";

// ─── Bentuk data ─────────────────────────────────────────────────────────────

/** Kelompok = judul bagian di halaman tutorial (urutan di KELOMPOK_TUTORIAL). */
export type KelompokTutorial =
  | "mulai"
  | "surat"
  | "persidangan"
  | "putusan"
  | "ekstensi"
  | "kinerja"
  | "pengelola";

export const KELOMPOK_TUTORIAL: Readonly<Record<KelompokTutorial, { label: string; keterangan: string }>> = {
  mulai: { label: "Mulai di ALETA", keterangan: "Masuk, mencari, dan mendapat bantuan." },
  surat: { label: "Surat, Disposisi, dan Tugas", keterangan: "Persuratan kantor dan pekerjaan harian." },
  persidangan: {
    label: "ALETA e-Court: Sidang dan Perkara",
    keterangan: "Jadwal Sidang, Status Perkara, Mediasi, Kasir, dan layanan lain di sekitar persidangan.",
  },
  putusan: {
    label: "Putusan, BAS, dan Blangko",
    keterangan: "Menyusun, memeriksa, dan mengunggah putusan serta berita acara sidang.",
  },
  ekstensi: {
    label: "Ekstensi di SIPP dan ABT",
    keterangan: "Alat bantu yang muncul langsung di halaman SIPP dan ABT pada peramban Anda.",
  },
  kinerja: { label: "Kinerja dan Kepegawaian", keterangan: "SKP, cuti, beban kerja, dan peta perkara." },
  pengelola: {
    label: "Pengaturan dan Pengelola",
    keterangan: "Untuk akun yang diberi wewenang mengatur server, akun, dan penghubung.",
  },
};

export const URUTAN_KELOMPOK_TUTORIAL: readonly KelompokTutorial[] = [
  "mulai",
  "surat",
  "persidangan",
  "putusan",
  "ekstensi",
  "kinerja",
  "pengelola",
];

/**
 * Apa yang dibahas sebuah tutorial, dinyatakan dengan kunci yang SAMA dengan
 * matriks peran. Satu tutorial boleh membahas beberapa kunci; satu kunci boleh
 * dibahas beberapa tutorial. Ini yang diperiksa penjaga kelengkapan.
 */
export type CakupanTutorial = {
  /** id di ATURAN_APLIKASI (matriks-peran) atau portalApps (mock-data). */
  aplikasi?: readonly string[];
  /** id menu samping di `modules` (mock-data). */
  modul?: readonly string[];
  /** tab ALETA e-Court. */
  tab?: readonly TabEcourt[];
  /** kunci hak aksi di AKSI (matriks-peran). */
  aksi?: readonly KunciAksi[];
};

/**
 * Dari catatan rilis mana tanda "Baru di versi X" diambil.
 * "portal" = PATCH_NOTES, "ekstensi" = CATATAN_EKSTENSI. Versinya harus ada di
 * daftar itu (dijaga uji), dan tandanya padam sendiri begitu versi itu
 * tergeser keluar dari JUMLAH_VERSI_DIANGGAP_BARU rilis terakhir.
 */
export type SejakVersi = { sumber: "portal" | "ekstensi"; versi: string };

export type Tutorial = {
  /** Kunci tetap, dipakai di tautan (?fitur=...). Jangan diganti sembarangan. */
  id: string;
  judul: string;
  /** Satu kalimat: fitur ini untuk apa, dalam bahasa sehari-hari. */
  ringkas: string;
  kelompok: KelompokTutorial;
  mencakup: CakupanTutorial;
  /**
   * Hanya bila tidak ada kunci matriks yang cocok (mis. alat di ekstensi yang
   * haknya dihitung ekstensi sendiri). Bila `mencakup` memuat aplikasi/aksi/tab/
   * modul, siapa-melihat diturunkan dari matriks dan `untuk` DILARANG (uji).
   */
  untuk?: "semua" | readonly GolonganPeran[];
  /** Halaman portal tempat tombol "?" menampilkan tutorial ini. */
  halaman: readonly string[];
  /** Tombol "Buka halamannya" - harus halaman yang ada (dijaga uji). */
  tautan?: { teks: string; href: string };
  /** Langkah bernomor, kalimat pendek. */
  langkah: readonly string[];
  /** Hal yang perlu diwaspadai. */
  peringatan?: readonly string[];
  /** Kata lain yang dipakai orang saat mencari. */
  kataKunci?: readonly string[];
  baruDi?: SejakVersi;
};

// ─── Tanda "Baru" ────────────────────────────────────────────────────────────

/** Berapa rilis terakhir yang masih dianggap baru. */
export const JUMLAH_VERSI_DIANGGAP_BARU = 3;

export function versiAdaDiCatatan(sejak: SejakVersi): boolean {
  return sejak.sumber === "portal"
    ? PATCH_NOTES.some((n) => n.version === sejak.versi)
    : CATATAN_EKSTENSI.some((n) => n.versi === sejak.versi);
}

/** Tanda "Baru di versi X" - null bila tidak ada atau sudah tidak baru. */
export function tandaBaru(t: Pick<Tutorial, "baruDi">): string | null {
  const s = t.baruDi;
  if (!s) return null;
  const daftar =
    s.sumber === "portal"
      ? PATCH_NOTES.slice(0, JUMLAH_VERSI_DIANGGAP_BARU).map((n) => n.version)
      : CATATAN_EKSTENSI.slice(0, JUMLAH_VERSI_DIANGGAP_BARU).map((n) => n.versi);
  if (!daftar.includes(s.versi)) return null;
  return s.sumber === "portal" ? `Baru di portal ${s.versi}` : `Baru di ekstensi ${s.versi}`;
}

// ─── Siapa melihat apa ───────────────────────────────────────────────────────

const SEMUA: readonly GolonganPeran[] = GOLONGAN_PERAN;
const PENGELOLA: readonly GolonganPeran[] = ["super-admin", "admin"];

function golonganDariAplikasi(appId: string): GolonganPeran[] {
  return GOLONGAN_PERAN.filter((g) => g === "super-admin" || bawaanAplikasiGolongan([g], appId));
}

/**
 * Golongan yang berhak melihat tutorial - diturunkan dari matriks peran:
 *   aplikasi  golongan yang menerima aplikasinya (Super Admin selalu);
 *   aksi      golongan yang diberi hak aksinya + pengelola;
 *   tab       golongan tab itu + pengelola;
 *   modul     aplikasi pemiliknya bila ada, selain itu peran yang diberi menu.
 * Satu tutorial yang membahas beberapa hal terlihat oleh gabungan golongannya.
 */
export function golonganPelihatTutorial(t: Tutorial): ReadonlySet<GolonganPeran> {
  if (t.untuk) return new Set(t.untuk === "semua" ? SEMUA : [...t.untuk, ...PENGELOLA]);

  const hasil = new Set<GolonganPeran>(["super-admin"]);
  const c = t.mencakup;

  for (const id of c.aplikasi ?? []) golonganDariAplikasi(id).forEach((g) => hasil.add(g));
  for (const k of c.aksi ?? []) {
    PENGELOLA.forEach((g) => hasil.add(g));
    AKSI[k].golongan.forEach((g) => hasil.add(g));
  }
  for (const tab of c.tab ?? []) {
    PENGELOLA.forEach((g) => hasil.add(g));
    const aturan = TAB_ECOURT[tab];
    (aturan.golongan === "semua" ? SEMUA : aturan.golongan).forEach((g) => hasil.add(g));
  }
  for (const idModul of c.modul ?? []) {
    const milik = MODUL_MILIK_APLIKASI[idModul];
    if (milik) {
      golonganDariAplikasi(milik).forEach((g) => hasil.add(g));
      continue;
    }
    const modul = modules.find((m) => m.id === idModul);
    for (const roleId of modul?.roleIds ?? []) hasil.add(golonganDariPeran(roleId));
  }
  return hasil;
}

/** Sudut pandang pembaca: akunnya sendiri, atau "lihat sebagai peran X" (Super Admin). */
export type SudutPandangTutorial = {
  pengguna?: PenggunaGolongan | null;
  aksesMenu?: AksesMenuPeran;
  /** Bila diisi, menggantikan golongan dari `pengguna` (mode "lihat sebagai peran"). */
  sebagaiGolongan?: readonly GolonganPeran[];
};

export function tutorialTampil(t: Tutorial, sudut: SudutPandangTutorial): boolean {
  const golongan = sudut.sebagaiGolongan ?? golonganPengguna(sudut.pengguna);
  if (golongan.length === 0) return false;
  if (golongan.includes("super-admin")) return true;
  const boleh = golonganPelihatTutorial(t);
  if (golongan.some((g) => boleh.has(g))) return true;
  // Akses Menu dapat membuka aplikasi untuk satu peran (jalan sadar Super Admin).
  if (!sudut.sebagaiGolongan && sudut.pengguna && !t.untuk) {
    return (t.mencakup.aplikasi ?? []).some((id) => aplikasiTampil(sudut.pengguna, id, sudut.aksesMenu));
  }
  return false;
}

export function saringTutorial(
  daftar: readonly Tutorial[],
  sudut: SudutPandangTutorial
): Tutorial[] {
  return daftar.filter((t) => tutorialTampil(t, sudut));
}

// ─── Pencarian, pengelompokan, halaman ───────────────────────────────────────

function normal(teks: string) {
  return teks.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function cocokDenganKata(t: Tutorial, kata: string): boolean {
  const q = normal(kata).trim();
  if (!q) return true;
  const jerami = normal(
    [t.judul, t.ringkas, KELOMPOK_TUTORIAL[t.kelompok].label, ...t.langkah, ...(t.peringatan ?? []), ...(t.kataKunci ?? [])].join(" ")
  );
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((bagian) => jerami.includes(bagian));
}

export function kelompokkanTutorial(daftar: readonly Tutorial[]): Array<{
  kelompok: KelompokTutorial;
  label: string;
  keterangan: string;
  isi: Tutorial[];
}> {
  return URUTAN_KELOMPOK_TUTORIAL.map((k) => ({
    kelompok: k,
    label: KELOMPOK_TUTORIAL[k].label,
    keterangan: KELOMPOK_TUTORIAL[k].keterangan,
    isi: daftar.filter((t) => t.kelompok === k),
  })).filter((g) => g.isi.length > 0);
}

/** Buang query/hash dan garis miring penutup; "/" tetap "/". */
export function jalurBersih(href: string): string {
  const tanpa = href.split("#")[0].split("?")[0];
  return tanpa.length > 1 ? tanpa.replace(/\/+$/, "") : tanpa || "/";
}

/** Tutorial untuk sebuah halaman (cocok persis atau sebagai induk). Yang paling spesifik lebih dulu. */
export function tutorialUntukHalaman(daftar: readonly Tutorial[], jalur: string): Tutorial[] {
  const j = jalurBersih(jalur);
  const skor = (t: Tutorial) => {
    let terbaik = -1;
    for (const h of t.halaman) {
      const p = jalurBersih(h);
      if (j === p) terbaik = Math.max(terbaik, p.length + 1000);
      else if (p !== "/" && j.startsWith(`${p}/`)) terbaik = Math.max(terbaik, p.length);
    }
    return terbaik;
  };
  return daftar
    .map((t) => ({ t, s: skor(t) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

/** Alamat halaman tutorial untuk satu fitur (dipakai tombol "?"). */
export function alamatTutorial(id: string): string {
  return `/panduan?fitur=${encodeURIComponent(id)}`;
}

/** Label golongan untuk pilihan "lihat sebagai peran" (Super Admin). */
export { LABEL_GOLONGAN } from "@/lib/matriks-peran";

// ─── Kelengkapan: dasar penjaga "tutorial wajib ikut berubah" ───────────────

/** Kunci nyata di portal yang SETIAP satunya wajib punya tutorial. */
export type SumberKunciTutorial = {
  aplikasi: readonly string[];
  modul: readonly string[];
  tab: readonly string[];
  aksi: readonly string[];
};

/** Daftar kunci yang berlaku sekarang, dibaca dari matriks peran dan daftar menu. */
export function sumberKunciNyata(): SumberKunciTutorial {
  return {
    aplikasi: Array.from(new Set([...ATURAN_APLIKASI.map((a) => a.id), ...portalApps.map((a) => a.id)])),
    modul: modules.map((m) => m.id),
    tab: Object.keys(TAB_ECOURT),
    aksi: Object.keys(AKSI),
  };
}

export type HasilPeriksaCakupan = {
  /** Kunci nyata yang belum dibahas tutorial mana pun. */
  belumAdaTutorial: string[];
  /** Kunci di tutorial yang sudah tidak ada di portal. */
  menunjukYangHilang: string[];
};

export function periksaCakupan(daftar: readonly Tutorial[], sumber: SumberKunciTutorial): HasilPeriksaCakupan {
  const jenis = ["aplikasi", "modul", "tab", "aksi"] as const;
  const belumAdaTutorial: string[] = [];
  const menunjukYangHilang: string[] = [];
  for (const j of jenis) {
    const dibahas = new Set(daftar.flatMap((t) => t.mencakup[j] ?? []));
    const nyata = new Set(sumber[j]);
    for (const k of nyata) if (!dibahas.has(k)) belumAdaTutorial.push(`${j}:${k}`);
    for (const k of dibahas) if (!nyata.has(k)) menunjukYangHilang.push(`${j}:${k}`);
  }
  return { belumAdaTutorial, menunjukYangHilang };
}
