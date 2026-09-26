"use client";

/**
 * ============================================================================
 * CETAK MASSAL RELAAS PANGGILAN DAN PEMBERITAHUAN PUTUSAN - SATU TANGGAL
 * ============================================================================
 *
 * Diminta pengguna 25 September 2026: "cetak relaas panggilan sidang dan
 * pemberitahuan putusan massal untuk jurusita dengan pilihan tanggal atau
 * defaultnya hari itu ... dia mengambil semua perkara yang cetak relaas
 * panggilan sidang dan pemberitahuan massal pada hari itu atau tanggal yang
 * dipilih".
 *
 * Sebelum ini juru sita menyalin nomor perkara satu per satu dari SIPP. Yang
 * dikerjakan layar ini hanya mengumpulkannya - ia TIDAK menuliskan apa pun ke
 * SIPP, dan tidak membuat relaasnya.
 *
 * TIDAK LAGI BERDIRI SEBAGAI TAB. Keputusan pengguna 25 September 2026:
 * "jangan buat tab baru di aleta e-court, cukup tambahkan tombol cetak relaas
 * di antrian aleta sidang". Tab "Cetak Relaas Massal" dihapus; rekap ini kini
 * ditanam sebagai bagian terlipat "Sudah tercatat di SIPP pada tanggal ini" di
 * dalam dialog Cetak relaas (aleta-ecourt-cetak-relaas.tsx), dengan tanggal
 * yang dikendalikan dialog - lihat prop `tertanam`.
 *
 * ============================================================================
 * NAMA JURU SITA DATANG DARI DUA JALAN YANG BERBEDA, DAN ITU DISEBUTKAN
 * ============================================================================
 *
 * Relaas panggilan menyimpan siapa yang mengerjakannya. Pemberitahuan putusan
 * TIDAK: perkara_putusan_pemberitahuan_putusan tidak punya kolom juru sita
 * sama sekali, sehingga namanya disimpulkan dari penunjukan yang masih aktif
 * pada perkaranya - aturan yang pengguna nyatakan sendiri.
 *
 * Kesimpulan bukan catatan. Karena itu tiap baris menyebut DARI MANA namanya
 * diketahui, dan baris yang penunjukannya berselisih dengan yang memanggil
 * membawa KEDUA namanya sekaligus. Terukur 41 dari 3.123 baris (1,3%), dan di
 * antaranya penunjukan bernama "jsp5" serta pemanggil bernama "Super
 * Administrator" - nama login, bukan nama orang. Layar yang memilih salah satu
 * di antaranya akan menugaskan orang yang tidak ada.
 *
 * ============================================================================
 * HARI KOSONG ADALAH KEADAAN LAZIM, BUKAN KEGAGALAN
 * ============================================================================
 *
 * Dari 365 hari hanya sebagian yang berisi - hari tersibuk 2026 baru 58 relaas
 * (29 April), dan pemberitahuan putusan paling banyak 15 sehari (18 Agustus).
 * Tabel kosong tanpa keterangan akan dibaca sebagai "layarnya rusak", jadi
 * hari kosong berbunyi dengan kalimatnya sendiri.
 *
 * Yang TIDAK boleh disamakan dengan hari kosong: bot yang tidak dapat
 * dihubungi. Keduanya digambar terpisah, sebab yang satu berarti tidak ada
 * pekerjaan dan yang lain berarti tidak ada jawaban.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
// Nama berkas blangko TIDAK ditulis di layar ini. Satu spasi yang hilang pada
// '[JS] 1. Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf' membuat blangkonya
// tidak pernah ketemu tanpa satu pun galat, jadi namanya hanya ada di
// pohon-blangko.ts dan dibaca dari sana - di layar ini maupun di rutenya.
import {
  BLANGKO_RELAAS,
  blangkoRelaas,
  keadaanUntukGolongan,
  pihakDipanggil as pihakDariSandi,
  type PihakDipanggil,
} from "@/lib/pohon-blangko";
import {
  tanggalHariPanjang,
  tanggalHariPendek,
  tanggalPanjangDenganHari,
} from "@/lib/tanggal-indonesia";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * RUAS BARU DITANDAI OPSIONAL DENGAN SENGAJA
 * ============================================================================
 *
 * golongan, urutanSidang, dihadiriOleh, pihakDipanggil, dan sudahAdaRelaas
 * ditambahkan ke bot pada saat yang sama dengan layar ini. Menyatakannya wajib
 * berarti tsc percaya ruasnya selalu datang, lalu layar menggambar `undefined`
 * sebagai 0 atau sebagai kosong - dan 0 yang tidak diukur tidak dapat dibedakan
 * dari 0 yang diukur.
 *
 * Karena itu bedanya dijaga pada TIGA keadaan, bukan dua: ruas yang TIDAK ADA
 * ("bot belum mengirimnya"), ruas yang ada tetapi KOSONG ("bot tidak dapat
 * menentukannya"), dan ruas yang ada beserta nilainya. Pembedanya `in`, bukan
 * nilai jatuhan - lihat nilaiBaris().
 */
type Baris = {
  jenis: "panggilan" | "pemberitahuan";
  perkaraId: number;
  nomorPerkara: string;
  jenisPerkara: string;
  pihak: string;
  sebutanPihak: string;
  tanggalSidang: string;
  tanggalPutusan: string;
  agenda: string;
  caraSandi: string;
  caraLabel: string;
  resi: string;
  statusPos: string;
  adaBerkas: boolean;
  sumberJurusita: string;
  berselisih: boolean;
  namaPanggilan: string;
  /** Golongan panggilan menurut bot - lihat GOLONGAN_LABEL. */
  golongan?: string;
  /**
   * Nomor sidang yang SUDAH diturunkan bot.
   *
   * BUKAN perkara_jadwal_sidang.urutan: komentar kolom itu berbunyi "Urutan
   * Jadwal Sidang Dalam Satu Hari yang sama: (by system)", jadi memakainya
   * sebagai nomor sidang salah. Yang dipakai di sini ruas yang sama dengan
   * daftar jadwal pada panel Status Perkara.
   */
  urutanSidang?: number | null;
  /** Sandi kehadiran SIPP apa adanya - boleh kosong, dan kosongnya berarti. */
  dihadiriOleh?: string | number | null;
  /** Hasil penerjemahan sandi di bot; layar tetap dapat menurunkannya sendiri. */
  pihakDipanggil?: string;
  /** Ada baris perkara_pelaksanaan_relaas untuk sidang dan pihak ini. */
  sudahAdaRelaas?: boolean | null;
};

type Jurusita = {
  nama: string;
  nip: string;
  relaas: number;
  pemberitahuan: number;
  baris: Baris[];
};

type Hasil = {
  tanggal: string;
  diperiksaPada: string;
  ringkas: {
    relaas: number;
    pemberitahuan: number;
    perkara: number;
    jurusita: number;
    tanpaJurusita: number;
    berselisih: number;
    /** Panggilan yang relaasnya BELUM ada - inilah pekerjaannya. Opsional. */
    belumAdaRelaas?: number | null;
    /** Hitungan per golongan dari bot. Opsional; layar menghitung sendiri juga. */
    golongan?: Record<string, number> | null;
  };
  jurusita: Jurusita[];
  catatan: string[];
};

/**
 * Nama yang dipakai bot untuk mengumpulkan baris yang juru sitanya tidak dapat
 * ditentukan. Dicocokkan sebagai teks, bukan sebagai bendera tersendiri - itu
 * yang dipatok kontrak jawabannya.
 */
const NAMA_TIDAK_TERCATAT = "tidak tercatat";

/** Hari ini menurut zona pengadilan (Asia/Makassar), bukan zona mesin pembaca. */
function hariIniPengadilan() {
  return waktuPengadilan().tanggal;
}

/**
 * Menggeser tanggal ISO sebanyak n hari lewat ANGKANYA, tanpa menyentuh zona.
 *
 * new Date("2026-04-29") dibaca sebagai tengah malam UTC, dan di zona sebelah
 * barat UTC hasil pergeserannya mundur sehari. Di sini tanggalnya hanya
 * kalender - tanpa jam, tanpa tempat - jadi Date.UTC yang dipakai.
 */
function geserHari(iso: string, selisih: number) {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!cocok) return iso;
  const waktu = new Date(
    Date.UTC(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]) + selisih)
  );
  const b = String(waktu.getUTCMonth() + 1).padStart(2, "0");
  const h = String(waktu.getUTCDate()).padStart(2, "0");
  return `${waktu.getUTCFullYear()}-${b}-${h}`;
}

/**
 * Cap waktu pemeriksaan - tanggal DAN jamnya dari zona pengadilan sekaligus.
 *
 * Tidak diimpor dari aleta-ecourt-arsip-berkas.tsx meskipun di sana ada
 * pembantu serupa: berkas itu salah satu layar e-Court terberat, dan
 * mengimpornya menyeret seluruhnya ke dalam muatan layar ini hanya untuk dua
 * baris pemformat.
 */
