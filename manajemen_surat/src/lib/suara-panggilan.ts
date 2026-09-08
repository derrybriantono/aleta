"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

/**
 * ============================================================================
 * SUARA PANGGILAN SIDANG - DIPILIH PETUGAS, BUKAN DIPILIHKAN PERAMBAN
 * ============================================================================
 *
 * Panggilan memakai pengucap bawaan peramban (Web Speech API): tidak ada
 * berkas suara yang diunduh, tidak ada layanan luar yang dihubungi, dan tidak
 * ada internet yang diperlukan - penting, sebab pengeras suara ruang tunggu
 * pengadilan ini berada di jaringan lokal.
 *
 * Sebelumnya kalimatnya hanya diberi lang = "id-ID" lalu diserahkan kepada
 * peramban. Itu bukan pilihan; itu penyerahan. Chrome memuat beberapa suara
 * Indonesia sekaligus - beberapa jernih, beberapa datar dan sengau - dan mana
 * yang terpakai bergantung urutan yang tidak dapat diramalkan. Pada pengeras
 * suara ruang tunggu yang memantul, bedanya menentukan apakah nomor antrian
 * terdengar atau tidak.
 *
 * Karena itu suaranya dipilih petugas, dicoba lebih dulu, dan diingat.
 *
 * ============================================================================
 * MENGAPA DAFTARNYA KADANG KOSONG SEBENTAR
 * ============================================================================
 *
 * getVoices() pada Chrome memulangkan daftar KOSONG pada pemanggilan pertama;
 * suaranya dimuat menyusul, dan barulah peristiwa voiceschanged menyala. Kode
 * yang membaca sekali lalu menyimpulkan "tidak ada suara Indonesia" akan salah
 * pada hampir setiap muat pertama - dan salahnya tidak kelihatan, sebab
 * peramban tetap berbicara dengan suara bawaannya.
 *
 * Karena itu daftarnya dibaca ulang pada voiceschanged, bukan sekali saja.
 */

export type SuaraPilihan = {
  /** Pengenal tetap milik peramban - inilah yang disimpan, bukan namanya. */
  uri: string;
  nama: string;
  bahasa: string;
  /** Suara yang terpasang di perangkat, bukan yang perlu jaringan. */
  lokal: boolean;
};

const KUNCI_SIMPAN = "aleta.antrian.suara";

/**
 * Kalimat yang diucapkan pelan dan agak rendah.
 *
 * Pengeras suara ruang tunggu memantul, dan kalimat yang diucapkan cepat
 * berubah menjadi bunyi yang tidak dapat dibedakan.
 */
const LAJU = 0.9;
const NADA = 1;

function bahasaIndonesia(kode: string) {
  return /^id\b/i.test(String(kode || "").replace("_", "-"));
}

/**
 * Seluruh suara yang tersedia, yang berbahasa Indonesia lebih dahulu.
 *
 * Yang bukan bahasa Indonesia TIDAK dibuang. Sebagian perangkat - terutama
 * Linux tanpa paket suara tambahan - tidak punya satu pun suara Indonesia, dan
 * daftar kosong akan membuat layarnya tampak rusak. Lebih baik menyodorkan
 * suara Inggris yang mengucapkan angka Indonesia dengan janggal daripada
 * membisu tanpa keterangan.
 */
export function daftarSuara(): SuaraPilihan[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const semua = window.speechSynthesis.getVoices() || [];
  return semua
    .map((s) => ({
      uri: s.voiceURI,
      nama: s.name,
      bahasa: s.lang,
      lokal: s.localService,
    }))
    .sort((a, b) => {
      const ai = bahasaIndonesia(a.bahasa) ? 0 : 1;
      const bi = bahasaIndonesia(b.bahasa) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      // Di dalam kelompok yang sama, suara yang terpasang di perangkat lebih
      // dahulu - ia tidak pernah gagal karena jaringan.
      if (a.lokal !== b.lokal) return a.lokal ? -1 : 1;
      return a.nama.localeCompare(b.nama);
    });
}

/** Suara Indonesia pertama, atau kosong bila perangkatnya tidak punya. */
export function suaraIndonesiaBawaan(daftar: SuaraPilihan[]): string {
  const id = daftar.find((x) => bahasaIndonesia(x.bahasa));
  return id ? id.uri : "";
}

export function bacaPilihanTersimpan(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KUNCI_SIMPAN) || "";
  } catch {
    // Peramban yang melarang penyimpanan - pilihannya berlaku sesi ini saja.
    return "";
  }
}

export function simpanPilihan(uri: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KUNCI_SIMPAN, uri);
  } catch {
    // Tidak menggagalkan apa pun: yang hilang hanya ingatannya.
  }
}

/**
 * Mengucapkan satu kalimat.
 *
 * ANTRE, bukan menimpa. Dua panggilan yang berdekatan harus terdengar dua
 * kali - yang tertimpa berarti ada orang yang tidak pernah dipanggil.
 */
