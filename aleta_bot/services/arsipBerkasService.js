"use strict";

/**
 * ============================================================================
 * BERKAS PINDAIAN ARSIP PERKARA - MENCARINYA, BUKAN MEMBACANYA DARI DATABASE
 * ============================================================================
 *
 * Berkas pindaian arsip ada di SIPP, di bawah dokumen_arsip, disusun menurut
 * letak fisiknya. Diukur di PA Donggala: 4.128 berkas, 32 GB.
 *
 *   dokumen_arsip/<no_ruang>/<no_lemari>/<no_rak>/<no_berkas>/Arsip_<nomor>.pdf
 *   dokumen_arsip/I/XII/I/46/Arsip_317_Pdt_G_2026_PA_Dgl.pdf
 *
 * Nomor perkaranya ditulis dengan titik dan garis miring diganti garis bawah:
 * 317/Pdt.G/2026/PA.Dgl menjadi 317_Pdt_G_2026_PA_Dgl.
 *
 * ============================================================================
 * TABEL arsip TIDAK MENYIMPAN NAMA BERKASNYA - SAMA SEKALI
 * ============================================================================
 *
 * Diperiksa lewat SHOW COLUMNS: tabel arsip hanya memuat letak fisik, nomor
 * arsip, tanggal, dan nama petugas. Tidak ada satu pun kolom berkas. Karena
 * itu ALETA selama ini menyimpulkan "tidak ada berkas" untuk SELURUH perkara -
 * bukan karena berkasnya tidak ada, melainkan karena yang ditanya kolom yang
 * memang tidak pernah ada.
 *
 * Jalurnya karena itu harus DISUSUN, bukan dibaca.
 *
 * ============================================================================
 * DAN JALUR SUSUNAN SAJA TIDAK CUKUP
 * ============================================================================
 *
 * Letak arsip dapat disunting di SIPP - lemari dinomori ulang, rak dipindah.
 * Berkas yang sudah terlanjur ditulis TETAP di jalur lama, sebab yang berubah
 * hanya barisnya. Diukur: 307 berkas berkeadaan begitu.
 *
 *   di disk        dokumen_arsip/1/1/1/1/Arsip_1_Pdt_G_2022_PA_Dgl.pdf
 *   menurut basis  dokumen_arsip/1/X/1/1/Arsip_1_Pdt_G_2022_PA_Dgl.pdf
 *
 * Pencarian yang hanya mengandalkan jalur susunan akan menyatakan 307 berkas
 * itu HILANG padahal ada, lalu menyembunyikan tombol unduhnya. Karena itu ada
 * jalan kedua: menelusuri NAMA berkasnya di seluruh pohon dokumen_arsip.
 *
 * Yang dilaporkan selalu menyebut jalan mana yang dipakai, supaya berkas yang
 * ketemu di luar letak semestinya dapat dibetulkan letaknya - bukan dibiarkan
 * karena toh tetap terunduh.
 *
 * ============================================================================
 * INDEKS DISIMPAN SEBENTAR, SEBAB POHONNYA BESAR
 * ============================================================================
 *
 * Menelusuri 32 GB untuk tiap permintaan tidak masuk akal. Yang ditelusuri
 * sebenarnya hanya NAMA berkasnya - isinya tidak dibaca sama sekali - tetapi
 * tetap berarti membaca ribuan entri direktori.
 *
 * Karena itu indeks nama disimpan sebentar. TTL-nya pendek dengan sengaja:
 * berkas baru dipindai petugas arsip setiap hari, dan indeks yang basi akan
 * menyatakan berkas yang baru diunggah belum ada.
 *
 * Akses ke SIPP tetap BACA SAJA. Modul ini tidak pernah menulis apa pun.
 */

const fs = require("fs");
const path = require("path");

const sippDocumentService = require("./sippDocumentService");

/** Folder akar arsip di dalam SIPP. */
const FOLDER_ARSIP = "dokumen_arsip";

/** Umur indeks nama berkas. Pendek - lihat catatan di atas. */
const UMUR_INDEKS_MS = Number(process.env.ALETA_BOT_ARSIP_INDEKS_MS || 10 * 60 * 1000);

/**
 * Batas penelusuran. Bukan karena diperkirakan tercapai - 4.128 berkas jauh di
 * bawahnya - melainkan supaya salah pasang mount (misalnya akar SIPP tertukar
 * dengan akar sistem) berhenti sendiri, bukan menggantung permintaan.
 */
const BATAS_BERKAS = Number(process.env.ALETA_BOT_ARSIP_BATAS_BERKAS || 200000);
const BATAS_DALAM = 8;