function capPemeriksaan(nilai: string) {
  if (!nilai) return "";
  const saat = new Date(nilai);
  if (Number.isNaN(saat.getTime())) return "";
  const { tanggal, jam } = waktuPengadilan(saat);
  return `${tanggalHariPendek(tanggal)} ${jam.slice(0, 5).replace(":", ".")}`;
}

function labelJenis(jenis: string) {
  if (jenis === "pemberitahuan") return "Pemberitahuan putusan";
  if (jenis === "panggilan") return "Panggilan sidang";
  return jenis ? `Jenis tidak dikenal: ${jenis}` : "Jenis tidak disebut";
}

/**
 * Arti sandi cara panggil - dari bot, yang membacanya dari komentar kolom SIPP.
 *
 * Sandi yang TIDAK ada di komentar kolom - 'N', terukur 14 baris - disebut
 * tidak dikenal, bukan dikarang artinya. Sandi 'S' berarti SURAT TERCATAT;
 * sampai batas ini ia salah dibaca sebagai "gagal", padahal dari 1.431 perkara
 * bersandi S ada 829 yang justru berhasil.
 */
function labelCara(sandi: string, label: string) {
  if (label) return sandi ? `${label} (${sandi})` : label;
  if (sandi) return `Sandi "${sandi}" tidak dikenal`;
  return "—";
}

/** Keadaan pos. Komentar kolom status_pos: "1. Berhasil 2.tidak berhasil". */
function labelPos(nilai: string) {
  if (nilai === "terkirim") return "Terkirim";
  if (nilai === "kembali") return "Kembali (retur)";
  if (nilai === "belum") return "Belum ada kabar";
  return nilai ? `Keadaan pos tidak dikenal: ${nilai}` : "Keadaan pos tidak terbaca";
}

function warnaPos(nilai: string) {
  if (nilai === "terkirim") return "success" as const;
  if (nilai === "kembali") return "danger" as const;
  if (nilai === "belum") return "muted" as const;
  return "warning" as const;
}

/** Dari mana nama juru sitanya diketahui - pertanyaan yang wajib punya jawaban. */
function labelSumber(sumber: string) {
  if (sumber === "panggilan") return "dari yang memanggil";
  if (sumber === "penunjukan") return "dari penunjukan aktif";
  if (sumber === NAMA_TIDAK_TERCATAT) return "tidak tercatat";
  return sumber ? `sumber tidak dikenal: ${sumber}` : "sumber tidak disebut";
}

/** Tanggal yang dibawa satu baris - sidangnya bila panggilan, putusannya bila pemberitahuan. */
function tanggalBaris(baris: Baris) {
  if (baris.jenis === "pemberitahuan") {
    return baris.tanggalPutusan ? `Putus ${tanggalHariPendek(baris.tanggalPutusan)}` : "";
  }
  return baris.tanggalSidang ? `Sidang ${tanggalHariPendek(baris.tanggalSidang)}` : "";
}

// ===========================================================================
// GOLONGAN PANGGILAN - LIMA YANG DIMINTA, DAN YANG KEENAM TETAP TERLIHAT
// ===========================================================================
//
// Diminta pengguna 25 September 2026: "di sipp dan abt deteksi apa saja
// panggilan untuk sidang pertama, sidang yang ditunda dan pemberitahuan
// putusan". Ikrar talak ikut sebab blangkonya memang ada tersendiri
// (perkara_jadwal_sidang.ikrar_talak = 'Y', terukur 1.024 dari 20.109 baris),
// dan sidang lanjutan ikut sebab sidang yang bukan pertama juga dipanggil.
//
// Golongan yang TIDAK ada di daftar ini tetap digambar dengan sandinya apa
// adanya. Menyaringnya keluar berarti barisnya hilang dari layar tanpa satu pun
// keterangan - dan yang hilang tanpa keterangan tidak pernah dicari.
const GOLONGAN_LABEL: Record<string, string> = {
  "sidang-pertama": "Sidang pertama",
  "sidang-ditunda": "Sidang ditunda",
  "pemberitahuan-putusan": "Pemberitahuan putusan",
  "ikrar-talak": "Ikrar talak",
  "sidang-lanjutan": "Sidang lanjutan",
};

/** Urutan penyaring - urutan perjalanan perkara, bukan abjad. */
const GOLONGAN_URUT = Object.keys(GOLONGAN_LABEL);

/**
 * Keadaan yang BENAR-BENAR punya blangko, dibaca dari katalognya sendiri.
 *
 * Ditulis sebagai turunan BLANGKO_RELAAS, bukan sebagai daftar kedua: daftar
 * kedua harus dijaga tetap cocok, dan begitu ia berselisih yang muncul di layar
 * adalah blangko yang tidak ada, atau blangko yang ada tetapi tidak terpakai.
 * Golongan dipetakan ke keadaannya lewat keadaanUntukGolongan() - di sanalah
 * keputusan "sidang-lanjutan memakai blangko sidang-ditunda" ditulis.
 */
const KEADAAN_BERBLANGKO = new Set<string>(BLANGKO_RELAAS.map((x) => x.keadaan));

function labelGolongan(sandi: string) {
  return GOLONGAN_LABEL[sandi] ?? (sandi ? `Golongan tidak dikenal: ${sandi}` : "");
}

/** Pihak yang dipanggil - kalimatnya, bukan sandinya. */
function labelPihakDipanggil(sandi: string) {
  if (sandi === "keduanya") return "Kedua pihak dipanggil";
  if (sandi === "pertama") return "Pihak Pertama dipanggil";
  if (sandi === "kedua") return "Pihak Kedua dipanggil";
  if (sandi === "tidak-perlu") {
    return "Semua pihak hadir - diperintahkan hadir di muka sidang, tidak dipanggil";
  }
  return "Pihak yang dipanggil belum diketahui";
}

export type NilaiBaris = {
  golongan: { sandi: string; label: string; disebut: boolean; dikenal: boolean };
  /**
   * disebut = ada jawabannya; pasti = jawabannya sudah SELESAI.
   *
   * Keduanya dipisah sebab "tidak-diketahui" punya dua arti yang sangat
   * berbeda. Pada sidang yang ditunda ia berarti bahaya - kehadirannya tidak
   * tercatat, dan menebaknya mencetak panggilan untuk orang yang salah. Pada
   * pemberitahuan putusan ia hanya berarti pihaknya ditentukan baris itu
   * sendiri, bukan oleh blangkonya. Menyamakan keduanya membuat peringatan
   * bahaya menyala pada ribuan baris yang tidak berbahaya - dan peringatan yang
   * selalu menyala berhenti dibaca.
   */
  pihak: { sandi: string; label: string; sebab: string; disebut: boolean; pasti: boolean };
  blangko: { ada: boolean; label: string; berkas: string; sebab: string };
  /** "sudah" dan "belum" adalah hasil ukur; "tidak-disebut" berarti belum diukur. */
  relaas: "sudah" | "belum" | "tidak-disebut";
  nomorSidang: { disebut: boolean; label: string };
};

/**
 * ============================================================================
 * SATU BARIS, DINILAI SEKALI - DIPAKAI LAYAR DAN LEMBAR CETAK
 * ============================================================================
 *
 * Seluruh keputusan tentang satu baris ada di sini, dan ketiadaan ruas dibedakan
 * dari ruas yang kosong:
 *
 *   ruas tidak ada       bot belum mengirimnya - BELUM TERUKUR
 *   ruas ada, kosong     bot mengukurnya dan tidak menemukan apa-apa
 *   ruas ada, berisi      terukur
 *
 * Pembedanya operator `in`, bukan nilai jatuhan. `baris.golongan || ""`
 * menyamakan ketiga keadaan itu menjadi satu, dan layar yang menyamakannya akan
 * berkata "tidak ada panggilan sidang pertama hari ini" ketika yang sebenarnya
 * terjadi bot belum mengirim ruasnya sama sekali.
 */
