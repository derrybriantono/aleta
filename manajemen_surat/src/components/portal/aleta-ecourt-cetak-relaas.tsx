"use client";

/**
 * ============================================================================
 * DIALOG CETAK RELAAS - DARI ANTRIAN SIDANG, LEWAT EKSTENSI ALETA
 * ============================================================================
 *
 * Keputusan pengguna 25 September 2026: "jangan buat tab baru di aleta
 * e-court, cukup tambahkan tombol cetak relaas di antrian aleta sidang untuk
 * cetak relaas dan pemberitahuan putusan (disini otomatis juga mengambil hari
 * itu yang baru daftar)". "Di ekstensi itu konek kepada cetak relaas dan
 * pemberitahuan massal untuk jurusita". "Tidak usah unggah ke SIPP dulu".
 *
 * Jadi dialog ini HANYA mencetak: daftar dokumennya dibaca dari
 * /api/aleta-ecourt/relaas-massal/cetak, juru sita memilih, lalu pilihannya
 * dikirim ke ekstensi ALETA yang mengambil RTF dari ABT dan menyimpannya APA
 * ADANYA di folder unduhan peramban - RTF saja, tanpa PDF ("untuk cetak
 * relaas dan BAS jangan pdf, cukup rtf/word saja", pengguna 6 Okt 2026).
 * Tidak ada satu pun yang ditulis ke SIPP.
 *
 * ============================================================================
 * "HARI ITU" ADALAH HARI MENCETAK, BUKAN HARI SIDANGNYA
 * ============================================================================
 *
 * Perkara yang didaftarkan hari ini dipanggil untuk sidang pertamanya; sidang
 * hari ini yang ditunda melahirkan panggilan untuk sidang berikutnya; putusan
 * hari ini melahirkan pemberitahuan. Semuanya lahir HARI INI walau sidang
 * tujuannya minggu depan - itulah sebab tiap baris menyebut sidang tujuan
 * beserta tanggalnya, terpisah dari tanggal dialog.
 *
 * ============================================================================
 * TIDAK ADA YANG TERCENTANG SENDIRI
 * ============================================================================
 *
 * Tiap dokumen yang dicentang menjadi satu kunjungan ke ABT dengan jeda
 * seperti manusia (rata-rata puluhan detik). Mencentang semuanya bawaannya
 * berarti satu ketukan yang tidak disengaja mengantrikan setengah jam kerja
 * ekstensi - dan dokumen yang pihaknya belum diketahui akan dicetak untuk
 * orang yang salah. Karena itu pilihan selalu dibuat orang, dan dokumen yang
 * pihaknya "tidak-diketahui" baru dapat dicentang sesudah pihaknya dipilih.
 *
 * ============================================================================
 * JEMBATAN KE EKSTENSI - window.postMessage BERPASANGAN idPesan
 * ============================================================================
 *
 * Halaman portal tidak dapat memanggil chrome.runtime. Yang menjembatani
 * ekstensi-sipp/aleta.js (content script di halaman portal): halaman mengirim
 * { sumber: "aleta-portal", jenis, idPesan, muatan }, jembatan meneruskannya
 * ke pekerja latar, lalu membalas { sumber: "aleta-ekstensi", balasan:
 * idPesan, jawaban }. Halaman MEMASANG BATAS WAKTU SENDIRI: ekstensi yang
 * dimuat ulang atau pekerjanya mati tidak akan pernah membalas, dan tombol
 * yang menunggu selamanya terbaca sebagai layar yang membeku.
 *
 * Putarannya hidup di ekstensi (chrome.storage.session), bukan di dialog ini.
 * Menutup dialog tidak menghentikannya, dan membuka dialog lagi menanyakan
 * keadaannya lalu menampilkannya kembali.
 */

import { ChevronDown, ChevronRight, Printer, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  PIHAK_PILIHAN,
  nilaiCetakDokumen,
  sebabProsesDiLuarMenu,
  type PetaBlangkoCetak,
  type PihakPilihan,
} from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import { pecahDokumenPerPihak, pecahPilihanKeduanya } from "@/app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak";
import { AletaEcourtRelaasMassal } from "@/components/portal/aleta-ecourt-relaas-massal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { namaCocokSatu } from "@/lib/perkara-sendiri";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { tanggalHariPanjang, tanggalHariPendek } from "@/lib/tanggal-indonesia";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import type {
  DokumenRelaasCetakPortal,
  RelaasCetakPortal,
  TertundaRelaasCetak,
  TidakPerluRelaasCetak,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";

// ===========================================================================
// JEMBATAN HALAMAN <-> EKSTENSI
// ===========================================================================

/**
 * Kelima jenis pesan yang diterima jembatan - di luar ini ditolak aleta.js.
 * relaas-panen dan relaas-perkiraan dikenal latar.js tetapi TIDAK dibuka dari
 * halaman: dialog ini tidak memakainya (lihat aleta.js).
 */
export const JENIS_PESAN_RELAAS = [
  "relaas-mulai",
  "relaas-keadaan",
  "relaas-henti",
  "relaas-lanjut",
  "relaas-bersihkan",
] as const;

export type JenisPesanRelaas = (typeof JENIS_PESAN_RELAAS)[number];

/** Satu butir putaran sebagaimana disimpan pekerja latar (latar.js). */
export type ButirPutaran = {
  kunci: string;
  nomorPerkara?: string;
  golongan?: string;
  label?: string;
  jurusita?: string;
  /** "menunggu" | "sedang" | "selesai" | "gagal" | "dilewati" */
  keadaan: string;
  /** Sebab keadaannya (gagal, dilewati, dipulihkan). */
  sebab?: string;
  hasil?: string;
  /** Relaas hanya RTF (6 Okt 2026) - tidak ada PDF. */
  unduhan?: { rtf?: string };
  percobaan?: number;
};

export type PekerjaanRelaas = {
  id: string;
  tanggal?: string;
  folder?: string;
  butir: ButirPutaran[];
  dilewati?: Array<{ kunci?: string; nomorPerkara?: string; label?: string; sebab?: string }>;
  catatan?: string[];
  waktuBerikut?: number;
  selesai: boolean;
  dihentikan?: boolean;
  tertahan?: { sebab?: string; perluMasuk?: string } | null;
};

export type RingkasPutaran = {
  menunggu: number;
  sedang: number;
  selesai: number;
  gagal: number;
  dilewati: number;
};

export type PerkiraanWaktu = { rata: number; rendah: number; tinggi: number };

export type JawabanEkstensi = {
  ok: boolean;
  sebab?: string;
  perluMasuk?: boolean | string;
  pekerjaan?: PekerjaanRelaas | null;
  ringkas?: RingkasPutaran;
  perkiraan?: PerkiraanWaktu;
  perkiraanSisa?: PerkiraanWaktu | null;
  sekarang?: number;
  /** Diisi halaman sendiri bila ekstensi tidak membalas sebelum batas waktu. */
  batasWaktu?: boolean;
  /** Ekstensi sedang menyiapkan putaran (memanen blangko dari ABT) - belum ada pekerjaan tersimpan. */
  menyiapkan?: boolean;
};

/** Kalimat bila ekstensi tidak ada - dipakai layar dan diuji apa adanya. */
export const KALIMAT_EKSTENSI_TIDAK_ADA =
  "Ekstensi ALETA belum terpasang atau versinya lama - muat ulang di chrome://extensions";

/**
 * Ekstensi yang mampu mencetak relaas menandai halaman ini sendiri
 * (dataset.aletaRelaas = "1" pada <html>). Versi lama yang belum membawa
 * jembatan relaas tidak menandainya - dan ia yang paling mungkin terpasang,
 * sebab ekstensi Load unpacked tidak pernah memperbarui dirinya sendiri.
 */
export function ekstensiRelaasTerpasang(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.aletaRelaas === "1";
}

let nomorPesan = 0;