let indeks = null;
let indeksPada = 0;
let indeksAkar = "";

/**
 * Nama berkas pindaian satu perkara.
 *
 * Titik DAN garis miring sama-sama menjadi garis bawah - itulah yang dipakai
 * SIPP. "317/Pdt.G/2026/PA.Dgl" menjadi "Arsip_317_Pdt_G_2026_PA_Dgl.pdf".
 */
function namaBerkas(nomorPerkara) {
  const nomor = String(nomorPerkara || "").trim();
  if (!nomor) return "";
  return `Arsip_${nomor.replace(/[./]/g, "_")}.pdf`;
}

/**
 * Jalur menurut letak fisik yang tercatat pada barisnya.
 *
 * Memulangkan kosong bila salah satu keping letaknya tidak ada - jalur
 * setengah jadi hanya akan menunjuk folder yang salah, dan menebak kepingan
 * yang hilang lebih buruk daripada mengaku tidak tahu.
 */
function jalurSusunan(baris) {
  const b = baris || {};
  const nama = namaBerkas(b.nomorPerkara);
  if (!nama) return "";
  const keping = [b.ruang, b.lemari, b.rak, b.box].map((x) => String(x === undefined || x === null ? "" : x).trim());
  if (keping.some((x) => !x)) return "";
  // Keping letak tidak boleh membawa pemisah jalur. Nilainya datang dari SIPP,
  // bukan dari peramban, tetapi jalur disusun di sini - dan jalur yang disusun
  // dari isi basis data tetap harus tidak dapat keluar dari foldernya.
  if (keping.some((x) => /[\\/]/.test(x) || x === "." || x === "..")) return "";
  return [FOLDER_ARSIP, ...keping, nama].join("/");
}

/** Akar SIPP pertama yang benar-benar memuat folder arsip. */
function akarArsip() {
  for (const akar of sippDocumentService.SIPP_DOCUMENT_ROOTS) {
    const calon = path.resolve(akar, FOLDER_ARSIP);
    try {
      if (fs.statSync(calon).isDirectory()) return calon;
    } catch (_) {
      // Akar berikutnya.
    }
  }
  return "";
}

/**
 * Menyusun indeks nama berkas.
 *
 * Kuncinya nama berkas huruf kecil. Ada satu baris arsip yang nomor perkaranya
 * tertulis "PA.dgl" sedangkan berkasnya "PA.Dgl" - pada berkas sistem yang
 * membedakan huruf besar-kecil, perbedaan itu saja sudah cukup membuatnya
 * tidak ketemu.
 *
 * Satu nama dapat menunjuk lebih dari satu jalur bila berkasnya pernah
 * berpindah letak dan salinan lamanya tertinggal. Semuanya disimpan, dan yang
 * dipakai kemudian yang paling baru diubah.
 */