export function nilaiBaris(baris: Baris): NilaiBaris {
  // ---- Golongan ----------------------------------------------------------
  const adaRuasGolongan = "golongan" in baris;
  const sandiGolongan = String(baris.golongan ?? "").trim();
  const golongan = {
    sandi: sandiGolongan,
    label: adaRuasGolongan
      ? sandiGolongan
        ? labelGolongan(sandiGolongan)
        : "Bot tidak dapat menggolongkan baris ini"
      : "Golongan belum dikirim bot",
    disebut: adaRuasGolongan && sandiGolongan !== "",
    dikenal: sandiGolongan in GOLONGAN_LABEL,
  };

  // ---- Pihak yang dipanggil ----------------------------------------------
  //
  // ==========================================================================
  // KEHADIRAN SIDANG TIDAK SELALU YANG MENENTUKANNYA
  // ==========================================================================
  //
  // Urutan jawabannya EMPAT, dan seluruhnya dibaca dari pohon-blangko.ts - layar
  // ini tidak punya tabel sandinya sendiri, sebab dua tabel yang sedikit berbeda
  // adalah cara paling mudah memanggil orang yang salah.
  //
  //   1 ruas pihakDipanggil dari bot          jawaban yang sudah dihitung
  //   2 blangko keadaan itu berpihak "keduanya"
  //     Sidang pertama dan ikrar talak memanggil KEDUA pihak, dan sebabnya
  //     tertulis di BLANGKO_RELAAS: "belum ada yang pernah hadir, jadi tidak ada
  //     yang dapat dikecualikan". Kehadiran sidang tidak berlaku di sini - pada
  //     sidang pertama, kolom dihadiri_oleh justru mencatat kehadiran sidang
  //     yang panggilannya sedang dicetak, yaitu yang belum terjadi.
  //   3 pemberitahuan putusan
  //     BLANGKO_RELAAS mencatat pihaknya "ditentukan baris pemberitahuannya
  //     sendiri (kolom pihak dan pihak_id), bukan oleh blangkonya" - dan nama
  //     itu sudah tergambar pada baris di atas.
  //   4 sandi kehadiran, diterjemahkan pihakDipanggil()
  //     Inilah satu-satunya jalan yang benar-benar bergantung kehadiran, dan
  //     satu-satunya tempat peringatan 1.354 baris itu berlaku.
  //
  // Tanpa pembagian ini peringatan "kehadiran tidak tercatat" menyala pada
  // hampir SELURUH panggilan sidang pertama - dan peringatan yang selalu menyala
  // berhenti dibaca, termasuk pada 1.354 baris yang sungguh berbahaya.
  const adaRuasPihak = "pihakDipanggil" in baris;
  const adaRuasHadir = "dihadiriOleh" in baris;
  const sandiHadir = baris.dihadiriOleh;
  const hadirKosong =
    sandiHadir === null || sandiHadir === undefined || String(sandiHadir).trim() === "";

  // Golongan -> keadaan blangko lewat pohon-blangko.ts, bukan dicocokkan
  // sebagai teks: "sidang-lanjutan" adalah golongan bot yang keadaannya
  // "sidang-ditunda", dan pemetaan itu keputusan yang tinggal di sana.
  const keadaanGolongan = golongan.disebut ? keadaanUntukGolongan(golongan.sandi) : null;
  const entriGolongan = keadaanGolongan
    ? (BLANGKO_RELAAS.find((x) => x.keadaan === keadaanGolongan) ?? null)
    : null;
  const terjemahanSandi: PihakDipanggil = adaRuasHadir
    ? pihakDariSandi(hadirKosong ? "" : sandiHadir)
    : "tidak-diketahui";

  /**
   * Sebab pihaknya tidak diketahui - SELALU punya isi.
   *
   * Terukur pada jawaban bot yang sungguhan 25 September 2026: 14 dari 156 baris
   * empat tanggal datang dengan pihakDipanggil = "tidak-diketahui" LANGSUNG dari
   * bot. Pada rancangan sebelumnya cabang itu tidak menyisakan sebab apa pun,
   * sehingga layar menampilkan "belum diketahui" tanpa satu kalimat penjelas -
   * persis kekosongan yang membuat juru sita menebak. Karena itu sebabnya
   * dihitung sekali di sini dan dipakai kedua cabang.
   */
  function sebabTidakDiketahui() {
    if (!adaRuasHadir) {
      return (
        "Bot menyatakan pihaknya tidak dapat ditentukan, dan ruas kehadirannya (dihadiriOleh) " +
        "tidak ikut dikirim - jadi sebabnya belum dapat disebut. Tanyakan kepada juru sitanya."
      );
    }
    // Arti sandinya dibaca dari BORANG SIPP (jadwal_sidang_p_edit.php): 1
    // Semua Pihak, 2 Pihak Pertama saja, 3 Pihak Kedua saja, 4 Para Pihak
    // Tidak Hadir, dan sisanya kombinasi dengan intervensi/turut tergugat atau
    // "sebagian" pihak. Sandi yang sampai di cabang ini karena itu BUKAN sandi
    // tanpa arti - artinya ada, tetapi tidak dapat dipetakan ke satu blangko.
    return hadirKosong
      ? "Kehadiran sidang tidak tercatat di SIPP - kolom dihadiri_oleh kosong pada 1.354 dari " +
          "20.109 baris jadwal sidang. Menebaknya berarti mencetak panggilan untuk orang yang " +
          "salah, jadi yang benar menanyakannya kepada juru sitanya."
      : `Sandi kehadiran "${String(sandiHadir)}" pada borang SIPP berarti kombinasi dengan ` +
          "pihak intervensi atau turut tergugat, atau sebagian pihak saja - tidak dapat " +
          "dipetakan ke satu blangko tanpa melihat perkaranya. Tanyakan kepada juru sitanya.";
  }

  let sandiPihak = "";
  let labelPihak = "Pihak yang dipanggil belum dikirim bot";
  let sebabPihak =
    "Bot belum mengirim ruas kehadiran (dihadiriOleh) maupun pihakDipanggil - jadi ini " +
    "BELUM terukur, bukan berarti kehadirannya tidak tercatat.";
  let pihakDisebut = false;
  let pihakPasti = false;

  const sandiBot = adaRuasPihak ? String(baris.pihakDipanggil ?? "").trim() : "";
  // Jawaban bot "tidak-diketahui" TIDAK menimpa sandi yang artinya sudah
  // dijawab SIPP. Bot yang belum diperbarui menjawab sandi 1 (Semua Pihak)
  // dengan "tidak-diketahui"; penerjemah tunggalnya pohon-blangko.ts, dan
  // jawabannya yang dipakai - bukan salinan tabel sandi yang tertinggal.
  const botTertinggal = sandiBot === "tidak-diketahui" && terjemahanSandi !== "tidak-diketahui";

  if (sandiBot && !botTertinggal) {
    sandiPihak = sandiBot;
    labelPihak = labelPihakDipanggil(sandiPihak);
    pihakDisebut = true;
    pihakPasti = sandiPihak !== "tidak-diketahui";
    sebabPihak = pihakPasti ? "" : sebabTidakDiketahui();
  } else if (entriGolongan && entriGolongan.pihak === "keduanya") {
    sandiPihak = "keduanya";
    labelPihak = labelPihakDipanggil("keduanya");
    pihakDisebut = true;
    pihakPasti = true;
    // Keterangan blangkonya sendiri, bukan kalimat baru: ia yang memuat sebabnya.
    sebabPihak = "";
  } else if (golongan.sandi === "pemberitahuan-putusan") {
    sandiPihak = "tidak-diketahui";
    labelPihak = "Pihak pada baris pemberitahuan ini - namanya tertulis di atas";
    pihakDisebut = true;
    pihakPasti = true;
    sebabPihak = "";
  } else if (adaRuasHadir) {
    sandiPihak = terjemahanSandi;
    labelPihak = labelPihakDipanggil(sandiPihak);
    pihakDisebut = true;
    pihakPasti = sandiPihak !== "tidak-diketahui";
    sebabPihak = pihakPasti ? "" : sebabTidakDiketahui();
  }

  const pihak = {
    sandi: sandiPihak,
    label: labelPihak,
    sebab: sebabPihak,
    disebut: pihakDisebut,
    pasti: pihakPasti,
  };

  // ---- Blangko -----------------------------------------------------------
  //
  // GOLONGAN -> KEADAAN LEWAT keadaanUntukGolongan(), TIDAK DITEBAK DI LAYAR
  //
  // "sidang-lanjutan" adalah golongan yang sah dari bot, tetapi ia BUKAN salah
  // satu KeadaanRelaas. Menyamakannya dengan "sidang-ditunda" adalah KEPUTUSAN,
  // dan keputusan itu kini tertulis di pohon-blangko.ts (keadaanUntukGolongan)
  // - bagi juru sita keduanya satu pekerjaan, dan ABT hanya punya satu blangko
  // untuknya, yang judulnya pun "(Sidang Lanjutan)". Golongan yang tidak
  // dipetakan di sana tetap DIKATAKAN tidak berblangko beserta sebabnya.
  const blangko = (() => {
    if (!golongan.disebut) {
      return {
        ada: false,
        label: "",
        berkas: "",
        sebab: adaRuasGolongan
          ? "Bot tidak dapat menggolongkan baris ini, jadi blangkonya juga belum dapat ditentukan."
          : "Ruas golongan belum dikirim bot - blangkonya BELUM terukur, bukan tidak ada.",
      };
    }
    if (!keadaanGolongan) {
      return {
        ada: false,
        label: "",
        berkas: "",
        sebab:
          `Golongan "${golongan.sandi}" tidak punya keadaan blangko di pohon-blangko.ts ` +
          `(keadaan yang ada: ${[...KEADAAN_BERBLANGKO].join(", ")}). Pemetaannya keputusan, dan ` +
          "keputusan itu ditulis di pohon-blangko.ts - tidak ditebak di layar.",
      };
    }
    const pilih = blangkoRelaas(
      keadaanGolongan,
      (pihak.disebut ? pihak.sandi : "tidak-diketahui") as PihakDipanggil
    );
    if (!pilih) {
      return {
        ada: false,
        label: "",
        berkas: "",
        sebab:
          pihak.sandi === "tidak-perlu"
            ? "Semua pihak hadir pada sidang itu - tidak ada yang dipanggil maupun diberi tahu, jadi tidak ada blangko yang dicetak."
            : `Keadaan "${keadaanGolongan}" tidak punya blangko terdaftar di BLANGKO_RELAAS.`,
      };
    }
    const bergeser = keadaanGolongan === "sidang-ditunda" && pilih.keadaan === "sidang-pertama";
    return {
      ada: true,
      label: pilih.label,
      berkas: pilih.berkas,
      sebab: bergeser
        ? "Sidang yang ditunda dengan Pihak Pertama ikut dipanggil memakai blangko sidang " +
          "pertama - hanya blangko itu yang memuat dua pihak sekaligus."
        : pihak.pasti
          ? ""
          : "Blangko bawaan keadaan ini. Pihaknya belum diketahui, jadi periksa dahulu sebelum dicetak.",
    };
  })();

  // ---- Sudah atau belum ada relaasnya ------------------------------------
  const relaas: NilaiBaris["relaas"] =
    baris.sudahAdaRelaas === true ? "sudah" : baris.sudahAdaRelaas === false ? "belum" : "tidak-disebut";

  // ---- Nomor sidang ------------------------------------------------------
  //
  // 0 TIDAK digambar sebagai nomor sidang. Sidang bernomor mulai dari 1, jadi 0
  // hanya dapat berarti "tidak terhitung" - dan "Sidang ke-0" pada lembar cetak
  // akan dibaca sebagai fakta.
  const urut = Number(baris.urutanSidang);
  const nomorSidang =
    "urutanSidang" in baris && Number.isFinite(urut) && urut > 0
      ? { disebut: true, label: `Sidang ke-${urut}` }
      : { disebut: false, label: "" };

  return { golongan, pihak, blangko, relaas, nomorSidang };
}