/** idPesan pendek (di bawah 64 aksara, batas yang dijaga jembatan) dan unik per halaman. */
function buatIdPesan() {
  nomorPesan += 1;
  return `rl-${Date.now().toString(36)}-${nomorPesan}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mengirim satu permintaan ke ekstensi dan menunggu balasan PASANGANNYA.
 *
 * Tidak pernah melempar dan tidak pernah menunggu selamanya: balasan yang tidak
 * datang sebelum batasMs dijawab { ok:false, batasWaktu:true, sebab }. Balasan
 * dari jendela lain, dari asal lain, atau berpasangan idPesan lain diabaikan -
 * halaman lain yang kebetulan mengirim pesan berbentuk sama tidak dapat
 * menjawab atas nama ekstensi.
 */
export function kirimKeEkstensi(
  jenis: JenisPesanRelaas,
  muatan: Record<string, unknown> = {},
  batasMs = 15_000
): Promise<JawabanEkstensi> {
  return new Promise((selesai) => {
    const idPesan = buatIdPesan();
    let jam = 0;
    const dengar = (peristiwa: MessageEvent) => {
      if (peristiwa.source !== window || peristiwa.origin !== window.location.origin) return;
      const data = peristiwa.data as { sumber?: unknown; balasan?: unknown; jawaban?: unknown } | null;
      if (!data || typeof data !== "object") return;
      if (data.sumber !== "aleta-ekstensi" || data.balasan !== idPesan) return;
      window.removeEventListener("message", dengar);
      window.clearTimeout(jam);
      const jawaban = data.jawaban;
      selesai(
        jawaban && typeof jawaban === "object"
          ? (jawaban as JawabanEkstensi)
          : { ok: false, sebab: "Ekstensi membalas tanpa isi jawaban." }
      );
    };
    window.addEventListener("message", dengar);
    jam = window.setTimeout(() => {
      window.removeEventListener("message", dengar);
      selesai({
        ok: false,
        batasWaktu: true,
        // TIDAK menyuruh "coba lagi": permintaan yang tidak terjawab belum tentu
        // gagal - relaas-mulai yang masih memanen blangko dari ABT tetap
        // melahirkan putaran sesudah halaman menyerah. Pemanggilnya yang
        // memutuskan langkah berikutnya (lihat mulaiCetak).
        sebab:
          `Ekstensi tidak menjawab dalam ${Math.round(batasMs / 1000)} detik - barangkali ia masih ` +
          "bekerja, baru dimuat ulang, atau pekerja latarnya berhenti.",
      });
    }, batasMs);
    window.postMessage({ sumber: "aleta-portal", jenis, idPesan, muatan }, window.location.origin);
  });
}

// ===========================================================================
// KALIMAT - sandi bot tidak pernah tampil telanjang
// ===========================================================================

const GOLONGAN_LABEL: Record<string, string> = {
  "sidang-pertama": "Sidang pertama",
  "sidang-ditunda": "Sidang ditunda",
  "ikrar-talak": "Ikrar talak",
  "pemberitahuan-putusan": "Pemberitahuan putusan",
};

/** Urutan perjalanan perkara - bukan abjad. */
const GOLONGAN_URUT = Object.keys(GOLONGAN_LABEL);

export function labelGolonganCetak(golongan: string) {
  return GOLONGAN_LABEL[golongan] ?? (golongan ? `Golongan tidak dikenal: ${golongan}` : "Golongan tidak disebut");
}

/** Sebab dokumen masuk ke daftar, sebagai kalimat. "hari ini" hanya bila memang hari ini. */
export function kalimatSebabMasuk(sebab: string, tanggal: string, hariIni: string) {
  const kini = tanggal === hariIni;
  switch (sebab) {
    case "didaftarkan":
      return kini
        ? "baru didaftarkan hari ini"
        : "didaftarkan atau ditetapkan hari sidangnya pada tanggal ini";
    case "ditunda":
      return kini ? "sidang hari ini ditunda" : "sidang pada tanggal ini ditunda";
    case "jadwal-baru":
      return kini ? "jadwal sidangnya baru dicatat hari ini" : "jadwal sidangnya dicatat pada tanggal ini";
    case "diputus":
      return kini ? "diputus hari ini" : "diputus pada tanggal ini";
    default:
      return sebab ? `sebab masuk tidak dikenal: ${sebab}` : "sebab masuk tidak disebut bot";
  }
}

function labelPihak(pihak: string, pemberitahuan: boolean) {
  if (pihak === "keduanya") return "Kedua pihak";
  if (pihak === "pertama") return "Pihak Pertama (P)";
  if (pihak === "kedua") return "Pihak Kedua (T)";
  if (pihak === "tidak-perlu") return "Tidak ada - semua pihak hadir";
  return pemberitahuan ? "Belum diketahui siapa yang diberi tahu" : "Belum diketahui siapa yang dipanggil";
}

const LABEL_PILIHAN: Record<PihakPilihan, string> = {
  pertama: "Pihak Pertama (P) saja",
  kedua: "Pihak Kedua (T) saja",
  keduanya: "Kedua pihak",
};

/**
 * Mengapa pihaknya tidak diketahui. Keterangan bot didahulukan - ia menyebut
 * sebab yang tidak terbaca dari sandinya saja (sandi 1 yang alasan
 * penundaannya menyebut panggilan, sidang sesudah putusan). Sandi 1 tanpa
 * keterangan TIDAK disebut "kombinasi": artinya "Semua Pihak".
 */
export function sebabPihakTidakDiketahui(dok: DokumenRelaasCetakPortal) {
  const keterangan = Array.isArray(dok.keterangan) ? dok.keterangan.filter(Boolean) : [];
  if (keterangan.length > 0) return keterangan.join(" ");
  const sandi = dok.dihadiriOleh;
  if (sandi === null || sandi === undefined || String(sandi).trim() === "") {
    return dok.sidangAsalId
      ? "Kehadiran pada sidang asalnya tidak tercatat di SIPP."
      : "Tidak ada sidang asal yang mencatat kehadiran.";
  }
  if (Number(sandi) === 1) {
    return "SIPP mencatat semua pihak hadir, tetapi bot menanyakan pihaknya tanpa menyebut sebabnya.";
  }
  return (
    `Kehadiran pada sidang asalnya bersandi "${String(sandi)}" - kombinasi dengan pihak ` +
    "intervensi/turut tergugat atau sebagian pihak, tidak dapat dipetakan ke satu blangko."
  );
}

const SEBAB_TERTUNDA: Record<string, string> = {
  "jadwal-pertama-belum-ada":
    "jadwal sidang pertama belum dibuat di SIPP - panggilannya belum dapat dicetak",
  "hasil-sidang-belum-dicatat":
    "hasil sidang belum dicatat - panggilannya belum dapat dicetak",
  "sidang-sesudah-putusan":
    "sidang sesudah putusan tanpa sidang berikutnya - periksa di SIPP apakah masih ada yang dipanggil",
  "sidang-pertama-sudah-lewat":
    "sidang yang ditetapkan sudah lewat - tidak ada panggilan yang dapat sampai",
};

/** Sebab yang tidak dikenal digambar apa adanya - bot boleh menambah sebab tanpa layar berbohong. */
export function kalimatTertunda(baris: Pick<TertundaRelaasCetak, "sebab">) {
  return SEBAB_TERTUNDA[baris.sebab] ?? (baris.sebab ? `sebab: ${baris.sebab}` : "sebab tidak disebut bot");
}

/**
 * Kalimat satu baris "tidak perlu", menurut SEBAB dan GOLONGANNYA. Hanya sandi
 * 1 yang berarti "semua pihak hadir"; sidang berikutnya yang jatuh hari itu
 * juga tidak dipanggil, tetapi karena tidak ada relaas yang dapat sampai. Untuk
 * pemberitahuan yang tidak perlu adalah memberi tahu isi putusan yang
 * dibacakan di hadapan para pihak - bukan "hadir di muka sidang". Sebab yang
 * tidak dikenal ditulis apa adanya, tanpa klaim apa pun.
 */
export function kalimatTidakPerlu(baris: Pick<TidakPerluRelaasCetak, "sebab" | "golongan">) {
  const pemberitahuan = baris.golongan === "pemberitahuan-putusan";
  switch (baris.sebab) {
    case "semua-pihak-hadir":
      return pemberitahuan
        ? "putusan dibacakan di hadapan semua pihak - tidak perlu diberi tahu"
        : "semua pihak hadir pada sidang asalnya - diperintahkan hadir di muka sidang, tidak dipanggil";
    case "sidang-tujuan-tidak-sesudah-hari-cetak":
      return "sidang berikutnya jatuh pada hari yang sama - tidak ada relaas yang dapat sampai sebelum sidangnya";
    default:
      return baris.sebab ? `tidak dicetak, sebab: ${baris.sebab}` : "tidak dicetak, sebabnya tidak disebut bot";
  }
}

/**
 * Tanggal yang dikirim Antrian Sidang ke dialog. Hanya hari yang DIPILIH
 * pengguna yang dikirim: bawaan Antrian adalah "hari ini" menurut jam
 * PERAMBAN, dan pada komputer berzona lain (UTC pukul 07.45 WITA) itu masih
 * hari kemarin - dialog lalu membuka dokumen kemarin padahal jam pengadilan
 * sudah berganti hari. Bawaan dialog sendiri (waktuPengadilan) yang benar.
 */
export function tanggalAwalDariAntrian(dari: string, sampai: string, hariIniAntrian: string) {
  if (dari !== sampai) return "";
  if (dari === hariIniAntrian) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(dari) ? dari : "";
}

/**
 * Yang harus diatur di ABT bila akun juru sita ditolak untuk SELURUH blangko
 * relaas (putaran tertahan "abt-akses"). Diukur pada ABT setempat 25 September
 * 2026: hak_akses_menu membaca baris menu induk "Blangko Derry" (abt_menu 900,
 * user_grup_id 1|10|20) LEBIH DAHULU daripada "Relaas dan PBT" (abt_menu 981,
 * grup 600|650), sehingga grup Juru Sita ditolak untuk setiap blangko di
 * dalamnya - juga ketika menekan tombol B U K A sendiri. Itu pengaturan milik
 * pengguna di ABT; ALETA tidak mengubah basis data ABT.
 */
export const KALIMAT_ATUR_AKSES_ABT =
  'Yang perlu diatur admin ABT: baris menu blangko "Blangko Derry" (abt_menu 900) saat ini hanya untuk ' +
  "grup 1 (Super Administrator), 10 (Ketua/Wakil Ketua), dan 20 (Hakim), dan ABT membaca baris itu lebih " +
  'dahulu daripada "Relaas dan PBT" (abt_menu 981). ' +
  "Tambahkan grup Juru Sita (600) dan Koordinator Delegasi (650) ke baris 900 - seperti baris 981 - lalu " +
  "tekan Lanjutkan (paket ABT abt-blangko-derry-rapi sudah memuat pengaturan ini). ALETA tidak mengubah pengaturan ABT.";

/** Lama waktu yang terbaca orang - menit bulat, bukan milidetik. */
export function lamaWaktu(ms: number) {
  const n = Math.max(0, Number(ms) || 0);
  if (n < 60_000) return "kurang dari 1 menit";
  return `${Math.round(n / 60_000)} menit`;
}

/**
 * Nama berkas unduhan (tanpa akhiran) - satu per kunci dokumen.
 *
 * Garis miring nomor perkara diganti tanda hubung: di dalam nama berkas ia
 * berarti FOLDER, dan "151/Pdt.G/2026/PA.Dgl" akan menjadi empat folder
 * bersarang. Nomor sidang ikut disebut supaya dua panggilan satu perkara pada
 * hari yang sama tidak saling menimpa.
 */
export function namaBerkasDokumen(dok: Pick<DokumenRelaasCetakPortal, "nomorPerkara" | "perkaraId" | "golongan" | "d" | "pihakKe">) {
  const nomor = String(dok.nomorPerkara || `perkara ${dok.perkaraId}`)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim();
  const bagian =
    dok.golongan === "pemberitahuan-putusan"
      ? "pemberitahuan putusan"
      : dok.golongan === "ikrar-talak"
        ? `panggilan ikrar talak sidang ke-${dok.d}`
        : `panggilan sidang ke-${dok.d}`;
  const pihak = dok.pihakKe ? ` pihak ${dok.pihakKe}` : "";
  return `${nomor} - ${bagian}${pihak}`;
}

// ===========================================================================
// PENGELOMPOKAN PER JURU SITA
// ===========================================================================

export type KelompokJurusita = {
  nama: string;
  nip: string;
  /** false: tidak ada penunjukan aktif di SIPP - nama "tidak tercatat". */
  dariPenunjukan: boolean;
  /** Nama cocok dengan akun yang sedang masuk (gelar dinormalkan). */
  milikSaya: boolean;
  dokumen: DokumenRelaasCetakPortal[];
};

const NAMA_TIDAK_TERCATAT = "tidak tercatat";

/**
 * Dokumen per juru sita. Kelompok akun yang sedang masuk paling atas bila
 * namanya cocok - dicocokkan lewat namaCocokSatu(), yang membuang gelar dan
 * sudah terukur 63/63 atas hakim dan panitera Donggala. Kelompok tanpa
 * penunjukan paling bawah: ia tetap digambar, bukan dibuang, sebab dokumennya
 * tetap harus dicetak seseorang.
 */
export function kelompokkanPerJurusita(
  dokumen: DokumenRelaasCetakPortal[],
  namaAkun: string
): KelompokJurusita[] {
  const peta = new Map<string, KelompokJurusita>();
  for (const dok of dokumen) {
    const nama = String(dok.jurusita?.nama || "").trim() || NAMA_TIDAK_TERCATAT;
    const dariPenunjukan = Boolean(dok.jurusita?.dariPenunjukan) && nama !== NAMA_TIDAK_TERCATAT;
    if (!peta.has(nama)) {
      peta.set(nama, {
        nama,
        nip: String(dok.jurusita?.nip || ""),
        dariPenunjukan,
        milikSaya: dariPenunjukan && Boolean(namaAkun) && namaCocokSatu(namaAkun, nama),
        dokumen: [],
      });
    }
    peta.get(nama)!.dokumen.push(dok);
  }
  const urutGolongan = (g: string) => {
    const i = GOLONGAN_URUT.indexOf(g);
    return i < 0 ? GOLONGAN_URUT.length : i;
  };
  const hasil = [...peta.values()];
  for (const k of hasil) {
    k.dokumen.sort(
      (a, b) =>
        urutGolongan(a.golongan) - urutGolongan(b.golongan) ||
        String(a.nomorPerkara).localeCompare(String(b.nomorPerkara), "id", { numeric: true })
    );
  }
  return hasil.sort((a, b) => {
    if (a.milikSaya !== b.milikSaya) return a.milikSaya ? -1 : 1;
    if (a.dariPenunjukan !== b.dariPenunjukan) return a.dariPenunjukan ? -1 : 1;
    return a.nama.localeCompare(b.nama, "id");
  });
}

// ===========================================================================
// DIALOG
// ===========================================================================

type Putaran = {
  pekerjaan: PekerjaanRelaas;
  ringkas: RingkasPutaran | null;
  perkiraanSisa: PerkiraanWaktu | null;
  sekarang: number;
};

type KabarKirim =
  | { jenis: "ekstensi" }
  | { jenis: "masuk-abt"; sebab: string }
  | { jenis: "menunggu"; sebab: string }
  | { jenis: "galat"; sebab: string };

/** Batas waktu tiap permintaan - relaas-mulai memanen token blangko dari ABT dulu. */
const BATAS_MULAI_MS = 120_000;
const BATAS_TANYA_MS = 8_000;
const BATAS_TINDAKAN_MS = 15_000;
/**
 * Kemajuan putaran ditanya tiap detik (7 Okt 2026, cetak relaas cepat - dulu
 * 2 detik). Satu dokumen kini selesai dalam beberapa detik saja, dan tanya
 * keadaan hanya membaca penyimpanan ekstensi - tidak menyentuh ABT.
 */
const JEDA_TANYA_MS = 1_000;
/**
 * Sesudah relaas-mulai tidak terjawab dalam BATAS_MULAI_MS, dialog MEMANTAU
 * keadaan ekstensi selama ini alih-alih menyuruh menekan Cetak lagi: panen
 * blangko yang baru menemukan blangkonya di kelompok ke-40 terukur 78-92 detik
 * jeda saja, belum termasuk waktu jawab ABT, dan pekerja latar terus bekerja
 * sesudah halaman menyerah. Menekan Cetak lagi pada saat itu adalah
 * relaas-mulai KEDUA - pemicu balapan yang dulu menghilangkan satu pekerjaan.
 */
const BATAS_PANTAU_MS = 5 * 60_000;

function putaranDariJawaban(jawab: JawabanEkstensi): Putaran | null {
  if (!jawab.pekerjaan || !Array.isArray(jawab.pekerjaan.butir)) return null;
  return {
    pekerjaan: jawab.pekerjaan,
    ringkas: jawab.ringkas ?? null,
    perkiraanSisa: jawab.perkiraanSisa ?? jawab.perkiraan ?? null,
    sekarang: Number(jawab.sekarang) || Date.now(),
  };
}

export function DialogCetakRelaas({
  tanggalAwal = "",
  hariIniAntrian = "",
  onTutup,
}: {
  /** YYYY-MM-DD dari Antrian; kosong berarti hari ini menurut jam pengadilan. */
  tanggalAwal?: string;
  /**
   * "Hari ini" menurut Antrian (jam PERAMBAN). tanggalAwal yang sama dengannya
   * adalah bawaan Antrian, bukan pilihan orang - diabaikan, dan dialog memakai
   * jam pengadilan. Lihat tanggalAwalDariAntrian.
   */
  hariIniAntrian?: string;
  onTutup: () => void;
}) {
  const { currentUser } = usePortal();
  const namaAkun = String(currentUser?.name || "");
  const hariIni = waktuPengadilan().tanggal;

  const [tanggal, setTanggal] = useState(
    () => tanggalAwalDariAntrian(tanggalAwal, tanggalAwal, hariIniAntrian) || waktuPengadilan().tanggal
  );
  const [data, setData] = useState<RelaasCetakPortal | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState("");
  const [pilihanPihak, setPilihanPihak] = useState<Record<string, PihakPilihan>>({});
  const [terpilih, setTerpilih] = useState<Set<string>>(() => new Set());

  const [ekstensi, setEkstensi] = useState(() => ({
    ada: ekstensiRelaasTerpasang(),
    versi: typeof document === "undefined" ? "" : String(document.documentElement.dataset.aletaEkstensi || ""),
  }));
  const [putaran, setPutaran] = useState<Putaran | null>(null);
  const [kabarPutaran, setKabarPutaran] = useState("");
  const [kabarKirim, setKabarKirim] = useState<KabarKirim | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [bertindak, setBertindak] = useState(false);
  /** Memantau putaran yang BELUM lahir (relaas-mulai tak terjawab / ekstensi menyiapkan). */
  const [memantau, setMemantau] = useState(false);

  const hidup = useRef(true);
  const sedangTanya = useRef(false);
  const nomorMuat = useRef(0);
  /** Batas waktu pemantauan (ms) dan id putaran yang ADA sebelum Cetak ditekan - 0/"" bila tidak memantau. */
  const pantauSampai = useRef(0);
  const idSebelumMulai = useRef("");

  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  // Escape menutup - pop up yang hanya dapat ditutup dengan tombol di layar
  // menjebak yang terbiasa menekan Escape. Menutup TIDAK menghentikan putaran.
  useEffect(() => {
    const tekan = (peristiwa: KeyboardEvent) => {
      if (peristiwa.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [onTutup]);

  // Ekstensi yang baru selesai memasang dirinya sesudah dialog terbuka
  // mengumumkan "siap". Tanpa pendengar ini dialog berkata "belum terpasang"
  // sampai ditutup dan dibuka lagi.
  useEffect(() => {
    const dengar = (peristiwa: MessageEvent) => {
      if (peristiwa.source !== window || peristiwa.origin !== window.location.origin) return;
      const isi = peristiwa.data as { sumber?: unknown; jenis?: unknown; versi?: unknown } | null;
      if (!isi || typeof isi !== "object" || isi.sumber !== "aleta-ekstensi" || isi.jenis !== "siap") return;
      setEkstensi({ ada: ekstensiRelaasTerpasang(), versi: String(isi.versi || "") });
    };
    window.addEventListener("message", dengar);
    return () => window.removeEventListener("message", dengar);
  }, []);

  // ---- Daftar dokumen dari portal -----------------------------------------
  const muat = useCallback(async () => {
    const nomor = ++nomorMuat.current;
    setMemuat(true);
    setGalatMuat("");
    try {
      const r = await fetch(
        apiPath(`/api/aleta-ecourt/relaas-massal/cetak?tanggal=${encodeURIComponent(tanggal)}`),
        { cache: "no-store" }
      );
      const isi = (await r.json()) as { data?: RelaasCetakPortal };
      if (nomor !== nomorMuat.current) return;
      if (!r.ok) {
        // Kegagalan TIDAK diubah menjadi daftar kosong - "tidak ada yang
        // dipanggil" dan "daftarnya tidak terbaca" menuntut tindakan berbeda.
        setData(null);
        setGalatMuat(pesanGalatPortal(isi, `HTTP ${r.status}`));
        return;
      }
      if (!isi.data || !Array.isArray(isi.data.dokumen)) {
        setData(null);
        setGalatMuat("Portal menjawab tanpa daftar dokumen - tidak ada yang dapat digambar.");
        return;
      }
      setData(isi.data);
    } catch (galat) {
      if (nomor !== nomorMuat.current) return;
      setData(null);
      setGalatMuat(
        galat instanceof Error
          ? `Daftar relaas tidak terbaca: ${galat.message}`
          : "Daftar relaas tidak terbaca."
      );
    } finally {
      if (nomor === nomorMuat.current) setMemuat(false);
    }
  }, [tanggal]);

  // Ditunda satu putaran - setState serentak di dalam efek ditolak aturan
  // lint repositori ini (penggambaran berantai).
  useEffect(() => {
    const jam = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(jam);
  }, [muat]);

  const gantiTanggal = (baru: string) => {
    // Ruas yang dikosongkan tidak dikirim: tanggal kosong berarti "hari ini"
    // bagi bot, sedangkan layar akan berkata "tanggal belum dipilih" - dua
    // jawaban berbeda untuk satu keadaan.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(baru)) return;
    setTanggal(baru);
    // Pilihan tanggal lain TIDAK terbawa: kunci dokumen tidak memuat tanggal,
    // dan centang yang tertinggal akan mencetak dokumen yang tidak terlihat.
    setTerpilih(new Set());
    setPilihanPihak({});
  };

  // ---- Keadaan putaran di ekstensi ----------------------------------------
  const tanyaKeadaan = useCallback(async () => {
    if (sedangTanya.current) return;
    sedangTanya.current = true;
    try {
      const jawab = await kirimKeEkstensi("relaas-keadaan", {}, BATAS_TANYA_MS);
      if (!hidup.current) return;
      if (jawab.ok) {
        const baru = putaranDariJawaban(jawab);
        setPutaran(baru);
        setKabarPutaran(
          jawab.menyiapkan
            ? "Ekstensi sedang menyiapkan putaran cetak (membaca blangko dari ABT) - tunggu, jangan tekan Cetak lagi."
            : ""
        );
        if (pantauSampai.current > 0 && baru && baru.pekerjaan.id !== idSebelumMulai.current) {
          // Putaran yang ditunggu sudah lahir - kemajuannya tampil di panel.
          pantauSampai.current = 0;
          setMemantau(false);
          setKabarKirim(null);
          setTerpilih(new Set());
        }
      } else {
        setKabarPutaran(jawab.sebab || "Ekstensi menjawab gagal tanpa menyebut sebabnya.");
      }
      // Pemantauan yang habis waktunya berhenti DENGAN sebab - baik ekstensi
      // menjawab tanpa putaran baru maupun tidak menjawab sama sekali. Selama
      // ekstensi masih berkata "menyiapkan", ia belum dianggap habis.
      if (pantauSampai.current > 0 && Date.now() > pantauSampai.current && !(jawab.ok && jawab.menyiapkan)) {
        pantauSampai.current = 0;
        setMemantau(false);
        setKabarKirim({
          jenis: "galat",
          sebab:
            `Ekstensi tidak melahirkan putaran dalam ${Math.round(BATAS_PANTAU_MS / 60_000)} menit ` +
            "sesudah Cetak ditekan. Periksa ekstensinya di chrome://extensions, lalu tekan Cetak lagi.",
        });
      }
    } finally {
      sedangTanya.current = false;
    }
  }, []);

  // Sekali saat dialog terbuka (atau saat ekstensi baru terpasang): putaran
  // yang sedang berjalan ditampilkan kembali.
  useEffect(() => {
    if (!ekstensi.ada) return;
    const jam = window.setTimeout(() => void tanyaKeadaan(), 0);
    return () => window.clearTimeout(jam);
  }, [ekstensi.ada, tanyaKeadaan]);

  const putaranBelumSelesai = Boolean(putaran && !putaran.pekerjaan.selesai);

  // Selama putaran belum selesai, atau selama menunggu putaran yang belum
  // lahir: ditanya tiap detik (JEDA_TANYA_MS).
  useEffect(() => {
    if (!ekstensi.ada || !(putaranBelumSelesai || memantau)) return;
    const jam = window.setInterval(() => void tanyaKeadaan(), JEDA_TANYA_MS);
    return () => window.clearInterval(jam);
  }, [ekstensi.ada, putaranBelumSelesai, memantau, tanyaKeadaan]);

  // ---- Penilaian dan pilihan ----------------------------------------------
  // Pemetaan blangko admin dari rute (6 Okt, butir 10): tanpa peta ini layar
  // menilai ulang dengan bawaan saja, dan berkas yang dikirim ke ekstensi
  // mengabaikan Pemetaan blangko.
  const petaBlangko = (data as { petaBlangko?: PetaBlangkoCetak } | null)?.petaBlangko ?? null;
  // 6 Okt (butir 10): dokumen "keduanya" (sidang pertama, sidang ditunda sandi
  // 4) dipecah menjadi satu dokumen per pihak - blangko P dan blangko T -
  // sebelum dinilai; gabungan 3.b hanya bila blangko per pihak tidak ada.
  const dokumen = useMemo(
    () =>
      (data?.dokumen ?? []).flatMap((d) => pecahDokumenPerPihak(d, petaBlangko?.relaas ?? {}, petaBlangko?.pbt ?? {})),
    [data, petaBlangko]
  );
  /**
   * Kelompok "dari hari kerja sebelumnya" - panggilan dari sidang kemarin yang
   * jadwalnya mungkin dicatat SESUDAH daftar kemarin dicetak. Milik daftar
   * kemarin, jadi TIDAK ikut "Pilih semua" dan tidak dihitung di angka hari
   * ini. Kunci yang (tak terduga) sama dengan dokumen hari ini dibuang: satu
   * kunci satu butir di ekstensi.
   */
  const dokumenKemarin = useMemo(() => {
    const hariIniKunci = new Set(dokumen.map((d) => d.kunci));
    return (data?.hariKerjaSebelumnya?.dokumen ?? [])
      .flatMap((d) => pecahDokumenPerPihak(d, petaBlangko?.relaas ?? {}, petaBlangko?.pbt ?? {}))
      .filter((d) => !hariIniKunci.has(d.kunci));
  }, [data, dokumen, petaBlangko]);
  const tanggalKemarin = data?.hariKerjaSebelumnya?.tanggal ?? "";
  /**
   * 9 Okt 2026: dokumen yang pihaknya dipilihkan "Kedua pihak" dicetak PER
   * PIHAK (blangko P dan blangko T), seperti dokumen "keduanya" dari bot dan
   * seperti tab Juru Sita ekstensi - bukan dengan gabungan 3.b. Barisnya tetap
   * satu (pilihan pihaknya tetap dapat diubah); pecahannya dipakai saat
   * menilai blangko yang ditampilkan dan saat mengirim ke ekstensi.
   */
  const pecahanPilihan = useMemo(() => {
    const peta = new Map<string, DokumenRelaasCetakPortal[]>();
    for (const dok of [...dokumen, ...dokumenKemarin]) {
      const pecah = pecahPilihanKeduanya(dok, pilihanPihak[dok.kunci], petaBlangko?.relaas ?? {}, petaBlangko?.pbt ?? {});
      if (pecah.length > 0) peta.set(dok.kunci, pecah);
    }
    return peta;
  }, [dokumen, dokumenKemarin, pilihanPihak, petaBlangko]);
  const nilai = useMemo(() => {
    const peta = new Map<string, ReturnType<typeof nilaiCetakDokumen>>();
    for (const dok of [...dokumen, ...dokumenKemarin]) {
      const n = nilaiCetakDokumen(dok, pilihanPihak[dok.kunci] ?? null, petaBlangko);
      const pecah = pecahanPilihan.get(dok.kunci);
      const bagian = pecah ? pecah.map((x) => nilaiCetakDokumen(x, null, petaBlangko).blangko) : [];
      if (n.blangko && bagian.length === 2 && bagian.every(Boolean)) {
        // Hanya tampilan: yang dikirim diambil ulang per pecahan (mulaiCetak).
        n.blangko = {
          label: bagian.map((b) => b!.label).join(" + "),
          berkas: bagian.map((b) => b!.berkas).join(" + "),
        };
      }
      peta.set(dok.kunci, n);
    }
    return peta;
  }, [dokumen, dokumenKemarin, pilihanPihak, petaBlangko, pecahanPilihan]);

  const kelompok = useMemo(() => kelompokkanPerJurusita(dokumen, namaAkun), [dokumen, namaAkun]);
  const kelompokKemarin = useMemo(() => kelompokkanPerJurusita(dokumenKemarin, namaAkun), [dokumenKemarin, namaAkun]);

  /** Yang terpilih DAN masih dapat dicetak - hanya ini yang dikirim, dari kedua kelompok. */
  const siapDikirim = useMemo(
    () =>
      [...dokumen, ...dokumenKemarin].filter((dok) => terpilih.has(dok.kunci) && nilai.get(dok.kunci)?.bisaDicetak),
    [dokumen, dokumenKemarin, terpilih, nilai]
  );
  /** Jumlah dokumen yang SUNGGUH dikirim - pilihan "Kedua pihak" menjadi dua (9 Okt 2026). */
  const jumlahDikirim = siapDikirim.reduce((n, dok) => n + (pecahanPilihan.get(dok.kunci)?.length ?? 1), 0);

  /**
   * "Siap dicetak" untuk tombol Pilih semua: dapat dicetak, TANPA peringatan
   * yang menahan (putusan dicabut/gugur - perlu konfirmasi), DAN belum
   * tercatat di SIPP. Hanya dipakai atas dokumen HARI INI. Yang sudah tercatat kemungkinan besar sudah dicetak dan
   * dijalankan; ikut terpilih bawaannya berarti mencetaknya dua kali. Semuanya
   * tetap dapat dicentang sendiri.
   */
  const siapDipilih = useCallback(
    (daftar: DokumenRelaasCetakPortal[]) =>
      daftar.filter((dok) => {
        const n = nilai.get(dok.kunci);
        return Boolean(n?.bisaDicetak && n.ikutPilihSemua) && dok.sudahAdaRelaas !== true;
      }),
    [nilai]
  );

  const pilihSemua = (daftar: DokumenRelaasCetakPortal[]) =>
    setTerpilih((lama) => {
      const baru = new Set(lama);
      for (const dok of siapDipilih(daftar)) baru.add(dok.kunci);
      return baru;
    });

  const alihCentang = (kunci: string) =>
    setTerpilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(kunci)) baru.delete(kunci);
      else baru.add(kunci);
      return baru;
    });

  const pilihPihak = (kunci: string, pihak: string) =>
    setPilihanPihak((lama) => {
      const baru = { ...lama };
      if (PIHAK_PILIHAN.includes(pihak as PihakPilihan)) baru[kunci] = pihak as PihakPilihan;
      else delete baru[kunci];
      return baru;
    });

  // ---- Mengirim ke ekstensi -----------------------------------------------
  const mulaiCetak = async () => {
    setKabarKirim(null);
    // Diperiksa SAAT DITEKAN, bukan hanya saat dialog dibuka: ekstensi dapat
    // dicopot atau dimuat ulang selagi dialog terbuka.
    if (!ekstensiRelaasTerpasang()) {
      setEkstensi((lama) => ({ ...lama, ada: false }));
      setKabarKirim({ jenis: "ekstensi" });
      return;
    }
    // Pilihan "Kedua pihak" dikirim sebagai DUA dokumen per pihak (9 Okt 2026).
    const kirim = siapDikirim.flatMap((asal) => {
      const pecah = pecahanPilihan.get(asal.kunci);
      return (pecah ?? [asal]).map((dok) => {
        const n = pecah ? nilaiCetakDokumen(dok, null, petaBlangko) : nilai.get(asal.kunci)!;
        return {
          kunci: dok.kunci,
          perkaraId: String(dok.perkaraId),
          nomorPerkara: dok.nomorPerkara,
          golongan: dok.golongan,
          label: `${labelGolonganCetak(dok.golongan)} - ${n.blangko?.label ?? ""}`,
          d: dok.golongan === "pemberitahuan-putusan" ? (dok.d ?? 0) : dok.d,
          // APA ADANYA dari pohon-blangko.ts - termasuk spasi sebelum ".rtf".
          berkas: n.blangko?.berkas ?? "",
          nama: namaBerkasDokumen(dok),
          jurusita: String(dok.jurusita?.nama || NAMA_TIDAK_TERCATAT),
        };
      });
    });
    if (kirim.length === 0) return;

    setMengirim(true);
    const idSebelum = putaran?.pekerjaan.id ?? "";
    try {
      const jawab = await kirimKeEkstensi(
        "relaas-mulai",
        { pekerjaan: { tanggal, dokumen: kirim, dilewati: [] } },
        BATAS_MULAI_MS
      );
      if (!hidup.current) return;
      if (jawab.ok) {
        setPutaran(putaranDariJawaban(jawab));
        setTerpilih(new Set());
        setKabarPutaran("");
        return;
      }
      if (jawab.batasWaktu || jawab.menyiapkan) {
        // Tidak terjawab BUKAN berarti gagal: pekerja latar bisa masih memanen
        // blangko. Dialog memantau keadaannya, dan tombol Cetak terkunci
        // selama itu - relaas-mulai kedua justru yang dulu menghilangkan satu
        // pekerjaan.
        idSebelumMulai.current = idSebelum;
        pantauSampai.current = Date.now() + BATAS_PANTAU_MS;
        setMemantau(true);
        setKabarKirim({
          jenis: "menunggu",
          sebab: jawab.batasWaktu
            ? `Ekstensi belum menjawab dalam ${Math.round(BATAS_MULAI_MS / 1000)} detik - kemungkinan masih ` +
              "membaca blangko dari ABT. Jangan tekan Cetak lagi: dialog menanyakan keadaannya tiap detik " +
              "dan menampilkan putarannya begitu lahir."
            : jawab.sebab || "Ekstensi sedang menyiapkan putaran lain - tunggu sampai putarannya tampil.",
        });
        void tanyaKeadaan();
        return;
      }
      if (jawab.perluMasuk) {
        setKabarKirim({ jenis: "masuk-abt", sebab: jawab.sebab || "Masuk ke ABT lebih dahulu." });
        return;
      }
      // Putaran lain masih berjalan: ditampilkan, bukan hanya disebut.
      const lama = putaranDariJawaban(jawab);
      if (lama) setPutaran(lama);
      setKabarKirim({ jenis: "galat", sebab: jawab.sebab || "Ekstensi menolak tanpa menyebut sebabnya." });
    } finally {
      if (hidup.current) setMengirim(false);
    }
  };

  const tindakan = async (jenis: "relaas-henti" | "relaas-lanjut" | "relaas-bersihkan") => {
    setBertindak(true);
    try {
      const jawab = await kirimKeEkstensi(jenis, {}, BATAS_TINDAKAN_MS);
      if (!hidup.current) return;
      if (jenis === "relaas-bersihkan" && jawab.ok) {
        setPutaran(null);
      } else if (jawab.pekerjaan !== undefined) {
        setPutaran(jawab.pekerjaan ? putaranDariJawaban(jawab) : null);
      }
      setKabarPutaran(jawab.ok ? "" : jawab.sebab || "Ekstensi menolak tanpa menyebut sebabnya.");
      // Keadaan lengkap (ringkas, perkiraan) dibaca ulang - jawaban tindakan
      // hanya membawa pekerjaannya.
      if (jawab.ok && jenis !== "relaas-bersihkan") void tanyaKeadaan();
    } finally {
      if (hidup.current) setBertindak(false);
    }
  };

  // ---- Angka ringkas -------------------------------------------------------
  const hitung = useMemo(() => {
    let siap = 0;
    let perluDilihat = 0;
    let perluPihak = 0;
    let tidakBisa = 0;
    for (const dok of dokumen) {
      const n = nilai.get(dok.kunci);
      if (n?.bisaDicetak && n.ikutPilihSemua) siap += 1;
      else if (n?.bisaDicetak) perluDilihat += 1;
      // Pihak yang belum dipilih dihitung di sana HANYA bila itu satu-satunya
      // sebabnya - dokumen yang pasti ditolak ABT tidak menjadi "pilih pihak".
      else if (
        String(dok.pihakDipanggil) === "tidak-diketahui" &&
        !pilihanPihak[dok.kunci] &&
        !sebabProsesDiLuarMenu(dok)
      )
        perluPihak += 1;
      else tidakBisa += 1;
    }
    return { siap, perluDilihat, perluPihak, tidakBisa };
  }, [dokumen, nilai, pilihanPihak]);

  const semuaSiapDipilih = siapDipilih(dokumen);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cetak relaas"
    >
      <div className="my-2 w-full max-w-5xl space-y-4 rounded-lg border bg-background p-4 shadow-lg sm:my-6">
        {/* ---- Kepala ------------------------------------------------- */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-base font-bold uppercase tracking-wide">Cetak relaas</h2>
            <p className="text-sm text-muted-foreground">
              Panggilan sidang dan pemberitahuan putusan yang lahir pada tanggal ini - termasuk
              perkara yang baru didaftarkan. Dicetak lewat ekstensi ALETA dari blangko ABT; tidak
              ada yang ditulis ke SIPP.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onTutup} aria-label="Tutup dialog cetak relaas">
            <X className="mr-1 h-4 w-4" />
            Tutup
          </Button>
        </div>

        {/* ---- Putaran yang sedang berjalan (bila ada) ---------------- */}
        {putaran ? (
          <PanelPutaran
            putaran={putaran}
            bertindak={bertindak}
            onHenti={() => void tindakan("relaas-henti")}
            onLanjut={() => void tindakan("relaas-lanjut")}
            onBersihkan={() => void tindakan("relaas-bersihkan")}
          />
        ) : null}
        {kabarPutaran ? (
          <p className="rounded-md border border-amber-300/70 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/60 dark:text-amber-200">
            {kabarPutaran}
          </p>
        ) : null}

        {/* ---- Tanggal ------------------------------------------------ */}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Tanggal mencetak
            <Input
              type="date"
              value={tanggal}
              className="w-[11rem]"
              onChange={(e) => gantiTanggal(e.target.value)}
              aria-label="Tanggal cetak relaas"
            />
          </label>
          <Button size="sm" variant="outline" onClick={() => gantiTanggal(hariIni)} disabled={tanggal === hariIni}>
            Hari ini
          </Button>
          <Button size="sm" variant="outline" onClick={() => void muat()} disabled={memuat}>
            {memuat ? "Membaca…" : "Muat ulang"}
          </Button>
          <p className="text-sm">{tanggalHariPanjang(tanggal, "Tanggal belum dipilih.")}</p>
        </div>

        {/* ---- Isi ---------------------------------------------------- */}
        {memuat && !data ? (
          <p className="text-sm text-muted-foreground">Membaca dari SIPP…</p>
        ) : galatMuat ? (
          <div className="space-y-2 rounded-lg border border-amber-300/70 bg-amber-100 p-3 dark:border-amber-700/50 dark:bg-amber-950/60">
            <p className="text-sm font-medium">Daftar relaas tidak terbaca.</p>
            <p className="text-sm">{galatMuat}</p>
            <Button size="sm" variant="outline" onClick={() => void muat()}>
              Coba lagi
            </Button>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              <Angka nilai={dokumen.length} label="dokumen lahir" />
              <Angka nilai={hitung.siap} label="siap dicetak" />
              <Angka nilai={hitung.perluDilihat} label="perlu konfirmasi" nyala />
              <Angka nilai={hitung.tidakBisa} label="tidak dapat dicetak" nyala />
              <Angka nilai={hitung.perluPihak} label="perlu dipilih pihaknya" nyala />
              <Angka nilai={data.tidakPerlu?.length ?? 0} label="tidak perlu dipanggil" />
              <Angka nilai={data.tertunda?.length ?? 0} label="tertunda" nyala />
              <Angka
                nilai={dokumen.filter((d) => d.sudahAdaRelaas === true).length}
                label="sudah tercatat di SIPP"
              />
            </div>

            {Array.isArray(data.catatan) && data.catatan.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                {data.catatan.map((teks, i) => (
                  <li key={`${i}-${teks.slice(0, 24)}`}>{teks}</li>
                ))}
              </ul>
            ) : null}

            {dokumen.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                Tidak ada panggilan maupun pemberitahuan yang lahir pada tanggal ini.
                <span className="text-muted-foreground">
                  {" "}
                  Itu keadaan yang lazim - periksa bagian tertunda di bawah bila ada sidang yang
                  hasilnya belum dicatat.
                </span>
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => pilihSemua(dokumen)}
                  disabled={semuaSiapDipilih.length === 0}
                  title="Mencentang seluruh dokumen yang dapat dicetak, tanpa peringatan, dan belum tercatat di SIPP. Yang lain tidak ikut - centang sendiri bila memang perlu dicetak."
                >
                  Pilih semua yang siap dicetak ({semuaSiapDipilih.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTerpilih(new Set())}
                  disabled={terpilih.size === 0}
                >
                  Kosongkan pilihan
                </Button>
                <span className="text-xs text-muted-foreground">
                  Tidak ada yang tercentang sendiri. Yang sudah tercatat di SIPP, yang perlu konfirmasi
                  (putusan dicabut/gugur), dan kelompok hari kerja sebelumnya tidak ikut &quot;Pilih semua&quot;.
                </span>
              </div>
            )}

            <div className="space-y-3">
              {kelompok.map((k) => (
                <BagianKelompok
                  key={k.nama}
                  kelompok={k}
                  tanggal={tanggal}
                  hariIni={hariIni}
                  nilai={nilai}
                  terpilih={terpilih}
                  pilihanPihak={pilihanPihak}
                  jumlahSiap={siapDipilih(k.dokumen).length}
                  onPilihSemua={() => pilihSemua(k.dokumen)}
                  onCentang={alihCentang}
                  onPilihPihak={pilihPihak}
                />
              ))}
            </div>

            {/* ---- Dari hari kerja sebelumnya - terpisah, tanpa Pilih semua */}
            {data.hariKerjaSebelumnya ? (
              <Lipatan
                judul={`Dari hari kerja sebelumnya${tanggalKemarin ? ` - ${tanggalHariPendek(tanggalKemarin, "")}` : ""}`}
                jumlah={dokumenKemarin.length}
              >
                <DaftarHariSebelumnya
                  kelompok={kelompokKemarin}
                  tanggalKemarin={tanggalKemarin}
                  jumlah={dokumenKemarin.length}
                  jumlahSudah={dokumenKemarin.filter((d) => d.sudahAdaRelaas === true).length}
                  tanggal={tanggal}
                  hariIni={hariIni}
                  nilai={nilai}
                  terpilih={terpilih}
                  pilihanPihak={pilihanPihak}
                  onCentang={alihCentang}
                  onPilihPihak={pilihPihak}
                />
              </Lipatan>
            ) : null}

            {/* ---- Yang TIDAK menjadi dokumen - dikatakan jujur -------- */}
            <Lipatan judul="Tidak perlu dipanggil atau diberi tahu" jumlah={data.tidakPerlu?.length ?? 0}>
              <DaftarTidakPerlu baris={data.tidakPerlu ?? []} />
            </Lipatan>
            <Lipatan judul="Tertunda - panggilannya belum dapat dicetak" jumlah={data.tertunda?.length ?? 0}>
              <DaftarTertunda baris={data.tertunda ?? []} />
            </Lipatan>
          </>
        ) : null}

        {/* Rekap lama - dimuat HANYA saat dibuka: ia membaca dua tabel besar
            SIPP, dan kebanyakan juru sita membuka dialog ini untuk mencetak,
            bukan untuk merekap. */}
        <Lipatan judul="Sudah tercatat di SIPP pada tanggal ini">
          <AletaEcourtRelaasMassal tertanam tanggal={tanggal} />
        </Lipatan>

        {/* ---- Kaki: kirim ke ekstensi ------------------------------ */}
        <div className="sticky bottom-0 -mx-4 -mb-4 space-y-2 rounded-b-lg border-t bg-background p-4">
          {kabarKirim?.jenis === "ekstensi" || (!ekstensi.ada && siapDikirim.length > 0) ? (
            <p className="rounded-md border border-rose-300/70 bg-rose-100 px-3 py-2 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/60 dark:text-rose-300">
              {KALIMAT_EKSTENSI_TIDAK_ADA}.
            </p>
          ) : null}
          {kabarKirim?.jenis === "masuk-abt" ? (
            <p className="rounded-md border border-amber-300/70 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/60 dark:text-amber-200">
              {kabarKirim.sebab}{" "}
              <a href="/aps_badilag/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                Masuk ke ABT dulu
              </a>
              , lalu tekan Cetak lagi.
            </p>
          ) : null}
          {kabarKirim?.jenis === "galat" || kabarKirim?.jenis === "menunggu" ? (
            <p className="rounded-md border border-amber-300/70 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/60 dark:text-amber-200">
              {kabarKirim.sebab}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {ekstensi.ada
                ? `Ekstensi ALETA terpasang${ekstensi.versi ? ` (versi ${ekstensi.versi})` : ""}. Berkas tersimpan di folder unduhan: "ALETA relaas ${tanggal}/<nama juru sita>/".`
                : "Ekstensi ALETA belum terdeteksi di halaman ini."}
            </p>
            <Button
              onClick={() => void mulaiCetak()}
              disabled={mengirim || siapDikirim.length === 0 || putaranBelumSelesai || memantau}
              title={
                putaranBelumSelesai
                  ? "Masih ada putaran cetak yang belum selesai - tunggu, atau hentikan dulu."
                  : memantau
                    ? "Menunggu putaran yang sedang disiapkan ekstensi."
                    : undefined
              }
            >
              <Printer className="mr-1.5 h-4 w-4" />
              {mengirim ? "Mengirim ke ekstensi…" : `Cetak ${jumlahDikirim} dokumen`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// BAGIAN-BAGIAN
// ===========================================================================

function Angka({ nilai, label, nyala = false }: { nilai: number; label: string; nyala?: boolean }) {
  return (
    <div
      className={
        nyala && nilai > 0
          ? "rounded-lg border border-amber-300/70 bg-amber-100 p-2.5 dark:border-amber-700/50 dark:bg-amber-950/60"
          : "rounded-lg border border-border bg-card p-2.5"
      }
    >
      <p className="text-lg font-semibold tabular-nums">{nilai}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Bagian terlipat - isinya BARU dipasang saat dibuka. */
function Lipatan({
  judul,
  jumlah,
  children,
}: {
  judul: string;
  jumlah?: number;
  children: ReactNode;
}) {
  const [buka, setBuka] = useState(false);
  return (
    <section className="rounded-lg border border-border">
      <button
        type="button"
        aria-expanded={buka}
        onClick={() => setBuka((x) => !x)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
      >
        {buka ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
        {judul}
        {jumlah !== undefined ? <span className="tabular-nums text-muted-foreground">({jumlah})</span> : null}
      </button>
      {buka ? <div className="border-t border-border p-3">{children}</div> : null}
    </section>
  );
}

export function DaftarTidakPerlu({ baris }: { baris: TidakPerluRelaasCetak[] }) {
  if (baris.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada pada tanggal ini.</p>;
  }
  const adaSandiSatu = baris.some((b) => b.sebab === "semua-pihak-hadir" && b.golongan !== "pemberitahuan-putusan");
  return (
    <div className="space-y-2">
      {adaSandiSatu ? (
        <p className="text-xs text-muted-foreground">
          &quot;Semua pihak hadir&quot; dibaca dari sandi kehadiran SIPP - yang juga nilai bawaan blangko SIPP
          bila isian kehadiran tidak disentuh. Sandi itu sesekali salah; periksa alasan penundaan yang
          tercatat di tiap baris.
        </p>
      ) : null}
      <ul className="space-y-1 text-sm">
        {baris.map((b) => (
          <li key={`${b.golongan}:${b.perkaraId}:${b.sidangAsalId ?? 0}`}>
            <span className="font-semibold">{b.nomorPerkara || `perkara ${b.perkaraId}`}</span>
            <span className="text-muted-foreground"> · {labelGolonganCetak(b.golongan)} · </span>
            {kalimatTidakPerlu(b)}
            {b.keterangan ? <span className="text-muted-foreground"> ({b.keterangan})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DaftarTertunda({ baris }: { baris: TertundaRelaasCetak[] }) {
  if (baris.length === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada pada tanggal ini.</p>;
  }
  const adaBelumDicatat = baris.some((b) => b.sebab === "hasil-sidang-belum-dicatat");
  return (
    <div className="space-y-2">
      {adaBelumDicatat ? (
        // "Hari itu" adalah hari MENCETAK: jadwal yang dicatat sore nanti
        // lahir pada TANGGAL INI (jalan "ditunda"), dan daftar besok tidak
        // memuatnya - jaring "jadwal baru" besok hanya membaca jadwal yang
        // diinput besok. Yang mencetak pagi harus tahu tempat mencarinya.
        <p className="text-xs text-muted-foreground">
          Panggilan dari sidang yang hasilnya dicatat nanti HARI INI tetap milik tanggal ini dan tidak
          muncul di daftar besok (yang baru dicatat besok muncul besok sebagai jadwal baru). Buka lagi
          tanggal ini sesudah hasil sidangnya dicatat.
        </p>
      ) : null}
      <ul className="space-y-1 text-sm">
        {baris.map((b) => (
          <li key={`${b.sebab}:${b.perkaraId}`}>
            <span className="font-semibold">{b.nomorPerkara || `perkara ${b.perkaraId}`}</span>
            <span> · {kalimatTertunda(b)}</span>
            {b.keterangan ? <span className="text-muted-foreground"> ({b.keterangan})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Panggilan dari sidang hari kerja sebelumnya. Milik daftar tanggal itu -
 * sebagian besar sudah tercetak kemarin - jadi tanpa "Pilih semua"; yang
 * sudah tercatat di SIPP bertanda, dan jam dicatatnya jadwal ada di
 * keterangan tiap baris.
 */
export function DaftarHariSebelumnya({
  kelompok,
  tanggalKemarin,
  jumlah,
  jumlahSudah,
  tanggal,
  hariIni,
  nilai,
  terpilih,
  pilihanPihak,
  onCentang,
  onPilihPihak,
}: {
  kelompok: KelompokJurusita[];
  tanggalKemarin: string;
  jumlah: number;
  jumlahSudah: number;
  tanggal: string;
  hariIni: string;
  nilai: Map<string, ReturnType<typeof nilaiCetakDokumen>>;
  terpilih: Set<string>;
  pilihanPihak: Record<string, PihakPilihan>;
  onCentang: (kunci: string) => void;
  onPilihPihak: (kunci: string, pihak: string) => void;
}) {
  const hari = tanggalKemarin ? tanggalHariPendek(tanggalKemarin, "hari kerja sebelumnya") : "hari kerja sebelumnya";
  if (jumlah === 0) {
    return <p className="text-sm text-muted-foreground">Tidak ada panggilan dari sidang {hari} yang masih dapat sampai.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Panggilan dari sidang {hari} yang ditunda. Milik daftar tanggal itu - {jumlahSudah} dari {jumlah} sudah
        tercatat di SIPP. Yang ditampilkan di sini untuk jadwal yang dicatat SESUDAH daftar itu dicetak; periksa
        jam dicatatnya dan tanda &quot;sudah tercatat di SIPP&quot; sebelum mencentang. Kelompok ini tidak ikut
        &quot;Pilih semua&quot;.
      </p>
      {kelompok.map((k) => (
        <BagianKelompok
          key={k.nama}
          kelompok={k}
          tanggal={tanggal}
          hariIni={hariIni}
          nilai={nilai}
          terpilih={terpilih}
          pilihanPihak={pilihanPihak}
          jumlahSiap={0}
          onPilihSemua={null}
          onCentang={onCentang}
          onPilihPihak={onPilihPihak}
          sebabMasukTeks={`sidang ${hari} ditunda`}
        />
      ))}
    </div>
  );
}

function BagianKelompok({
  kelompok,
  tanggal,
  hariIni,
  nilai,
  terpilih,
  pilihanPihak,
  jumlahSiap,
  onPilihSemua,
  onCentang,
  onPilihPihak,
  sebabMasukTeks,
}: {
  kelompok: KelompokJurusita;
  tanggal: string;
  hariIni: string;
  nilai: Map<string, ReturnType<typeof nilaiCetakDokumen>>;
  terpilih: Set<string>;
  pilihanPihak: Record<string, PihakPilihan>;
  jumlahSiap: number;
  /** null: tanpa tombol "Pilih semua" (kelompok hari kerja sebelumnya). */
  onPilihSemua: (() => void) | null;
  onCentang: (kunci: string) => void;
  onPilihPihak: (kunci: string, pihak: string) => void;
  /** Pengganti kalimat sebab masuk - dokumen yang sidang asalnya BUKAN tanggal dialog. */
  sebabMasukTeks?: string;
}) {
  return (
    <section
      aria-label={`Juru sita ${kelompok.nama}`}
      className={
        kelompok.dariPenunjukan
          ? "rounded-lg border border-border bg-card"
          : "rounded-lg border border-amber-300/70 bg-amber-100/60 dark:border-amber-700/50 dark:bg-amber-950/40"
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
        <p className="text-sm font-semibold">{kelompok.nama}</p>
        {kelompok.milikSaya ? <Badge variant="info">Anda</Badge> : null}
        {kelompok.nip ? (
          <span className="font-mono text-xs text-muted-foreground">NIP {kelompok.nip}</span>
        ) : null}
        <span className="text-xs text-muted-foreground">{kelompok.dokumen.length} dokumen</span>
        {!kelompok.dariPenunjukan ? (
          <span className="text-xs">
            Tidak ada penunjukan juru sita aktif di SIPP - dokumennya dikumpulkan di sini, bukan dibuang.
          </span>
        ) : null}
        {onPilihSemua ? (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={onPilihSemua}
            disabled={jumlahSiap === 0}
          >
            Pilih semua yang siap dicetak ({jumlahSiap})
          </Button>
        ) : null}
      </div>
      <div className="divide-y divide-border/70">
        {kelompok.dokumen.map((dok) => (
          <BarisDokumen
            key={dok.kunci}
            dok={dok}
            tanggal={tanggal}
            hariIni={hariIni}
            nilai={nilai.get(dok.kunci) ?? nilaiCetakDokumen(dok)}
            tercentang={terpilih.has(dok.kunci)}
            pilihan={pilihanPihak[dok.kunci] ?? ""}
            onCentang={() => onCentang(dok.kunci)}
            onPilihPihak={(pihak) => onPilihPihak(dok.kunci, pihak)}
            sebabMasukTeks={sebabMasukTeks}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Satu dokumen. Diekspor supaya uji dapat MENGGAMBARNYA sendiri - penjaga
 * penyisir teks di repositori ini sudah tiga kali hijau atas kode yang melempar.
 */
export function BarisDokumen({
  dok,
  tanggal,
  hariIni,
  nilai,
  tercentang,
  pilihan,
  onCentang,
  onPilihPihak,
  sebabMasukTeks,
}: {
  dok: DokumenRelaasCetakPortal;
  tanggal: string;
  hariIni: string;
  nilai: ReturnType<typeof nilaiCetakDokumen>;
  tercentang: boolean;
  pilihan: string;
  onCentang: () => void;
  onPilihPihak: (pihak: string) => void;
  sebabMasukTeks?: string;
}) {
  const pemberitahuan = dok.golongan === "pemberitahuan-putusan";
  const perluPilih = String(dok.pihakDipanggil) === "tidak-diketahui";
  const idCentang = `cetak-relaas-${dok.kunci}`;

  return (
    <div className="flex gap-3 px-3 py-2 text-sm">
      <input
        id={idCentang}
        type="checkbox"
        className="mt-1 size-4 shrink-0"
        checked={tercentang}
        disabled={!nilai.bisaDicetak && !tercentang}
        onChange={onCentang}
        aria-label={`Cetak ${dok.nomorPerkara} - ${labelGolonganCetak(dok.golongan)}`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={idCentang} className="font-semibold">
            {dok.nomorPerkara || `perkara ${dok.perkaraId}`}
          </label>
          <Badge variant={pemberitahuan ? "netral" : "info"}>{labelGolonganCetak(dok.golongan)}</Badge>
          {dok.jenisPerkara ? <span className="text-xs text-muted-foreground">{dok.jenisPerkara}</span> : null}
          {dok.sudahAdaRelaas === true ? <Badge variant="muted">sudah tercatat di SIPP</Badge> : null}
          {dok.sudahAdaRelaas === null ? (
            <span className="text-xs text-muted-foreground">tercatat tidaknya di SIPP belum dapat dinilai</span>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {sebabMasukTeks || kalimatSebabMasuk(dok.sebabMasuk, tanggal, hariIni)}
          {!pemberitahuan ? (
            <>
              {" · "}
              {dok.d ? `untuk sidang ke-${dok.d}` : "nomor sidang tujuan tidak terbaca"}
              {dok.tanggalSidangTujuan
                ? `, ${tanggalHariPendek(dok.tanggalSidangTujuan, "tanggal tidak terbaca")}`
                : ", tanggal sidangnya belum tercatat"}
            </>
          ) : null}
        </p>

        <p className="text-xs">
          <span className="text-muted-foreground">{pemberitahuan ? "Diberi tahu: " : "Dipanggil: "}</span>
          <span className={nilai.pihak === "tidak-diketahui" ? "font-medium text-amber-700 dark:text-amber-400" : "font-medium"}>
            {labelPihak(nilai.pihak, pemberitahuan)}
          </span>
          {perluPilih && pilihan ? <span className="text-muted-foreground"> (dipilih petugas)</span> : null}
        </p>

        {!perluPilih && Array.isArray(dok.keterangan) && dok.keterangan.length > 0 ? (
          <p className="text-xs text-muted-foreground">{dok.keterangan.join(" ")}</p>
        ) : null}

        {perluPilih ? (
          <div className="flex flex-wrap items-center gap-2 rounded border border-amber-300/70 bg-amber-50 px-2 py-1 text-xs dark:border-amber-700/50 dark:bg-amber-950/40">
            <span>{sebabPihakTidakDiketahui(dok)} Pilih pihaknya dulu:</span>
            <select
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
              value={pilihan}
              onChange={(e) => onPilihPihak(e.target.value)}
              aria-label={`Pihak ${pemberitahuan ? "yang diberi tahu" : "yang dipanggil"} untuk ${dok.nomorPerkara}`}
            >
              <option value="">- pilih -</option>
              {PIHAK_PILIHAN.map((p) => (
                <option key={p} value={p}>
                  {LABEL_PILIHAN[p]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <p className="text-xs">
          <span className="text-muted-foreground">Blangko: </span>
          {nilai.blangko ? (
            <>
              <span className="font-medium">{nilai.blangko.label}</span>
              <span className="ml-1 font-mono text-[11px] text-muted-foreground">{nilai.blangko.berkas}</span>
            </>
          ) : (
            <span className="font-medium text-amber-700 dark:text-amber-400">tidak ada</span>
          )}
        </p>

        {!nilai.bisaDicetak ? (
          <p className="text-xs text-amber-800 dark:text-amber-300">Belum dapat dicetak: {nilai.sebabTidakBisa}</p>
        ) : null}

        {nilai.peringatan.length > 0 ? (
          <ul className="space-y-0.5 text-xs">
            {nilai.peringatan.map((p) => (
              <li
                key={`${p.jenis}:${p.teks.slice(0, 32)}`}
                className={p.tahanPilihSemua ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"}
              >
                {p.jenis === "status-putusan"
                  ? "Perlu konfirmasi (tidak ikut \"Pilih semua\"): "
                  : p.tahanPilihSemua
                    ? "Perlu dilihat dulu (tidak ikut \"Pilih semua\"): "
                    : "Catatan: "}
                {p.teks}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Kemajuan putaran di ekstensi - neraca, perkiraan, dan tindakan. */
export function PanelPutaran({
  putaran,
  bertindak,
  onHenti,
  onLanjut,
  onBersihkan,
}: {
  putaran: Putaran;
  bertindak: boolean;
  onHenti: () => void;
  onLanjut: () => void;
  onBersihkan: () => void;
}) {
  const { pekerjaan } = putaran;
  const butir = Array.isArray(pekerjaan.butir) ? pekerjaan.butir : [];
  const dilewatiAwal = Array.isArray(pekerjaan.dilewati) ? pekerjaan.dilewati : [];
  const ringkas: RingkasPutaran = putaran.ringkas ?? {
    menunggu: butir.filter((b) => b.keadaan === "menunggu").length,
    sedang: butir.filter((b) => b.keadaan === "sedang").length,
    selesai: butir.filter((b) => b.keadaan === "selesai").length,
    gagal: butir.filter((b) => b.keadaan === "gagal").length,
    dilewati: butir.filter((b) => b.keadaan === "dilewati").length + dilewatiAwal.length,
  };
  const total = butir.length + dilewatiAwal.length;
  const tuntas = ringkas.selesai + ringkas.gagal + ringkas.dilewati;
  const persen = total > 0 ? Math.round((tuntas / total) * 100) : 100;
  const tertahan = pekerjaan.tertahan ?? null;

  const keadaan = pekerjaan.selesai
    ? pekerjaan.dihentikan
      ? "Dihentikan"
      : "Selesai"
    : tertahan
      ? "Tertahan"
      : "Berjalan";

  const gagal = butir.filter((b) => b.keadaan === "gagal");
  const dilewati = [
    ...butir.filter((b) => b.keadaan === "dilewati"),
    ...dilewatiAwal.map((x) => ({ kunci: String(x.kunci || ""), nomorPerkara: x.nomorPerkara, label: x.label, keadaan: "dilewati", sebab: x.sebab })),
  ];
  const tungguBerikut = Number(pekerjaan.waktuBerikut || 0) - putaran.sekarang;

  return (
    <section aria-label="Kemajuan cetak relaas" className="space-y-2 rounded-lg border border-sky-300/70 bg-sky-50 p-3 dark:border-sky-700/50 dark:bg-sky-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">
          Putaran cetak{pekerjaan.tanggal ? ` ${tanggalHariPendek(pekerjaan.tanggal, "")}` : ""}
        </p>
        <Badge
          variant={
            keadaan === "Berjalan"
              ? "info"
              : keadaan === "Tertahan"
                ? "warning"
                : keadaan === "Selesai"
                  ? "success"
                  : "muted"
          }
        >
          {keadaan}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">
          {tuntas} dari {total} dokumen
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {!pekerjaan.selesai ? (
            <Button size="sm" variant="outline" onClick={onHenti} disabled={bertindak}>
              Hentikan
            </Button>
          ) : null}
          {!pekerjaan.selesai && tertahan ? (
            <Button size="sm" onClick={onLanjut} disabled={bertindak}>
              Lanjutkan
            </Button>
          ) : null}
          {pekerjaan.selesai ? (
            <Button size="sm" variant="outline" onClick={onBersihkan} disabled={bertindak}>
              Bersihkan
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Kemajuan cetak relaas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={persen}
      >
        <div className="h-full bg-sky-500" style={{ width: `${persen}%` }} />
      </div>

      <p className="text-sm">
        <span className="font-medium">{ringkas.selesai} tersimpan (RTF)</span>
        {" · "}
        <span className={ringkas.gagal > 0 ? "font-medium text-rose-700 dark:text-rose-400" : ""}>{ringkas.gagal} gagal</span>
        {" · "}
        {ringkas.dilewati} dilewati
        {" · "}
        {ringkas.menunggu + ringkas.sedang} menunggu
      </p>

      {!pekerjaan.selesai && putaran.perkiraanSisa && ringkas.menunggu > 0 ? (
        <p className="text-xs text-muted-foreground">
          Perkiraan sisa waktu: {lamaWaktu(putaran.perkiraanSisa.rendah)} sampai{" "}
          {lamaWaktu(putaran.perkiraanSisa.tinggi)}. Antar dokumen ada jeda 1-2,5 detik supaya server ABT
          tidak terbebani.
          {tungguBerikut > 0 ? ` Dokumen berikutnya sekitar ${Math.ceil(tungguBerikut / 1000)} detik lagi.` : ""}
        </p>
      ) : null}

      {tertahan ? (
        <p className="rounded-md border border-amber-300/70 bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/60 dark:text-amber-200">
          {tertahan.sebab || "Putaran tertahan tanpa sebab yang tercatat."}{" "}
          {tertahan.perluMasuk === "abt" ? (
            <a href="/aps_badilag/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Masuk ke ABT dulu
            </a>
          ) : null}
          {tertahan.perluMasuk === "abt-akses" ? (
            <>
              <a href="/aps_badilag/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                Buka ABT
              </a>
              <span className="mt-1 block text-xs">{KALIMAT_ATUR_AKSES_ABT}</span>
            </>
          ) : null}
          {tertahan.perluMasuk === "aleta" ? <span className="font-semibold">Masuk ke portal ALETA lagi.</span> : null}
        </p>
      ) : null}

      {pekerjaan.folder ? (
        <p className="text-xs text-muted-foreground">
          Berkas tersimpan di folder unduhan peramban: {pekerjaan.folder}/&lt;nama juru sita&gt;/
        </p>
      ) : null}

      {gagal.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium">Gagal:</p>
          <ul className="space-y-0.5 text-xs">
            {gagal.map((b) => (
              <li key={b.kunci}>
                <span className="font-semibold">{b.nomorPerkara || b.kunci}</span>
                {b.label ? ` (${b.label})` : ""}: {b.sebab || "sebab tidak tercatat"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dilewati.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium">Dilewati:</p>
          <ul className="space-y-0.5 text-xs">
            {dilewati.map((b, i) => (
              <li key={`${b.kunci}-${i}`}>
                <span className="font-semibold">{b.nomorPerkara || b.kunci || "dokumen"}</span>
                {b.label ? ` (${b.label})` : ""}: {b.sebab || "sebab tidak tercatat"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {Array.isArray(pekerjaan.catatan) && pekerjaan.catatan.length > 0 ? (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {pekerjaan.catatan.slice(-5).map((c, i) => (
            <li key={`${i}-${c.slice(0, 24)}`}>{c}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