export function ucapkan(kalimat: string, uriSuara = "") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const teks = String(kalimat || "").trim();
  if (!teks) return false;

  const ucapan = new SpeechSynthesisUtterance(teks);
  ucapan.rate = LAJU;
  ucapan.pitch = NADA;
  ucapan.lang = "id-ID";

  if (uriSuara) {
    const pilih = (window.speechSynthesis.getVoices() || []).find((s) => s.voiceURI === uriSuara);
    if (pilih) {
      ucapan.voice = pilih;
      // Bahasa mengikuti suaranya. Memaksakan id-ID pada suara Inggris membuat
      // sebagian peramban menolak keduanya lalu diam sama sekali.
      ucapan.lang = pilih.lang;
    }
  }

  window.speechSynthesis.speak(ucapan);
  return true;
}

/** Menghentikan seluruh antrean ucapan - dipakai tombol berhenti. */
export function hentikanUcapan() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

/**
 * ============================================================================
 * DAFTAR SUARA ADALAH SISTEM LUAR, BUKAN STATE REACT
 * ============================================================================
 *
 * Godaannya menaruh daftar suara di useState lalu mengisinya dari useEffect.
 * Itu keliru dua kali: memanggil setState di dalam badan efek memicu render
 * beruntun - dan aturan lint proyek ini menolaknya - sedangkan daftar suara
 * memang bukan milik React. Ia milik peramban, berubah sendiri, dan
 * mengabarkan perubahannya lewat peristiwa voiceschanged.
 *
 * useSyncExternalStore adalah alat yang tepat untuk keadaan seperti itu:
 * berlangganan ke sumbernya, membaca cuplikannya, dan memulangkan cuplikan
 * kosong yang tetap ketika dirender di server.
 *
 * Satu syaratnya: getSnapshot harus memulangkan rujukan yang SAMA selama isinya
 * tidak berubah. Menyusun larik baru tiap panggilan akan membuat React
 * menyimpulkan datanya berubah terus, lalu merender tanpa henti. Karena itu
 * hasilnya disinggahkan dan dibandingkan lewat kunci gabungan URI-nya.
 */
const KOSONG: SuaraPilihan[] = [];
let singgahKunci = "";
let singgahDaftar: SuaraPilihan[] = KOSONG;

function cuplikanSuara(): SuaraPilihan[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return KOSONG;
  const mentah = window.speechSynthesis.getVoices() || [];
  const kunci = mentah.map((s) => s.voiceURI).join("|");
  if (kunci === singgahKunci) return singgahDaftar;
  singgahKunci = kunci;
  singgahDaftar = daftarSuara();
  return singgahDaftar;
}

function cuplikanPeladen(): SuaraPilihan[] {
  return KOSONG;
}

function berlangganan(beritahu: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", beritahu);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", beritahu);
}

/** Apakah peramban ini punya Web Speech API sama sekali. */
function adaPengucap() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Daftar suara beserta pilihan petugas yang diingat.
 *
 * `didukung` salah pada peramban tanpa Web Speech API - layar yang memakainya
 * menyembunyikan seluruh kendali suara, bukan menampilkan tombol yang tidak
 * melakukan apa pun.
 */
export function useSuaraPanggilan() {
  const daftar = useSyncExternalStore(berlangganan, cuplikanSuara, cuplikanPeladen);
  // Dilanggan dengan cara yang sama supaya nilainya di peladen selalu false,
  // dan hidrasinya tidak berselisih dengan hasil render di peramban.
  const didukung = useSyncExternalStore(
    () => () => {},
    adaPengucap,
    () => false
  );

  const [pilihanPetugas, setPilihanPetugas] = useState("");

  /**
   * Urutan pemilihannya: pilihan petugas pada sesi ini, lalu yang diingat dari
   * sesi sebelumnya, lalu suara Indonesia pertama.
   *
   * Pilihan yang sudah tidak ada di daftar - suaranya hilang sesudah sistem
   * diperbarui - dilewati, bukan dipertahankan. Mempertahankannya membuat
   * pemilihnya menampilkan pilihan kosong tanpa sebab.
   */
  const terpilih = useMemo(() => {
    if (pilihanPetugas && daftar.some((x) => x.uri === pilihanPetugas)) return pilihanPetugas;
    const tersimpan = bacaPilihanTersimpan();
    if (tersimpan && daftar.some((x) => x.uri === tersimpan)) return tersimpan;
    return suaraIndonesiaBawaan(daftar);
  }, [pilihanPetugas, daftar]);

  const pilih = useCallback((uri: string) => {
    setPilihanPetugas(uri);
    simpanPilihan(uri);
  }, []);

  const bunyikan = useCallback((kalimat: string) => ucapkan(kalimat, terpilih), [terpilih]);

  return { daftar, terpilih, pilih, bunyikan, didukung };
}