/**
 * ============================================================================
 * SELISIH ANTARA RINGKASAN BOT DAN BARIS YANG DIKIRIMNYA
 * ============================================================================
 *
 * Kotak angka di layar ini dihitung dari BARIS yang digambar - harus begitu,
 * sebab kotak yang angkanya berasal dari sumber lain daripada tabel di bawahnya
 * akan menjanjikan 20 lalu menampilkan 25.
 *
 * Tetapi mengganti angka bot tanpa berkata apa pun berarti menutupi selisihnya.
 * Dan selisihnya NYATA: terukur 18 Agustus 2026 ringkasan bot menyebut 20 relaas
 * panggilan sedangkan baris panggilan yang dikirimnya 25; 10 Maret 2026 menyebut
 * 7 sedangkan barisnya 15; 2 Juni 2026 menyebut 6 sedangkan barisnya 17.
 * Sebabnya masuk akal - ringkasan menghitung relaas yang SUDAH ada, sedangkan
 * baris kini memuat panggilan yang relaasnya belum ada - tetapi yang masuk akal
 * tetap harus disebut, bukan ditebak sendiri oleh pembaca layar.
 *
 * Yang dibandingkan hanya angka atas hasil PENUH, bukan atas hasil yang sudah
 * disaring: penyaring memang dimaksudkan mengurangi, dan membandingkannya
 * dengan ringkasan bot akan berbunyi pada tiap ketukan chip.
 */
export function selisihRingkas(hasil: Hasil): string[] {
  const baris = hasil.jurusita.flatMap((js) => js.baris);
  const pesan: string[] = [];

  const panggilan = baris.filter((x) => x.jenis === "panggilan").length;
  if (hasil.ringkas.relaas !== panggilan) {
    pesan.push(
      `Ringkasan bot menyebut ${hasil.ringkas.relaas} relaas panggilan, sedangkan baris ` +
        `panggilan yang dikirimnya ${panggilan}. Kotak di atas menghitung baris yang digambar.`
    );
  }

  const pemberitahuan = baris.filter((x) => x.jenis === "pemberitahuan").length;
  if (hasil.ringkas.pemberitahuan !== pemberitahuan) {
    pesan.push(
      `Ringkasan bot menyebut ${hasil.ringkas.pemberitahuan} pemberitahuan putusan, sedangkan ` +
        `baris pemberitahuan yang dikirimnya ${pemberitahuan}.`
    );
  }

  const perkara = new Set(baris.map((x) => x.perkaraId)).size;
  if (hasil.ringkas.perkara !== perkara) {
    pesan.push(
      `Ringkasan bot menyebut ${hasil.ringkas.perkara} perkara, sedangkan perkara yang berbeda ` +
        `pada barisnya ${perkara}.`
    );
  }

  const adaRuasRelaas = baris.some((x) => "sudahAdaRelaas" in x);
  const belum = baris.filter((x) => x.sudahAdaRelaas === false).length;
  if (
    adaRuasRelaas &&
    typeof hasil.ringkas.belumAdaRelaas === "number" &&
    hasil.ringkas.belumAdaRelaas !== belum
  ) {
    pesan.push(
      `Ringkasan bot menyebut ${hasil.ringkas.belumAdaRelaas} relaas yang belum ada, sedangkan ` +
        `baris bertanda belum ${belum}.`
    );
  }

  return pesan;
}

/** Hitungan per golongan atas baris yang BENAR-BENAR ada - bukan dari ringkasan bot. */
export function hitungGolongan(jurusita: Jurusita[]) {
  const hitung = new Map<string, number>();
  let tanpaGolongan = 0;
  for (const js of jurusita) {
    for (const baris of js.baris) {
      const nilai = nilaiBaris(baris);
      if (!nilai.golongan.disebut) {
        tanpaGolongan += 1;
        continue;
      }
      hitung.set(nilai.golongan.sandi, (hitung.get(nilai.golongan.sandi) ?? 0) + 1);
    }
  }
  return { hitung, tanpaGolongan };
}

/**
 * Menyaring hasil menurut golongan dan menurut "baru yang belum ada relaasnya".
 *
 * Juru sita yang barisnya habis tersaring DIBUANG dari daftar, bukan digambar
 * sebagai kepala tanpa isi - kepala kosong terbaca sebagai juru sita yang tidak
 * punya pekerjaan, dan itu keterangan yang berbeda. Angka relaas serta
 * pemberitahuan tiap juru sita ikut dihitung ulang dari baris yang tersisa;
 * membiarkan angka lamanya berarti kepala menyebut 12 di atas 3 baris.
 */
export function saringHasil(
  hasil: Hasil,
  pilihan: { matikan: Set<string>; hanyaBelum: boolean }
): Hasil {
  const lolos = (baris: Baris) => {
    const nilai = nilaiBaris(baris);
    // Baris yang golongannya belum diketahui memakai kunci "" pada penyaring,
    // sehingga ia pun dapat dimatikan - tetapi hanya dengan sengaja.
    if (pilihan.matikan.has(nilai.golongan.disebut ? nilai.golongan.sandi : "")) return false;
    if (pilihan.hanyaBelum && nilai.relaas !== "belum") return false;
    return true;
  };

  const jurusita = hasil.jurusita
    .map((js) => {
      const baris = js.baris.filter(lolos);
      return {
        ...js,
        baris,
        relaas: baris.filter((x) => x.jenis === "panggilan").length,
        pemberitahuan: baris.filter((x) => x.jenis === "pemberitahuan").length,
      };
    })
    .filter((js) => js.baris.length > 0);

  const perkara = new Set<number>();
  let relaas = 0;
  let pemberitahuan = 0;
  let belum = 0;
  let adaRuasRelaas = false;
  for (const js of jurusita) {
    for (const baris of js.baris) {
      perkara.add(baris.perkaraId);
      if (baris.jenis === "pemberitahuan") pemberitahuan += 1;
      else relaas += 1;
      if ("sudahAdaRelaas" in baris) adaRuasRelaas = true;
      if (baris.sudahAdaRelaas === false) belum += 1;
    }
  }

  return {
    ...hasil,
    ringkas: {
      ...hasil.ringkas,
      relaas,
      pemberitahuan,
      perkara: perkara.size,
      jurusita: jurusita.length,
      tanpaJurusita: jurusita
        .filter((js) => !js.nama || js.nama === NAMA_TIDAK_TERCATAT)
        .reduce((jumlah, js) => jumlah + js.baris.length, 0),
      berselisih: jurusita.reduce(
        (jumlah, js) => jumlah + js.baris.filter((x) => x.berselisih).length,
        0
      ),
      // null, bukan 0, ketika ruasnya belum ada sama sekali - 0 yang tidak
      // diukur tidak dapat dibedakan dari 0 yang diukur.
      belumAdaRelaas: adaRuasRelaas ? belum : null,
    },
    jurusita,
  };
}