function susunIndeks(akar) {
  const peta = new Map();
  let jumlah = 0;

  const telusuri = (folder, dalam) => {
    if (dalam > BATAS_DALAM || jumlah >= BATAS_BERKAS) return;
    let isi;
    try {
      isi = fs.readdirSync(folder, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const butir of isi) {
      if (jumlah >= BATAS_BERKAS) return;
      const penuh = path.join(folder, butir.name);
      if (butir.isDirectory()) {
        telusuri(penuh, dalam + 1);
      } else if (butir.isFile() && butir.name.toLowerCase().endsWith(".pdf")) {
        jumlah += 1;
        const kunci = butir.name.toLowerCase();
        const daftar = peta.get(kunci);
        if (daftar) daftar.push(penuh);
        else peta.set(kunci, [penuh]);
      }
    }
  };

  telusuri(akar, 0);
  return { peta, jumlah };
}

function indeksSiap() {
  const akar = akarArsip();
  if (!akar) {
    indeks = null;
    indeksAkar = "";
    return null;
  }
  const kedaluwarsa = !indeks || akar !== indeksAkar || Date.now() - indeksPada > UMUR_INDEKS_MS;
  if (kedaluwarsa) {
    const hasil = susunIndeks(akar);
    indeks = hasil.peta;
    indeksPada = Date.now();
    indeksAkar = akar;
  }
  return indeks;
}

/** Membuang indeks - dipakai uji, dan bila petugas arsip baru mengunggah. */
function lupakanIndeks() {
  indeks = null;
  indeksPada = 0;
  indeksAkar = "";
}

function keteranganBerkas(jalurNyata) {
  try {
    const s = fs.statSync(jalurNyata);
    if (!s.isFile()) return null;
    return { besar: s.size, diubah: new Date(s.mtime).toISOString().slice(0, 10) };
  } catch (_) {
    return null;
  }
}

/**
 * Mencari berkas pindaian satu baris arsip.
 *
 * @param baris { ruang, lemari, rak, box, nomorPerkara }
 * @returns {{
 *   ada: boolean, jalur: string, jalurSusunan: string, cara: string,
 *   besar: number|null, diubah: string, alasan: string
 * }}
 *   `jalur` relatif terhadap akar SIPP, siap dilewatkan sippDocumentService.
 *   `cara` bernilai "letak" bila ketemu di tempat semestinya, "nama" bila
 *   ketemu di tempat lain lewat penelusuran nama.
 */
function cariBerkas(baris) {
  const kosong = { ada: false, jalur: "", jalurSusunan: "", cara: "", besar: null, diubah: "", alasan: "" };

  const nama = namaBerkas(baris && baris.nomorPerkara);
  if (!nama) return { ...kosong, alasan: "Nomor perkara tidak diketahui." };

  const akar = akarArsip();
  if (!akar) {
    return {
      ...kosong,
      alasan: `Folder ${FOLDER_ARSIP} tidak terbaca dari container. Akar yang dicoba: ${sippDocumentService.SIPP_DOCUMENT_ROOTS.join(", ")}.`,
    };
  }

  const relatif = jalurSusunan(baris);

  // Jalan pertama: tempat semestinya menurut letak yang tercatat.
  if (relatif) {
    const penuh = path.resolve(path.dirname(akar), ...relatif.split("/"));
    const ket = keteranganBerkas(penuh);
    if (ket) {
      return { ada: true, jalur: relatif, jalurSusunan: relatif, cara: "letak", besar: ket.besar, diubah: ket.diubah, alasan: "" };
    }
  }

  // Jalan kedua: menelusuri namanya. Inilah yang menemukan berkas yang
  // letaknya pernah disunting sesudah berkasnya ditulis.
  const peta = indeksSiap();
  const calon = peta ? peta.get(nama.toLowerCase()) || [] : [];
  if (calon.length === 0) {
    return {
      ...kosong,
      jalurSusunan: relatif,
      alasan: relatif
        ? "Berkas pindaian belum ada - tidak di letak yang tercatat, dan namanya tidak ditemukan di folder arsip."
        : "Letak arsip belum lengkap dicatat, dan nama berkasnya tidak ditemukan di folder arsip.",
    };
  }

  // Yang paling baru diubah - bila ada salinan lama yang tertinggal, yang
  // dipakai yang terbaru.
  let terpilih = "";
  let terbaru = -1;
  let ketTerpilih = null;
  for (const penuh of calon) {
    const ket = keteranganBerkas(penuh);
    if (!ket) continue;
    const waktu = new Date(ket.diubah).getTime();
    if (waktu > terbaru) {
      terbaru = waktu;
      terpilih = penuh;
      ketTerpilih = ket;
    }
  }
  if (!terpilih || !ketTerpilih) {
    return { ...kosong, jalurSusunan: relatif, alasan: "Berkas terdaftar pada indeks tetapi tidak dapat dibaca." };
  }

  const relatifNyata = path.relative(path.dirname(akar), terpilih).replace(/\\/g, "/");
  return {
    ada: true,
    jalur: relatifNyata,
    jalurSusunan: relatif,
    cara: "nama",
    besar: ketTerpilih.besar,
    diubah: ketTerpilih.diubah,
    alasan: relatif
      ? `Berkas ada, tetapi TIDAK di letak yang tercatat. Tercatat ${relatif}, sebenarnya ${relatifNyata} - letak arsipnya kemungkinan disunting sesudah berkasnya dipindai.`
      : `Berkas ada di ${relatifNyata}, sedangkan letak arsipnya belum lengkap dicatat.`,
  };
}

/** Keadaan indeks - untuk layar diagnosa dan uji. */
function keadaanIndeks() {
  const akar = akarArsip();
  return {
    akar,
    terbaca: Boolean(akar),
    jumlahNama: indeks ? indeks.size : 0,
    disusunPada: indeksPada ? new Date(indeksPada).toISOString() : "",
    umurMs: UMUR_INDEKS_MS,
  };
}

module.exports = {
  FOLDER_ARSIP,
  namaBerkas,
  jalurSusunan,
  cariBerkas,
  akarArsip,
  keadaanIndeks,
  lupakanIndeks,
  // Diekspor untuk diuji satuan.
  susunIndeks,
};