/**
 * Satu angka ringkasan.
 *
 * nilai boleh null, dan null digambar sebagai "—" beserta keterangannya. Itulah
 * bedanya "belum diukur" dari "terukur nol", dan bedanya tidak boleh hilang
 * hanya karena keduanya tampak sama enaknya sebagai angka 0.
 */
function Angka({
  nilai,
  label,
  nyala = false,
  sebab = "",
}: {
  nilai: number | null;
  label: string;
  nyala?: boolean;
  sebab?: string;
}) {
  return (
    <div
      className={
        nyala && nilai !== null && nilai > 0
          ? "rounded-lg border border-amber-300/70 bg-amber-100 p-3 dark:border-amber-700/50 dark:bg-amber-950/60"
          : "rounded-lg border border-border bg-card p-3"
      }
    >
      <p className="text-xl font-semibold tabular-nums">{nilai === null ? "—" : nilai}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      {nilai === null && sebab ? <p className="mt-0.5 text-xs">{sebab}</p> : null}
    </div>
  );
}

/**
 * Satu saklar golongan.
 *
 * Nyala-matinya dibawa aria-pressed, bukan hanya warna: pembaca layar dan
 * penguji keduanya membaca keadaan itu, dan warna saja tidak terbaca oleh
 * siapa pun yang tidak melihatnya.
 */
function TombolGolongan({
  label,
  jumlah,
  nyala,
  onKetuk,
}: {
  label: string;
  jumlah: number;
  nyala: boolean;
  onKetuk: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={nyala}
      onClick={onKetuk}
      className={
        nyala
          ? "rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
          : "rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground line-through"
      }
    >
      {label} <span className="tabular-nums">({jumlah})</span>
    </button>
  );
}

/**
 * @param tertanam benar bila rekap ini ditanam di dalam dialog Cetak relaas.
 *   Tanggalnya lalu DIKENDALIKAN dialog lewat `tanggal`, dan pemilih tanggal
 *   sendiri disembunyikan - dua pemilih tanggal dalam satu dialog akan
 *   berselisih, dan rekap yang tanggalnya berbeda dari daftar di atasnya
 *   terbaca sebagai rekap daftar itu.
 * @param tanggal YYYY-MM-DD dari dialog; hanya dipakai bila tertanam.
 */
export function AletaEcourtRelaasMassal({
  tertanam = false,
  tanggal: tanggalLuar = "",
}: { tertanam?: boolean; tanggal?: string } = {}) {
  const { institutionIdentity } = usePortal();
  const [tanggalSendiri, setTanggal] = useState(hariIniPengadilan);
  const tanggal = tertanam && tanggalLuar ? tanggalLuar : tanggalSendiri;
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [kabar, setKabar] = useState("");
  const [mencetak, setMencetak] = useState(false);
  /**
   * Golongan yang DIMATIKAN, bukan yang dinyalakan.
   *
   * Bawaannya SEMUA menyala, seperti yang diminta. Menyimpan yang menyala
   * berarti golongan baru yang kelak dikirim bot lahir dalam keadaan mati -
   * barisnya hilang dari layar tanpa satu pun keterangan, dan yang hilang tanpa
   * keterangan tidak pernah dicari.
   */
  const [matikan, setMatikan] = useState<Set<string>>(() => new Set<string>());
  /**
   * Bawaannya MATI - layar ini dua pekerjaan sekaligus.
   *
   * Pengguna menyebut keduanya: "mengambil semua perkara yang cetak relaas ...
   * pada hari itu" (rekap, butuh yang sudah ada) dan "deteksi apa saja panggilan
   * untuk ..." (pekerjaan, butuh yang belum ada). Menyalakannya bawaannya akan
   * memotong rekapnya.
   */
  const [hanyaBelum, setHanyaBelum] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setKabar("");
    try {
      const r = await fetch(
        apiPath(`/api/aleta-ecourt/relaas-massal?tanggal=${encodeURIComponent(tanggal)}`),
        { cache: "no-store" }
      );
      const j = (await r.json()) as { data?: Hasil };
      if (!r.ok) {
        // Kegagalan TIDAK diubah menjadi daftar kosong. Yang lama tetap
        // dibersihkan supaya angka tanggal sebelumnya tidak terbaca sebagai
        // angka tanggal ini.
        setHasil(null);
        setKabar(pesanGalatPortal(j, `HTTP ${r.status}`));
        return;
      }
      setHasil(j.data ?? null);
      if (!j.data) setKabar("Bot menjawab tanpa data. Tidak ada yang dapat digambar.");
    } catch (galat) {
      setHasil(null);
      setKabar(
        galat instanceof Error
          ? `ALETA Bot belum dapat dihubungi: ${galat.message}`
          : "ALETA Bot belum dapat dihubungi."
      );
    } finally {
      setMemuat(false);
    }
  }, [tanggal]);

  // Ditunda satu putaran, bukan dipanggil langsung: setState serentak di dalam
  // efek memicu penggambaran berantai yang ditolak aturan lint repositori ini.
  // Pola yang sama dipakai panel sebaran juru sita dan arsip berkas.
  useEffect(() => {
    const jam = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(jam);
  }, [muat]);

  const kosong = Boolean(
    hasil && hasil.ringkas.relaas === 0 && hasil.ringkas.pemberitahuan === 0
  );

  // Hitungan golongan dari BARIS yang benar-benar datang, bukan dari ringkasan
  // bot: penyaring yang angkanya berasal dari sumber lain daripada tabel yang
  // disaringnya akan menjanjikan 12 baris lalu menampilkan 3.
  const golonganAda = useMemo(
    () => (hasil ? hitungGolongan(hasil.jurusita) : { hitung: new Map<string, number>(), tanpaGolongan: 0 }),
    [hasil]
  );

  // Penyaring hanya dapat dipakai bila ruas golongannya memang sudah dikirim
  // bot. Lima kotak yang seluruhnya berbunyi 0 akan terbaca sebagai "hari ini
  // tidak ada panggilan jenis apa pun" - keterangan yang sama sekali berbeda
  // dari "ruasnya belum ada".
  const golonganDapatDisaring = golonganAda.hitung.size > 0;

  const hasilTampil = useMemo(
    () => (hasil ? saringHasil(hasil, { matikan, hanyaBelum }) : null),
    [hasil, matikan, hanyaBelum]
  );

  // Dibandingkan atas hasil PENUH - penyaring memang dimaksudkan mengurangi.
  const selisih = useMemo(() => (hasil ? selisihRingkas(hasil) : []), [hasil]);

  const tersaringHabis = Boolean(hasil && !kosong && hasilTampil && hasilTampil.jurusita.length === 0);
  const adaIsi = Boolean(hasilTampil && !kosong && hasilTampil.jurusita.length > 0);

  /** Kalimat penyaring yang sedang berlaku - ikut tercetak di lembarnya. */
  const kalimatSaring = [
    matikan.size > 0
      ? `golongan dimatikan: ${[...matikan].map((s) => (s ? labelGolongan(s) : "belum digolongkan")).join(", ")}`
      : "",
    hanyaBelum ? "hanya yang relaasnya belum ada" : "",
  ]
    .filter(Boolean)
    .join("; ");

  const alihGolongan = (sandi: string) => {
    setMatikan((lama) => {
      const baru = new Set(lama);
      if (baru.has(sandi)) baru.delete(sandi);
      else baru.add(sandi);
      return baru;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {tertanam
            ? "Rekap relaas dan pemberitahuan yang tercatat di SIPP"
            : "Cetak massal relaas panggilan dan pemberitahuan putusan"}
        </CardTitle>
        <CardDescription>
          {tertanam
            ? "Relaas panggilan dan pemberitahuan putusan yang SUDAH tercatat di SIPP pada tanggal dialog ini, dikelompokkan per juru sita."
            : "Seluruh relaas panggilan sidang dan pemberitahuan putusan pada satu tanggal, dikelompokkan per juru sita. Bawaannya hari ini menurut jam pengadilan (WITA)."}
          {hasil?.diperiksaPada ? ` Dibaca ${capPemeriksaan(hasil.diperiksaPada)}.` : ""}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ---- Pemilih tanggal ---------------------------------------- */}
        <div className="flex flex-wrap items-end gap-2">
          {tertanam ? null : (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Tanggal
                <Input
                  type="date"
                  value={tanggal}
                  className="w-[11rem]"
                  onChange={(e) => setTanggal(e.target.value)}
                  aria-label="Tanggal relaas dan pemberitahuan"
                />
              </label>
              <Button size="sm" variant="outline" onClick={() => setTanggal(geserHari(tanggal, -1))}>
                Sehari sebelum
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTanggal(geserHari(tanggal, 1))}>
                Sehari sesudah
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTanggal(hariIniPengadilan())}>
                Hari ini
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => void muat()} disabled={memuat}>
            {memuat ? "Membaca…" : "Muat ulang"}
          </Button>
          {/* Tombol cetak hanya menyala bila memang ada yang dapat dicetak -
              lembar kosong yang keluar dari mesin cetak membuang kertas dan
              membuat orang menyangka datanya hilang. */}
          <Button size="sm" onClick={() => setMencetak(true)} disabled={!adaIsi}>
            Cetak lembar
          </Button>
        </div>

        <p className="text-sm">
          {tanggalHariPanjang(tanggal, "Tanggal belum dipilih.")}
        </p>

        {/* ---- Keadaan ------------------------------------------------ */}
        {memuat ? (
          <p className="text-sm text-muted-foreground">Membaca dari SIPP…</p>
        ) : kabar ? (
          <div className="space-y-2 rounded-lg border border-amber-300/70 bg-amber-100 p-3 dark:border-amber-700/50 dark:bg-amber-950/60">
            <p className="text-sm font-medium">Daftarnya tidak terbaca.</p>
            {/* Sebab dari bot apa adanya - termasuk "halaman 404" ketika
                rutenya belum terpasang. Itu yang membedakan "belum ada rute"
                dari "bot mati", dan keduanya butuh tindakan yang berbeda. */}
            <p className="text-sm">{kabar}</p>
            <Button size="sm" variant="outline" onClick={() => void muat()}>
              Coba lagi
            </Button>
          </div>
        ) : kosong ? (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            Tidak ada relaas maupun pemberitahuan pada tanggal ini.
            {/* Disebut supaya tidak dibaca sebagai kerusakan: dari 365 hari
                hanya sebagian yang berisi, dan hari tersibuk 2026 pun baru 58
                relaas. */}
            <span className="text-muted-foreground">
              {" "}
              Itu keadaan yang lazim - juru sita tidak berelaas setiap hari.
            </span>
          </p>
        ) : hasilTampil ? (
          <>
            {/* ---- Penyaring golongan ---------------------------------- */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Golongan panggilan — dapat dinyalakan bersama, bawaannya semua
              </p>

              {golonganDapatDisaring ? (
                <div className="flex flex-wrap items-center gap-2">
                  {GOLONGAN_URUT.map((sandi) => (
                    <TombolGolongan
                      key={sandi}
                      label={GOLONGAN_LABEL[sandi]}
                      jumlah={golonganAda.hitung.get(sandi) ?? 0}
                      nyala={!matikan.has(sandi)}
                      onKetuk={() => alihGolongan(sandi)}
                    />
                  ))}
                  {/* Golongan yang dikirim bot tetapi belum punya nama di layar
                      ini tetap muncul dengan sandinya - bukan disaring keluar.
                      Baris yang hilang tanpa keterangan tidak pernah dicari. */}
                  {[...golonganAda.hitung.keys()]
                    .filter((sandi) => !(sandi in GOLONGAN_LABEL))
                    .map((sandi) => (
                      <TombolGolongan
                        key={sandi}
                        label={`Golongan tidak dikenal: ${sandi}`}
                        jumlah={golonganAda.hitung.get(sandi) ?? 0}
                        nyala={!matikan.has(sandi)}
                        onKetuk={() => alihGolongan(sandi)}
                      />
                    ))}
                  {golonganAda.tanpaGolongan > 0 ? (
                    <TombolGolongan
                      label="Belum digolongkan"
                      jumlah={golonganAda.tanpaGolongan}
                      nyala={!matikan.has("")}
                      onKetuk={() => alihGolongan("")}
                    />
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => setMatikan(new Set())}>
                    Semua golongan
                  </Button>
                </div>
              ) : (
                /* Nol yang TIDAK diukur tidak digambar sebagai nol. Lima kotak
                   berbunyi 0 akan terbaca "hari ini tidak ada panggilan jenis
                   apa pun", padahal yang terjadi ruasnya belum dikirim bot. */
                <p className="rounded border border-amber-300/70 bg-amber-100 px-2 py-1 text-sm dark:border-amber-700/50 dark:bg-amber-950/60">
                  Bot belum mengirim ruas <span className="font-mono text-xs">golongan</span> pada
                  baris tanggal ini, jadi penyaring golongan belum dapat dipakai. Ini{" "}
                  <span className="font-semibold">belum terukur</span> — bukan berarti tidak ada
                  panggilan sidang pertama, sidang ditunda, maupun pemberitahuan putusan hari ini.
                </p>
              )}

              <label className="flex w-fit items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={hanyaBelum}
                  onChange={(e) => setHanyaBelum(e.target.checked)}
                />
                Hanya yang relaasnya <span className="font-semibold">belum ada</span> — itulah
                pekerjaannya
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Angka nilai={hasilTampil.ringkas.relaas} label="relaas panggilan" />
              <Angka nilai={hasilTampil.ringkas.pemberitahuan} label="pemberitahuan putusan" />
              <Angka nilai={hasilTampil.ringkas.perkara} label="perkara tersentuh" />
              {/* Angka pekerjaan yang sesungguhnya - dan null bila ruasnya belum
                  dikirim bot, sebab 0 di sini akan terbaca "tidak ada pekerjaan". */}
              <Angka
                nilai={hasilTampil.ringkas.belumAdaRelaas ?? null}
                label="relaas BELUM ada"
                nyala
                sebab="ruas sudahAdaRelaas belum dikirim bot"
              />
              {/* Kedua angka terakhir menyala kuning bila tidak nol: keduanya
                  ketidaklengkapan, dan ketidaklengkapan yang tidak terlihat
                  akan terbaca sebagai kelengkapan. */}
              <Angka nilai={hasilTampil.ringkas.tanpaJurusita} label="tanpa juru sita" nyala />
              <Angka nilai={hasilTampil.ringkas.berselisih} label="penunjukan berselisih" nyala />
            </div>

            {/* Selisih antara ringkasan bot dan baris yang dikirimnya - disebut,
                bukan ditutup dengan mengganti angkanya diam-diam. */}
            {selisih.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-amber-300/70 bg-amber-100 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/60">
                {selisih.map((teks) => (
                  <li key={teks.slice(0, 40)}>{teks}</li>
                ))}
              </ul>
            ) : null}

            {/* Catatan dari bot - apa adanya, tidak diringkas dan tidak
                disembunyikan. Di sinilah tertulis apa yang dipotong atau tidak
                terbaca. */}
            {hasilTampil.catatan.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                {hasilTampil.catatan.map((teks, i) => (
                  <li key={`${i}-${teks.slice(0, 24)}`}>{teks}</li>
                ))}
              </ul>
            ) : null}

            {/* Tersaring habis BUKAN hari kosong. Yang satu berarti tidak ada
                pekerjaan, yang lain berarti penyaringnya sendiri yang menutupi -
                dan keduanya menuntut tindakan yang berbeda. */}
            {tersaringHabis ? (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                Tanggal ini berisi {hasil ? hasil.ringkas.relaas + hasil.ringkas.pemberitahuan : 0}{" "}
                baris, tetapi tidak satu pun lolos penyaring yang sedang berlaku
                {kalimatSaring ? ` (${kalimatSaring})` : ""}. Nyalakan kembali golongannya untuk
                melihatnya.
              </p>
            ) : null}

            <div className="space-y-4">
              {hasilTampil.jurusita.map((js) => (
                <BagianJurusita key={js.nama || `tanpa-${js.relaas}-${js.pemberitahuan}`} js={js} />
              ))}
            </div>
          </>
        ) : null}
      </CardContent>

      {/* Yang dicetak adalah yang TERLIHAT, beserta kalimat penyaringnya di
          kepala lembar. Mencetak seluruh baris sementara layar menampilkan
          sebagiannya membuat kertas dan layar bercerita berbeda. */}
      {mencetak && hasilTampil ? (
        <LembarCetak
          hasil={hasilTampil}
          saring={kalimatSaring}
          namaPengadilan={institutionIdentity.courtName || "PENGADILAN AGAMA"}
          onSelesai={() => setMencetak(false)}
        />
      ) : null}
    </Card>
  );
}

/** Satu juru sita beserta seluruh barisnya. */
function BagianJurusita({ js }: { js: Jurusita }) {
  const tidakTercatat = js.nama === NAMA_TIDAK_TERCATAT || !js.nama;

  return (
    <div
      className={
        tidakTercatat
          ? "rounded-lg border border-amber-300/70 bg-amber-100/60 dark:border-amber-700/50 dark:bg-amber-950/40"
          : "rounded-lg border border-border bg-card"
      }
    >
      <div className="flex flex-wrap items-baseline gap-2 border-b border-border/70 px-3 py-2">
        <p className="text-sm font-semibold">{js.nama || NAMA_TIDAK_TERCATAT}</p>
        {js.nip ? (
          <span className="font-mono text-xs text-muted-foreground">NIP {js.nip}</span>
        ) : (
          <span className="text-xs text-muted-foreground">NIP tidak tercatat</span>
        )}
        <span className="text-xs text-muted-foreground">
          {js.relaas} relaas · {js.pemberitahuan} pemberitahuan
        </span>
        {tidakTercatat ? (
          <span className="text-xs">
            Juru sitanya tidak dapat ditentukan - barisnya dikumpulkan di sini, bukan dibuang.
          </span>
        ) : null}
      </div>

      <div className="divide-y divide-border/70">
        {js.baris.map((baris) => (
          <BarisPekerjaan key={`${baris.jenis}-${baris.perkaraId}-${baris.pihak}-${baris.resi}`} baris={baris} />
        ))}
      </div>
    </div>
  );
}

/**
 * Satu baris pekerjaan.
 *
 * Diekspor supaya penjaga uji dapat MENGGAMBARNYA, bukan menyisir teks
 * sumbernya. Penyisir teks di repositori ini sudah tiga kali hijau atas kode
 * yang melempar galat - yang membuktikan sebuah kolom sungguh muncul hanyalah
 * keluaran penggambarannya.
 */
export function BarisPekerjaan({ baris }: { baris: Baris }) {
  const nilai = nilaiBaris(baris);

  return (
    <div
      className={
        // Yang BELUM ada relaasnya menonjol dengan pita kiri - itulah
        // pekerjaannya. Yang sudah ada tinggal dicetak ulang, jadi ia justru
        // tidak boleh menarik perhatian.
        nilai.relaas === "belum"
          ? "space-y-1 border-l-4 border-l-amber-500 bg-amber-50/60 px-3 py-2 text-sm dark:bg-amber-950/30"
          : "space-y-1 px-3 py-2 text-sm"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={baris.jenis === "pemberitahuan" ? "netral" : "info"}>
          {labelJenis(baris.jenis)}
        </Badge>
        {/* Golongan panggilan - dan nomor sidangnya, bila bot menyebutnya. */}
        {nilai.golongan.disebut ? (
          <Badge variant={nilai.golongan.dikenal ? "outline" : "warning"}>
            {nilai.golongan.label}
          </Badge>
        ) : (
          <Badge variant="muted">{nilai.golongan.label}</Badge>
        )}
        {nilai.nomorSidang.disebut ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {nilai.nomorSidang.label}
          </span>
        ) : null}
        <span className="font-semibold">{baris.nomorPerkara || "nomor tidak terbaca"}</span>
        {baris.jenisPerkara ? (
          <span className="text-xs text-muted-foreground">{baris.jenisPerkara}</span>
        ) : null}
        {/* Sudah atau belum ada relaasnya - TIGA keadaan, bukan dua. */}
        {nilai.relaas === "sudah" ? (
          <Badge variant="muted">Relaas sudah ada</Badge>
        ) : nilai.relaas === "belum" ? (
          <Badge variant="warning">BELUM ada relaas</Badge>
        ) : (
          <Badge variant="muted">Sudah/belum relaas tidak disebut bot</Badge>
        )}
        <Badge variant={warnaPos(baris.statusPos)}>{labelPos(baris.statusPos)}</Badge>
        {baris.adaBerkas ? (
          <Badge variant="outline">Ada berkas</Badge>
        ) : (
          <Badge variant="muted">Berkas belum diunggah</Badge>
        )}
      </div>

      <p>
        {baris.sebutanPihak ? `${baris.sebutanPihak}: ` : ""}
        {baris.pihak || "pihak tidak terbaca"}
        {tanggalBaris(baris) ? <span className="text-muted-foreground"> · {tanggalBaris(baris)}</span> : null}
        {baris.agenda ? <span className="text-muted-foreground"> · {baris.agenda}</span> : null}
      </p>

      {/* ---- Blangko dan pihak yang dipanggil --------------------------
          Kolom yang KOSONG tidak dipakai untuk menyatakan "tidak dapat
          ditentukan": kolom kosong terbaca sebagai layar yang belum selesai,
          dan tidak seorang pun bertanya kepadanya. */}
      <p className="text-xs">
        <span className="text-muted-foreground">Blangko: </span>
        {nilai.blangko.ada ? (
          <>
            <span className="font-medium">{nilai.blangko.label}</span>
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              {nilai.blangko.berkas}
            </span>
          </>
        ) : (
          <span className="font-medium text-amber-700 dark:text-amber-400">
            belum dapat ditentukan
          </span>
        )}
      </p>
      {nilai.blangko.sebab ? (
        <p className="text-xs text-muted-foreground">{nilai.blangko.sebab}</p>
      ) : null}

      <p className="text-xs">
        <span className="text-muted-foreground">Dipanggil: </span>
        <span
          className={
            // Warna peringatan HANYA ketika jawabannya belum selesai. Pada
            // pemberitahuan putusan dan sidang pertama jawabannya sudah selesai
            // walau sandinya "tidak-diketahui" - lihat NilaiBaris.pihak.pasti.
            nilai.pihak.pasti ? "font-medium" : "font-medium text-amber-700 dark:text-amber-400"
          }
        >
          {nilai.pihak.label}
        </span>
      </p>
      {/* SEBABNYA disebut ketika pihaknya tidak diketahui. Tanpa sebab, juru
          sita hanya melihat "belum diketahui" lalu menebak - dan tebakannya
          mencetak panggilan untuk orang yang salah. */}
      {nilai.pihak.sebab ? (
        <p className="rounded border border-amber-300/70 bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/60 dark:text-amber-300">
          {nilai.pihak.sebab}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Cara: {labelCara(baris.caraSandi, baris.caraLabel)}
        {baris.resi ? ` · Resi ${baris.resi}` : " · tanpa nomor resi"}
        {" · Juru sita "}
        {labelSumber(baris.sumberJurusita)}
      </p>

      {/* Berselisih: KEDUA nama disebut. Memilih salah satunya berarti
          menugaskan orang yang barangkali tidak ada - di antara yang berselisih
          ada penunjukan bernama "jsp5" dan pemanggil bernama "Super
          Administrator". */}
      {baris.berselisih ? (
        <p className="rounded border border-rose-300/70 bg-rose-100 px-2 py-1 text-xs text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/60 dark:text-rose-300">
          Penunjukan berselisih dengan yang memanggil - penunjukan aktif atas nama
          yang tertulis di atas, sedangkan yang memanggil perkara ini{" "}
          <span className="font-semibold">{baris.namaPanggilan || "tidak terbaca"}</span>. Periksa
          dahulu sebelum dicetak.
        </p>
      ) : null}
    </div>
  );
}

/**
 * ============================================================================
 * LEMBAR CETAK - ATURANNYA MEMBUNYIKAN SISANYA, BUKAN SEBALIKNYA
 * ============================================================================
 *
 * Saat mencetak, seluruh anak langsung body disembunyikan kecuali lembar ini -
 * sehingga tombol, sidebar, dan bilah pencarian tidak pernah tercetak. Pola
 * yang sama dipakai aleta-ecourt-cetak-jadwal.tsx. Menyembunyikan satu per satu
 * bagian aplikasi akan gagal begitu ada bagian baru ditambahkan.
 *
 * Satu hari paling banyak sekitar 60-70 baris, jadi penomoran halaman tidak
 * diperlukan; yang diperlukan tabel yang rapi di kertas.
 */
const GAYA_CETAK = `
@media print {
  body > *:not(#aleta-cetak-relaas-massal) { display: none !important; }
  #aleta-cetak-relaas-massal { display: block !important; }
  @page { size: A4 landscape; margin: 12mm; }
  #aleta-cetak-relaas-massal tr { break-inside: avoid; }
}
#aleta-cetak-relaas-massal { display: none; }
`;

function sel(tambahan: React.CSSProperties = {}): React.CSSProperties {
  return { border: "1px solid #000", padding: "4px 5px", verticalAlign: "top", ...tambahan };
}

function LembarCetak({
  hasil,
  saring,
  namaPengadilan,
  onSelesai,
}: {
  hasil: Hasil;
  /** Kalimat penyaring yang berlaku - tercetak supaya kertas tidak mengaku lengkap. */
  saring: string;
  namaPengadilan: string;
  onSelesai: () => void;
}) {
  useEffect(() => {
    // Cetak dipanggil sesudah lembarnya benar-benar tergambar. Memanggilnya
    // pada putaran yang sama menghasilkan halaman kosong pada sebagian
    // peramban - isinya belum sempat masuk ke pohon tampilan.
    const jam = window.setTimeout(() => {
      window.print();
      onSelesai();
    }, 120);
    return () => window.clearTimeout(jam);
  }, [onSelesai]);

  if (typeof document === "undefined") return null;

  const isi = (
    <div id="aleta-cetak-relaas-massal" style={{ color: "#000", background: "#fff" }}>
      <style>{GAYA_CETAK}</style>

      <div style={{ fontFamily: "serif", padding: "0 0 10px" }}>
        <h1 style={{ margin: 0, fontSize: "16pt", textAlign: "center" }}>
          DAFTAR RELAAS PANGGILAN DAN PEMBERITAHUAN PUTUSAN
        </h1>
        <h2 style={{ margin: "2px 0 0", fontSize: "13pt", textAlign: "center", fontWeight: 600 }}>
          {namaPengadilan}
        </h2>
        {/* Bulan berhuruf beserta nama harinya - bentuk naskah pengadilan,
            dan nama harinya membuat tanggal yang salah ketik langsung
            kelihatan. */}
        <p style={{ margin: "6px 0 0", fontSize: "10pt", textAlign: "center" }}>
          {tanggalPanjangDenganHari(hasil.tanggal, "tanggal tidak terbaca")}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: "9pt", textAlign: "center" }}>
          {hasil.ringkas.relaas} relaas panggilan · {hasil.ringkas.pemberitahuan} pemberitahuan
          putusan · {hasil.ringkas.perkara} perkara · {hasil.ringkas.jurusita} juru sita
          {hasil.ringkas.tanpaJurusita > 0
            ? ` · ${hasil.ringkas.tanpaJurusita} baris tanpa juru sita`
            : ""}
          {hasil.ringkas.berselisih > 0
            ? ` · ${hasil.ringkas.berselisih} penunjukan berselisih`
            : ""}
          {typeof hasil.ringkas.belumAdaRelaas === "number"
            ? ` · ${hasil.ringkas.belumAdaRelaas} relaas belum ada`
            : ""}
        </p>
        {/* Lembar yang disaring HARUS mengaku disaring. Tanpa baris ini, kertas
            yang memuat sebagian baris terbaca sebagai daftar lengkap hari itu,
            dan yang tidak tercetak tidak pernah dikerjakan. */}
        {saring ? (
          <p style={{ margin: "3px 0 0", fontSize: "9pt", textAlign: "center", fontWeight: 700 }}>
            DISARING — {saring}. Daftar ini BUKAN seluruh baris tanggal tersebut.
          </p>
        ) : null}
        {typeof hasil.ringkas.belumAdaRelaas !== "number" ? (
          <p style={{ margin: "2px 0 0", fontSize: "8.5pt", textAlign: "center", fontStyle: "italic" }}>
            Sudah/belum adanya relaas tidak disebut sumber data, jadi kolom Blangko di bawah
            menyebut blangko yang akan dipakai - bukan bahwa relaasnya belum dibuat.
          </p>
        ) : null}
        {/* Catatan bot ikut tercetak. Lembar yang dipegang di lapangan harus
            membawa keterangan apa yang tidak terbaca - bukan meninggalkannya
            di layar yang sudah ditutup. */}
        {hasil.catatan.map((teks, i) => (
          <p
            key={`${i}-${teks.slice(0, 24)}`}
            style={{ margin: "2px 0 0", fontSize: "8.5pt", textAlign: "center", fontStyle: "italic" }}
          >
            {teks}
          </p>
        ))}
      </div>

      {hasil.jurusita.map((js) => (
        <div key={js.nama || `tanpa-${js.relaas}`} style={{ marginBottom: "12px" }}>
          <p
            style={{
              margin: "0 0 3px",
              fontSize: "10.5pt",
              fontFamily: "sans-serif",
              fontWeight: 700,
            }}
          >
            {js.nama || NAMA_TIDAK_TERCATAT}
            {js.nip ? ` — NIP ${js.nip}` : " — NIP tidak tercatat"}
            {` (${js.relaas} relaas, ${js.pemberitahuan} pemberitahuan)`}
          </p>
          {js.nama === NAMA_TIDAK_TERCATAT || !js.nama ? (
            <p style={{ margin: "0 0 3px", fontSize: "8.5pt", fontFamily: "sans-serif" }}>
              Juru sitanya tidak dapat ditentukan dari SIPP. Barisnya tetap dicetak supaya
              tidak hilang dari hitungan.
            </p>
          ) : null}

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "8.5pt",
              fontFamily: "sans-serif",
            }}
          >
            <thead>
              <tr>
                {[
                  "No",
                  "Jenis",
                  "Golongan",
                  "Nomor Perkara",
                  "Jenis Perkara",
                  "Pihak",
                  "Dipanggil",
                  "Blangko",
                  "Relaas",
                  "Tanggal",
                  "Agenda",
                  "Cara",
                  "Resi",
                  "Pos",
                  "Berkas",
                  "Asal nama juru sita",
                ].map((judul) => (
                  <th
                    key={judul}
                    style={{
                      border: "1px solid #000",
                      padding: "4px 5px",
                      background: "#e8e8e8",
                      textAlign: "left",
                      fontWeight: 700,
                    }}
                  >
                    {judul}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {js.baris.map((baris, urutan) => {
                const nilai = nilaiBaris(baris);
                return (
                <tr key={`${baris.jenis}-${baris.perkaraId}-${baris.pihak}-${baris.resi}`}>
                  <td style={sel({ textAlign: "right" })}>{urutan + 1}</td>
                  <td style={sel()}>
                    {baris.jenis === "pemberitahuan" ? "Pemberitahuan" : "Panggilan"}
                  </td>
                  <td style={sel()}>
                    <div>{nilai.golongan.label}</div>
                    {nilai.nomorSidang.disebut ? (
                      <div style={{ fontSize: "8pt" }}>{nilai.nomorSidang.label}</div>
                    ) : null}
                  </td>
                  <td style={sel({ fontWeight: 600, whiteSpace: "nowrap" })}>
                    {baris.nomorPerkara || "—"}
                  </td>
                  <td style={sel()}>{baris.jenisPerkara || "—"}</td>
                  <td style={sel()}>
                    {baris.sebutanPihak ? (
                      <div style={{ fontStyle: "italic" }}>{baris.sebutanPihak}</div>
                    ) : null}
                    <div>{baris.pihak || "—"}</div>
                  </td>
                  {/* Pihak yang dipanggil beserta SEBABNYA ketika tidak
                      diketahui - di lapangan lembar inilah satu-satunya
                      keterangan yang dipegang juru sita. */}
                  <td style={sel({ fontSize: "8pt" })}>
                    <div>{nilai.pihak.label}</div>
                    {nilai.pihak.sebab ? (
                      <div style={{ fontStyle: "italic" }}>{nilai.pihak.sebab}</div>
                    ) : null}
                  </td>
                  <td style={sel({ fontSize: "8pt" })}>
                    {nilai.blangko.ada ? (
                      <>
                        <div>{nilai.blangko.label}</div>
                        <div style={{ fontFamily: "monospace", fontSize: "7.5pt" }}>
                          {nilai.blangko.berkas}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontWeight: 700 }}>belum dapat ditentukan</div>
                    )}
                    {nilai.blangko.sebab ? (
                      <div style={{ fontStyle: "italic" }}>{nilai.blangko.sebab}</div>
                    ) : null}
                  </td>
                  <td style={sel({ fontSize: "8pt", fontWeight: nilai.relaas === "belum" ? 700 : 400 })}>
                    {nilai.relaas === "sudah"
                      ? "sudah ada"
                      : nilai.relaas === "belum"
                        ? "BELUM ada"
                        : "tidak disebut"}
                  </td>
                  <td style={sel({ whiteSpace: "nowrap" })}>{tanggalBaris(baris) || "—"}</td>
                  <td style={sel()}>{baris.agenda || "—"}</td>
                  <td style={sel()}>{labelCara(baris.caraSandi, baris.caraLabel)}</td>
                  <td style={sel()}>{baris.resi || "—"}</td>
                  <td style={sel()}>{labelPos(baris.statusPos)}</td>
                  <td style={sel()}>{baris.adaBerkas ? "Ada" : "Belum"}</td>
                  <td style={sel({ fontSize: "8pt" })}>
                    <div>{labelSumber(baris.sumberJurusita)}</div>
                    {baris.berselisih ? (
                      <div style={{ fontWeight: 700 }}>
                        BERSELISIH - yang memanggil {baris.namaPanggilan || "tidak terbaca"}
                      </div>
                    ) : null}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <p style={{ marginTop: "8px", fontSize: "8pt", fontFamily: "sans-serif" }}>
        Dicetak dari ALETA pada {new Date().toLocaleString("id-ID")}. Sumber data: SIPP
        (perkara_pelaksanaan_relaas dan perkara_putusan_pemberitahuan_putusan). Nama juru sita
        pada pemberitahuan putusan disimpulkan dari penunjukan yang masih aktif pada perkaranya.
      </p>
    </div>
  );

  return createPortal(isi, document.body);
}
